import { describe, expect, it } from "vitest";

import { mapMemory, type MemoryRow } from "./mappers";

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

describe("mapMemory — photo_path", () => {
  it("porta la chiave dell'oggetto nel modello", () => {
    expect(mapMemory(row({ photo_path: "u1/m1.jpg" })).photoPath).toBe("u1/m1.jpg");
  });

  it("null resta null", () => {
    expect(mapMemory(row({ photo_path: null })).photoPath).toBeNull();
  });

  it("una riga senza la colonna (client vecchio, migrazione non ancora applicata) → null", () => {
    expect(mapMemory(row()).photoPath).toBeNull();
  });
});
