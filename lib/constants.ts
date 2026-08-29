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
 * Freemium: a free account owns exactly one folder. Creating/opening a
 * second one will raise the Premium sheet once RevenueCat lands; until then
 * no create-folder affordance exists beyond the onboarding pick.
 */
export const FREE_FOLDER_LIMIT = 1;

/**
 * 2026-08-27 (Angelo): during the test phase the app behaves like the full
 * version — any signed-in user can add folders from Knowledge, one per kind
 * (the DB has unique(user_id, kind) and the app keys folders by kind, so the
 * ceiling is the 4 templates + 1 custom). Flip to true when the RevenueCat
 * paywall lands and FREE_FOLDER_LIMIT becomes the gate again.
 */
export const FOLDER_LIMIT_ENFORCED = false;

export const MEMORY_STATES = ["active", "fading", "archived"] as const;
export type MemoryState = (typeof MEMORY_STATES)[number];

export const REVIEW_LAYERS: ReadonlyArray<LayerKey> = ["scan", "reinforcement", "focus"];

/**
 * Which layer reviews a due memory — Maurizio's phase ladder (tables of
 * 2026-08-28, materiale_maurizio/feedback_2026-08-28) mapped onto SM-2
 * `srs_repetitions` (= successful reviews so far):
 *
 *   Focus          repetitions < 2                   20h and 48h consolidations ("ricordi di ieri")
 *   Reinforcement  2 <= repetitions < 4, or fading   7-day and 30-day phases ("ultimi 3–7 giorni")
 *   Scan           repetitions >= 4                  3 months and beyond ("ricordi più vecchi")
 *
 * Fading cards always go to Reinforcement: guided recall is the recovery
 * path. A forget resets repetitions to 0, so a forgotten card drops back to
 * Focus. The same split is written as PostgREST predicates in lib/api.ts
 * (fetchDueMemoriesByLayer / fetchDueCounts) and as the pure `layerFor` in
 * lib/queue.ts — keep the three in sync.
 */
export const LAYER_REPS_FOCUS_BELOW = 2;
export const LAYER_REPS_REINFORCEMENT_BELOW = 4;

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
 * Paywall kill-switch. The "Memika Premium" row in Settings and the
 * /subscribe route stay hidden until the RevenueCat in-app-purchase paywall
 * replaces the old external-checkout screen — a store build that links out to
 * a web checkout is rejected under Apple 3.1.1 / Play Payments policy.
 */
export const PREMIUM_ENABLED = false;

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
