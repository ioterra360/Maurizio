/**
 * Domain constants. Centralized so changing a seed-folder name or a status
 * label doesn't mean a grep-and-replace across feature folders.
 *
 * Slugs MUST match the database. UI labels can localize freely.
 */

import type { LayerKey } from "@/theme/tokens";

export const FOLDER_KINDS = ["jp", "medicine", "es", "law"] as const;
export type FolderKind = (typeof FOLDER_KINDS)[number];

export const FOLDER_DEFAULTS: ReadonlyArray<{
  kind: FolderKind;
  name: string;
  priority: number;
  itemTypes: readonly string[];
}> = [
  { kind: "jp",       name: "Japanese", priority: 1, itemTypes: ["Word", "Kanji", "Grammar", "Phrase"] },
  { kind: "medicine", name: "Medicine", priority: 2, itemTypes: ["Term", "Concept", "Drug", "Fact"] },
  { kind: "es",       name: "Spanish",  priority: 3, itemTypes: ["Word", "Verb", "Grammar", "Phrase"] },
  { kind: "law",      name: "Law",      priority: 4, itemTypes: ["Doctrine", "Case", "Statute", "Term"] },
];

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
