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

import { dayKeyOf } from "./upcoming";

/**
 * Il vecchio trigger "ogni giorno" (fino all'8/9/2026). Le installazioni
 * attuali lo hanno ancora in attesa: la sincronizzazione lo cancella.
 */
export const LEGACY_DAILY_REMINDER_ID = "daily-reminder";
export const DAILY_ID_PREFIX = "daily:";
/** Quanti giorni avanti si programma il promemoria (spec 2026-09-08). Oltre, serve riaprire l'app. */
export const DAILY_HORIZON_DAYS = 14;
export const FIRST_REVIEW_ID_PREFIX = "first-review:";
/** Canale Android. Importanza e suono sono immutabili dopo la creazione: per cambiarli serve un id nuovo. */
export const REMINDER_CHANNEL_ID = "reminders";
export const DEFAULT_REMINDER_SLOT = "08:00";

/** Sotto questo margine iOS rifiuta la data (promise rigettata) e Android la perde in silenzio. */
const MIN_LEAD_MS = 2000;

const pad = (n: number) => String(n).padStart(2, "0");

/** Ore e minuti → "HH:MM", il formato della colonna `time` senza secondi. */
export function formatSlot(hour: number, minute: number): string {
  return `${pad(hour)}:${pad(minute)}`;
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
 * Da `profiles.morning_review_at` ("HH:MM:SS", colonna `time`) a "HH:MM".
 * Fino al 6/9/2026 arrotondava alla mezz'ora perche' la schermata offriva 48
 * caselle; ora il selettore a rulli accetta qualunque minuto e il valore
 * passa intero. Valore assente o rotto → default.
 */
export function slotFromProfileTime(value: string | null | undefined): string {
  const p = value ? parseSlot(value) : null;
  if (!p) return DEFAULT_REMINDER_SLOT;
  return formatSlot(p.hour, p.minute);
}

/** Identificatore stabile per giorno locale: ri-programmare lo stesso giorno sostituisce. */
export function dailyIdentifier(dayKey: string): string {
  return `${DAILY_ID_PREFIX}${dayKey}`;
}

/** `dailyIdentifier` di un istante del piano. */
export function dailyIdentifierFor(at: Date): string {
  return dailyIdentifier(dayKeyOf(at));
}

/**
 * Vero se lo slot di OGGI scatta entro il margine minimo, cioe' e' gia'
 * stato consegnato all'OS e sta per suonare. `dailyPlan` lo scarta (non si
 * puo' programmare cosi' a ridosso), ma chi ripulisce le notifiche in
 * attesa non deve cancellarlo: sarebbe l'unico modo di perdere il
 * promemoria del giorno, per una finestra di due secondi.
 */
export function dailySlotAboutToFire(slot: string, now: Date = new Date()): boolean {
  const p = parseSlot(slot);
  if (!p) return false;
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), p.hour, p.minute, 0, 0).getTime();
  return at > now.getTime() && at <= now.getTime() + MIN_LEAD_MS;
}

/**
 * Gli istanti del promemoria nei prossimi `horizonDays` giorni, a partire
 * da OGGI. Il giorno d entra se il suo slot e' nel futuro con margine
 * (`MIN_LEAD_MS`) E la data di ripasso piu' vicina (`earliestDueAt`) lo
 * precede. Un ricordo in coda resta in coda finche' non viene ripassato:
 * dal primo giorno utile in poi, tutti. Date locali da componenti: reggono
 * cambio mese e ora legale. Niente in coda, slot o data rotti: `[]`.
 */
export function dailyPlan(input: {
  earliestDueAt: string | null;
  slot: string;
  now?: Date;
  horizonDays?: number;
}): Date[] {
  const p = parseSlot(input.slot);
  if (!p || !input.earliestDueAt) return [];
  const earliest = Date.parse(input.earliestDueAt);
  if (Number.isNaN(earliest)) return [];
  const now = input.now ?? new Date();
  const horizon = input.horizonDays ?? DAILY_HORIZON_DAYS;
  const out: Date[] = [];
  for (let d = 0; d < horizon; d++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, p.hour, p.minute, 0, 0);
    if (at.getTime() <= now.getTime() + MIN_LEAD_MS) continue;
    if (earliest > at.getTime()) continue;
    out.push(at);
  }
  return out;
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

/**
 * Tetto delle richieste di primo ripasso che possono stare IN ATTESA
 * nell'OS. iOS ne tiene al massimo 64 per app e scarta le altre IN
 * SILENZIO, conservando le più imminenti: `scheduleNotificationAsync` non
 * segnala nulla, quindi nessuno qui può accorgersene. Oltre il tetto gli
 * sfrattati naturali sono i promemoria in fondo all'orizzonte, che
 * scattano più tardi della raffica dei primi ripassi — l'utente perderebbe
 * l'avviso del mattino senza un segnale da nessuna parte.
 *
 * 45 e non 64: 45 + DAILY_HORIZON_DAYS (14) = 59, e il margine ospita
 * qualunque secondo tipo di notifica che verrà dopo.
 */
export const MAX_PENDING_FIRST_REVIEWS = 45;

/**
 * Vero se questo primo ripasso NON va programmato perché la coda è piena.
 * `pending` sono gli identificatori dei primi ripassi già in attesa.
 *
 * Un id GIÀ in coda non è mai bloccato: ri-programmarlo SOSTITUISCE la
 * richiesta esistente invece di aggiungerne una (è quello che fa
 * app/memory/[id].tsx a ogni modifica del ricordo), quindi il totale non
 * cresce e rifiutarlo lascerebbe in attesa l'orario vecchio.
 */
export function firstReviewCapReached(pending: readonly string[], identifier: string): boolean {
  if (pending.includes(identifier)) return false;
  return pending.length >= MAX_PENDING_FIRST_REVIEWS;
}

/** Cosa viaggia dentro `content.data`. Solo stringhe: deve essere serializzabile. */
export type NotificationPayload =
  | { kind: "first-review"; memoryId: string; folderId: string }
  | { kind: "daily"; dayKey: string };

export function firstReviewPayload(memoryId: string, folderId: string): NotificationPayload {
  return { kind: "first-review", memoryId, folderId };
}

export function dailyPayload(dayKey: string): NotificationPayload {
  return { kind: "daily", dayKey };
}

function asRecord(data: unknown): Record<string, unknown> | null {
  return data && typeof data === "object" ? (data as Record<string, unknown>) : null;
}

/** Vero per il payload nuovo (con dayKey) E per quello vecchio `{ kind: "daily" }`. */
export function isDailyPayload(data: unknown): boolean {
  const d = asRecord(data);
  return !!d && d.kind === "daily";
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
