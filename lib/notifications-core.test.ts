import { describe, expect, it } from "vitest";
import {
  DAILY_HORIZON_DAYS,
  DEFAULT_REMINDER_SLOT,
  LEGACY_DAILY_REMINDER_ID,
  MAX_PENDING_FIRST_REVIEWS,
  canScheduleAt,
  dailyIdentifier,
  dailyPayload,
  dailyPlan,
  dailySlotAboutToFire,
  firstReviewCapReached,
  firstReviewIdentifier,
  firstReviewPayload,
  isDailyPayload,
  isFirstReviewInFolder,
  isFirstReviewPayload,
  parseSlot,
  formatSlot,
  routeForPayload,
  shouldScheduleDaily,
  shouldScheduleFirstReview,
  slotFromProfileTime,
} from "./notifications-core";

// Date costruite da componenti LOCALI (come lib/upcoming.test.ts): i test
// non dipendono dal fuso della macchina che li esegue.
const local = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min);

describe("formatSlot", () => {
  it("HH:MM con zeri davanti", () => {
    expect(formatSlot(8, 5)).toBe("08:05");
    expect(formatSlot(23, 0)).toBe("23:00");
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
  it("tiene i minuti interi: il selettore a rulli non e' piu' a mezz'ore", () => {
    expect(slotFromProfileTime("08:00:00")).toBe("08:00");
    expect(slotFromProfileTime("08:15:00")).toBe("08:15");
    expect(slotFromProfileTime("08:45:00")).toBe("08:45");
    expect(slotFromProfileTime("21:30:00")).toBe("21:30");
  });

  it("torna al default su null o spazzatura", () => {
    expect(slotFromProfileTime(null)).toBe("08:00");
    expect(slotFromProfileTime(undefined)).toBe("08:00");
    expect(slotFromProfileTime("garbage")).toBe("08:00");
  });
});

describe("dailyPlan — solo i giorni con qualcosa in coda", () => {
  const iso = (d: Date) => d.toISOString();
  const at = (y: number, m: number, d: number, h = 8, min = 0) => local(y, m, d, h, min).getTime();

  it("nulla in coda: nessun promemoria", () => {
    expect(dailyPlan({ earliestDueAt: null, slot: "08:00", now: local(2026, 9, 9, 7, 0) })).toEqual([]);
  });

  it("un ricordo in ritardo alle 07:00 con slot 08:00: 14 giorni, da oggi", () => {
    const plan = dailyPlan({ earliestDueAt: iso(local(2026, 9, 8, 10, 0)), slot: "08:00", now: local(2026, 9, 9, 7, 0) });
    expect(plan).toHaveLength(14);
    expect(plan[0].getTime()).toBe(at(2026, 9, 9));
    expect(plan[13].getTime()).toBe(at(2026, 9, 22));
  });

  it("alle 09:00 lo slot di oggi e' passato: 13 giorni, da domani", () => {
    const plan = dailyPlan({ earliestDueAt: iso(local(2026, 9, 8, 10, 0)), slot: "08:00", now: local(2026, 9, 9, 9, 0) });
    expect(plan).toHaveLength(13);
    expect(plan[0].getTime()).toBe(at(2026, 9, 10));
  });

  it("esattamente allo scatto (o un secondo prima) oggi non si programma", () => {
    expect(dailyPlan({ earliestDueAt: iso(local(2026, 9, 1)), slot: "08:00", now: local(2026, 9, 9, 8, 0) })[0].getTime()).toBe(at(2026, 9, 10));
    const now = new Date(at(2026, 9, 9) - 1000);
    expect(dailyPlan({ earliestDueAt: iso(local(2026, 9, 1)), slot: "08:00", now })[0].getTime()).toBe(at(2026, 9, 10));
  });

  it("un ricordo che entra in coda il giorno 5 alle 10:00: dal giorno 6", () => {
    const plan = dailyPlan({ earliestDueAt: iso(local(2026, 9, 14, 10, 0)), slot: "08:00", now: local(2026, 9, 9, 7, 0) });
    expect(plan[0].getTime()).toBe(at(2026, 9, 15));
    expect(plan).toHaveLength(8);
  });

  it("un ricordo che entra alle 07:30 del giorno 5 con slot 08:00: dal giorno 5", () => {
    const plan = dailyPlan({ earliestDueAt: iso(local(2026, 9, 14, 7, 30)), slot: "08:00", now: local(2026, 9, 9, 7, 0) });
    expect(plan[0].getTime()).toBe(at(2026, 9, 14));
  });

  it("oltre l'orizzonte: niente", () => {
    expect(dailyPlan({ earliestDueAt: iso(local(2026, 9, 23, 8, 0)), slot: "08:00", now: local(2026, 9, 9, 7, 0) })).toEqual([]);
  });

  it("l'orizzonte e' iniettabile", () => {
    expect(dailyPlan({ earliestDueAt: iso(local(2026, 9, 1)), slot: "08:00", now: local(2026, 9, 9, 7, 0), horizonDays: 3 })).toHaveLength(3);
  });

  it("scavalca il cambio di mese", () => {
    const plan = dailyPlan({ earliestDueAt: iso(local(2026, 9, 1)), slot: "08:00", now: local(2026, 9, 28, 7, 0) });
    expect(plan[3].getTime()).toBe(at(2026, 10, 1));
  });

  it("resta alle 08:00 locali attraverso il cambio d'ora", () => {
    const plan = dailyPlan({ earliestDueAt: iso(local(2026, 10, 1)), slot: "08:00", now: local(2026, 10, 20, 7, 0) });
    for (const d of plan) expect([d.getHours(), d.getMinutes()]).toEqual([8, 0]);
    expect(plan[6].getTime()).toBe(at(2026, 10, 26));
  });

  it("slot invalido o data rotta: niente", () => {
    expect(dailyPlan({ earliestDueAt: iso(local(2026, 9, 1)), slot: "25:00", now: local(2026, 9, 9) })).toEqual([]);
    expect(dailyPlan({ earliestDueAt: "non-una-data", slot: "08:00", now: local(2026, 9, 9) })).toEqual([]);
  });
});

describe("dailySlotAboutToFire — i due secondi da non cancellare", () => {
  it("vero solo nella finestra fra adesso e il margine minimo", () => {
    const slotAt = local(2026, 9, 9, 8, 0).getTime();
    // Un secondo prima: gia' consegnata all'OS, sta per suonare.
    expect(dailySlotAboutToFire("08:00", new Date(slotAt - 1000))).toBe(true);
    // Tre secondi prima: dailyPlan la programma ancora, niente da salvare.
    expect(dailySlotAboutToFire("08:00", new Date(slotAt - 3000))).toBe(false);
    // Allo scatto e dopo: non e' piu' in attesa, cancellarla e' un no-op.
    expect(dailySlotAboutToFire("08:00", new Date(slotAt))).toBe(false);
    expect(dailySlotAboutToFire("08:00", local(2026, 9, 9, 9, 0))).toBe(false);
    // Molto prima: il piano di oggi c'e' gia'.
    expect(dailySlotAboutToFire("08:00", local(2026, 9, 9, 7, 0))).toBe(false);
  });

  it("uno slot invalido non salva niente", () => {
    expect(dailySlotAboutToFire("25:00", local(2026, 9, 9))).toBe(false);
  });

  it("copre esattamente il buco che dailyPlan lascia oggi", () => {
    // Il giorno che dailyPlan scarta per il margine e' lo stesso che questa
    // funzione protegge: senza, un ricalcolo in quell'istante cancellerebbe
    // il promemoria del giorno senza riprogrammarlo.
    const now = new Date(local(2026, 9, 9, 8, 0).getTime() - 1000);
    const plan = dailyPlan({ earliestDueAt: local(2026, 9, 1).toISOString(), slot: "08:00", now });
    expect(plan.map((d) => d.getDate())).not.toContain(9);
    expect(dailySlotAboutToFire("08:00", now)).toBe(true);
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
    expect(LEGACY_DAILY_REMINDER_ID).toBe("daily-reminder");
    expect(dailyIdentifier("2026-09-10")).toBe("daily:2026-09-10");
  });

  it("isDailyPayload riconosce il payload nuovo E quello vecchio delle installazioni attuali", () => {
    expect(isDailyPayload(dailyPayload("2026-09-10"))).toBe(true);
    expect(isDailyPayload({ kind: "daily" })).toBe(true);
    expect(isDailyPayload(firstReviewPayload("m1", "f1"))).toBe(false);
    expect(isDailyPayload(null)).toBe(false);
  });

  it("il primo ripasso porta alla scheda del ricordo", () => {
    expect(routeForPayload(firstReviewPayload("m1", "f1"))).toEqual({
      pathname: "/memory/[id]",
      params: { id: "m1" },
    });
  });

  it("il giornaliero porta a Oggi", () => {
    expect(routeForPayload(dailyPayload("2026-09-10"))).toEqual({ pathname: "/(app)/today" });
    // Il payload vecchio (senza dayKey) porta ancora a Oggi.
    expect(routeForPayload({ kind: "daily" })).toEqual({ pathname: "/(app)/today" });
  });

  it("un payload sconosciuto non porta da nessuna parte", () => {
    expect(routeForPayload(null)).toBeNull();
    expect(routeForPayload({})).toBeNull();
    expect(routeForPayload({ kind: "first-review", memoryId: "" })).toBeNull();
    expect(routeForPayload({ kind: "boh" })).toBeNull();
  });

  it("riconosce i primi ripassi di una cartella", () => {
    expect(isFirstReviewPayload(firstReviewPayload("m1", "f1"))).toBe(true);
    expect(isFirstReviewPayload(dailyPayload("2026-09-10"))).toBe(false);
    expect(isFirstReviewInFolder(firstReviewPayload("m1", "f1"), "f1")).toBe(true);
    expect(isFirstReviewInFolder(firstReviewPayload("m1", "f1"), "f2")).toBe(false);
    expect(isFirstReviewInFolder(dailyPayload("2026-09-10"), "f1")).toBe(false);
  });
});

describe("firstReviewCapReached", () => {
  const ids = (n: number) => Array.from({ length: n }, (_, i) => firstReviewIdentifier(`m${i}`));

  it("primi ripassi + promemoria restano sotto il limite iOS di 64 richieste in attesa", () => {
    // Oltre 64 iOS scarta in silenzio le più lontane: i promemoria in fondo
    // all'orizzonte sparirebbero senza che nessuno se ne accorga.
    expect(MAX_PENDING_FIRST_REVIEWS + DAILY_HORIZON_DAYS).toBeLessThan(64);
  });

  it("con la coda vuota non blocca niente", () => {
    expect(firstReviewCapReached([], firstReviewIdentifier("nuovo"))).toBe(false);
  });

  it("blocca il ricordo NUOVO quando la coda è piena", () => {
    const full = ids(MAX_PENDING_FIRST_REVIEWS);
    expect(firstReviewCapReached(full, firstReviewIdentifier("nuovo"))).toBe(true);
    // Anche oltre: una coda già sforata non riapre.
    expect(firstReviewCapReached(ids(MAX_PENDING_FIRST_REVIEWS + 10), firstReviewIdentifier("nuovo"))).toBe(true);
  });

  it("lascia passare un id GIÀ in coda anche a coda piena", () => {
    // Ri-programmarlo sostituisce la richiesta esistente: il totale non
    // cresce, e bloccarlo lascerebbe in attesa l'orario vecchio.
    const full = ids(MAX_PENDING_FIRST_REVIEWS);
    expect(firstReviewCapReached(full, full[0])).toBe(false);
    expect(firstReviewCapReached(full, full[MAX_PENDING_FIRST_REVIEWS - 1])).toBe(false);
  });

  it("l'ultimo slot libero è ancora libero", () => {
    expect(firstReviewCapReached(ids(MAX_PENDING_FIRST_REVIEWS - 1), firstReviewIdentifier("nuovo"))).toBe(false);
  });
});
