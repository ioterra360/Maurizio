import { describe, expect, it } from "vitest";

import { trashHoursLeft, TRASH_RETENTION_HOURS } from "./trash";

const T0 = "2026-08-30T12:00:00.000Z";
const at = (hoursAfter: number) => new Date(Date.parse(T0) + hoursAfter * 3_600_000);

describe("trashHoursLeft — hours until auto-purge of a trashed item", () => {
  it("shows the full retention right after deletion", () => {
    expect(trashHoursLeft(T0, at(0))).toBe(TRASH_RETENTION_HOURS);
  });

  it("rounds up partial hours so the label never overpromises", () => {
    // 23.5 h left → "24 h" would overpromise; 23.5 → ceil = 24? No: after
    // 30 min, 23.5 h remain → the user reads "24 ore" only if we ceil.
    // We ceil so "1 ora" still shows while 10 minutes remain.
    expect(trashHoursLeft(T0, at(23.8))).toBe(1);
    expect(trashHoursLeft(T0, at(0.5))).toBe(24);
  });

  it("never goes below zero once the purge window has passed", () => {
    expect(trashHoursLeft(T0, at(25))).toBe(0);
    expect(trashHoursLeft(T0, at(24))).toBe(0);
  });

  it("treats an unparsable timestamp as expired", () => {
    expect(trashHoursLeft("not-a-date", at(0))).toBe(0);
  });
});
