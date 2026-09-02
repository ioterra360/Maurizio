import { describe, expect, it } from "vitest";
import { dayKeyOf, groupByLocalDay, localDayKey, upcomingDays } from "./upcoming";

// Le date sono costruite da componenti LOCALI, così i test non dipendono
// dal fuso della macchina che li esegue.
const local = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);

describe("localDayKey — mezzanotte locale, non UTC", () => {
  it("un ripasso alle 23:30 locali resta nel suo giorno", () => {
    expect(localDayKey(local(2026, 9, 3, 23).toISOString())).toBe("2026-09-03");
  });

  it("un ripasso alle 00:30 locali cade nel giorno nuovo", () => {
    expect(localDayKey(local(2026, 9, 4, 0).toISOString())).toBe("2026-09-04");
  });

  it("una data invalida torna null invece di NaN-NaN-NaN", () => {
    expect(localDayKey("non-una-data")).toBeNull();
  });
});

describe("groupByLocalDay", () => {
  it("conta per giorno e scarta le date rotte", () => {
    const counts = groupByLocalDay([
      { nextReviewAt: local(2026, 9, 3).toISOString() },
      { nextReviewAt: local(2026, 9, 3, 20).toISOString() },
      { nextReviewAt: local(2026, 9, 5).toISOString() },
      { nextReviewAt: "garbage" },
    ]);
    expect(counts.get("2026-09-03")).toBe(2);
    expect(counts.get("2026-09-05")).toBe(1);
    expect(counts.size).toBe(2);
  });
});

describe("upcomingDays", () => {
  const now = local(2026, 9, 2);
  const counts = new Map([
    ["2026-09-01", 4], // ieri: fuori
    ["2026-09-02", 8], // oggi: fuori (la Home lo mostra nella card hero)
    ["2026-09-03", 5],
    ["2026-09-08", 7],
    ["2026-09-04", 2],
  ]);

  it("parte da domani, in ordine, limitato", () => {
    expect(upcomingDays(counts, 2, now)).toEqual([
      { dayKey: "2026-09-03", count: 5 },
      { dayKey: "2026-09-04", count: 2 },
    ]);
  });

  it("senza limite copre tutti i giorni futuri con ripassi", () => {
    expect(upcomingDays(counts, 10, now).map((d) => d.dayKey)).toEqual([
      "2026-09-03",
      "2026-09-04",
      "2026-09-08",
    ]);
  });

  it("dayKeyOf e localDayKey concordano", () => {
    const d = local(2026, 12, 31, 23);
    expect(dayKeyOf(d)).toBe(localDayKey(d.toISOString()));
  });
});
