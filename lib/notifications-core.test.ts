import { describe, expect, it } from "vitest";
import {
  DAILY_REMINDER_ID,
  DEFAULT_REMINDER_SLOT,
  canScheduleAt,
  dailyPayload,
  firstReviewIdentifier,
  firstReviewPayload,
  isFirstReviewInFolder,
  isFirstReviewPayload,
  nextDailyTrigger,
  parseSlot,
  reminderSlots,
  routeForPayload,
  shouldScheduleDaily,
  shouldScheduleFirstReview,
  slotFromProfileTime,
} from "./notifications-core";

// Date costruite da componenti LOCALI (come lib/upcoming.test.ts): i test
// non dipendono dal fuso della macchina che li esegue.
const local = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min);

describe("reminderSlots", () => {
  it("sono 48 slot da mezz'ora, da 00:00 a 23:30", () => {
    const s = reminderSlots();
    expect(s).toHaveLength(48);
    expect(s[0]).toBe("00:00");
    expect(s[1]).toBe("00:30");
    expect(s[47]).toBe("23:30");
    for (const x of s) expect(x).toMatch(/^\d{2}:(00|30)$/);
  });

  it("contengono il default", () => {
    expect(reminderSlots()).toContain(DEFAULT_REMINDER_SLOT);
  });
});

describe("parseSlot", () => {
  it("legge HH:MM e HH:MM:SS (Postgres time)", () => {
    expect(parseSlot("08:30")).toEqual({ hour: 8, minute: 30 });
    expect(parseSlot("21:30:00")).toEqual({ hour: 21, minute: 30 });
  });

  it("rifiuta orari fuori scala o malformati", () => {
    expect(parseSlot("24:00")).toBeNull();
    expect(parseSlot("08:60")).toBeNull();
    expect(parseSlot("8:30")).toBeNull();
    expect(parseSlot("")).toBeNull();
    expect(parseSlot("domani")).toBeNull();
  });
});

describe("slotFromProfileTime", () => {
  it("arrotonda per difetto alla mezz'ora", () => {
    expect(slotFromProfileTime("08:00:00")).toBe("08:00");
    expect(slotFromProfileTime("08:15:00")).toBe("08:00");
    expect(slotFromProfileTime("08:45:00")).toBe("08:30");
    expect(slotFromProfileTime("21:30:00")).toBe("21:30");
  });

  it("torna al default su null o spazzatura", () => {
    expect(slotFromProfileTime(null)).toBe("08:00");
    expect(slotFromProfileTime(undefined)).toBe("08:00");
    expect(slotFromProfileTime("garbage")).toBe("08:00");
  });
});

describe("nextDailyTrigger — ora locale, mezzanotte locale", () => {
  it("oggi, se l'orario deve ancora arrivare", () => {
    const now = local(2026, 9, 3, 7, 0);
    expect(nextDailyTrigger("08:00", now)?.getTime()).toBe(local(2026, 9, 3, 8, 0).getTime());
  });

  it("domani, se l'orario è già passato", () => {
    const now = local(2026, 9, 3, 9, 0);
    expect(nextDailyTrigger("08:00", now)?.getTime()).toBe(local(2026, 9, 4, 8, 0).getTime());
  });

  it("domani, se è esattamente adesso", () => {
    const now = local(2026, 9, 3, 8, 0);
    expect(nextDailyTrigger("08:00", now)?.getTime()).toBe(local(2026, 9, 4, 8, 0).getTime());
  });

  it("scavalca il cambio di mese", () => {
    const now = local(2026, 9, 30, 23, 0);
    expect(nextDailyTrigger("08:00", now)?.getTime()).toBe(local(2026, 10, 1, 8, 0).getTime());
  });

  it("uno slot invalido non produce una data", () => {
    expect(nextDailyTrigger("25:00", local(2026, 9, 3))).toBeNull();
  });
});

describe("i cancelli", () => {
  it("giornaliero: serve permesso + interruttore + calma spenta", () => {
    expect(shouldScheduleDaily({ enabled: true, calmMode: false, allowed: true })).toBe(true);
    expect(shouldScheduleDaily({ enabled: true, calmMode: true, allowed: true })).toBe(false);
    expect(shouldScheduleDaily({ enabled: false, calmMode: false, allowed: true })).toBe(false);
    expect(shouldScheduleDaily({ enabled: true, calmMode: false, allowed: false })).toBe(false);
  });

  it("primo ripasso: serve permesso + interruttore + Avvisami; la calma NON lo tocca", () => {
    expect(shouldScheduleFirstReview({ enabled: true, firstReview: true, allowed: true })).toBe(true);
    expect(shouldScheduleFirstReview({ enabled: true, firstReview: false, allowed: true })).toBe(false);
    expect(shouldScheduleFirstReview({ enabled: false, firstReview: true, allowed: true })).toBe(false);
    expect(shouldScheduleFirstReview({ enabled: true, firstReview: true, allowed: false })).toBe(false);
  });
});

describe("canScheduleAt", () => {
  const now = local(2026, 9, 3, 10, 0);
  it("solo nel futuro, con margine: iOS rifiuta le date passate, Android le perde in silenzio", () => {
    expect(canScheduleAt(local(2026, 9, 3, 9, 0).toISOString(), now)).toBe(false);
    expect(canScheduleAt(new Date(now.getTime() + 1000).toISOString(), now)).toBe(false);
    expect(canScheduleAt(new Date(now.getTime() + 60_000).toISOString(), now)).toBe(true);
    expect(canScheduleAt("non-una-data", now)).toBe(false);
  });
});

describe("identificatori, payload e rotte", () => {
  it("l'identificatore deriva dal ricordo: ri-programmare sostituisce, cancellare è idempotente", () => {
    expect(firstReviewIdentifier("abc")).toBe("first-review:abc");
    expect(DAILY_REMINDER_ID).toBe("daily-reminder");
  });

  it("il primo ripasso porta alla scheda del ricordo", () => {
    expect(routeForPayload(firstReviewPayload("m1", "f1"))).toEqual({
      pathname: "/memory/[id]",
      params: { id: "m1" },
    });
  });

  it("il giornaliero porta a Oggi", () => {
    expect(routeForPayload(dailyPayload())).toEqual({ pathname: "/(app)/today" });
  });

  it("un payload sconosciuto non porta da nessuna parte", () => {
    expect(routeForPayload(null)).toBeNull();
    expect(routeForPayload({})).toBeNull();
    expect(routeForPayload({ kind: "first-review", memoryId: "" })).toBeNull();
    expect(routeForPayload({ kind: "boh" })).toBeNull();
  });

  it("riconosce i primi ripassi di una cartella", () => {
    expect(isFirstReviewPayload(firstReviewPayload("m1", "f1"))).toBe(true);
    expect(isFirstReviewPayload(dailyPayload())).toBe(false);
    expect(isFirstReviewInFolder(firstReviewPayload("m1", "f1"), "f1")).toBe(true);
    expect(isFirstReviewInFolder(firstReviewPayload("m1", "f1"), "f2")).toBe(false);
    expect(isFirstReviewInFolder(dailyPayload(), "f1")).toBe(false);
  });
});
