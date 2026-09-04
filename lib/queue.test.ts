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
  photoPath: null,
  lastReviewedAt: null,
  nextReviewAt: "2026-07-25T08:00:00.000Z",
  phase: "p20h",
  reviewWindowEnd: "2026-07-27T08:00:00.000Z",
  recoveryFrom: null,
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

  it("porta photoPath sulla carta, undefined quando il ricordo non ha foto", () => {
    expect(toReviewCard(mem({ photoPath: "u1/m1.jpg" }), "Spanish").photoPath).toBe("u1/m1.jpg");
    expect(toReviewCard(mem(), "Spanish").photoPath).toBeUndefined();
  });
});

describe("DEMO_DUE_COUNTS", () => {
  it("mirrors the static demo deck sizes", () => {
    expect(DEMO_DUE_COUNTS).toEqual({ scan: 4, reinforcement: 3, focus: 3 });
  });
});

describe("layerFor", () => {
  it("manda i due consolidamenti a Focus", () => {
    expect(layerFor("p20h", "active")).toBe("focus");
    expect(layerFor("p48h", "active")).toBe("focus");
  });

  it("manda 7 e 30 giorni a Reinforcement", () => {
    expect(layerFor("p7d", "active")).toBe("reinforcement");
    expect(layerFor("p30d", "active")).toBe("reinforcement");
  });

  it("manda da 3 mesi in poi a Scan", () => {
    expect(layerFor("p3m", "active")).toBe("scan");
    expect(layerFor("p1y", "active")).toBe("scan");
  });

  it("una carta archiviata non sta in nessuna coda", () => {
    expect(layerFor("p20h", "archived")).toBeNull();
  });

  it("una carta in ritardo resta nel layer della SUA fase", () => {
    // Prima le carte fading finivano tutte in Reinforcement. Ora il layer
    // dipende dalla fase; il ritardo cambia solo l'ordine in coda.
    expect(layerFor("p3m", "fading")).toBe("scan");
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
