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

const DAY_SHORT = ["DOM", "LUN", "MAR", "MER", "GIO", "VEN", "SAB"] as const;
const MONTH_SHORT = [
  "GEN", "FEB", "MAR", "APR", "MAG", "GIU",
  "LUG", "AGO", "SET", "OTT", "NOV", "DIC",
] as const;

/** "LUN · 19 MAG" — used as a date kicker badge on Today and Admin Home. */
export function dateBadge(date: Date = new Date()): string {
  return `${DAY_SHORT[date.getDay()]} · ${date.getDate()} ${MONTH_SHORT[date.getMonth()]}`;
}

export function timeGreeting(date: Date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return "Buongiorno,";
  if (h < 18) return "Buon pomeriggio,";
  return "Buonasera,";
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
  if (!iso) return "Mai ripassato";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Mai ripassato";
  const diff = now.getTime() - then;
  if (diff < 0) return "Adesso";
  const days = Math.floor(diff / DAY_MS);
  if (days === 0) return "Oggi";
  if (days === 1) return "Ieri";
  if (days < 7) return `${days} giorni fa`;
  if (days < 30) {
    const w = Math.floor(days / 7);
    return w === 1 ? "1 settimana fa" : `${w} settimane fa`;
  }
  const m = Math.floor(days / 30);
  return m === 1 ? "1 mese fa" : `${m} mesi fa`;
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
  const daysMatch = /^(\d+)\s+(days?\s+ago|giorni?\s+fa)$/.exec(s);
  if (daysMatch) {
    const n = Number(daysMatch[1]);
    return new Date(now.getTime() - n * DAY_MS).toISOString();
  }
  const weeksMatch = /^(\d+)\s+(weeks?\s+ago|settimane?\s+fa)$/.exec(s);
  if (weeksMatch) {
    const n = Number(weeksMatch[1]);
    return new Date(now.getTime() - n * 7 * DAY_MS).toISOString();
  }
  const monthsMatch = /^(\d+)\s+(months?\s+ago|mesi?\s+fa|mese\s+fa)$/.exec(s);
  if (monthsMatch) {
    const n = Number(monthsMatch[1]);
    return new Date(now.getTime() - n * 30 * DAY_MS).toISOString();
  }
  return null;
}
