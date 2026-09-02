/**
 * La scala di ripasso di Memika — modello a FASI FISSE, non SM-2.
 *
 * Fonte: materiale_maurizio/feedback_2026-08-28 (screenshot 00-05) e
 * Memora Timing System UPDATED.pdf §6/§15. Dove le due divergono valgono
 * gli screenshot, che sono posteriori.
 *
 * Funzione pura: stessi ingressi, stessa uscita. Niente React, niente
 * Supabase, niente I/O. Chi persiste è lib/api.ts.
 *
 * Perché a fasi e non SM-2: la scala ha intervalli SOTTO il giorno (20h) e
 * scadenze per fase, due cose che il vecchio motore non poteva esprimere —
 * lavorava a giorni interi per scelta dichiarata.
 */

import type { LayerKey } from "@/theme/tokens";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Sentinella per "non torna più in coda". Non usiamo null: next_review_at è NOT NULL a DB. */
const NEVER = new Date("2999-12-31T00:00:00.000Z");

export const REVIEW_PHASES = [
  "p20h",
  "p48h",
  "p7d",
  "p30d",
  "p3m",
  "p6m",
  "p1y",
  "done",
  "r24h",
  "r48h",
  "r3d",
  "r7d",
  "r14d",
  "r30d",
  "r2m",
] as const;

export type ReviewPhase = (typeof REVIEW_PHASES)[number];

export type PhaseSpec = {
  /** Da quanto tempo dall'ancoraggio la carta torna disponibile. */
  startMs: number;
  /** Entro quando andrebbe fatta. null = non scade mai. */
  endMs: number | null;
  /** Quanto si resta in Fading prima dell'archivio (usato dal piano archivio, non qui). */
  graceMs: number;
  layer: LayerKey;
  /** Fase successiva dopo un ripasso riuscito e IN ORARIO. */
  next: ReviewPhase;
};

/**
 * Le fasi di recupero (r*) rientrano nella scala canonica in un punto che
 * dipende da quanto era stabile il ricordo: chi dimentica a 20 ore riparte
 * da 48 ore, chi dimentica a un anno riparte da due mesi. "Più il ricordo
 * era vecchio e stabile, meno aggressivo deve essere il recupero."
 */
export const PHASE_SPEC: Record<ReviewPhase, PhaseSpec> = {
  p20h: { startMs: 20 * HOUR_MS, endMs: 48 * HOUR_MS, graceMs: 0, layer: "focus", next: "p48h" },
  p48h: { startMs: 48 * HOUR_MS, endMs: 72 * HOUR_MS, graceMs: 7 * DAY_MS, layer: "focus", next: "p7d" },
  p7d: { startMs: 7 * DAY_MS, endMs: 8 * DAY_MS, graceMs: 7 * DAY_MS, layer: "reinforcement", next: "p30d" },
  p30d: { startMs: 30 * DAY_MS, endMs: 32 * DAY_MS, graceMs: 14 * DAY_MS, layer: "reinforcement", next: "p3m" },
  p3m: { startMs: 90 * DAY_MS, endMs: 94 * DAY_MS, graceMs: 30 * DAY_MS, layer: "scan", next: "p6m" },
  p6m: { startMs: 180 * DAY_MS, endMs: 186 * DAY_MS, graceMs: 60 * DAY_MS, layer: "scan", next: "p1y" },
  p1y: { startMs: 365 * DAY_MS, endMs: 385 * DAY_MS, graceMs: 90 * DAY_MS, layer: "scan", next: "done" },
  done: { startMs: 0, endMs: null, graceMs: 0, layer: "scan", next: "done" },

  r24h: { startMs: 24 * HOUR_MS, endMs: 48 * HOUR_MS, graceMs: 7 * DAY_MS, layer: "focus", next: "r48h" },
  r48h: { startMs: 48 * HOUR_MS, endMs: 72 * HOUR_MS, graceMs: 7 * DAY_MS, layer: "focus", next: "p7d" },
  r3d: { startMs: 3 * DAY_MS, endMs: 4 * DAY_MS, graceMs: 7 * DAY_MS, layer: "reinforcement", next: "p7d" },
  r7d: { startMs: 7 * DAY_MS, endMs: 8 * DAY_MS, graceMs: 7 * DAY_MS, layer: "reinforcement", next: "p30d" },
  r14d: { startMs: 14 * DAY_MS, endMs: 16 * DAY_MS, graceMs: 14 * DAY_MS, layer: "reinforcement", next: "p30d" },
  r30d: { startMs: 30 * DAY_MS, endMs: 32 * DAY_MS, graceMs: 14 * DAY_MS, layer: "scan", next: "p3m" },
  r2m: { startMs: 60 * DAY_MS, endMs: 64 * DAY_MS, graceMs: 30 * DAY_MS, layer: "scan", next: "p3m" },
};

/** Stato di programmazione di un ricordo. Specchio esatto delle colonne DB. */
export type PhaseState = {
  phase: ReviewPhase;
  /** ISO. Inizio finestra: da qui la carta entra in coda. */
  nextReviewAt: string;
  /** ISO. Fine finestra: oltre questa la carta è in ritardo (fading). null = non scade. */
  reviewWindowEnd: string | null;
  /** Fase in cui è avvenuto il "dimenticato" che ha aperto il recupero. null = non in recupero. */
  recoveryFrom: ReviewPhase | null;
  /** ISO dell'ultimo ripasso, riuscito o no. null = mai ripassato. */
  lastReviewedAt: string | null;
};

export function layerForPhase(phase: ReviewPhase): LayerKey {
  return PHASE_SPEC[phase].layer;
}

/** Calcola inizio e fine finestra di una fase a partire dal suo ancoraggio. */
export function scheduleFor(
  phase: ReviewPhase,
  anchor: Date,
): { nextReviewAt: string; reviewWindowEnd: string | null } {
  const spec = PHASE_SPEC[phase];
  if (phase === "done") {
    return { nextReviewAt: NEVER.toISOString(), reviewWindowEnd: null };
  }
  return {
    nextReviewAt: new Date(anchor.getTime() + spec.startMs).toISOString(),
    reviewWindowEnd:
      spec.endMs === null ? null : new Date(anchor.getTime() + spec.endMs).toISOString(),
  };
}

/**
 * Stato di un ricordo appena creato. T0 = istante del salvataggio: TUTTO il
 * timing iniziale si conta da qui, non da quando l'utente apre l'app.
 */
export function firstReview(createdAt: Date = new Date()): PhaseState {
  return {
    phase: "p20h",
    ...scheduleFor("p20h", createdAt),
    recoveryFrom: null,
    lastReviewedAt: null,
  };
}
