import type { TKey } from "./i18n";
import type { TutorialShot } from "./tutorial-shots";

/**
 * I passi del tutorial di benvenuto (app/tutorial.tsx). Modulo PURO: solo
 * dati e un'aritmetica, cosi' vitest puo' garantire che ogni chiave esista
 * nel catalogo e che ogni screenshot sia fra quelli catturati.
 *
 * Sette passi (Angelo, 7/9/2026): la mascotte si presenta, poi sei
 * schermate VERE dell'app con due frasi ciascuna: Oggi, Cartelle, Nuovo
 * ricordo, Ripasso, Salute della memoria, Notifiche. Si salta in un tocco.
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
  /** La posa della mascotte: eroe nel passo di benvenuto, badge sulla cornice negli altri. */
  mascot: TutorialMascot;
  tint: TutorialTint;
  titleKey: TKey;
  bodyKey: TKey;
  /** Lo screenshot dell'app mostrato nella cornice; assente nel passo di benvenuto. */
  shot?: TutorialShot;
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
    key: "today",
    mascot: "idea",
    tint: "scan",
    titleKey: "tutorial.todayTitle",
    bodyKey: "tutorial.todayBody",
    shot: "today",
  },
  {
    key: "folders",
    mascot: "checklist",
    tint: "focus",
    titleKey: "tutorial.foldersTitle",
    bodyKey: "tutorial.foldersBody",
    shot: "knowledge",
  },
  {
    key: "add",
    mascot: "idea",
    tint: "active",
    titleKey: "tutorial.addTitle",
    bodyKey: "tutorial.addBody",
    shot: "add",
  },
  {
    key: "review",
    mascot: "investigate",
    tint: "reinforcement",
    titleKey: "tutorial.reviewTitle",
    bodyKey: "tutorial.reviewBody",
    shot: "focus",
  },
  {
    key: "health",
    mascot: "investigate",
    tint: "active",
    titleKey: "tutorial.healthTitle",
    bodyKey: "tutorial.healthBody",
    shot: "health",
  },
  {
    key: "reminders",
    mascot: "announce",
    tint: "scan",
    titleKey: "tutorial.remindersTitle",
    bodyKey: "tutorial.remindersBody",
    shot: "notifications",
  },
];

/** Pagina piu' vicina a un offset orizzontale; mai fuori da [0, count-1]. */
export function pageIndex(offsetX: number, width: number, count: number): number {
  // Chiamata anche dal gestore di scroll di reanimated, sul thread UI.
  "worklet";
  if (width <= 0 || count <= 0) return 0;
  const raw = Math.round(offsetX / width);
  return Math.min(Math.max(raw, 0), count - 1);
}
