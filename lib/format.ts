/**
 * Tiny formatting helpers shared across screens. Extracted to kill the
 * duplicated split/initials logic in today.tsx, settings.tsx, home.tsx, more.tsx.
 *
 * Every label resolves through `t()` at call time — the module only holds
 * catalog KEYS, never translated text, so the Settings language switch
 * applies on the next render.
 */

import { t, tp, type TKey } from "@/lib/i18n";

export function firstName(fullName: string | undefined | null, fallback = ""): string {
  if (!fullName) return fallback;
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return parts[0] ?? fallback;
}

export function initials(fullName: string | undefined | null, fallback = "M"): string {
  if (!fullName) return fallback;
  const parts = fullName.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return fallback;
  return parts.map((p) => p.charAt(0).toUpperCase()).join("");
}

const DAY_SHORT: readonly TKey[] = [
  "format.dayShortSun", "format.dayShortMon", "format.dayShortTue", "format.dayShortWed",
  "format.dayShortThu", "format.dayShortFri", "format.dayShortSat",
];
const MONTH_SHORT: readonly TKey[] = [
  "format.monthShortJan", "format.monthShortFeb", "format.monthShortMar",
  "format.monthShortApr", "format.monthShortMay", "format.monthShortJun",
  "format.monthShortJul", "format.monthShortAug", "format.monthShortSep",
  "format.monthShortOct", "format.monthShortNov", "format.monthShortDec",
];

/** "LUN · 19 MAG" — used as a date kicker badge on Today and Admin Home. */
export function dateBadge(date: Date = new Date()): string {
  return t("format.dateBadge", {
    day: t(DAY_SHORT[date.getDay()]),
    date: date.getDate(),
    month: t(MONTH_SHORT[date.getMonth()]),
  });
}

const MONTH_LONG: readonly TKey[] = [
  "format.monthLongJanuary", "format.monthLongFebruary", "format.monthLongMarch",
  "format.monthLongApril", "format.monthLongMay", "format.monthLongJune",
  "format.monthLongJuly", "format.monthLongAugust", "format.monthLongSeptember",
  "format.monthLongOctober", "format.monthLongNovember", "format.monthLongDecember",
];

/** "27 agosto 2026" — full date for the memory detail sheet. Invalid input → "". */
export function longDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return t("format.longDate", {
    date: d.getDate(),
    month: t(MONTH_LONG[d.getMonth()]),
    year: d.getFullYear(),
  });
}

export function timeGreeting(date: Date = new Date()): string {
  const h = date.getHours();
  // "Buongiorno" covers the whole day in everyday Italian; "Buon pomeriggio"
  // was also the one greeting too wide for the Today hero on 360 dp phones.
  if (h < 18) return t("format.greetingDay");
  return t("format.greetingEvening");
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local midnight of `d`, as epoch ms. */
function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Human-friendly relative timestamp for the "Reviewed …" footer on memory
 * rows. Bucketed coarsely (today / yesterday / N days / N weeks / N months)
 * to match the editorial calm of the design — we don't need minute-level
 * precision on a list of flashcards.
 */
export function relativeReviewed(
  iso: string | null,
  now: Date = new Date(),
): string {
  if (!iso) return t("format.neverReviewed");
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return t("format.neverReviewed");
  if (then.getTime() > now.getTime()) return t("format.justNow");
  // Calendar days in the user's local time zone, not rolling 24 h windows:
  // a review yesterday at 20:00 must read "Ieri" at 15:00 today (19 h
  // later), and a card reviewed two evenings ago is "2 giorni fa" even if
  // only 26 h passed. Math.round absorbs the 23/25 h days around DST.
  const days = Math.round((startOfLocalDay(now) - startOfLocalDay(then)) / DAY_MS);
  if (days <= 0) return t("format.today");
  if (days === 1) return t("format.yesterday");
  if (days < 7) return tp("format.daysAgo", days);
  if (days < 30) {
    const w = Math.floor(days / 7);
    return tp("format.weeksAgo", w);
  }
  const m = Math.floor(days / 30);
  return tp("format.monthsAgo", m);
}

/**
 * Inverse of relativeReviewed for the demo seed only — turn a display
 * string ("Yesterday", "3 days ago", "2 months ago") back into an ISO
 * timestamp so we can feed it to a Memory.lastReviewedAt field and have
 * relativeReviewed reproduce the original label.
 *
 * This exists because folder-data.ts stores seed timestamps as the
 * already-formatted string. Without it, demo memories would render
 * "Never reviewed" everywhere. Real Memory rows from Supabase will not
 * go through this path — they already carry ISO timestamps.
 *
 * Returns null for anything we can't confidently parse — caller should
 * fall through to "Never reviewed".
 */
export function isoFromRelativeLabel(
  label: string,
  now: Date = new Date(),
): string | null {
  const s = label.trim().toLowerCase();
  if (!s) return null;
  // Match both English (legacy demo seeds) and Italian forms so the
  // pre-localized labels in folder-data.ts still parse.
  if (s === "today" || s === "just now" || s === "oggi" || s === "adesso") {
    return now.toISOString();
  }
  if (s === "yesterday" || s === "ieri") {
    return new Date(now.getTime() - DAY_MS).toISOString();
  }
  // Italian singular/plural don't share a stem (settimana/settimane,
  // giorno/giorni, mese/mesi), so each alternation needs both forms.
  const daysMatch = /^(\d+)\s+(days?\s+ago|giorno\s+fa|giorni\s+fa)$/.exec(s);
  if (daysMatch) {
    const n = Number(daysMatch[1]);
    return new Date(now.getTime() - n * DAY_MS).toISOString();
  }
  const weeksMatch = /^(\d+)\s+(weeks?\s+ago|settimana\s+fa|settimane\s+fa)$/.exec(s);
  if (weeksMatch) {
    const n = Number(weeksMatch[1]);
    return new Date(now.getTime() - n * 7 * DAY_MS).toISOString();
  }
  const monthsMatch = /^(\d+)\s+(months?\s+ago|mese\s+fa|mesi\s+fa)$/.exec(s);
  if (monthsMatch) {
    const n = Number(monthsMatch[1]);
    return new Date(now.getTime() - n * 30 * DAY_MS).toISOString();
  }
  return null;
}
