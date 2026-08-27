import type { it } from "./it";

/**
 * English. Typed against the Italian catalog: a missing or extra key is a
 * compile error. Product names (Memika, Scan, Reinforcement, Focus) stay.
 */
export const en: Record<keyof typeof it, string> = {
  // ---- common -------------------------------------------------------------
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.continue": "Continue",
  "common.retry": "Try again",
  "common.back": "Back",
  "common.delete": "Delete",
  "common.close": "Close",
  "common.skip": "Skip",
  "common.ok": "OK",
  "common.oneMoment": "One moment…",
  "common.never": "never",

  // ---- settings · language ------------------------------------------------
  "settings.language": "Language",
  "settings.languageSection": "Language",
  "settings.languageSystem": "Same as the phone",
  "settings.languageIt": "Italiano",
  "settings.languageEn": "English",
  "settings.languageHint": "Applies right away, no restart.",
};
