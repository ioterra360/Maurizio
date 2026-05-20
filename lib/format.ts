/**
 * Tiny formatting helpers shared across screens. Extracted to kill the
 * duplicated split/initials logic in today.tsx, settings.tsx, home.tsx, more.tsx.
 */

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

const DAY_SHORT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
const MONTH_SHORT = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
] as const;

/** "MON · MAY 19" — used as a date kicker badge on Today and Admin Home. */
export function dateBadge(date: Date = new Date()): string {
  return `${DAY_SHORT[date.getDay()]} · ${MONTH_SHORT[date.getMonth()]} ${date.getDate()}`;
}

export function timeGreeting(date: Date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return "Good morning,";
  if (h < 18) return "Good afternoon,";
  return "Good evening,";
}

const DAY_MS = 24 * 60 * 60 * 1000;

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
  if (!iso) return "Never reviewed";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Never reviewed";
  const diff = now.getTime() - then;
  if (diff < 0) return "Just now";
  const days = Math.floor(diff / DAY_MS);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) {
    const w = Math.floor(days / 7);
    return w === 1 ? "1 week ago" : `${w} weeks ago`;
  }
  const m = Math.floor(days / 30);
  return m === 1 ? "1 month ago" : `${m} months ago`;
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
  if (s === "today" || s === "just now") return now.toISOString();
  if (s === "yesterday") return new Date(now.getTime() - DAY_MS).toISOString();
  const daysMatch = /^(\d+)\s+days?\s+ago$/.exec(s);
  if (daysMatch) {
    const n = Number(daysMatch[1]);
    return new Date(now.getTime() - n * DAY_MS).toISOString();
  }
  const weeksMatch = /^(\d+)\s+weeks?\s+ago$/.exec(s);
  if (weeksMatch) {
    const n = Number(weeksMatch[1]);
    return new Date(now.getTime() - n * 7 * DAY_MS).toISOString();
  }
  const monthsMatch = /^(\d+)\s+months?\s+ago$/.exec(s);
  if (monthsMatch) {
    const n = Number(monthsMatch[1]);
    return new Date(now.getTime() - n * 30 * DAY_MS).toISOString();
  }
  return null;
}
