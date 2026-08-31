import { describe, expect, it } from "vitest";

import {
  DEMO_DUE_COUNTS,
  allocateByFolderPriority,
  layerFor,
  layerMinutes,
  splitBudget,
  toReviewCard,
  totalMinutes,
} from "./queue";
import type { Memory } from "./mappers";

const mem = (over: Partial<Memory> = {}): Memory => ({
  id: "m1",
  userId: "u1",
  folderId: "f1",
  term: "biblioteca",
  reading: null,
  definition: "Library",
  example: null,
  itemType: "word",
  state: "active",
  srs: { intervalDays: 1, easeFactor: 2.5, repetitions: 0 },
  subfolderId: null,
  deletedAt: null,
  lastReviewedAt: null,
  nextReviewAt: "2026-07-25T08:00:00.000Z",
  createdAt: "2026-07-20T08:00:00.000Z",
  updatedAt: "2026-07-20T08:00:00.000Z",
  ...over,
});

describe("splitBudget", () => {
  it("returns everything when under cap", () => {
    expect(splitBudget({ scan: 3, reinforcement: 2, focus: 1 }, 28)).toEqual({
      scan: 3,
      reinforcement: 2,
      focus: 1,
    });
  });

  it("splits proportionally with remainder to scan first", () => {
    // totale 20, cap 8 → quote floor: scan 4, reinf 2, focus 1 (somma 7), resto 1 → scan
    expect(splitBudget({ scan: 10, reinforcement: 6, focus: 4 }, 8)).toEqual({
      scan: 5,
      reinforcement: 2,
      focus: 1,
    });
  });

  it("never allocates beyond a layer's own queue", () => {
    const r = splitBudget({ scan: 1, reinforcement: 0, focus: 30 }, 8);
    expect(r.scan).toBe(1);
    expect(r.reinforcement).toBe(0);
    expect(r.scan + r.reinforcement + r.focus).toBe(8);
  });

  it("handles empty queue", () => {
    expect(splitBudget({ scan: 0, reinforcement: 0, focus: 0 }, 28)).toEqual({
      scan: 0,
      reinforcement: 0,
      focus: 0,
    });
  });
});

describe("minutes", () => {
  it("estimates per layer (ceil, min 1 when non-empty)", () => {
    expect(layerMinutes("scan", 0)).toBe(0);
    expect(layerMinutes("scan", 1)).toBe(1);
    expect(layerMinutes("focus", 6)).toBe(4); // 240s
  });

  it("totals the three layers", () => {
    expect(totalMinutes({ scan: 3, reinforcement: 0, focus: 0 })).toBe(1);
  });
});

describe("toReviewCard", () => {
  it("maps a Memory including the composed SRS snapshot", () => {
    const c = toReviewCard(mem(), "Spanish", "es");
    expect(c).toMatchObject({
      id: "m1",
      front: "biblioteca",
      back: "Library",
      folder: "Spanish",
      folderKind: "es",
    });
    expect(c.srs).toEqual({
      intervalDays: 1,
      easeFactor: 2.5,
      repetitions: 0,
      nextReviewAt: "2026-07-25T08:00:00.000Z",
      lastReviewedAt: null,
    });
  });

  it("falls back to example as hint and omits empties", () => {
    const c = toReviewCard(mem({ example: "¡Voy a la biblioteca!" }), "Spanish");
    expect(c.hint).toBe("¡Voy a la biblioteca!");
    expect(toReviewCard(mem(), "Spanish").hint).toBeUndefined();
    expect(toReviewCard(mem(), "Spanish").reading).toBeUndefined();
  });
});

describe("DEMO_DUE_COUNTS", () => {
  it("mirrors the static demo deck sizes", () => {
    expect(DEMO_DUE_COUNTS).toEqual({ scan: 4, reinforcement: 3, focus: 3 });
  });
});

describe("layerFor — Maurizio's phase ladder on SM-2 repetitions", () => {
  it("sends new and once-reviewed cards to Focus (20h / 48h consolidations)", () => {
    expect(layerFor(0, "active")).toBe("focus");
    expect(layerFor(1, "active")).toBe("focus");
  });

  it("sends the 7-day and 30-day phases to Reinforcement", () => {
    expect(layerFor(2, "active")).toBe("reinforcement");
    expect(layerFor(3, "active")).toBe("reinforcement");
  });

  it("sends everything from 3 months on to Scan", () => {
    expect(layerFor(4, "active")).toBe("scan");
    expect(layerFor(12, "active")).toBe("scan");
  });

  it("routes fading cards to Reinforcement whatever their count", () => {
    expect(layerFor(0, "fading")).toBe("reinforcement");
    expect(layerFor(9, "fading")).toBe("reinforcement");
  });

  it("keeps archived cards out of every layer", () => {
    expect(layerFor(0, "archived")).toBeNull();
    expect(layerFor(5, "archived")).toBeNull();
  });
});

describe("allocateByFolderPriority — folders higher in the list come first", () => {
  const due = (id: string, folderId: string, next: string) =>
    mem({ id, folderId, nextReviewAt: next });
  const items = [
    due("b1", "B", "2026-08-01T08:00:00.000Z"),
    due("a1", "A", "2026-08-03T08:00:00.000Z"),
    due("b2", "B", "2026-08-02T08:00:00.000Z"),
    due("a2", "A", "2026-08-02T08:00:00.000Z"),
    due("c1", "C", "2026-08-01T08:00:00.000Z"),
  ];
  const priority = new Map([["A", 1], ["B", 2], ["C", 3]]);

  it("guarantees every folder its most urgent card when the cap allows, then fills by priority", () => {
    // 3 folders with due cards, cap 3: one each, in priority order.
    expect(allocateByFolderPriority(items, priority, 3).map((m) => m.id)).toEqual(["a2", "b1", "c1"]);
    // cap 4: the floor plus the next card of the top folder, deck kept in priority order.
    expect(allocateByFolderPriority(items, priority, 4).map((m) => m.id)).toEqual(["a2", "a1", "b1", "c1"]);
  });

  it("falls back to strict priority when the cap cannot touch every folder", () => {
    expect(allocateByFolderPriority(items, priority, 2).map((m) => m.id)).toEqual(["a2", "a1"]);
  });

  it("returns everything in priority order when under the cap", () => {
    expect(allocateByFolderPriority(items, priority, 10).map((m) => m.id)).toEqual(["a2", "a1", "b1", "b2", "c1"]);
  });

  it("puts folders without a known priority last, and never mutates the input", () => {
    const copy = [...items];
    const out = allocateByFolderPriority(items, new Map([["C", 1]]), 10);
    expect(out[0].id).toBe("c1");
    expect(items).toEqual(copy);
  });
});
