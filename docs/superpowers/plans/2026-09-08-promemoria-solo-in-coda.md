# Promemoria solo nei giorni con qualcosa in coda — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Il promemoria all'orario scelto arriva solo nei giorni in cui, a quell'ora, c'e' almeno un ricordo in coda; nessun server, nessuna dipendenza nuova, esce in OTA.

**Architecture:** Il trigger "ogni giorno" sparisce. `lib/api.ts` fornisce la data di ripasso piu' vicina fra i ricordi ripassabili; `lib/notifications-core.ts` (puro) la trasforma nel piano dei prossimi 14 giorni; `lib/notifications.ts` programma una notifica datata per ciascun giorno del piano (identificatore `daily:AAAA-MM-GG`) e cancella le altre, compreso il vecchio `daily-reminder`. Il ricalcolo gira all'avvio, a ogni primo piano e background, a fine sessione, dopo un salvataggio e dalla schermata Notifiche.

**Tech Stack:** TypeScript, Expo SDK 54, `expo-notifications` (gia' nel binario), expo-router, zustand, Supabase PostgREST (nessuna migrazione), vitest.

**Spec:** `docs/superpowers/specs/2026-09-08-promemoria-solo-in-coda-design.md`

## Global Constraints

- **Vitest raccoglie solo `lib/**/*.test.ts` e `features/**/*.test.ts`**; `expo-notifications` NON e' stubbato: `lib/notifications-core.ts` non deve importarlo mai, e `lib/notifications.ts` si verifica solo con `npx tsc --noEmit -p .`.
- **Test API = registratore** (impianto di `lib/api.plan-counters.test.ts`): il client Supabase e' un mock che registra la catena di chiamate; la query E' il comportamento.
- **Testi**: 4 cataloghi (`lib/i18n/{it,en,fr,es}.ts`) con le STESSE chiavi e gli stessi segnaposto; niente trattini lunghi (`i18n.test.ts` li vieta); i tre ritmi Scan/Reinforcement/Focus non si nominano.
- **Fingerprint**: nessuna dipendenza nuova, `app.json`/`eas.json` intatti. MAI `npx expo lint` (installa eslint e cambia `package.json`).
- **Commit**: in questa sessione i commit li chiede Angelo; i passi "Commit" qui sotto si eseguono solo su sua richiesta, altrimenti l'albero resta sporco fino al commit unico finale.
- **Tetto iOS**: 64 notifiche in attesa per app; `MAX_PENDING_FIRST_REVIEWS + DAILY_HORIZON_DAYS < 64`.

---

### Task 1: Il nucleo puro — `dailyPlan`, identificatori, payload, tetto

**Files:**
- Modify: `lib/notifications-core.ts` (costanti in testa, `nextDailyTrigger` righe 52-62, tetto riga 100, payload righe 118-131)
- Test: `lib/notifications-core.test.ts`

**Interfaces:**
- Consumes: `parseSlot`, `MIN_LEAD_MS` (gia' nel file); `dayKeyOf` da `lib/upcoming.ts`.
- Produces: `LEGACY_DAILY_REMINDER_ID = "daily-reminder"`, `DAILY_ID_PREFIX = "daily:"`, `DAILY_HORIZON_DAYS = 14`, `dailyIdentifier(dayKey: string): string`, `dailyPlan(input: { earliestDueAt: string | null; slot: string; now?: Date; horizonDays?: number }): Date[]`, `dailyPayload(dayKey: string): NotificationPayload`, `isDailyPayload(data: unknown): boolean`, `MAX_PENDING_FIRST_REVIEWS = 45`. RIMOSSI: `nextDailyTrigger`, `DAILY_REMINDER_ID`.

- [ ] **Step 1: Scrivere i test che falliscono**

In `lib/notifications-core.test.ts` sostituire nell'import `DAILY_REMINDER_ID` con `LEGACY_DAILY_REMINDER_ID`, `nextDailyTrigger` con `dailyPlan`, e aggiungere `DAILY_HORIZON_DAYS`, `dailyIdentifier`, `isDailyPayload`. Sostituire l'intero `describe("nextDailyTrigger — ...")` con:

```ts
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

  it("esattamente allo scatto (o due secondi prima) oggi non si programma", () => {
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
```

In `describe("identificatori, payload e rotte")` sostituire `expect(DAILY_REMINDER_ID).toBe("daily-reminder");` con:

```ts
    expect(LEGACY_DAILY_REMINDER_ID).toBe("daily-reminder");
    expect(dailyIdentifier("2026-09-10")).toBe("daily:2026-09-10");
```

e `routeForPayload(dailyPayload())` con `routeForPayload(dailyPayload("2026-09-10"))`. Aggiungere nello stesso describe:

```ts
  it("isDailyPayload riconosce il payload nuovo E quello vecchio delle installazioni attuali", () => {
    expect(isDailyPayload(dailyPayload("2026-09-10"))).toBe(true);
    expect(isDailyPayload({ kind: "daily" })).toBe(true);
    expect(isDailyPayload(firstReviewPayload("m1", "f1"))).toBe(false);
    expect(isDailyPayload(null)).toBe(false);
  });
```

Nel `describe("firstReviewCapReached")` sostituire il test "resta sotto il limite iOS" con:

```ts
  it("primi ripassi + giornaliere restano sotto il limite iOS di 64 richieste in attesa", () => {
    // Oltre 64 iOS scarta in silenzio le piu' lontane: le giornaliere in
    // fondo all'orizzonte sparirebbero senza che nessuno se ne accorga.
    expect(MAX_PENDING_FIRST_REVIEWS + DAILY_HORIZON_DAYS).toBeLessThan(64);
  });
```

- [ ] **Step 2: Vedere i test fallire**

Run: `npx vitest run lib/notifications-core.test.ts`
Expected: FAIL, `dailyPlan is not a function` / export mancanti.

- [ ] **Step 3: Implementare in `lib/notifications-core.ts`**

Aggiungere in testa `import { dayKeyOf } from "./upcoming";` (solo per l'export che segue) e sostituire `export const DAILY_REMINDER_ID = "daily-reminder";` con:

```ts
/**
 * Il vecchio trigger "ogni giorno" (fino all'8/9/2026). Le installazioni
 * attuali lo hanno ancora in attesa: la sincronizzazione lo cancella.
 */
export const LEGACY_DAILY_REMINDER_ID = "daily-reminder";
export const DAILY_ID_PREFIX = "daily:";
/** Quanti giorni avanti si programma il promemoria (spec 2026-09-08). Oltre, serve riaprire l'app. */
export const DAILY_HORIZON_DAYS = 14;
```

Sostituire `nextDailyTrigger` (con il suo commento) con:

```ts
/** Identificatore stabile per giorno locale: ri-programmare lo stesso giorno sostituisce. */
export function dailyIdentifier(dayKey: string): string {
  return `${DAILY_ID_PREFIX}${dayKey}`;
}

/** `dailyIdentifier` di un istante del piano. */
export function dailyIdentifierFor(at: Date): string {
  return dailyIdentifier(dayKeyOf(at));
}

/**
 * Gli istanti del promemoria nei prossimi `horizonDays` giorni, a partire
 * da OGGI. Il giorno d entra se il suo slot e' nel futuro con margine
 * (`MIN_LEAD_MS`) E la data di ripasso piu' vicina (`earliestDueAt`) lo
 * precede. Un ricordo in coda resta in coda finche' non viene ripassato:
 * dal primo giorno utile in poi, tutti. Date locali da componenti: reggono
 * cambio mese e ora legale. Niente in coda, slot o data rotti: `[]`.
 */
export function dailyPlan(input: {
  earliestDueAt: string | null;
  slot: string;
  now?: Date;
  horizonDays?: number;
}): Date[] {
  const p = parseSlot(input.slot);
  if (!p || !input.earliestDueAt) return [];
  const earliest = Date.parse(input.earliestDueAt);
  if (Number.isNaN(earliest)) return [];
  const now = input.now ?? new Date();
  const horizon = input.horizonDays ?? DAILY_HORIZON_DAYS;
  const out: Date[] = [];
  for (let d = 0; d < horizon; d++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, p.hour, p.minute, 0, 0);
    if (at.getTime() <= now.getTime() + MIN_LEAD_MS) continue;
    if (earliest > at.getTime()) continue;
    out.push(at);
  }
  return out;
}
```

Tetto: `export const MAX_PENDING_FIRST_REVIEWS = 45;` e nel commento sopra sostituire "50 e non 64: il margine ospita il giornaliero e qualunque secondo tipo di notifica che verrà dopo." con "45 e non 64: 45 + DAILY_HORIZON_DAYS (14) = 59, e il margine ospita qualunque secondo tipo di notifica che verra' dopo."

Payload: il tipo diventa `| { kind: "daily"; dayKey: string }`; `dailyPayload` diventa:

```ts
export function dailyPayload(dayKey: string): NotificationPayload {
  return { kind: "daily", dayKey };
}

/** Vero per il payload nuovo (con dayKey) E per quello vecchio `{ kind: "daily" }`. */
export function isDailyPayload(data: unknown): boolean {
  const d = asRecord(data);
  return !!d && d.kind === "daily";
}
```

`routeForPayload` resta com'e' (`d.kind === "daily"` copre entrambi).

- [ ] **Step 4: Vedere i test passare**

Run: `npx vitest run lib/notifications-core.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit (solo su richiesta di Angelo)**

```bash
git add lib/notifications-core.ts lib/notifications-core.test.ts
git commit -m "feat(notifiche): dailyPlan, identificatori per giorno, tetto 45"
```

---

### Task 2: `fetchEarliestDueAt` in `lib/api.ts`

**Files:**
- Modify: `lib/api.ts` (dopo `fetchOverdueCount`, riga ~1043)
- Create: `lib/api.earliest-due.test.ts`

**Interfaces:**
- Consumes: `pausedFolderIds(userId)` (privata, riga 360), `supabase`, `isDemoMode`.
- Produces: `fetchEarliestDueAt(userId: string): Promise<string | null>` (ISO di `next_review_at` o `null`).

- [ ] **Step 1: Scrivere il test che fallisce**

`lib/api.earliest-due.test.ts`:

```ts
/**
 * Forma della query di fetchEarliestDueAt, il solo dato dietro il
 * promemoria "solo nei giorni con qualcosa in coda" (spec 2026-09-08).
 * Stesso impianto registratore di lib/api.plan-counters.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Call = [string, unknown[]];
type Result = { data?: unknown; error?: unknown; count?: number | null };

const log: Array<{ table: string; calls: Call[] }> = [];
let results: Result[] = [];
const state = vi.hoisted(() => ({ demo: false }));

function makeBuilder(table: string) {
  const entry = { table, calls: [] as Call[] };
  log.push(entry);
  const builder: Record<string, unknown> = {};
  const chain = (name: string) =>
    ((...args: unknown[]) => {
      entry.calls.push([name, args]);
      return builder;
    });
  for (const m of [
    "select", "update", "delete", "insert", "upsert",
    "eq", "neq", "is", "in", "not", "or", "lt", "lte", "gt", "gte",
    "order", "limit", "returns", "maybeSingle", "single",
  ]) {
    builder[m] = chain(m);
  }
  builder.then = (resolve: (r: Result) => void) => {
    const next = results.shift() ?? { data: [], error: null, count: 0 };
    return Promise.resolve({ data: null, error: null, count: null, ...next }).then(resolve);
  };
  return builder;
}

vi.mock("./supabase", () => ({
  get isDemoMode() {
    return state.demo;
  },
  supabase: {
    from: (table: string) => makeBuilder(table),
    rpc: () => Promise.resolve({ data: null, error: null }),
  },
}));

import { fetchEarliestDueAt } from "./api";

const callNames = (i: number) => log[i].calls.map(([n]) => n);
const call = (i: number, name: string) => log[i].calls.filter(([n]) => n === name).map(([, a]) => a);

beforeEach(() => {
  log.length = 0;
  results = [];
  state.demo = false;
});

describe("fetchEarliestDueAt", () => {
  it("prende la prima next_review_at fra i ricordi vivi e non archiviati, in ordine", async () => {
    results = [{ data: [] }, { data: [{ next_review_at: "2026-09-10T06:00:00.000Z" }] }];
    expect(await fetchEarliestDueAt("u1")).toBe("2026-09-10T06:00:00.000Z");
    expect(log.map((l) => l.table)).toEqual(["folders", "memories"]);
    expect(call(1, "select")).toEqual([["next_review_at"]]);
    expect(call(1, "eq")).toEqual([["user_id", "u1"]]);
    expect(call(1, "is")).toEqual([["deleted_at", null]]);
    expect(call(1, "neq")).toEqual([["state", "archived"]]);
    // Niente is-not-null: ORDER BY ASC mette i NULL in fondo, la prima riga
    // e' una data se ne esiste una. Senza cartelle in pausa nessun "not".
    expect(callNames(1)).not.toContain("not");
    expect(call(1, "order")).toEqual([["next_review_at"]]);
    expect(call(1, "limit")).toEqual([[1]]);
    // Niente confronto con "adesso": il chiamante decide per QUALE istante
    // il ricordo e' in coda (uno slot futuro), non per l'istante della query.
    expect(callNames(1)).not.toContain("lte");
    expect(callNames(1)).not.toContain("lt");
  });

  it("esclude le cartelle in pausa come la coda di Oggi", async () => {
    results = [{ data: [{ id: "f1" }, { id: "f2" }] }, { data: [] }];
    expect(await fetchEarliestDueAt("u1")).toBeNull();
    expect(call(1, "not")).toContainEqual(["folder_id", "in", "(f1,f2)"]);
  });

  it("senza righe torna null, non una stringa vuota", async () => {
    results = [{ data: [] }, { data: [] }];
    expect(await fetchEarliestDueAt("u1")).toBeNull();
  });

  it("in demo vale null senza toccare Supabase", async () => {
    state.demo = true;
    expect(await fetchEarliestDueAt("u1")).toBeNull();
    expect(log).toHaveLength(0);
  });

  it("un errore PostgREST si propaga", async () => {
    results = [{ data: [] }, { data: null, error: new Error("boom") }];
    await expect(fetchEarliestDueAt("u1")).rejects.toThrow("boom");
  });
});
```

- [ ] **Step 2: Vedere il test fallire**

Run: `npx vitest run lib/api.earliest-due.test.ts`
Expected: FAIL, `fetchEarliestDueAt` non esportata.

- [ ] **Step 3: Implementare**

In `lib/api.ts`, subito dopo `fetchOverdueCount`:

```ts
/**
 * La data di ripasso piu' vicina fra i ricordi RIPASSABILI: vivi, non
 * archiviati, cartella non in pausa (stessi predicati della coda globale
 * di Oggi, fetchDueMemoriesByLayer senza folderId). E' l'unico dato che
 * serve al promemoria "solo nei giorni con qualcosa in coda": un ricordo
 * in coda resta in coda finche' non viene ripassato, quindi da questa data
 * in poi ogni slot ha qualcosa (docs/superpowers/specs/
 * 2026-09-08-promemoria-solo-in-coda-design.md). Nessun confronto con
 * "adesso": il chiamante la confronta con slot FUTURI. Null = mai niente.
 */
export async function fetchEarliestDueAt(userId: string): Promise<string | null> {
  if (isDemoMode) return null;
  const paused = await pausedFolderIds(userId);
  let q = supabase
    .from("memories")
    .select("next_review_at")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .neq("state", "archived");
  if (paused.length > 0) q = q.not("folder_id", "in", `(${paused.join(",")})`);
  // Niente filtro is-not-null: ORDER BY ... ASC mette i NULL in fondo, quindi
  // la prima riga e' una data se ne esiste una. (Un `.not(..., "is", null)` in
  // testa alla catena manda tsc in "type instantiation excessively deep" alla
  // riassegnazione di q, come `.returns<>()`: cast al confine.)
  const { data, error } = await q.order("next_review_at").limit(1);
  if (error) throw error;
  const rows = (data ?? []) as Array<{ next_review_at: string | null }>;
  return rows[0]?.next_review_at ?? null;
}
```

- [ ] **Step 4: Vedere il test passare**

Run: `npx vitest run lib/api.earliest-due.test.ts`
Expected: PASS (5 test).

- [ ] **Step 5: Commit (solo su richiesta di Angelo)**

```bash
git add lib/api.ts lib/api.earliest-due.test.ts
git commit -m "feat(api): fetchEarliestDueAt, la data piu' vicina fra i ricordi in coda"
```

---

### Task 3: `syncDailyReminder` a piano datato + `resyncDailyReminder`

**Files:**
- Modify: `lib/notifications.ts` (import righe 29-47; `syncDailyReminder` righe 230-277; commento di testa)

**Interfaces:**
- Consumes: Task 1 (`dailyPlan`, `dailyIdentifierFor`, `dailyPayload`, `isDailyPayload`, `LEGACY_DAILY_REMINDER_ID`, `slotFromProfileTime`, `shouldScheduleDaily`), Task 2 (`fetchEarliestDueAt`), `fetchProfile` (gia' in `lib/api.ts`), `dayKeyOf` da `lib/upcoming.ts`.
- Produces: `syncDailyReminder(userId: string, profile: Pick<Profile, "calmMode" | "morningReviewAt"> | null): Promise<Date[]>` (gli istanti programmati, `[]` se niente), `resyncDailyReminder(userId: string): Promise<Date[]>`.

- [ ] **Step 1: Aggiornare gli import**

Nell'import da `./notifications-core` sostituire `DAILY_REMINDER_ID,` con `LEGACY_DAILY_REMINDER_ID,` e aggiungere `dailyIdentifierFor, dailyPlan, isDailyPayload,` (in ordine alfabetico con gli altri). Aggiungere `import { fetchEarliestDueAt, fetchProfile } from "./api";` e `import { dayKeyOf } from "./upcoming";`.

- [ ] **Step 2: Sostituire `syncDailyReminder`**

Sostituire tutto il blocco dal commento `/** Riallinea il promemoria giornaliero ...` fino alla chiusura della funzione con:

```ts
/**
 * Riallinea il promemoria a profilo + prefs + permesso + CODA. Dal 8/9/2026
 * non e' piu' un trigger "ogni giorno": e' una notifica DATATA per ciascuno
 * dei prossimi DAILY_HORIZON_DAYS giorni in cui, all'orario scelto, c'e'
 * almeno un ricordo in coda (dailyPlan su fetchEarliestDueAt). E' l'unico
 * punto che le programma o le cancella: chiamarlo e' sempre corretto, in
 * qualunque stato. Profilo null (demo, errore di rete) = calma accesa =
 * niente promemoria. Torna gli istanti programmati: il primo e' la riga
 * "Prossimo promemoria" della schermata Notifiche.
 */
export async function syncDailyReminder(
  userId: string,
  profile: Pick<Profile, "calmMode" | "morningReviewAt"> | null,
): Promise<Date[]> {
  if (!notificationsAvailable()) return [];
  try {
    const prefs = useNotificationPrefsStore.getState().prefs;
    const perm = await getPermission();
    const calmMode = profile?.calmMode ?? true;
    if (!shouldScheduleDaily({ enabled: prefs.enabled, calmMode, allowed: perm.allowed })) {
      await cancelDailyExcept(new Set());
      return [];
    }
    let earliestDueAt: string | null;
    try {
      earliestDueAt = await fetchEarliestDueAt(userId);
    } catch (e) {
      // Rete assente: meglio il programma stantio in attesa che nessuno.
      // Il prossimo primo piano rimette a posto.
      reportError("notifications/sync-daily-fetch", e);
      return [];
    }
    const plan = dailyPlan({ earliestDueAt, slot: slotFromProfileTime(profile?.morningReviewAt) });
    if (plan.length > 0) await ensureChannel();
    for (const at of plan) {
      // Stesso identificatore = sostituzione: un cambio di orario riscrive
      // il giorno senza duplicarlo.
      await Notifications.scheduleNotificationAsync({
        identifier: dailyIdentifierFor(at),
        content: {
          title: t("notifications.dailyTitle"),
          body: t("notifications.dailyBody"),
          data: dailyPayload(dayKeyOf(at)),
          sound: true,
        },
        trigger: {
          type: SchedulableTriggerInputTypes.DATE,
          date: at.getTime(),
          channelId: REMINDER_CHANNEL_ID,
        },
      });
    }
    await cancelDailyExcept(new Set(plan.map(dailyIdentifierFor)));
    return plan;
  } catch (e) {
    reportError("notifications/sync-daily", e);
    return [];
  }
}

/**
 * Cancella le notifiche del promemoria in attesa (payload daily, compreso
 * il vecchio "daily-reminder" delle installazioni attuali) tranne quelle
 * in `keep`. Si filtra sul payload e sull'identificatore, mai sul trigger,
 * che torna in forma nativa diversa fra iOS e Android.
 */
async function cancelDailyExcept(keep: ReadonlySet<string>): Promise<void> {
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  const stale = pending.filter(
    (r) =>
      (isDailyPayload(r.content.data) || r.identifier === LEGACY_DAILY_REMINDER_ID) &&
      !keep.has(r.identifier),
  );
  await Promise.all(stale.map((r) => Notifications.cancelScheduledNotificationAsync(r.identifier)));
}

/**
 * Per chi non ha il profilo sotto mano (layout, fine sessione): lo legge
 * e riallinea. Un errore di rete lascia in attesa il programma vecchio.
 */
export async function resyncDailyReminder(userId: string): Promise<Date[]> {
  if (!notificationsAvailable()) return [];
  try {
    const profile = await fetchProfile(userId);
    return await syncDailyReminder(userId, profile);
  } catch (e) {
    reportError("notifications/resync-daily", e);
    return [];
  }
}
```

Nel commento di testa del file, dopo "solo locali: nessun token push, nessun server;" aggiungere la riga ` *  - il promemoria e' un piano di notifiche DATATE, una per giorno con coda (spec 2026-09-08), non un trigger giornaliero;`.

- [ ] **Step 3: Compilare**

Run: `npx tsc --noEmit -p .`
Expected: errori SOLO nei call site (`app/(app)/_layout.tsx`, `app/add.tsx`, `app/(app)/notifications.tsx`) per la firma nuova; nessun errore in `lib/`.

- [ ] **Step 4: Commit (solo su richiesta di Angelo)**

```bash
git add lib/notifications.ts
git commit -m "feat(notifiche): il promemoria diventa un piano di notifiche datate"
```

---

### Task 4: I punti di ricalcolo — layout, fine sessione, Aggiungi, schermata Notifiche

**Files:**
- Modify: `app/(app)/_layout.tsx` (import righe 1-19; effetto righe 98-113)
- Modify: `app/review/complete.tsx` (import righe 16-22; effetto vicino a riga 191)
- Modify: `app/add.tsx:317`
- Modify: `app/(app)/notifications.tsx` (import righe 27-31; stato riga ~77; effetto profilo righe 84-97; `onToggleMain` riga 154; `saveProfile` riga 178; `slotHint` righe 199-207)

**Interfaces:**
- Consumes: Task 3 (`syncDailyReminder(userId, profile)`, `resyncDailyReminder(userId)`), Task 1 (`DAILY_HORIZON_DAYS`).
- Produces: nessuna API; usa la chiave i18n `notifications.slotNone` con `{days}` (Task 5).

- [ ] **Step 1: `app/(app)/_layout.tsx`**

Import: `import { AppState, StyleSheet } from "react-native";` al posto di `import { StyleSheet } from "react-native";`; `import { fetchDeletionRequestedAt } from "@/lib/api";` (via `fetchProfile`, che non serve piu'); `import { notificationsAvailable, resyncDailyReminder } from "@/lib/notifications";` al posto di `syncDailyReminder`. Sostituire l'effetto "Promemoria giornaliero: riallineato al profilo..." con:

```ts
  // Promemoria: riallineato alla CODA (spec 2026-09-08) all'avvio, a ogni
  // ritorno in primo piano e a ogni uscita in background, che e' quando
  // cestino, pausa e ripassi hanno appena cambiato la coda. `inactive` no:
  // su iOS precede sempre `background` e raddoppierebbe il lavoro. Le
  // notifiche per singolo ricordo NON si toccano qui: si programmano solo
  // al salvataggio. Senza flag niente query in piu'.
  useEffect(() => {
    if (!userId || !notificationsAvailable()) return;
    void resyncDailyReminder(userId);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" || state === "background") void resyncDailyReminder(userId);
    });
    return () => sub.remove();
  }, [userId]);
```

Verificare che `reportError` resti usato altrove nel file (lo e': foto).

- [ ] **Step 2: `app/review/complete.tsx`**

Aggiungere gli import `import { useAuthStore } from "@/lib/auth-store";` e `import { resyncDailyReminder } from "@/lib/notifications";`. Nel componente, subito dopo l'effetto `success()`:

```ts
  // La sessione ha appena svuotato (o ridotto) la coda: il promemoria si
  // riallinea qui, non al prossimo avvio (spec 2026-09-08).
  const userId = useAuthStore((s) => s.user?.id ?? null);
  useEffect(() => {
    if (userId) void resyncDailyReminder(userId);
  }, [userId]);
```

- [ ] **Step 3: `app/add.tsx`**

Riga 317: `void syncDailyReminder(profile);` diventa `if (user) void syncDailyReminder(user.id, profile);` (`user` e' `useAuthStore((s) => s.user)`, riga 77, tipizzato nullable).

- [ ] **Step 4: `app/(app)/notifications.tsx`**

Import da `@/lib/notifications-core`: `DAILY_HORIZON_DAYS, DEFAULT_REMINDER_SLOT, slotFromProfileTime` (via `nextDailyTrigger`). Dopo `const [slot, setSlot] = ...` aggiungere:

```ts
  // Primo istante del piano programmato: undefined = non ancora calcolato
  // (niente riga), null = niente in coda nei prossimi DAILY_HORIZON_DAYS.
  const [nextAt, setNextAt] = useState<Date | null | undefined>(undefined);
  const syncDaily = useCallback(
    async (calm: boolean, s: string) => {
      if (!user) return;
      const plan = await syncDailyReminder(user.id, { calmMode: calm, morningReviewAt: s });
      setNextAt(plan[0] ?? null);
    },
    [user],
  );
```

Nell'effetto che carica il profilo, dopo `setSlot(slotFromProfileTime(p.morningReviewAt));` aggiungere `void syncDaily(p.calmMode, slotFromProfileTime(p.morningReviewAt));`. Aggiungere `syncDaily` alle dipendenze di quell'effetto (`[user, syncDaily]`).

In `onToggleMain`: `await syncDailyReminder({ calmMode, morningReviewAt: slot });` diventa `await syncDaily(calmMode, slot);`.

In `saveProfile`: `.then(() => syncDailyReminder({ calmMode: nextCalm, morningReviewAt: nextSlot }))` diventa `.then(() => syncDaily(nextCalm, nextSlot))`.

`slotHint` diventa:

```ts
  const slotHint = !active
    ? t("notifications.slotDisabled")
    : calmMode
      ? t("notifications.slotDisabledByToggle")
      : nextAt === undefined
        ? ""
        : nextAt
          ? t("notifications.slotNext", { time: shortDateTime(nextAt.toISOString()) })
          : t("notifications.slotNone", { days: DAILY_HORIZON_DAYS });
```

- [ ] **Step 5: Compilare**

Run: `npx tsc --noEmit -p .`
Expected: errori SOLO per la chiave `notifications.slotNone` mancante (arriva con il Task 5). Se il tipo `TKey` e' derivato dal catalogo, l'errore e' atteso qui e sparisce dopo.

- [ ] **Step 6: Commit (solo su richiesta di Angelo)**

```bash
git add "app/(app)/_layout.tsx" app/review/complete.tsx app/add.tsx "app/(app)/notifications.tsx"
git commit -m "feat(notifiche): ricalcolo del promemoria a primo piano, background, fine sessione e Aggiungi"
```

---

### Task 5: Testi nelle 4 lingue e documenti

**Files:**
- Modify: `lib/i18n/it.ts` (righe 1133, 1136, 1185 + chiave nuova dopo 1134), `lib/i18n/en.ts`, `lib/i18n/fr.ts`, `lib/i18n/es.ts` (stesse righe)
- Modify: `docs/DATA-MODEL.md:44,46`, `docs/DEPLOY.md:735`, `docs/ROADMAP.md:181`

**Interfaces:**
- Produces: chiave `notifications.slotNone` con segnaposto `{days}` (usata dal Task 4).

- [ ] **Step 1: Cataloghi**

`it.ts`:
```ts
  "notifications.dailySwitchHint": "All'ora che scegli, solo nei giorni in cui hai ricordi in coda.",
  "notifications.slotNext": "Prossimo promemoria: {time}",
  "notifications.slotNone": "Niente in coda nei prossimi {days} giorni: nessun promemoria programmato.",
  ...
  "notifications.dailySwitch": "Ricordamelo quando c'è da ripassare",
  ...
  "tutorial.remindersBody": "Dalle Impostazioni scegli l'orario del promemoria: arriva solo nei giorni con qualcosa da ripassare. Io ti avviso anche quando il primo ripasso è pronto.",
```

`en.ts`:
```ts
  "notifications.dailySwitchHint": "At the time you choose, only on days with memories in the queue.",
  "notifications.slotNext": "Next reminder: {time}",
  "notifications.slotNone": "Nothing in the queue for the next {days} days: no reminder scheduled.",
  ...
  "notifications.dailySwitch": "Remind me when there's something to review",
  ...
  "tutorial.remindersBody": "In Settings, choose the reminder time: it only comes on days with something to review. I also let you know when the first review is ready.",
```

`fr.ts`:
```ts
  "notifications.dailySwitchHint": "À l'heure que tu choisis, seulement les jours où tu as des souvenirs en attente.",
  "notifications.slotNext": "Prochain rappel : {time}",
  "notifications.slotNone": "Rien en attente dans les {days} prochains jours : aucun rappel programmé.",
  ...
  "notifications.dailySwitch": "Rappelle-le-moi quand il y a des révisions",
  ...
  "tutorial.remindersBody": "Dans les Réglages, choisis l'heure du rappel : il n'arrive que les jours où il y a quelque chose à réviser. Je te préviens aussi quand la première révision est prête.",
```

`es.ts`:
```ts
  "notifications.dailySwitchHint": "A la hora que elijas, solo los días en que tengas recuerdos en cola.",
  "notifications.slotNext": "Próximo recordatorio: {time}",
  "notifications.slotNone": "Nada en cola en los próximos {days} días: ningún recordatorio programado.",
  ...
  "notifications.dailySwitch": "Recuérdamelo cuando haya algo que repasar",
  ...
  "tutorial.remindersBody": "En Ajustes, elige la hora del recordatorio: solo llega los días en que hay algo que repasar. También te aviso cuando el primer repaso está listo.",
```

- [ ] **Step 2: Documenti**

`docs/DATA-MODEL.md` riga 44: `| calm_mode | boolean | Suppresses the reminder (the first-review alert stays), default true, so the reminder is opt-out. Since 2026-09-08 the reminder is scheduled only on days with something due (14-day horizon, spec 2026-09-08) |`. Riga 46: `| morning_review_at | time | Reminder slot (HH:MM, any minute since 2026-09-06); default 08:00. Fires only on days with something in the queue at that time |`.

`docs/DEPLOY.md` riga 735: "and the daily reminder fire" diventa "and the reminder (only on days with something due) fire".

`docs/ROADMAP.md` riga 181: "first-review alert at T0+20h + one daily reminder." diventa "first-review alert at T0+20h + a reminder only on days with something in the queue (2026-09-08)."

- [ ] **Step 3: Verificare**

Run: `npx tsc --noEmit -p . && npx vitest run`
Expected: tsc 0 errori; tutti i test verdi (i18n: stesse chiavi e segnaposto in 4 lingue).

- [ ] **Step 4: Commit (solo su richiesta di Angelo)**

```bash
git add lib/i18n docs/DATA-MODEL.md docs/DEPLOY.md docs/ROADMAP.md
git commit -m "feat(notifiche): testi del promemoria solo nei giorni con coda, 4 lingue, docs"
```

---

### Task 6: Verifica finale OTA-safe

**Files:** nessuno.

- [ ] **Step 1: Suite completa**

Run: `npx tsc --noEmit -p . && npx vitest run`
Expected: 0 errori, tutti verdi.

- [ ] **Step 2: Pre-check Hermes (TROUBLESHOOTING.md § Hermes)**

```bash
TMP="<scratchpad>/memika-export"; rm -rf "$TMP"
npx expo export --platform android --no-bytecode --output-dir "$TMP"
BUNDLE=$(ls "$TMP"/_expo/static/js/android/*.js | head -1)
node_modules/react-native/sdks/hermesc/win64-bin/hermesc.exe -emit-binary -out "$TMP/index.hbc" "$BUNDLE"; echo "hermesc exit=$?"
```
Expected: `hermesc exit=0`.

- [ ] **Step 3: Fingerprint invariati**

Run: `npx expo-updates fingerprint:generate --platform android` e `--platform ios`
Expected: hash `a3372f41…` (vc16) e `174bc468…` (build 5); `git status` senza `package.json`/`package-lock.json` modificati.

- [ ] **Step 4: Revisione avversaria** (Workflow, lenti: correttezza del piano date/ora legale, tetto iOS, concorrenza dei ricalcoli, cancellazione della legacy, testi) e correzioni.

- [ ] **Step 5: Commit unico + OTA solo su richiesta di Angelo**

```bash
git add -u && git add lib/api.earliest-due.test.ts docs/superpowers/specs/2026-09-08-promemoria-solo-in-coda-design.md docs/superpowers/plans/2026-09-08-promemoria-solo-in-coda.md
git commit -m "feat(notifiche): promemoria solo nei giorni con qualcosa in coda"
npx eas update --channel production --message "feat: promemoria solo nei giorni con qualcosa da ripassare" --non-interactive
```
