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
