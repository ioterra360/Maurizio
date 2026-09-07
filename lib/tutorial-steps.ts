import type { TKey } from "./i18n";

/**
 * I passi del tutorial di benvenuto (app/tutorial.tsx). Modulo PURO: solo
 * dati e un'aritmetica, cosi' vitest puo' garantire che ogni chiave esista
 * nel catalogo e che i tre ritmi restino nell'ordine bloccato.
 *
 * Cinque passi, non di piu': l'onboarding e' "volutamente corto"
 * (docs/EMAILS.md) e si salta in un tocco.
 */

/** Le pose hi-res della mascotte (~500 px). La `default` da 130 px sgrana a dimensione hero. */
export type TutorialMascot = "idea" | "checklist" | "investigate" | "announce";

/**
 * La tinta del passo: il fondo della pagina si dissolve da una all'altra
 * seguendo lo scorrimento. Sono nomi di token, non colori: la schermata li
 * risolve nella palette del tema corrente (chiaro o scuro).
 */
export type TutorialTint = "welcome" | "focus" | "reinforcement" | "active" | "scan";

export type TutorialStep = {
  key: string;
  mascot: TutorialMascot;
  tint: TutorialTint;
  titleKey: TKey;
  bodyKey: TKey;
  /** Il passo mostra le tre righe dei ritmi sotto il testo. */
  layers?: true;
};

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    key: "welcome",
    mascot: "announce",
    tint: "welcome",
    titleKey: "tutorial.welcomeTitle",
    bodyKey: "tutorial.welcomeBody",
  },
  {
    key: "folders",
    mascot: "idea",
    tint: "focus",
    titleKey: "tutorial.foldersTitle",
    bodyKey: "tutorial.foldersBody",
  },
  {
    key: "review",
    mascot: "investigate",
    tint: "reinforcement",
    titleKey: "tutorial.reviewTitle",
    bodyKey: "tutorial.reviewBody",
    layers: true,
  },
  {
    key: "health",
    mascot: "checklist",
    tint: "active",
    titleKey: "tutorial.healthTitle",
    bodyKey: "tutorial.healthBody",
  },
  {
    key: "reminders",
    mascot: "announce",
    tint: "scan",
    titleKey: "tutorial.remindersTitle",
    bodyKey: "tutorial.remindersBody",
  },
];

/** Ordine bloccato (AGENTS.md §3): copy, righe e icone lo rispettano ovunque. */
export const LAYER_ROWS = ["scan", "reinforcement", "focus"] as const;
export type LayerRow = (typeof LAYER_ROWS)[number];

/** Pagina piu' vicina a un offset orizzontale; mai fuori da [0, count-1]. */
export function pageIndex(offsetX: number, width: number, count: number): number {
  // Chiamata anche dal gestore di scroll di reanimated, sul thread UI.
  "worklet";
  if (width <= 0 || count <= 0) return 0;
  const raw = Math.round(offsetX / width);
  return Math.min(Math.max(raw, 0), count - 1);
}
