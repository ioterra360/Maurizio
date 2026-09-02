import { describe, expect, it } from "vitest";
import { mapMemory, toPhaseState, type MemoryRow } from "./mappers";

const row = (over: Partial<MemoryRow> = {}): MemoryRow => ({
  id: "m1",
  user_id: "u1",
  folder_id: "f1",
  term: "embargo",
  reading: null,
  definition: "blocco commerciale",
  example: null,
  item_type: null,
  state: "active",
  srs_interval_days: 0,
  srs_ease_factor: 2.5,
  srs_repetitions: 0,
  last_reviewed_at: null,
  next_review_at: "2026-09-03T06:00:00.000Z",
  review_phase: "p20h",
  review_window_end: "2026-09-04T10:00:00.000Z",
  recovery_from: null,
  created_at: "2026-09-02T10:00:00.000Z",
  updated_at: "2026-09-02T10:00:00.000Z",
  ...over,
});

describe("mapMemory — campi di fase", () => {
  it("porta fase, finestra e recupero nel modello", () => {
    const m = mapMemory(row());
    expect(m.phase).toBe("p20h");
    expect(m.reviewWindowEnd).toBe("2026-09-04T10:00:00.000Z");
    expect(m.recoveryFrom).toBeNull();
  });

  it("una riga vecchia senza colonne di fase non esplode", () => {
    const m = mapMemory(row({ review_phase: undefined, review_window_end: undefined }));
    expect(m.phase).toBe("p20h");
    expect(m.reviewWindowEnd).toBeNull();
  });
});

describe("toPhaseState", () => {
  it("ricompone lo stato che il motore si aspetta", () => {
    expect(toPhaseState(mapMemory(row()))).toEqual({
      phase: "p20h",
      nextReviewAt: "2026-09-03T06:00:00.000Z",
      reviewWindowEnd: "2026-09-04T10:00:00.000Z",
      recoveryFrom: null,
      lastReviewedAt: null,
    });
  });
});
