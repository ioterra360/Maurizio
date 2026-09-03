/**
 * Notifiche locali — la parte PURA (spec 2026-09-02 §F3).
 *
 * Qui non c'è expo-notifications, React, Supabase: solo aritmetica di orari,
 * identificatori e payload. È il pezzo coperto da vitest; il wrapper che
 * parla con l'OS è lib/notifications.ts.
 *
 * Confine di giornata: la MEZZANOTTE LOCALE del telefono, come
 * lib/upcoming.ts — il promemoria "alle 08:00" è alle 08:00 dove sta
 * l'utente, non a Greenwich.
 */

export const DAILY_REMINDER_ID = "daily-reminder";
export const FIRST_REVIEW_ID_PREFIX = "first-review:";
/** Canale Android. Importanza e suono sono immutabili dopo la creazione: per cambiarli serve un id nuovo. */
export const REMINDER_CHANNEL_ID = "reminders";
export const DEFAULT_REMINDER_SLOT = "08:00";

/** Sotto questo margine iOS rifiuta la data (promise rigettata) e Android la perde in silenzio. */
const MIN_LEAD_MS = 2000;

const pad = (n: number) => String(n).padStart(2, "0");

/** I 48 slot da mezz'ora della giornata, "HH:MM". */
export function reminderSlots(): string[] {
  const out: string[] = [];
  for (let h = 0; h < 24; h++) {
    out.push(`${pad(h)}:00`, `${pad(h)}:30`);
  }
  return out;
}

/** "HH:MM" o "HH:MM:SS" (com'è la colonna `time` di Postgres) → ore e minuti. */
export function parseSlot(value: string): { hour: number; minute: number } | null {
  const m = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

/**
 * Da `profiles.morning_review_at` allo slot della lista. La colonna accetta
 * qualunque minuto; la lista no, quindi si arrotonda PER DIFETTO alla
 * mezz'ora. Valore assente o rotto → default.
 */
export function slotFromProfileTime(value: string | null | undefined): string {
  const p = value ? parseSlot(value) : null;
  if (!p) return DEFAULT_REMINDER_SLOT;
  return `${pad(p.hour)}:${p.minute >= 30 ? "30" : "00"}`;
}

/**
 * Il prossimo scatto di uno slot, in ora locale: oggi se deve ancora
 * arrivare, altrimenti domani. Usato per la riga "Prossimo promemoria: …";
 * il trigger DAILY dell'OS fa lo stesso conto per conto suo.
 */
export function nextDailyTrigger(slot: string, now: Date = new Date()): Date | null {
  const p = parseSlot(slot);
  if (!p) return null;
  const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), p.hour, p.minute, 0, 0);
  if (candidate.getTime() <= now.getTime()) candidate.setDate(candidate.getDate() + 1);
  return candidate;
}

/** Il promemoria giornaliero esiste solo con permesso, interruttore acceso e modalità calma spenta (spec :331). */
export function shouldScheduleDaily(d: { enabled: boolean; calmMode: boolean; allowed: boolean }): boolean {
  return d.enabled && d.allowed && !d.calmMode;
}

/** L'avviso del primo ripasso ignora la modalità calma: è "il punto 20 reso visibile". */
export function shouldScheduleFirstReview(d: { enabled: boolean; firstReview: boolean; allowed: boolean }): boolean {
  return d.enabled && d.allowed && d.firstReview;
}

/** Vero solo se l'istante è nel futuro con margine. */
export function canScheduleAt(iso: string, now: Date = new Date()): boolean {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return false;
  return ms > now.getTime() + MIN_LEAD_MS;
}

export function firstReviewIdentifier(memoryId: string): string {
  return `${FIRST_REVIEW_ID_PREFIX}${memoryId}`;
}

/** Cosa viaggia dentro `content.data`. Solo stringhe: deve essere serializzabile. */
export type NotificationPayload =
  | { kind: "first-review"; memoryId: string; folderId: string }
  | { kind: "daily" };

export function firstReviewPayload(memoryId: string, folderId: string): NotificationPayload {
  return { kind: "first-review", memoryId, folderId };
}

export function dailyPayload(): NotificationPayload {
  return { kind: "daily" };
}

function asRecord(data: unknown): Record<string, unknown> | null {
  return data && typeof data === "object" ? (data as Record<string, unknown>) : null;
}

export function isFirstReviewPayload(data: unknown): boolean {
  const d = asRecord(data);
  return !!d && d.kind === "first-review" && typeof d.memoryId === "string" && d.memoryId.length > 0;
}

export function isFirstReviewInFolder(data: unknown, folderId: string): boolean {
  const d = asRecord(data);
  return isFirstReviewPayload(data) && !!d && d.folderId === folderId;
}

/** Dove porta il tocco. Stessa forma degli Href di expo-router (cfr. app/(app)/upcoming.tsx:347). */
export type NotificationRoute =
  | { pathname: "/memory/[id]"; params: { id: string } }
  | { pathname: "/(app)/today" };

export function routeForPayload(data: unknown): NotificationRoute | null {
  const d = asRecord(data);
  if (!d) return null;
  if (d.kind === "daily") return { pathname: "/(app)/today" };
  if (isFirstReviewPayload(d)) return { pathname: "/memory/[id]", params: { id: d.memoryId as string } };
  return null;
}
