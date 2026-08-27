/**
 * Domain constants. Centralized so changing a template name or a status
 * label doesn't mean a grep-and-replace across feature folders.
 *
 * Slugs MUST match the database. UI labels can localize freely.
 */

import type { LayerKey } from "@/theme/tokens";

/**
 * The four folder TEMPLATES a user can pick at onboarding. These slugs are
 * the database identifiers (folders.kind) and never change; the UI labels
 * are Italian. Nothing is auto-seeded any more: the user starts with ONE
 * folder — a template or a custom one — chosen in /choose-topic.
 */
export const TEMPLATE_KINDS = ["jp", "medicine", "es", "law"] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];

/** Kind slug of a user-named folder ("Altro…" at onboarding). */
export const CUSTOM_FOLDER_KIND = "custom" as const;

/** Every kind slug the app can route/render. Templates + custom. */
export const FOLDER_KINDS = [...TEMPLATE_KINDS, CUSTOM_FOLDER_KIND] as const;
export type FolderKind = (typeof FOLDER_KINDS)[number];

/** Item-type option: stable English slug (`value`) + Italian UI label. */
export type ItemTypeOption = { value: string; label: string };

export type FolderTemplate = {
  kind: TemplateKind;
  /** Italian display name — becomes folders.name when the template is picked. */
  name: string;
  /** One-line hint shown on the template card at onboarding. */
  hint: string;
  /** Item-type chips offered by Add for this template (Italian labels). */
  itemTypes: readonly ItemTypeOption[];
};

export const FOLDER_TEMPLATES: ReadonlyArray<FolderTemplate> = [
  {
    kind: "jp",
    name: "Giapponese",
    hint: "Parole, kanji, grammatica",
    itemTypes: [
      { value: "word", label: "Parola" },
      { value: "kanji", label: "Kanji" },
      { value: "grammar", label: "Grammatica" },
      { value: "phrase", label: "Frase" },
    ],
  },
  {
    kind: "medicine",
    name: "Medicina",
    hint: "Termini, concetti, farmaci",
    itemTypes: [
      { value: "term", label: "Termine" },
      { value: "concept", label: "Concetto" },
      { value: "drug", label: "Farmaco" },
      { value: "fact", label: "Nozione" },
    ],
  },
  {
    kind: "es",
    name: "Spagnolo",
    hint: "Parole, verbi, grammatica",
    itemTypes: [
      { value: "word", label: "Parola" },
      { value: "verb", label: "Verbo" },
      { value: "grammar", label: "Grammatica" },
      { value: "phrase", label: "Frase" },
    ],
  },
  {
    kind: "law",
    name: "Diritto",
    hint: "Dottrina, casi, norme",
    itemTypes: [
      { value: "doctrine", label: "Dottrina" },
      { value: "case", label: "Caso" },
      { value: "statute", label: "Norma" },
      { value: "term", label: "Termine" },
    ],
  },
];

/** Generic chips for a custom folder — no domain assumption. */
export const CUSTOM_ITEM_TYPES: readonly ItemTypeOption[] = [
  { value: "term", label: "Termine" },
  { value: "concept", label: "Concetto" },
  { value: "fact", label: "Nozione" },
  { value: "phrase", label: "Frase" },
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

export const REVIEW_RESPONSES = ["remembered", "struggled", "forgot", "skipped"] as const;
export type ReviewResponse = (typeof REVIEW_RESPONSES)[number];

/** Time-budget options on Today. Four cards: 5 / 15 / 30 / 60+ minutes. */
export const TIME_BUDGETS = [
  { label: "5 min",   sublabel: "Veloce",     minutes: 5,  estItems: 8   },
  { label: "15 min",  sublabel: "Standard",   minutes: 15, estItems: 28  },
  { label: "30 min",  sublabel: "Approfondita", minutes: 30, estItems: 55  },
  { label: "1+ ora",  sublabel: "Maratona",   minutes: 60, estItems: 110 },
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
