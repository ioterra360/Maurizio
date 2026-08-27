/**
 * Italian — the base catalog. Every key here must exist in en.ts.
 * Key convention: `<area>.<camelCaseMeaning>`; shared UI words live under
 * `common.*`; plural pairs end with `_one` / `_other` and receive `{count}`.
 * Keep keys sorted by area, then by appearance in the screen.
 */
export const it = {
  // ---- common -------------------------------------------------------------
  "common.save": "Salva",
  "common.cancel": "Annulla",
  "common.continue": "Continua",
  "common.retry": "Riprova",
  "common.back": "Indietro",
  "common.delete": "Elimina",
  "common.close": "Chiudi",
  "common.skip": "Salta",
  "common.ok": "OK",
  "common.oneMoment": "Un attimo…",
  "common.never": "mai",

  // ---- settings · language ------------------------------------------------
  "settings.language": "Lingua",
  "settings.languageSection": "Lingua",
  "settings.languageSystem": "Come il telefono",
  "settings.languageIt": "Italiano",
  "settings.languageEn": "English",
  "settings.languageHint": "Cambia subito, senza riavviare.",
} as const;
