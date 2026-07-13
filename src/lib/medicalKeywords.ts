/**
 * Specialized keywords for speech-to-text transcription.
 * When a template with a matching name is loaded, these keywords
 * are sent to the Gemini transcription API to improve accuracy.
 */

const SPECIALIZED_KEYWORDS: Record<string, string> = {
  'cérébr': [
    "glioblastome", "astrocytome", "oligodendrogliome", "méningiome",
    "schwannome", "craniopharyngiome", "adénome hypophysaire",
    "médulloblastome", "épendymome", "hémangioblastome",
    "métastases cérébrales", "lymphome cérébral primitif",
    "anévrisme", "dissection", "AVC ischémique", "AVC hémorragique",
    "hémorragie sous-arachnoïdienne", "hématome sous-dural",
    "hématome extradural", "thrombose veineuse cérébrale",
    "malformation artério-veineuse", "angiome caverneux",
    "lacune ischémique", "microangiopathie chronique", "leucoaraïose",
    "sclérose en plaques", "neuromyélite optique",
    "hypersignal FLAIR", "diffusion restreinte", "ADC bas",
    "rehaussement annulaire", "hypersignal T2", "hyposignal T1",
    "abcès cérébral", "toxoplasmose cérébrale", "encéphalite herpétique",
    "maladie d'Alzheimer", "atrophie hippocampique",
    "kyste arachnoïdien", "malformation de Chiari",
    "hydrocéphalie", "encéphalopathie postérieure réversible"
  ].join(', '),

  'thorac': [
    "nodule pulmonaire", "micronodule", "nodule spiculé",
    "emphysème", "fibrose pulmonaire", "fibrose idiopathique",
    "atélectasie", "opacité en verre dépoli", "condensations alvéolaires",
    "pneumopathie interstitielle", "pneumopathie organisée",
    "tuberculose pulmonaire", "granulome calcifié",
    "épanchement pleural", "pleurésie", "empyème", "pneumothorax",
    "masse médiastinale", "thymome", "lymphome médiastinal",
    "adénopathie hilaire", "adénopathie médiastinale",
    "embolie pulmonaire", "hypertension pulmonaire",
    "dissection aortique", "anévrisme thoracique",
    "bronchectasie", "carcinome bronchique",
    "adénocarcinome pulmonaire", "métastases pulmonaires",
    "crazy paving", "arbre en bourgeons", "honeycombing"
  ].join(', '),

  'genou': [
    "lésion méniscale", "fissure méniscale", "déchirure méniscale",
    "rupture du LCA", "rupture du LCP",
    "ligament collatéral médial", "ligament collatéral latéral",
    "chondropathie", "chondromalacie", "ostéochondrite disséquante",
    "arthrose fémoro-tibiale", "arthrose fémoro-patellaire", "gonarthrose",
    "œdème osseux", "contusion osseuse", "fracture du plateau tibial",
    "ostéonécrose du condyle interne",
    "tendinopathie rotulienne", "tendinopathie quadricipitale",
    "syndrome de l'essuie-glace", "bursite anserine",
    "kyste poplité", "kyste paraméniscal",
    "lésion méniscale en anse de seau",
    "luxation rotulienne", "dysplasie trochléenne",
    "hémarthrose", "synovite villonodulaire", "chondrocalcinose"
  ].join(', '),

  'rachis': [
    "hernie discale", "protrusion discale", "canal lombaire étroit",
    "sténose foraminale", "spondylolisthésis", "arthrose interapophysaire",
    "remaniements Modic", "syndrome de la queue de cheval", "discopathie dégénérative",
    "fracture-tassement", "angiome vertébral", "kyste synovial articulaire",
    "sténose canalaire sévère", "scoliose dégénérative",
    "discarthrose", "ostéophytose", "instabilité vertébrale",
    "spondylolyse", "spondylodiscite", "abcès épidural",
    "compression médullaire", "myélopathie", "syringomyélie",
    "métastases rachidiennes", "schwannome rachidien",
    "kyste de Tarlov"
  ].join(', '),

  'abdomin': [
    "stéatose hépatique", "cirrhose", "fibrose hépatique",
    "kyste hépatique", "angiome hépatique", "carcinome hépatocellulaire",
    "métastases hépatiques", "cholangiocarcinome",
    "lithiase biliaire", "cholécystite", "cholédocolithiase",
    "dilatation des voies biliaires",
    "pancréatite aiguë", "pancréatite chronique",
    "adénocarcinome pancréatique", "IPMN",
    "splénomégalie", "infarctus splénique",
    "néphrolithiase", "hydronéphrose", "pyélonéphrite",
    "carcinome à cellules rénales", "angiomyolipome",
    "anévrisme de l'aorte abdominale", "thrombose de la veine porte",
    "ascite", "carcinose péritonéale",
    "diverticulite", "maladie de Crohn", "occlusion intestinale",
    "appendicite", "fibrome utérin", "endométriose",
    "kyste ovarien", "cancer de l'ovaire",
    "adénome prostatique", "cancer de la prostate",
    "tumeur vésicale"
  ].join(', '),
};

/**
 * Get specialized transcription keywords for a template name.
 * Matches template names containing the key string (case-insensitive).
 */
export function getKeywordsForTemplate(templateName: string): string | null {
  const lower = templateName.toLowerCase();
  for (const key of Object.keys(SPECIALIZED_KEYWORDS)) {
    if (lower.includes(key)) {
      return SPECIALIZED_KEYWORDS[key];
    }
  }
  return null;
}
