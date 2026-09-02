/**
 * SRS types — kept narrow so the scheduler stays a pure function.
 *
 * Dal 2026-09-02 il motore è la scala a fasi di Maurizio (./phases.ts), non
 * più SM-2. Il vocabolario SM-2 (quality, ease, LayerOutcome, UpdatedSrs) è
 * stato ritirato insieme a scheduler.ts; restano qui solo i tipi che il
 * resto dell'app usa ancora.
 */

export type MemoryLifecycleState = "active" | "fading" | "archived";

/** Ri-export così i consumatori non devono dual-importare da phases.ts. */
export type { PhaseState, ReviewPhase } from "./phases";

/**
 * Snapshot delle colonne srs_* legacy della riga memories. Lo scheduler non
 * le legge più; il tipo sopravvive finché le colonne esistono a DB e
 * ReviewCard le trasporta. Va via con la migrazione che le rimuove.
 */
export type SrsState = {
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  /** ISO timestamp of when the memory should next surface in the queue. */
  nextReviewAt: string;
  /** ISO timestamp of when the memory was last reviewed (null on first ever). */
  lastReviewedAt: string | null;
};
