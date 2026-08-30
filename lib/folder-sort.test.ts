import { describe, expect, it } from "vitest";

import { FOLDER_SORTS, isFolderSort, sortMemories } from "./folder-sort";
import type { Memory } from "./mappers";

const mem = (over: Partial<Memory>): Memory => ({
  id: "m",
  userId: "u1",
  folderId: "f1",
  term: "x",
  reading: null,
  definition: "d",
  example: null,
  itemType: "word",
  state: "active",
  srs: { intervalDays: 1, easeFactor: 2.5, repetitions: 0 },
  deletedAt: null,
  lastReviewedAt: null,
  nextReviewAt: "2026-08-29T08:00:00.000Z",
  createdAt: "2026-08-01T08:00:00.000Z",
  updatedAt: "2026-08-01T08:00:00.000Z",
  ...over,
});

const items = [
  mem({ id: "a", term: "zapato", createdAt: "2026-08-03T08:00:00.000Z", nextReviewAt: "2026-08-30T08:00:00.000Z" }),
  mem({ id: "b", term: "Ámbito", createdAt: "2026-08-01T08:00:00.000Z", nextReviewAt: "2026-08-28T08:00:00.000Z" }),
  mem({ id: "c", term: "biblioteca", createdAt: "2026-08-02T08:00:00.000Z", nextReviewAt: "2026-08-29T08:00:00.000Z" }),
];

describe("sortMemories", () => {
  it("'due' keeps the queue order (soonest next review first)", () => {
    expect(sortMemories(items, "due").map((m) => m.id)).toEqual(["b", "c", "a"]);
  });

  it("'alpha' sorts A to Z ignoring case and accents", () => {
    expect(sortMemories(items, "alpha").map((m) => m.term)).toEqual(["Ámbito", "biblioteca", "zapato"]);
  });

  it("'alpha' uses the reading when the term is not alphabetic (kanji)", () => {
    const jp = [
      mem({ id: "1", term: "時間", reading: "jikan" }),
      mem({ id: "2", term: "医者", reading: "isha" }),
    ];
    expect(sortMemories(jp, "alpha").map((m) => m.id)).toEqual(["2", "1"]);
  });

  it("'newest' puts the most recently added first, 'oldest' the reverse", () => {
    expect(sortMemories(items, "newest").map((m) => m.id)).toEqual(["a", "c", "b"]);
    expect(sortMemories(items, "oldest").map((m) => m.id)).toEqual(["b", "c", "a"]);
  });

  it("does not mutate the input", () => {
    const copy = [...items];
    sortMemories(items, "alpha");
    expect(items).toEqual(copy);
  });

  it("validates persisted values", () => {
    expect(FOLDER_SORTS).toEqual(["due", "alpha", "newest", "oldest"]);
    expect(isFolderSort("alpha")).toBe(true);
    expect(isFolderSort("garbage")).toBe(false);
  });
});
