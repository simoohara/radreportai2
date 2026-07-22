import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { HonoEnv } from '../types';
import { isAuthenticated } from '../middleware/auth';
import { generateContent, generateContentWithSearch, transcribeAudio } from '../services/gemini';
import { checkAndDecrementQuota, refundQuota, checkAndDecrementTranscriptionQuota, refundTranscriptionQuota } from '../services/quota';
import { transcriptionLimiter } from '../middleware/rateLimit';
import { sendFacebookEvent, sendGAEvent } from '../services/analytics';

const app = new Hono<HonoEnv>();

// 1MB limit for most AI routes
const standardLimit = bodyLimit({ maxSize: 1 * 1024 * 1024, onError: (c) => c.json({ error: 'Payload Too Large' }, 413) });
// 10MB limit for transcription
const largeLimit = bodyLimit({ maxSize: 10 * 1024 * 1024, onError: (c) => c.json({ error: 'Payload Too Large' }, 413) });

app.use('/generate', standardLimit);
app.use('/summarize-report', standardLimit);
app.use('/generate-normal-template', standardLimit);
app.use('/format-template', standardLimit);
app.use('/transcribe', largeLimit, transcriptionLimiter);

// ─── System instructions & prompts (ported from old app) ────────────────────

const GENERATE_SYSTEM_INSTRUCTION = `Tu es un assistant expert en radiologie. Ta tâche est double :
1. Intégrer les informations des 'notes brutes' dans le 'modèle de compte rendu' HTML fourni, en respectant le niveau d'édition demandé. Les notes brutes sont la source de vérité principale. Si les notes contredisent une information du modèle, le contenu des notes DOIT remplacer celui du modèle.
2. Dans le rapport final que tu génères, identifier les RÉSULTATS PATHOLOGIQUES CLÉS et surligne-les en les enveloppant dans des balises \`<mark class="ai-highlight">\`. Ne surligne PAS les résultats normaux ou non significatifs.

La sortie doit être UNIQUEMENT du code HTML propre, sans texte explicatif ni démarqueurs de code.`;

const EDIT_PROMPTS: Record<string, string> = {
  prudent: `
    1. Intègre les informations des notes dans les sections appropriées du modèle.
    2. Ne modifie que le strict nécessaire pour rendre le rapport cohérent.
    3. Conserve la structure et le phrasé du modèle autant que possible.
    4. Remplis les champs vides (comme [....]) avec les informations pertinentes des notes.
    5. Ne supprime aucune section du modèle original, même si les notes n'en parlent pas.
    6. Corrige uniquement les fautes d'orthographe et de grammaire évidentes dans les notes.
    7. Assure-toi que la conclusion reflète les observations des notes.`,
  equilibre: `
    1. Fusionne intelligemment les informations des notes dans le modèle de compte rendu.
    2. Adapte le style et la terminologie du modèle pour qu'ils correspondent aux observations des notes, tout en restant professionnel.
    3. Reformule légèrement les phrases pour une meilleure fluidité et clarté.
    4. Si les notes contredisent une partie du modèle "normal", remplace cette partie par les observations des notes.
    5. Remplis les champs vides et ajoute des détails pertinents si les notes le suggèrent.
    6. Synthétise la conclusion pour qu'elle résume précisément les points clés des notes.`,
  ameliore: `
    1. Réécris entièrement le compte rendu en utilisant le modèle comme guide structurel et les notes comme source d'information principale.
    2. Adopte un style de rédaction clair, concis et professionnel, typique d'un rapport de radiologie de haute qualité.
    3. Organise les informations de manière logique, même si cela implique de restructurer l'ordre du modèle initial.
    4. Enrichis le rapport avec des détails anatomiques et sémiologiques pertinents implicites dans les notes, si cela est approprié.
    5. Assure-toi que le rapport final est un document complet, cohérent et prêt à être signé, sans laisser de sections vides non pertinentes.
    6. Formule une conclusion percutante qui répond directement à l'indication clinique si elle est mentionnée dans les notes.`,
};

const EXAMPLE_TEMPLATE = `
<p><strong>RÉSULTATS :</strong></p>
<p>Le parenchyme cérébral présente une différenciation substance grise / substance blanche normale.</p>
<p>Le système ventriculaire est de taille et de configuration normales.</p>
<p><strong>CONCLUSION :</strong></p>
<p>Examen cérébral sans anomalie.</p>
`;
const EXAMPLE_NOTES = "On note un hypersignal flair périventriculaire. Conclusion : leucoaraïose.";
const EXAMPLE_OUTPUT = `
<p><strong>RÉSULTATS :</strong></p>
<p>Le parenchyme cérébral présente une différenciation substance grise / substance blanche normale.</p>
<p><mark class="ai-highlight">Présence d'un hypersignal FLAIR de la substance blanche périventriculaire, compatible avec une leucoaraïose.</mark></p>
<p>Le système ventriculaire est de taille et de configuration normales.</p>
<p><strong>CONCLUSION :</strong></p>
<p>Leucoaraïose.</p>
`;

const SUMMARIZE_SYSTEM_INSTRUCTION = `Tu es un assistant radiologue expert en synthèse. Ta mission est double :
1. Transformer un compte rendu détaillé en une version concise et télégraphique.
2. Dans cette version synthétisée, identifier les RÉSULTATS PATHOLOGIQUES CLÉS et les surligner en les enveloppant dans des balises <mark class="ai-highlight">. 
Ne surligne PAS les résultats normaux ou non significatifs. Le format de sortie doit être UNIQUEMENT du code HTML propre.`;

const SUMMARIZE_EXAMPLE_INPUT = `
<p><strong>INDICATION :</strong></p><p>Céphalées.</p><p><strong>RÉSULTATS :</strong></p><p>Le parenchyme cérébral présente une différenciation substance grise/substance blanche normale.</p><p>Présence d'un hypersignal FLAIR de la substance blanche périventriculaire, compatible avec une leucoaraïose grade 2 de Fazekas.</p><p>Le système ventriculaire est de taille normale et symétrique.</p><p><strong>CONCLUSION :</strong></p><p>Leucoaraïose grade 2 de Fazekas.</p>
`;

const SUMMARIZE_EXAMPLE_OUTPUT = `
<p><strong>Indication :</strong></p><p>Céphalées.</p><p><strong>Résultat :</strong></p><p>Différenciation substance grise/blanche normale.</p><p><mark class="ai-highlight">Hypersignal FLAIR périventriculaire compatible avec une leucoaraïose grade 2.</mark></p><p>Système ventriculaire en place.</p><p><strong>Conclusion :</strong></p><p>Leucoaraïose grade 2 de Fazekas.</p>
`;

// ─── Routes ─────────────────────────────────────────────────────────────────

/**
 * POST /api/generate — Generate a radiology report from template + notes.
 */
app.post('/generate', isAuthenticated, async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{
    template: string;
    notes: string;
    editLevel: string;
    modality?: string;
  }>();

  if (!body.template || !body.notes || !body.editLevel) {
    return c.json({ error: 'Missing required fields: template, notes, or editLevel' }, 400);
  }

  const specificInstructions = EDIT_PROMPTS[body.editLevel];
  if (!specificInstructions) {
    return c.json({ error: 'Invalid editLevel' }, 400);
  }

  const quotaCheck = await checkAndDecrementQuota(c.env.DB, user);
  if (!quotaCheck.canProceed) {
    return c.json({ error: quotaCheck.error }, 402);
  }

  try {
    const fullPrompt = `${specificInstructions}

--- EXEMPLE ---
MODÈLE DE COMPTE RENDU (EXEMPLE):
${EXAMPLE_TEMPLATE}

NOTES BRUTES (EXEMPLE):
${EXAMPLE_NOTES}

SORTIE ATTENDUE (EXEMPLE):
${EXAMPLE_OUTPUT}
--- FIN DE L'EXEMPLE ---

--- TÂCHE RÉELLE ---
MODÈLE DE COMPTE RENDU:
${body.template}

NOTES BRUTES:
${body.notes}`;

    const text = await generateContent(c.env.API_KEY, fullPrompt, GENERATE_SYSTEM_INSTRUCTION);

    c.executionCtx.waitUntil(
      Promise.all([
        sendFacebookEvent(c.env, 'GenerateReport', { email: user.email }, { modality: body.modality || 'unknown' }, c.req.url),
        sendGAEvent(c.env, 'generate_report', { modality: body.modality || 'unknown' }, user.id),
      ])
    );

    return c.json({ text });
  } catch (error) {
    await refundQuota(c.env.DB, user).catch((refundError) => {
      console.error('Failed to refund generation quota:', refundError);
    });
    console.error('Error with Gemini API:', error);
    return c.json({ error: 'Failed to generate report from Gemini API' }, 500);
  }
});

/**
 * POST /api/summarize-report — Summarize a report into a concise version.
 */
app.post('/summarize-report', isAuthenticated, async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{ reportContent: string }>();
  if (!body.reportContent) {
    return c.json({ error: 'reportContent is required.' }, 400);
  }

  const quotaCheck = await checkAndDecrementQuota(c.env.DB, user);
  if (!quotaCheck.canProceed) {
    return c.json({ error: quotaCheck.error }, 402);
  }

  try {
    const fullPrompt = `Effectue les deux tâches suivantes sur le "COMPTE RENDU À TRAITER":
1.  Transforme le compte rendu en une version courte et télégraphique, en suivant le style de l'exemple fourni.
2.  Dans le nouveau texte synthétisé, analyse les résultats et enveloppe UNIQUEMENT les phrases décrivant des anomalies ou des résultats pathologiques significatifs avec la balise <mark class="ai-highlight">. Laisse les descriptions de normalité sans surlignage.

--- EXEMPLE ENTRÉE ---
${SUMMARIZE_EXAMPLE_INPUT}

--- EXEMPLE SORTIE ---
${SUMMARIZE_EXAMPLE_OUTPUT}

--- COMPTE RENDU À TRAITER ---
${body.reportContent}`;

    const text = await generateContent(c.env.API_KEY, fullPrompt, SUMMARIZE_SYSTEM_INSTRUCTION);
    const cleanedText = text.replace(/```html/g, '').replace(/```/g, '').trim();

    return c.json({ text: cleanedText });
  } catch (error) {
    await refundQuota(c.env.DB, user).catch((refundError) => {
      console.error('Failed to refund generation quota:', refundError);
    });
    console.error('Error summarizing report:', error);
    return c.json({ error: 'Failed to summarize report' }, 500);
  }
});

/**
 * POST /api/generate-normal-template — Generate a "normal exam" template with Google Search.
 */
app.post('/generate-normal-template', isAuthenticated, async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{
    modality: string;
    region: string;
    gender?: string;
    laterality?: string;
    indication?: string;
  }>();

  if (!body.modality || !body.region) {
    return c.json({ error: 'Modality and region are required' }, 400);
  }

  const quotaCheck = await checkAndDecrementQuota(c.env.DB, user);
  if (!quotaCheck.canProceed) {
    return c.json({ error: quotaCheck.error }, 402);
  }

  const fullRegionDescription = [body.region, body.laterality, body.gender ? `(${body.gender})` : '']
    .filter(Boolean)
    .join(' ')
    .trim();

  const exampleTemplate = `
<div><h2><strong>Indication :</strong></h2><p></p></div><div><h2><strong>Technique :</strong></h2><p>Acquisition sans injection intraveineuse de produit de contraste.</p></div><div><h2><strong>R&eacute;sultat :</strong></h2><p>Absence de comparatif disponible.</p><p>Absence d&rsquo;anomalie significative de densit&eacute; du parenchyme c&eacute;r&eacute;bral.<br />Absence de saignement intracr&acirc;nien r&eacute;cent.<br />Syst&egrave;me ventriculaire sym&eacute;trique et de taille normale.<br />Absence d&rsquo;anomalie des espaces liquidiens p&eacute;ri-c&eacute;r&eacute;braux ou des citernes de la base.<br />Absence d&rsquo;effet de masse intracr&acirc;nien, notamment pas de d&eacute;viation des structures de la ligne m&eacute;diane ni d'engagement.<br />Bonne a&eacute;ration des cavit&eacute;s pneumatis&eacute;es.<br />Absence d'anomalie significative des structures osseuses, notamment pas de fracture.<br />Parties molles sans particularit&eacute;.</p></div><div><h2><strong>Conclusion :</strong></h2></div><p>Examen tomodensitom&eacute;trique c&eacute;r&eacute;bral sans particularit&eacute; significative.</p>
  `;

  try {
    const prompt = `
Tu es un expert radiologue rédacteur. Ta tâche est de générer un modèle de compte rendu HTML pour un examen radiologique considéré comme "normal".
Utilise l'outil de recherche pour identifier les points anatomiques et sémiologiques clés à vérifier pour ce type d'examen.

Examen demandé: ${body.modality} de la région: ${fullRegionDescription}.
Indication clinique fournie: "${body.indication || 'Non spécifiée'}"

Instructions STRICTES:
1. Rédige un modèle de compte rendu complet, professionnel et directement utilisable.
2. Le modèle doit décrire un examen SANS AUCUNE ANOMALIE.
3. Si une "Indication Clinique" est fournie, assure-toi que les sections "Résultats" et "Conclusion" y répondent spécifiquement (par exemple, si l'indication est "recherche de fracture", la conclusion doit mentionner "absence de fracture").
4. Structure le rapport avec les sections suivantes : "Indication", "Technique", "Résultat", et "Conclusion".
5. Remplis la section "Indication" avec l'indication clinique fournie. Si aucune n'est fournie, laisse le paragraphe vide.
6. Rédige une section "Technique" appropriée pour un examen de type "${body.modality}" de la région "${fullRegionDescription}".
7. Dans la section "Résultat", liste les observations clés pour un examen normal de la région "${body.region}", en t'inspirant des résultats de ta recherche. Chaque point doit être un paragraphe court et concis.
8. La "Conclusion" doit simplement indiquer que l'examen est sans anomalie significative, en tenant compte de l'indication clinique.
9. Le format de sortie doit être **UNIQUEMENT et STRICTEMENT du code HTML**, utilisant des balises <div>, <h2>, <strong>, et <p>.
10. **NE JAMAIS** inclure de citations de recherche (comme [1], [2, 5]).
11. **NE JAMAIS** renvoyer de texte explicatif, de commentaires ou de démarqueurs de code comme \`\`\`html. La sortie doit commencer par <div> et finir par </p>.
12. Inspire-toi du style et de la structure de l'exemple suivant:
--- EXEMPLE ---
${exampleTemplate}
---
`;

    const text = await generateContentWithSearch(c.env.API_KEY, prompt);
    const cleanedText = text.replace(/```html/g, '').replace(/```/g, '').trim();

    c.executionCtx.waitUntil(
      Promise.all([
        sendFacebookEvent(c.env, 'GenerateReport', { email: user.email }, { modality: body.modality || 'unknown', type: 'normal' }, c.req.url),
        sendGAEvent(c.env, 'generate_report', { modality: body.modality || 'unknown', type: 'normal' }, user.id),
      ])
    );

    return c.json({ content: cleanedText });
  } catch (error) {
    await refundQuota(c.env.DB, user).catch((refundError) => {
      console.error('Failed to refund generation quota:', refundError);
    });
    console.error('Error generating normal template:', error);
    return c.json({ error: 'Failed to generate normal template' }, 500);
  }
});

/**
 * POST /api/transcribe — Transcribe audio dictation using Gemini.
 */
app.post('/transcribe', isAuthenticated, async (c) => {
  const body = await c.req.json<{ audioData: string; mimeType?: string; keywords?: string }>();

  if (!body.audioData) {
    return c.json({ error: 'Audio data is required' }, 400);
  }

  const mimeType = (body.mimeType || 'audio/webm').split(';')[0].toLowerCase();
  const supportedMimeTypes = new Set(['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav']);
  const maxBase64Length = 14 * 1024 * 1024; // roughly 10 MB of audio before base64 encoding

  if (!supportedMimeTypes.has(mimeType)) {
    return c.json({ error: 'Unsupported audio format' }, 400);
  }
  if (body.audioData.length > maxBase64Length) {
    return c.json({ error: 'Audio recording is too large. Please record a shorter dictation.' }, 413);
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(body.audioData)) {
    return c.json({ error: 'Invalid audio data' }, 400);
  }

  const user = c.get('user');
  const quotaCheck = await checkAndDecrementTranscriptionQuota(c.env.DB, user);
  if (!quotaCheck.canProceed) {
    return c.json({ error: quotaCheck.error }, 402);
  }

  try {
    const transcription = await transcribeAudio(c.env.API_KEY, body.audioData, mimeType, body.keywords);
    return c.json({ transcription });
  } catch (error) {
    console.error('Error with transcription API:', error);
    await refundTranscriptionQuota(c.env.DB, user);
    return c.json({ error: 'Failed to transcribe audio' }, 500);
  }
});

/**
 * POST /api/format-template — Format an imported raw template using Gemini.
 */
app.post('/format-template', isAuthenticated, async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{ content: string }>();

  if (!body.content) {
    return c.json({ error: 'Content is required' }, 400);
  }

  const quotaCheck = await checkAndDecrementQuota(c.env.DB, user);
  if (!quotaCheck.canProceed) {
    return c.json({ error: quotaCheck.error }, 402);
  }

  try {
    const prompt = `Formate ce texte brut en un modèle de compte rendu radiologique HTML propre. 
Utilise des balises <div>, <h2> pour les titres de section (Indication, Technique, Résultats, Conclusion), <strong> pour mettre en évidence les éléments importants, et <p> pour les paragraphes. 
Ne modifie pas le contenu médical, structure-le simplement. 
Renvoie UNIQUEMENT le code HTML propre, sans aucun texte explicatif ni démarqueurs de code (comme \`\`\`html).
    
TEXTE BRUT :
${body.content}`;

    // Pass gemini-3.6-flash explicitly for speed on this formatting task
    const text = await generateContent(c.env.API_KEY, prompt, undefined, 'gemini-3.6-flash');
    const cleanedText = text.replace(/```html/g, '').replace(/```/g, '').trim();

    return c.json({ content: cleanedText });
  } catch (error) {
    await refundQuota(c.env.DB, user).catch(console.error);
    console.error('Error formatting template:', error);
    return c.json({ error: 'Failed to format template' }, 500);
  }
});

export default app;
