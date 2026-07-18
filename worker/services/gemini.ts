/**
 * Gemini API service — direct fetch to the REST API.
 * The @google/genai SDK doesn't work on Cloudflare Workers,
 * so we use the REST API directly.
 */

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

interface GeminiContent {
  parts: GeminiPart[];
  role?: string;
}

interface GeminiRequest {
  contents: GeminiContent[];
  systemInstruction?: { parts: { text: string }[] };
  tools?: Array<Record<string, unknown>>;
}

interface GeminiResponse {
  candidates?: Array<{
    content: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

function getResponseText(data: GeminiResponse): string {
  const text = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || '')
    .join('')
    .trim();

  if (!text) {
    throw new Error('Gemini returned no usable text');
  }

  return text;
}

/**
 * Generate text content using a specified Gemini model (defaults to Gemini 2.5 Pro).
 */
export async function generateContent(
  apiKey: string,
  prompt: string,
  systemInstruction?: string,
  model: string = 'gemini-2.5-pro'
): Promise<string> {
  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

  const body: GeminiRequest = {
    contents: [{ parts: [{ text: prompt }] }],
  };

  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Gemini API error:', error);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = (await response.json()) as GeminiResponse;
  return getResponseText(data);
}

/**
 * Generate content with Google Search grounding (for template generation).
 */
export async function generateContentWithSearch(
  apiKey: string,
  prompt: string,
  model: string = 'gemini-2.5-pro'
): Promise<string> {
  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

  const body: GeminiRequest = {
    contents: [{ parts: [{ text: prompt }] }],
    tools: [{ googleSearch: {} }],
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Gemini API error (search):', error);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = (await response.json()) as GeminiResponse;
  return getResponseText(data);
}

/**
 * Transcribe audio using Gemini with inline audio data.
 * Always defaults to Gemini 2.5 Flash for speed, cost-efficiency, and stability.
 */
export async function transcribeAudio(
  apiKey: string,
  audioData: string,
  mimeType: string,
  keywords?: string,
  model: string = 'gemini-2.5-flash'
): Promise<string> {
  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

  let prompt = "Transcris le texte de cet enregistrement audio. Il s'agit d'une dictée médicale en français pour un compte rendu de radiologie.";

  if (keywords) {
    prompt += ` Fais particulièrement attention aux termes suivants, qui sont très probables d'apparaître : ${keywords}`;
  }

  const body: GeminiRequest = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType,
              data: audioData,
            },
          },
        ],
      },
    ],
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Gemini transcription error:', error);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = (await response.json()) as GeminiResponse;
  return getResponseText(data);
}
