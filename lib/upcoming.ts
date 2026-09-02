/**
 * Raggruppamento dei ripassi futuri per giorno — il dato dietro "Prossimi
 * ripassi" della Home e il calendario (spec 2026-09-02 §B3).
 *
 * Confine di giornata: la MEZZANOTTE LOCALE del telefono. È l'unica scelta
 * che non mette un ricordo nella casella del giorno sbagliato per chi vive
 * a est o a ovest di Greenwich; i confronti di scadenza restano assoluti
 * (UTC) — qui si decide solo in quale casella visiva cade un ricordo.
 *
 * Puro: niente I/O, testato in lib/upcoming.test.ts.
 */

/** "YYYY-MM-DD" nel fuso locale del device. */
export function localDayKey(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Chiave del giorno per una Date locale (per costruire le celle del calendario). */
export function dayKeyOf(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Conteggio dei ripassi per giorno locale. Le date invalide sono scartate. */
export function groupByLocalDay(rows: ReadonlyArray<{ nextReviewAt: string }>): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows) {
    const key = localDayKey(r.nextReviewAt);
    if (!key) continue;
    out.set(key, (out.get(key) ?? 0) + 1);
  }
  return out;
}

export type UpcomingDay = { dayKey: string; count: number };

/**
 * I prossimi N giorni CON ripassi, in ordine, a partire da domani —
 * alimenta le righe "Domani · 3 ricordi" della Home. `now` è iniettabile
 * per i test.
 */
export function upcomingDays(
  counts: ReadonlyMap<string, number>,
  limit: number,
  now: Date = new Date(),
): UpcomingDay[] {
  const todayKey = dayKeyOf(now);
  return [...counts.entries()]
    .filter(([dayKey, count]) => dayKey > todayKey && count > 0)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(0, limit)
    .map(([dayKey, count]) => ({ dayKey, count }));
}
