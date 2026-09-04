/**
 * Domain constants. Centralized so changing a template name or a status
 * label doesn't mean a grep-and-replace across feature folders.
 *
 * Slugs MUST match the database. UI labels can localize freely.
 */

import { t, type TKey } from "@/lib/i18n";
import type { LayerKey } from "@/theme/tokens";

/**
 * The four folder TEMPLATES a user can pick at onboarding. These slugs are
 * the database identifiers (folders.kind) and never change; the UI labels
 * are localized via lib/i18n. Nothing is auto-seeded any more: the user
 * starts with ONE folder — a template or a custom one — chosen in
 * /choose-topic.
 */
export const TEMPLATE_KINDS = ["jp", "medicine", "es", "law"] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];

/** Kind slug of a user-named folder ("Altro…" at onboarding). */
export const CUSTOM_FOLDER_KIND = "custom" as const;

/** Every kind slug the app can route/render. Templates + custom. */
export const FOLDER_KINDS = [...TEMPLATE_KINDS, CUSTOM_FOLDER_KIND] as const;
export type FolderKind = (typeof FOLDER_KINDS)[number];

/** Item-type option: stable English slug (`value`) + localized UI label. */
export type ItemTypeOption = { value: string; label: string };

export type FolderTemplate = {
  kind: TemplateKind;
  /**
   * Localized display name (resolved on access, in the current language) —
   * becomes folders.name when the template is picked.
   */
  name: string;
  /** One-line hint shown on the template card at onboarding. */
  hint: string;
  /** Item-type chips offered by Add for this template (localized labels). */
  itemTypes: readonly ItemTypeOption[];
};

/**
 * Text fields below are getters that call `t()` on every access, so the
 * objects keep their plain `{ name, hint, label }` shape while following the
 * runtime language switch — never cache the resolved strings.
 */
const itemType = (value: string, labelKey: TKey): ItemTypeOption => ({
  value,
  get label() {
    return t(labelKey);
  },
});

export const FOLDER_TEMPLATES: ReadonlyArray<FolderTemplate> = [
  {
    kind: "jp",
    get name() {
      return t("constants.templateJpName");
    },
    get hint() {
      return t("constants.templateJpHint");
    },
    itemTypes: [
      itemType("word", "constants.itemTypeWord"),
      itemType("kanji", "constants.itemTypeKanji"),
      itemType("grammar", "constants.itemTypeGrammar"),
      itemType("phrase", "constants.itemTypePhrase"),
    ],
  },
  {
    kind: "medicine",
    get name() {
      return t("constants.templateMedicineName");
    },
    get hint() {
      return t("constants.templateMedicineHint");
    },
    itemTypes: [
      itemType("term", "constants.itemTypeTerm"),
      itemType("concept", "constants.itemTypeConcept"),
      itemType("drug", "constants.itemTypeDrug"),
      itemType("fact", "constants.itemTypeFact"),
    ],
  },
  {
    kind: "es",
    get name() {
      return t("constants.templateEsName");
    },
    get hint() {
      return t("constants.templateEsHint");
    },
    itemTypes: [
      itemType("word", "constants.itemTypeWord"),
      itemType("verb", "constants.itemTypeVerb"),
      itemType("grammar", "constants.itemTypeGrammar"),
      itemType("phrase", "constants.itemTypePhrase"),
    ],
  },
  {
    kind: "law",
    get name() {
      return t("constants.templateLawName");
    },
    get hint() {
      return t("constants.templateLawHint");
    },
    itemTypes: [
      itemType("doctrine", "constants.itemTypeDoctrine"),
      itemType("case", "constants.itemTypeCase"),
      itemType("statute", "constants.itemTypeStatute"),
      itemType("term", "constants.itemTypeTerm"),
    ],
  },
];

/** Generic chips for a custom folder — no domain assumption. */
export const CUSTOM_ITEM_TYPES: readonly ItemTypeOption[] = [
  itemType("term", "constants.itemTypeTerm"),
  itemType("concept", "constants.itemTypeConcept"),
  itemType("fact", "constants.itemTypeFact"),
  itemType("phrase", "constants.itemTypePhrase"),
];

/** Custom folder names: 1–40 chars after trimming (lib/folder-templates.ts). */
export const FOLDER_NAME_MAX_LENGTH = 40;

/**
 * I limiti dei piani NON stanno piu' qui: stanno in lib/plan.ts
 * (PLAN_LIMITS), che e' l'unico specchio della verita' server-side dei
 * trigger di 20260903100000_plans.sql. FREE_FOLDER_LIMIT (codice morto),
 * FOLDER_LIMIT_ENFORCED, SUBFOLDERS_MAX e PREMIUM_ENABLED (orfano, importato
 * da zero file) sono stati rimossi il 2026-09-03. `PREMIUM_ENABLED` e' un
 * NOME STORICO: la fascia che allora si chiamava "premium" si chiama `pro`
 * dalla rinomina delle fasce del 2026-09-04 (Free / Plus / Pro).
 */

export const MEMORY_STATES = ["active", "fading", "archived"] as const;
export type MemoryState = (typeof MEMORY_STATES)[number];

export const REVIEW_LAYERS: ReadonlyArray<LayerKey> = ["scan", "reinforcement", "focus"];

/**
 * Il livello di ripasso NON si deduce più dal numero di ripetizioni: si
 * deduce dalla fase (features/srs/phases.ts, layerForPhase). Le vecchie
 * soglie LAYER_REPS_* sono state rimosse il 2026-09-02 perché il conteggio
 * di ripetizioni era un proxy sbagliato — a ease standard 4 ripetizioni
 * valgono ~37 giorni, quindi la fase "30 giorni" finiva in Scan invece che
 * in Reinforcement.
 */

export const REVIEW_RESPONSES = ["remembered", "struggled", "forgot", "skipped"] as const;
export type ReviewResponse = (typeof REVIEW_RESPONSES)[number];

/**
 * Time-budget options on Today. Four cards: 5 / 15 / 30 / 60+ minutes.
 * `label` / `sublabel` are getters resolved in the current language on access.
 */
export const TIME_BUDGETS = [
  {
    get label() {
      return t("constants.budget5Label");
    },
    get sublabel() {
      return t("constants.budget5Sublabel");
    },
    minutes: 5,
    estItems: 8,
  },
  {
    get label() {
      return t("constants.budget15Label");
    },
    get sublabel() {
      return t("constants.budget15Sublabel");
    },
    minutes: 15,
    estItems: 28,
  },
  {
    get label() {
      return t("constants.budget30Label");
    },
    get sublabel() {
      return t("constants.budget30Sublabel");
    },
    minutes: 30,
    estItems: 55,
  },
  {
    get label() {
      return t("constants.budget60Label");
    },
    get sublabel() {
      return t("constants.budget60Sublabel");
    },
    minutes: 60,
    estItems: 110,
  },
] as const;

export const DAILY_INPUT_CAP_DEFAULT = 20;

/**
 * Limite duro sul termine da ricordare (Maurizio 2026-09-01: "mettiamo un
 * limite di 50 lettere"). Il contatore compare da TERM_COUNTER_FROM in su.
 */
export const TERM_MAX_LENGTH = 50;
export const TERM_COUNTER_FROM = 40;

/**
 * Notifiche locali (F3): il plugin expo-notifications è in app.json dalla
 * build 3 (vc13 / iOS 3) e la schermata /notifications legge le colonne del
 * profilo. Il flag resta come kill-switch. Acceso è sicuro anche verso i
 * binari vecchi: non ricevono più OTA da questo albero (fingerprint diverso),
 * quindi nessun bundle con il flag a true gira mai senza il modulo nativo.
 */
export const NOTIFICATIONS_ENABLED = true;

/**
 * Public legal / support endpoints. The pages are published by the
 * publisher on GitHub Pages (repo ioterra360/memika-legal, no custom domain yet) from the drafts in docs/legal/;
 * Google Play's Data-safety form and Apple's privacy fields point at the
 * same URLs, so change them here and in the store listings together.
 */
export const PRIVACY_URL = "https://ioterra360.github.io/memika-legal/privacy/";
export const TERMS_URL = "https://ioterra360.github.io/memika-legal/terms/";
/** Web path for deleting an account without reinstalling (Play requirement). */
export const ACCOUNT_DELETION_URL = "https://ioterra360.github.io/memika-legal/account-deletion/";
export const SUPPORT_EMAIL = "memikaapp@gmail.com";
