/**
 * Coach tips — short, evidence-based suggestions delivered by the Memora
 * mascot in a speech bubble. Two pools:
 *
 *   - `general` : tips about memory science in general (study habits, sleep,
 *     spacing, retrieval practice). Surfaced anywhere when no context tip
 *     applies. Sourced from peer-reviewed memory research — citations live
 *     alongside each tip.
 *   - `screen`  : tips tied to a specific screen, surfaced when the user
 *     lands on that screen for the first time (or after a long absence).
 *
 * Sources frequently referenced:
 *   - Karpicke & Roediger (2008) — testing effect, Science.
 *   - Cepeda et al. (2008) — spacing effect, Psychological Science.
 *   - Ebbinghaus (1885) — forgetting curve.
 *   - Walker (2017) "Why We Sleep" — sleep and consolidation.
 *   - Bjork & Bjork (2011) — desirable difficulties.
 */

export type CoachTip = {
  id: string;
  title: string;
  body: string;
  /** Optional source citation shown small under the body. */
  source?: string;
};

export const GENERAL_TIPS: CoachTip[] = [
  {
    id: "gen.spacing",
    title: "Il potere dell'intervallo",
    body:
      "Studiare poco e spesso batte le maratone: ripassi distribuiti nel tempo creano memorie più durature.",
    source: "Cepeda et al., 2008",
  },
  {
    id: "gen.testing",
    title: "Provare a ricordare insegna",
    body:
      "Lo sforzo di richiamare un'informazione la fissa più del rileggerla. È l'effetto del test.",
    source: "Karpicke & Roediger, 2008",
  },
  {
    id: "gen.sleep",
    title: "Il sonno consolida",
    body:
      "Durante il sonno profondo il cervello riorganizza i ricordi. Dormire bene è parte dello studio.",
    source: "Walker, Why We Sleep, 2017",
  },
  {
    id: "gen.forgetting-curve",
    title: "Anticipa l'oblio",
    body:
      "Ricordiamo la metà di ciò che impariamo nelle prime ore se non lo rivediamo. Un breve ripasso prima fa la differenza.",
    source: "Ebbinghaus, 1885",
  },
  {
    id: "gen.desirable-difficulty",
    title: "La fatica giusta",
    body:
      "Quando ricordare richiede uno sforzo (ma ci riesci), la memoria migliora. Non temere le difficoltà desiderabili.",
    source: "Bjork & Bjork, 2011",
  },
  {
    id: "gen.context",
    title: "Cambia ambiente, fissa meglio",
    body:
      "Studiare la stessa cosa in luoghi diversi crea più \"agganci\" mentali e riduce le dimenticanze.",
    source: "Smith, Glenberg & Bjork, 1978",
  },
  {
    id: "gen.elaborate",
    title: "Collega per ricordare",
    body:
      "Lega un'informazione nuova a qualcosa che già sai. Più connessioni, più stabile diventa il ricordo.",
    source: "Craik & Lockhart, 1972 (Levels of processing)",
  },
  {
    id: "gen.health",
    title: "La mente segue il corpo",
    body:
      "30 minuti di movimento al giorno migliorano memoria di lavoro e attenzione: bene per te, bene per i tuoi ricordi.",
    source: "Erickson et al., PNAS 2011",
  },
];

/**
 * Subject categories. Each Memora folder maps onto one of these — the
 * `categoryOfFolder` table at the bottom resolves a folder kind to its
 * category, falling back to "generic" if unknown.
 */
export type StudyCategory =
  | "languages"
  | "math"
  | "history"
  | "medicine"
  | "law"
  | "science"
  | "art"
  | "code"
  | "generic";

export const CATEGORY_TIPS: Record<StudyCategory, CoachTip[]> = {
  languages: [
    {
      id: "lang.shadowing",
      title: "Ripeti subito ad alta voce",
      body:
        "Sentire e ripetere una parola entro 1 secondo (shadowing) attiva pronuncia e memoria insieme. Funziona per qualsiasi lingua.",
      source: "Murphey, ELT Journal 2001",
    },
    {
      id: "lang.context",
      title: "Frasi, non parole singole",
      body:
        "Memorizza le parole dentro una frase: il contesto è una scorciatoia gratis per richiamarle quando ti servono.",
    },
    {
      id: "lang.daily",
      title: "Meglio 10 minuti al giorno",
      body:
        "Per le lingue la frequenza batte la durata: piccoli incontri quotidiani consolidano più di sessioni lunghe e rare.",
      source: "DeKeyser, Studies in Second Language Acquisition, 2007",
    },
    {
      id: "lang.errors",
      title: "Sbagliare aiuta",
      body:
        "Tentare di tradurre prima di vedere la risposta crea una traccia di memoria più forte di quella di una lettura passiva.",
      source: "Karpicke & Blunt, Science 2011",
    },
  ],
  math: [
    {
      id: "math.spaced-problems",
      title: "Distanzia i problemi",
      body:
        "Alterna tipi di esercizio invece di farne 20 dello stesso tipo: l'\"interleaving\" rende l'apprendimento più solido.",
      source: "Rohrer & Taylor, Instructional Science 2007",
    },
    {
      id: "math.explain",
      title: "Spiegalo come a un bambino",
      body:
        "Se riesci a spiegare un concetto matematico con parole semplici, l'hai capito. È la tecnica di Feynman.",
    },
    {
      id: "math.retrieval",
      title: "Risolvi senza guardare",
      body:
        "Prova a risolvere il problema a mente prima di vedere la formula: il richiamo crea memoria.",
      source: "Karpicke & Roediger, 2008",
    },
  ],
  history: [
    {
      id: "hist.timeline",
      title: "Costruisci una linea del tempo",
      body:
        "Le date isolate sfuggono. Connessione causa-effetto: ogni evento è meglio ricordato se sai cosa lo ha provocato.",
    },
    {
      id: "hist.story",
      title: "Trasforma in storia",
      body:
        "Il cervello ricorda le narrazioni meglio delle liste. Racconta gli eventi come fossero una trama.",
      source: "Bower & Clark, 1969",
    },
    {
      id: "hist.places",
      title: "Palazzo della memoria",
      body:
        "Associa ogni evento a un luogo familiare. Tecnica usata da retori romani, ancora oggi tra le più potenti.",
      source: "Yates, The Art of Memory 1966",
    },
  ],
  medicine: [
    {
      id: "med.mnemonic",
      title: "Mnemonici medici",
      body:
        "Acronimi e immagini bizzarre velocizzano il richiamo dei sistemi anatomici e farmaci.",
    },
    {
      id: "med.cases",
      title: "Studia per casi clinici",
      body:
        "Collega ogni concetto a un paziente immaginario: sintomo → ipotesi → trattamento. Il caso è il contesto.",
      source: "Norman, Medical Education 2000",
    },
    {
      id: "med.spaced-anki",
      title: "Ripasso spaziato e selettivo",
      body:
        "Per il volume di nozioni in medicina la spaced repetition è il metodo più studiato. Anki nasce in questo contesto.",
    },
  ],
  law: [
    {
      id: "law.irac",
      title: "Metodo IRAC",
      body:
        "Issue · Rule · Application · Conclusion. Catalogare ogni caso secondo questi 4 punti rende il richiamo automatico in esame.",
    },
    {
      id: "law.outline",
      title: "Outline prima dei dettagli",
      body:
        "Sapere la struttura di un codice prima di studiarne gli articoli aiuta il cervello a collocarli correttamente.",
    },
    {
      id: "law.cases",
      title: "Una sentenza, una storia",
      body:
        "I casi memorabili sono quelli con dettagli umani. Cerca il fatto concreto dietro la massima giuridica.",
    },
  ],
  science: [
    {
      id: "sci.diagrams",
      title: "Disegna anche se non sai",
      body:
        "Provare a disegnare un meccanismo prima di vederlo lo fissa meglio di copiarlo dal libro.",
      source: "Van Meter, Educational Psychology 2001",
    },
    {
      id: "sci.connect",
      title: "Collega le scale",
      body:
        "In scienze, lega il micro (cellula, atomo) al macro (organismo, sistema). I ponti tra livelli stabilizzano la memoria.",
    },
  ],
  art: [
    {
      id: "art.attribution",
      title: "Riconosci, non solo nomina",
      body:
        "Per opere e stili allena il riconoscimento visivo: guarda 20 dipinti dello stesso autore prima di leggere la teoria.",
    },
  ],
  code: [
    {
      id: "code.recall-syntax",
      title: "Scrivi senza autocomplete",
      body:
        "Disattiva la copia: forza la mente a ricordare la sintassi. Il richiamo attivo batte la lettura.",
    },
    {
      id: "code.read-good-code",
      title: "Leggi codice scritto bene",
      body:
        "Il cervello impara per imitazione. Esponilo ogni giorno a esempi puliti dei pattern che vuoi padroneggiare.",
    },
  ],
  generic: [
    {
      id: "gen.start-easy",
      title: "Parti dal facile",
      body:
        "Le prime ripetizioni di una sessione dovrebbero darti fiducia: il cervello si \"riscalda\" come un muscolo.",
    },
  ],
};

/**
 * Map between a Memora folder kind and a study category. Add new mappings
 * here when a new folder kind is introduced.
 */
const FOLDER_TO_CATEGORY: Record<string, StudyCategory> = {
  jp: "languages",
  es: "languages",
  medicine: "medicine",
  law: "law",
  math: "math",
  history: "history",
  science: "science",
  art: "art",
  code: "code",
};

export function categoryOfFolder(folderKind: string | null | undefined): StudyCategory {
  if (!folderKind) return "generic";
  return FOLDER_TO_CATEGORY[folderKind] ?? "generic";
}

/**
 * Pick a tip tailored to the folder/category being reviewed. Falls back to
 * general memory science when the category has no tips configured.
 */
export function pickCategoryTip(
  folderKind: string | null | undefined,
  version: number,
): CoachTip {
  const cat = categoryOfFolder(folderKind);
  const pool = CATEGORY_TIPS[cat]?.length ? CATEGORY_TIPS[cat] : GENERAL_TIPS;
  const idx = Math.abs(version) % pool.length;
  return pool[idx];
}

export const SCREEN_TIPS: Record<string, CoachTip[]> = {
  today: [
    {
      id: "today.flow",
      title: "Un giro al giorno",
      body:
        "Il flow Scan → Reinforcement → Focus è pensato per coprire tutto in pochi minuti. Prova a farlo ogni giorno alla stessa ora.",
    },
    {
      id: "today.budget",
      title: "Scegli quanto tempo hai",
      body:
        "Anche 5 minuti contano. La costanza vince sulla quantità: meglio breve oggi che lungo \"domani\".",
    },
  ],
  knowledge: [
    {
      id: "knowledge.priority",
      title: "L'ordine conta",
      body:
        "Le cartelle più in alto vengono proposte per prime. Sposta in cima quelle su cui vuoi concentrarti.",
    },
    {
      id: "knowledge.categories",
      title: "Catalogare aiuta",
      body:
        "Suddividere i ricordi per cartelle facilita il richiamo: il cervello li raggruppa già da solo.",
      source: "Bower et al., 1969",
    },
  ],
  health: [
    {
      id: "health.attention",
      title: "Guarda la curva",
      body:
        "Una memoria che sbiadisce non è persa: torna verde con uno o due ripassi mirati.",
    },
  ],
  add: [
    {
      id: "add.short",
      title: "Meno è meglio",
      body:
        "Un ricordo breve e specifico si fissa più di un paragrafo. Scrivi solo ciò che ti serve davvero ricordare.",
    },
  ],
};

/**
 * Stable but rotated pick — given a screen and a "version" (e.g. the day
 * number), return a tip that changes over time without being random on every
 * mount. Falls back to general tips if the screen has none configured.
 */
export function pickTip(screen: string, version: number): CoachTip {
  const pool = SCREEN_TIPS[screen]?.length ? SCREEN_TIPS[screen] : GENERAL_TIPS;
  const idx = Math.abs(version) % pool.length;
  return pool[idx];
}

export function pickGeneralTip(version: number): CoachTip {
  const idx = Math.abs(version) % GENERAL_TIPS.length;
  return GENERAL_TIPS[idx];
}
