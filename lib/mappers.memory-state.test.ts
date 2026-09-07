import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Platform: { OS: "android" },
  I18nManager: { getConstants: () => ({ localeIdentifier: "it_IT" }) },
  NativeModules: {},
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: vi.fn(async () => null), setItem: vi.fn(async () => {}), removeItem: vi.fn(async () => {}) },
}));

import { mapMemory, type MemoryRow } from "./mappers";

const HOUR = 60 * 60 * 1000;

function row(overrides: Partial<MemoryRow> = {}): MemoryRow {
  return {
    id: "m1",
    user_id: "u1",
    folder_id: "f1",
    term: "ámbito",
    reading: null,
    definition: "ambito",
    example: null,
    item_type: "word",
    state: "active",
    srs_interval_days: 1,
    srs_ease_factor: "2.50",
    srs_repetitions: 0,
    last_reviewed_at: null,
    next_review_at: new Date(Date.now() + HOUR).toISOString(),
    created_at: "2026-09-01T10:00:00.000Z",
    updated_at: "2026-09-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("mapMemory: review_count", () => {
  it("legge la colonna, 0 se un client vecchio non la vede", () => {
    expect(mapMemory(row({ review_count: 7 })).reviewCount).toBe(7);
    expect(mapMemory(row({ review_count: null })).reviewCount).toBe(0);
    expect(mapMemory(row()).reviewCount).toBe(0);
  });
});

describe("mapMemory: lo stato si calcola alla lettura", () => {
  it("finestra scaduta adesso → in dissolvenza, anche se la colonna dice active", () => {
    const past = new Date(Date.now() - HOUR).toISOString();
    expect(mapMemory(row({ state: "active", review_window_end: past })).state).toBe("fading");
  });

  it("finestra viva → attivo, anche se la colonna dice fading (risposta in ritardo di ieri)", () => {
    const future = new Date(Date.now() + 24 * HOUR).toISOString();
    expect(mapMemory(row({ state: "fading", review_window_end: future })).state).toBe("active");
  });

  it("senza finestra (done) → attivo; archiviato resta archiviato", () => {
    expect(mapMemory(row({ state: "fading", review_window_end: null })).state).toBe("active");
    const past = new Date(Date.now() - HOUR).toISOString();
    expect(mapMemory(row({ state: "archived", review_window_end: past })).state).toBe("archived");
  });
});
