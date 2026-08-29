/**
 * Ordinamento della lista ricordi nella schermata cartella. Puro, testato
 * in lib/folder-sort.test.ts. La scelta per cartella vive in
 * lib/folder-sort-store.ts.
 */
import type { Memory } from "./mappers";

export const FOLDER_SORTS = ["due", "alpha", "newest", "oldest"] as const;
export type FolderSort = (typeof FOLDER_SORTS)[number];

export function isFolderSort(value: unknown): value is FolderSort {
  return typeof value === "string" && (FOLDER_SORTS as readonly string[]).includes(value);
}

const CJK = /[　-ヿ㐀-䶿一-鿿豈-﫿]/;

/** Kanji/kana terms sort by their reading when they have one. */
function alphaKey(m: Memory): string {
  if (m.reading && CJK.test(m.term)) return m.reading;
  return m.term;
}

// Intl.Collator ships with Hermes on both platforms (SDK 54); the fallback
// keeps the sort deterministic if it ever goes missing.
const collator =
  typeof Intl !== "undefined" && typeof Intl.Collator === "function"
    ? new Intl.Collator(undefined, { sensitivity: "base", numeric: true })
    : null;

function compareText(a: string, b: string): number {
  if (collator) return collator.compare(a, b);
  return a.toLowerCase().localeCompare(b.toLowerCase());
}

function time(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms;
}

/** Returns a new array; never mutates `items`. */
export function sortMemories(items: readonly Memory[], sort: FolderSort): Memory[] {
  const out = [...items];
  switch (sort) {
    case "alpha":
      return out.sort((a, b) => compareText(alphaKey(a), alphaKey(b)));
    case "newest":
      return out.sort((a, b) => time(b.createdAt) - time(a.createdAt));
    case "oldest":
      return out.sort((a, b) => time(a.createdAt) - time(b.createdAt));
    case "due":
    default:
      return out.sort((a, b) => time(a.nextReviewAt) - time(b.nextReviewAt));
  }
}
