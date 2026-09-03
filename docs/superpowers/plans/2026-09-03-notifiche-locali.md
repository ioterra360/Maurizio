# Notifiche locali (F3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Due notifiche locali — "primo ripasso pronto" a T0+20h per ogni ricordo salvato e un promemoria giornaliero all'orario scelto — con permesso chiesto dopo il primo salvataggio, una schermata `/notifications` raggiunta da Impostazioni, e il tocco che porta al ricordo o a Oggi.

**Architecture:** Tre moduli in `lib/`: `notifications-core.ts` (puro: slot, prossimo scatto, identificatori, rotte — coperto da vitest), `notification-prefs-store.ts` (zustand + AsyncStorage per le due preferenze di dispositivo, sul modello di `theme/theme-store.ts`) e `notifications.ts` (l'unico file che importa `expo-notifications`: permessi, canale Android, programmazione/cancellazione, tocco). Nessun server, nessun token push, nessuna migrazione: l'orario riusa `profiles.morning_review_at`, calma e digest le colonne che già esistono. Le notifiche per singolo ricordo si programmano SOLO al salvataggio e si cancellano al cestino; il promemoria giornaliero si riallinea al profilo a ogni avvio.

**Tech Stack:** TypeScript, Expo SDK 54, `expo-notifications` 0.32.17 (già installato su `build-3`, commit `38904d6`), expo-router, NativeWind v4, zustand, Supabase (PostgREST, nessuna migrazione), vitest.

**Spec:** `docs/superpowers/specs/2026-09-02-feedback-maurizio-design.md` §F3 (righe 309-358), "Ordine di esecuzione" (764-810). Le risposte verificate del critico (permessi, persistenza, cancellazione, tocco) sono incorporate qui sotto: le decisioni sono chiuse.

**Verifica preventiva (2026-09-03):** i blocchi di codice dei Task 1-4 (nucleo, store, wrapper, schermata, `SettingsRow`, chiavi i18n) sono stati estratti nel worktree, `vitest` è passato (32 test) e `tsc --noEmit` dell'intero progetto è uscito 0; poi l'albero è stato ripristinato. I Task 5-7 sono modifiche chirurgiche a file esistenti e vanno verificati con `npm run lint` a ogni step.

**Revisione (2026-09-03, due revisori):** dopo quella prova il piano è cambiato in sette punti — gate del pre-prompt su Android ≤ 12, nonce sull'interruttore principale, riarmo dei primi ripassi alla riaccensione, payload riscritto dopo uno spostamento, cancellazione al logout, `openSystemNotificationSettings` guardata, stato locale di calma/orario nella schermata. Le parti nuove NON sono passate per l'estrazione di prova: `npm run lint` e `npm test` a ogni step non sono una formalità.

## Global Constraints

- **Ordine rispetto agli altri tre piani della build 3, sullo stesso branch `build-3`:** `build3-config-nativa Task 1-4` → **questo piano** → `piani-paywall-revenuecat` → `foto-ricordi` → `build3-config-nativa Task 5-6`. Quando questo piano comincia, `app.json` porta già il plugin `expo-notifications` con l'icona bianca e la tinta `#3B6BF5`, e `lib/constants.ts` è ancora quello di partenza. I due piani che seguono toccheranno gli stessi file di `app/add.tsx`, `app/(app)/settings.tsx`, `app/(app)/_layout.tsx`, `app/_layout.tsx` e `lib/i18n/*`: quello che scrivi qui **resta**, e loro hanno l'ordine di innestarsi sopra senza cancellarlo.
- **Node/test:** `npm test` = `vitest run`. Il config raccoglie SOLO `features/**/*.test.ts` e `lib/**/*.test.ts` (`vitest.config.ts`). Niente test su `app/` o `components/`. `react-native` e AsyncStorage sono stub in `test/stubs/`; `expo-notifications` NON lo è → il modulo puro non deve importarlo mai.
- **Typecheck:** `npm run lint` = `tsc --noEmit`. Deve passare a ogni commit.
- **i18n:** `TKey = keyof typeof it` — una chiave aggiunta al solo `it.ts` è un errore di compilazione. `lib/i18n/i18n.test.ts` impone insiemi di chiavi identici, `{placeholder}` identici e nessuna stringa vuota su **it/en/fr/es**. Nessun literal italiano in TSX.
- **Demo mode + Expo Go:** ogni funzione di `lib/notifications.ts` inizia con `if (!notificationsAvailable()) return …` dove `notificationsAvailable() = NOTIFICATIONS_ENABLED && !isDemoMode`. In Expo Go `expo-notifications` emette solo un `console.warn` all'import (`node_modules/expo-notifications/build/index.js:5-9`): il codice non deve mai lanciare.
- **Solo notifiche locali** (spec :322): nessun `getExpoPushTokenAsync`, nessuna edge function, nessun token salvato.
- **Copy senza numeri** (spec :327-330, `docs/PRODUCT.md`): il promemoria giornaliero non contiene conteggi. Mai.
- **Permesso dopo il primo ricordo salvato, mai all'avvio** (spec :333-334). Il pre-prompt è un `MascotDialog`: "Non ora" NON chiama `requestPermissionsAsync`, così il prompt di sistema resta disponibile per la schermata.
- **iOS PROVISIONAL conta come concesso**: `allowed = granted || ios.status === IosAuthorizationStatus.PROVISIONAL` (foglio API verificato).
- **Identificatori stabili**: `first-review:<memoryId>` e `daily-reminder`. Stesso identificatore = la ri-programmazione sostituisce; la cancellazione è idempotente.
- **`NOTIFICATIONS_ENABLED` resta `false` in questo piano.** Il flip a `true` — insieme al plugin `["expo-notifications", {icon, color}]` in `app.json` e all'icona Android bianca su trasparente — appartiene al task finale di attivazione del piano di configurazione nativa (build 3). Questo piano rende il codice funzionante e verificabile flippando il flag in locale, senza committarlo.
- **Nessuna migrazione.** `calm_mode` resta `default true` a DB: con la semantica di spec :331 il promemoria giornaliero è opt-out (bisogna spegnere la modalità calma). La schermata lo dice in chiaro. Se Angelo/Maurizio vorranno invertire il default è una decisione separata (SQL in fondo, sezione "Passi umani").
- **Errori:** ogni `catch` passa da `reportError(tag, err)`; le funzioni di `lib/notifications.ts` non lanciano mai — i call site fanno `void fn()`.
- **Commit:** Conventional Commits con scope e riga di sommario in italiano; ogni commit porta il trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`, passato via HEREDOC come negli step qui sotto.
- **Lingua:** commenti e copy in italiano, simboli in inglese.

---

## Il modello, in una tabella

| Notifica | Identificatore | Trigger | Quando si programma | Quando si cancella | Tocco |
|---|---|---|---|---|---|
| Primo ripasso pronto | `first-review:<memoryId>` | `DATE` = `memory.nextReviewAt` (T0+20h) | al salvataggio (`app/add.tsx`), al ripristino dal cestino, a ogni apertura della scheda del ricordo (riscrive il payload dopo uno spostamento), alla riaccensione dell'interruttore principale o di "Avvisami" | cestino singolo, cestino cartella, "Avvisami" spento, interruttore principale spento, logout, richiesta di eliminazione account | `/memory/[id]` |
| Promemoria giornaliero | `daily-reminder` | `DAILY` alle `HH:MM` locali di `profiles.morning_review_at` | a ogni avvio con utente, a ogni cambio nella schermata | modalità calma ON, interruttore principale OFF, permesso revocato, logout, richiesta di eliminazione account | `/(app)/today` |

Tre cancelli, tutti e tre devono essere aperti perché una notifica esista: **permesso OS** (per dispositivo) · **interruttore principale** (`prefs.enabled`, per dispositivo) · per il giornaliero **modalità calma OFF** (profilo), per il singolo ricordo **"Avvisami" ON** (`prefs.firstReview`, per dispositivo).

Dove vive cosa (deciso, non si riapre):

| Dato | Dove | Perché |
|---|---|---|
| Interruttore principale, "Avvisami", prompt già mostrato | `lib/notification-prefs-store.ts` → AsyncStorage `memika.notifications.v1` | Sono lo specchio di un permesso OS che è per-dispositivo; identici in demo e reale; nessuna grant da toccare |
| Orario del promemoria | `profiles.morning_review_at` (già nella grant di UPDATE, `20260825121500_lock_profiles_columns.sql:26-33`) | Tipo `time`, default 08:00, già in `Profile`/`updateProfile`. `evening_review_at` resta in tabella ma non si legge più |
| Modalità calma, Riepilogo settimanale | `profiles.calm_mode`, `profiles.weekly_digest` | Esistono già; il digest resta una preferenza salvata con hint sincero ("non è ancora attivo") |

---

## File Structure

| File | Responsabilità |
|---|---|
| `lib/notifications-core.ts` **(nuovo)** | Puro: lista slot, parse/normalizzazione orario, prossimo scatto locale, identificatori, payload, rotta dal payload, regole dei cancelli. Zero import. |
| `lib/notifications-core.test.ts` **(nuovo)** | Copertura vitest della parte pura. |
| `lib/notification-prefs-store.ts` **(nuovo)** | Preferenze di dispositivo `{ enabled, firstReview, promptSeen }` con hydrate/persist. |
| `lib/notification-prefs-store.test.ts` **(nuovo)** | Default, persistenza, idratazione con valori sporchi. |
| `lib/notifications.ts` **(nuovo)** | L'UNICO importatore di `expo-notifications`: handler, canale, permessi, schedule/cancel, sync giornaliero, tocco. **Senza test, di proposito**: sta sotto `lib/`, quindi vitest lo raccoglierebbe, ma importa `expo-notifications`, che non ha stub in `test/stubs/` (ci sono solo `react-native` e AsyncStorage, `vitest.config.ts:22-28`). Tutta la logica decidibile — cancelli, identificatori, payload, filtro per cartella — vive in `notifications-core.ts` ed è testata lì; qui resta solo I/O con l'OS. |
| `components/SettingsRow.tsx` | Guadagna `chevron?: boolean` (freccia a destra: la riga apre un'altra schermata). |
| `app/(app)/notifications.tsx` **(nuovo)** | La schermata: interruttore · slot · Avvisami · Modalità calma · Riepilogo. |
| `app/(app)/_layout.tsx` | Registra il tab nascosto; riallinea il promemoria giornaliero a ogni avvio con utente. |
| `app/_layout.tsx` | Installa l'handler a livello di modulo; idrata le prefs; instrada il tocco. |
| `app/(app)/settings.tsx` | I due blocchi inline (Orari, Notifiche) diventano una riga con chevron → `/notifications`. |
| `app/add.tsx` | Programma il primo ripasso al salvataggio; pre-prompt con la mascotte. |
| `app/memory/[id].tsx` | Cancella al cestino; guardia auth (è fuori dal gate e diventa destinazione di un deep link). |
| `app/folder-settings.tsx` | Cancella i primi ripassi della cartella cestinata. |
| `app/trash.tsx` | Ri-programma al ripristino. |
| `lib/i18n/{it,en,es,fr}.ts` | Sezione `notifications.*`; `settings.calmModeHint` dice la verità nuova. |
| `lib/constants.ts` | Il commento sopra `NOTIFICATIONS_ENABLED` dice lo stato vero (il valore NON cambia). |
| `docs/ROUTING.md`, `docs/DATA-MODEL.md`, `docs/ROADMAP.md` | Route nuova, semantica delle colonne, voce roadmap. |

---

### Task 1: Il nucleo puro — slot, scatto locale, identificatori, rotte

**Files:**
- Create: `lib/notifications-core.ts`
- Create: `lib/notifications-core.test.ts`

**Interfaces:**
- Consumes: niente (zero import).
- Produces:
  - `DAILY_REMINDER_ID = "daily-reminder"`, `FIRST_REVIEW_ID_PREFIX = "first-review:"`, `REMINDER_CHANNEL_ID = "reminders"`, `DEFAULT_REMINDER_SLOT = "08:00"`
  - `reminderSlots(): string[]` — 48 slot `"HH:MM"` da `00:00` a `23:30`
  - `parseSlot(value: string): { hour: number; minute: number } | null` — accetta `HH:MM` e `HH:MM:SS`
  - `slotFromProfileTime(value: string | null | undefined): string` — `"08:15:00"` → `"08:00"`, invalido → default
  - `nextDailyTrigger(slot: string, now?: Date): Date | null` — prossimo scatto in ORA LOCALE
  - `shouldScheduleDaily(d: { enabled: boolean; calmMode: boolean; allowed: boolean }): boolean`
  - `shouldScheduleFirstReview(d: { enabled: boolean; firstReview: boolean; allowed: boolean }): boolean`
  - `canScheduleAt(iso: string, now?: Date): boolean` — futuro con almeno 2 s di margine
  - `firstReviewIdentifier(memoryId: string): string`
  - `type NotificationPayload = { kind: "first-review"; memoryId: string; folderId: string } | { kind: "daily" }`
  - `firstReviewPayload(memoryId: string, folderId: string): NotificationPayload`, `dailyPayload(): NotificationPayload`
  - `isFirstReviewPayload(data: unknown): boolean`, `isFirstReviewInFolder(data: unknown, folderId: string): boolean`
  - `type NotificationRoute = { pathname: "/memory/[id]"; params: { id: string } } | { pathname: "/(app)/today" }`
  - `routeForPayload(data: unknown): NotificationRoute | null`

- [ ] **Step 1: Scrivere i test che falliscono**

Crea `lib/notifications-core.test.ts`:

```ts
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
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npm test -- lib/notifications-core.test.ts`
Expected: FAIL — `Failed to resolve import "./notifications-core"`.

- [ ] **Step 3: Scrivere `lib/notifications-core.ts`**

```ts
/**
 * Notifiche locali — la parte PURA (spec 2026-09-02 §F3).
 *
 * Qui non c'è expo-notifications, React, Supabase: solo aritmetica di orari,
 * identificatori e payload. È il pezzo coperto da vitest; il wrapper che
 * parla con l'OS è lib/notifications.ts.
 *
 * Confine di giornata: la MEZZANOTTE LOCALE del telefono, come
 * lib/upcoming.ts — il promemoria "alle 08:00" è alle 08:00 dove sta
 * l'utente, non a Greenwich.
 */

export const DAILY_REMINDER_ID = "daily-reminder";
export const FIRST_REVIEW_ID_PREFIX = "first-review:";
/** Canale Android. Importanza e suono sono immutabili dopo la creazione: per cambiarli serve un id nuovo. */
export const REMINDER_CHANNEL_ID = "reminders";
export const DEFAULT_REMINDER_SLOT = "08:00";

/** Sotto questo margine iOS rifiuta la data (promise rigettata) e Android la perde in silenzio. */
const MIN_LEAD_MS = 2000;

const pad = (n: number) => String(n).padStart(2, "0");

/** I 48 slot da mezz'ora della giornata, "HH:MM". */
export function reminderSlots(): string[] {
  const out: string[] = [];
  for (let h = 0; h < 24; h++) {
    out.push(`${pad(h)}:00`, `${pad(h)}:30`);
  }
  return out;
}

/** "HH:MM" o "HH:MM:SS" (com'è la colonna `time` di Postgres) → ore e minuti. */
export function parseSlot(value: string): { hour: number; minute: number } | null {
  const m = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

/**
 * Da `profiles.morning_review_at` allo slot della lista. La colonna accetta
 * qualunque minuto; la lista no, quindi si arrotonda PER DIFETTO alla
 * mezz'ora. Valore assente o rotto → default.
 */
export function slotFromProfileTime(value: string | null | undefined): string {
  const p = value ? parseSlot(value) : null;
  if (!p) return DEFAULT_REMINDER_SLOT;
  return `${pad(p.hour)}:${p.minute >= 30 ? "30" : "00"}`;
}

/**
 * Il prossimo scatto di uno slot, in ora locale: oggi se deve ancora
 * arrivare, altrimenti domani. Usato per la riga "Prossimo promemoria: …";
 * il trigger DAILY dell'OS fa lo stesso conto per conto suo.
 */
export function nextDailyTrigger(slot: string, now: Date = new Date()): Date | null {
  const p = parseSlot(slot);
  if (!p) return null;
  const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), p.hour, p.minute, 0, 0);
  if (candidate.getTime() <= now.getTime()) candidate.setDate(candidate.getDate() + 1);
  return candidate;
}

/** Il promemoria giornaliero esiste solo con permesso, interruttore acceso e modalità calma spenta (spec :331). */
export function shouldScheduleDaily(d: { enabled: boolean; calmMode: boolean; allowed: boolean }): boolean {
  return d.enabled && d.allowed && !d.calmMode;
}

/** L'avviso del primo ripasso ignora la modalità calma: è "il punto 20 reso visibile". */
export function shouldScheduleFirstReview(d: { enabled: boolean; firstReview: boolean; allowed: boolean }): boolean {
  return d.enabled && d.allowed && d.firstReview;
}

/** Vero solo se l'istante è nel futuro con margine. */
export function canScheduleAt(iso: string, now: Date = new Date()): boolean {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return false;
  return ms > now.getTime() + MIN_LEAD_MS;
}

export function firstReviewIdentifier(memoryId: string): string {
  return `${FIRST_REVIEW_ID_PREFIX}${memoryId}`;
}

/** Cosa viaggia dentro `content.data`. Solo stringhe: deve essere serializzabile. */
export type NotificationPayload =
  | { kind: "first-review"; memoryId: string; folderId: string }
  | { kind: "daily" };

export function firstReviewPayload(memoryId: string, folderId: string): NotificationPayload {
  return { kind: "first-review", memoryId, folderId };
}

export function dailyPayload(): NotificationPayload {
  return { kind: "daily" };
}

function asRecord(data: unknown): Record<string, unknown> | null {
  return data && typeof data === "object" ? (data as Record<string, unknown>) : null;
}

export function isFirstReviewPayload(data: unknown): boolean {
  const d = asRecord(data);
  return !!d && d.kind === "first-review" && typeof d.memoryId === "string" && d.memoryId.length > 0;
}

export function isFirstReviewInFolder(data: unknown, folderId: string): boolean {
  const d = asRecord(data);
  return isFirstReviewPayload(data) && !!d && d.folderId === folderId;
}

/** Dove porta il tocco. Stessa forma degli Href di expo-router (cfr. app/(app)/upcoming.tsx:347). */
export type NotificationRoute =
  | { pathname: "/memory/[id]"; params: { id: string } }
  | { pathname: "/(app)/today" };

export function routeForPayload(data: unknown): NotificationRoute | null {
  const d = asRecord(data);
  if (!d) return null;
  if (d.kind === "daily") return { pathname: "/(app)/today" };
  if (isFirstReviewPayload(d)) return { pathname: "/memory/[id]", params: { id: d.memoryId as string } };
  return null;
}
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npm test -- lib/notifications-core.test.ts`
Expected: PASS, tutti.

- [ ] **Step 5: Typecheck e commit**

```bash
npm run lint
git add lib/notifications-core.ts lib/notifications-core.test.ts
git commit -m "$(cat <<'EOF'
feat(notifications): nucleo puro — slot da mezz'ora, scatto locale, identificatori e rotte

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Le preferenze di dispositivo

**Files:**
- Create: `lib/notification-prefs-store.ts`
- Create: `lib/notification-prefs-store.test.ts`
- Modify: `app/_layout.tsx:251-256` (il `Promise.all` di idratazione)

**Interfaces:**
- Consumes: `reportError` da `./report-error`.
- Produces:
  - `type NotificationPrefs = { enabled: boolean; firstReview: boolean; promptSeen: boolean }`
  - `DEFAULT_NOTIFICATION_PREFS: NotificationPrefs` = `{ enabled: false, firstReview: true, promptSeen: false }`
  - `useNotificationPrefsStore` con `prefs`, `hydrated`, `hydrate(): Promise<void>`, `setPrefs(patch: Partial<NotificationPrefs>): void`

- [ ] **Step 1: Scrivere il test che fallisce**

Crea `lib/notification-prefs-store.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";

// report-error importa @sentry/react-native, che importa il react-native
// vero (non lo stub). I rami catch non sono esercitati qui.
vi.mock("./report-error", () => ({ reportError: vi.fn() }));

import { DEFAULT_NOTIFICATION_PREFS, useNotificationPrefsStore } from "./notification-prefs-store";

const KEY = "memika.notifications.v1";

describe("notification prefs store", () => {
  beforeEach(async () => {
    await AsyncStorage.removeItem(KEY);
    useNotificationPrefsStore.setState({ prefs: DEFAULT_NOTIFICATION_PREFS, hydrated: false });
  });

  it("parte spento, con Avvisami acceso e prompt mai mostrato", () => {
    expect(useNotificationPrefsStore.getState().prefs).toEqual({
      enabled: false,
      firstReview: true,
      promptSeen: false,
    });
  });

  it("applica una patch parziale e la persiste", async () => {
    useNotificationPrefsStore.getState().setPrefs({ enabled: true });
    expect(useNotificationPrefsStore.getState().prefs).toEqual({ enabled: true, firstReview: true, promptSeen: false });
    await new Promise((r) => setTimeout(r, 0));
    expect(JSON.parse((await AsyncStorage.getItem(KEY)) ?? "{}")).toEqual({
      enabled: true,
      firstReview: true,
      promptSeen: false,
    });
  });

  it("idrata dallo storage e scarta i valori non booleani", async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ enabled: true, firstReview: "no", promptSeen: 1, extra: true }));
    await useNotificationPrefsStore.getState().hydrate();
    expect(useNotificationPrefsStore.getState().prefs).toEqual({ enabled: true, firstReview: true, promptSeen: false });
    expect(useNotificationPrefsStore.getState().hydrated).toBe(true);
  });

  it("una scelta fatta mentre lo storage rispondeva vince sulla snapshot", async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ enabled: false }));
    useNotificationPrefsStore.getState().setPrefs({ enabled: true });
    await useNotificationPrefsStore.getState().hydrate();
    expect(useNotificationPrefsStore.getState().prefs.enabled).toBe(true);
  });
});
```

- [ ] **Step 2: Eseguire e verificare che fallisca**

Run: `npm test -- lib/notification-prefs-store.test.ts`
Expected: FAIL — `Failed to resolve import "./notification-prefs-store"`.

- [ ] **Step 3: Scrivere `lib/notification-prefs-store.ts`**

```ts
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { reportError } from "./report-error";

/**
 * Preferenze notifiche DI DISPOSITIVO (spec F3): l'interruttore principale,
 * "Avvisami quando un ricordo è pronto per il primo ripasso" e il flag "il
 * pre-prompt è già stato mostrato".
 *
 * Perché AsyncStorage e non profiles: sono lo specchio di un permesso OS
 * che è per-telefono. Una colonna condivisa direbbe "acceso" su un secondo
 * telefono dove nessuno ha mai concesso nulla. Stesso pattern hand-rolled
 * di lib/folder-sort-store.ts; idratato in app/_layout.tsx col tema.
 */

const STORAGE_KEY = "memika.notifications.v1";

export type NotificationPrefs = {
  /** Interruttore principale della schermata Notifiche. */
  enabled: boolean;
  /** Avviso "primo ripasso pronto" per ogni ricordo salvato. */
  firstReview: boolean;
  /** Il pre-prompt con la mascotte è già stato mostrato su questo telefono. */
  promptSeen: boolean;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  enabled: false,
  firstReview: true,
  promptSeen: false,
};

type State = {
  prefs: NotificationPrefs;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setPrefs: (patch: Partial<NotificationPrefs>) => void;
};

function clean(raw: unknown): Partial<NotificationPrefs> {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const out: Partial<NotificationPrefs> = {};
  if (typeof r.enabled === "boolean") out.enabled = r.enabled;
  if (typeof r.firstReview === "boolean") out.firstReview = r.firstReview;
  if (typeof r.promptSeen === "boolean") out.promptSeen = r.promptSeen;
  return out;
}

async function persist(prefs: NotificationPrefs) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch (e) {
    // Non fatale: la scelta vale per la sessione.
    reportError("notification-prefs/persist", e);
  }
}

export const useNotificationPrefsStore = create<State>((set, get) => ({
  prefs: DEFAULT_NOTIFICATION_PREFS,
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const stored = raw ? clean(JSON.parse(raw)) : {};
      // Una scelta fatta mentre lo storage rispondeva vince sulla snapshot:
      // si confronta col default, non con lo stato corrente.
      const live = get().prefs;
      const changed: Partial<NotificationPrefs> = {};
      for (const k of ["enabled", "firstReview", "promptSeen"] as const) {
        if (live[k] !== DEFAULT_NOTIFICATION_PREFS[k]) changed[k] = live[k];
      }
      set({ prefs: { ...DEFAULT_NOTIFICATION_PREFS, ...stored, ...changed }, hydrated: true });
    } catch (e) {
      reportError("notification-prefs/hydrate", e);
      set({ hydrated: true });
    }
  },

  setPrefs: (patch) => {
    const next = { ...get().prefs, ...patch };
    set({ prefs: next });
    void persist(next);
  },
}));
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npm test -- lib/notification-prefs-store.test.ts`
Expected: PASS.

- [ ] **Step 5: Idratare nel root layout**

In `app/_layout.tsx`, il blocco alle righe 251-256:

```ts
      // Locale + tema per primi (pochi ms da AsyncStorage) così il primo
      // frame è già nella lingua E nel tema scelti, poi auth.
      await Promise.all([
        useLocaleStore.getState().hydrate(),
        useThemeStore.getState().hydrate(),
      ]);
```

diventa:

```ts
      // Locale + tema per primi (pochi ms da AsyncStorage) così il primo
      // frame è già nella lingua E nel tema scelti, poi auth. Le prefs
      // notifiche viaggiano insieme: servono prima del primo salvataggio.
      await Promise.all([
        useLocaleStore.getState().hydrate(),
        useThemeStore.getState().hydrate(),
        useNotificationPrefsStore.getState().hydrate(),
      ]);
```

e sotto l'import di riga 33 (`useThemeStore, useColors`) aggiungi:

```ts
import { useNotificationPrefsStore } from "@/lib/notification-prefs-store";
```

- [ ] **Step 6: Typecheck e commit**

```bash
npm run lint
git add lib/notification-prefs-store.ts lib/notification-prefs-store.test.ts app/_layout.tsx
git commit -m "$(cat <<'EOF'
feat(notifications): preferenze di dispositivo — interruttore, Avvisami, prompt visto

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Il wrapper — permessi, canale, programmazione, tocco

**Files:**
- Create: `lib/notifications.ts`
- Modify: `lib/i18n/it.ts`, `lib/i18n/en.ts`, `lib/i18n/es.ts`, `lib/i18n/fr.ts` (sezione nuova in fondo, prima di `} as const;` / `};`)
- Modify: `app/_layout.tsx` (handler a livello di modulo, dopo `Sentry.init` alla riga 70)

**Interfaces:**
- Consumes: Task 1 e Task 2; `NOTIFICATIONS_ENABLED` da `./constants:242`; `isDemoMode` da `./supabase`; `t` da `@/lib/i18n`; `Memory`, `Profile` da `./mappers`; `reportError`.
- Produces (nessuna lancia; tutte restituiscono subito se `!notificationsAvailable()`):
  - `notificationsAvailable(): boolean`
  - `installNotificationHandler(): void`
  - `type PermissionState = { allowed: boolean; canAskAgain: boolean; undetermined: boolean }`
  - `getPermission(): Promise<PermissionState>`, `requestPermission(): Promise<PermissionState>`
  - `openSystemNotificationSettings(): void`
  - `scheduleFirstReview(memory: Pick<Memory, "id" | "folderId" | "term" | "nextReviewAt" | "phase">): Promise<void>`
  - `cancelFirstReview(memoryId: string): Promise<void>`
  - `cancelFirstReviewsInFolder(folderId: string): Promise<void>`
  - `cancelAllFirstReviews(): Promise<void>`
  - `syncDailyReminder(profile: Pick<Profile, "calmMode" | "morningReviewAt"> | null): Promise<void>`
  - `cancelAllReminders(): Promise<void>`
  - `subscribeToNotificationTaps(onRoute: (route: NotificationRoute) => void): () => void`

- [ ] **Step 1: Aggiungere la copy delle notifiche ai quattro cataloghi**

Sono le stringhe che l'OS mostra; la schermata arriva nel Task 4 con le sue. In fondo a ogni catalogo, dopo `"upcoming.emptyDay"` e prima della riga di chiusura, aggiungi una sezione nuova. Il giornaliero NON contiene numeri: la notifica locale non può sapere cosa c'è in coda quando scatta.

`lib/i18n/it.ts`:

```ts

  // ---- notifications (locali: primo ripasso + promemoria, spec F3 2026-09-03) ----
  "notifications.channelName": "Promemoria di ripasso",
  "notifications.dailyTitle": "Ripasso di oggi",
  "notifications.dailyBody": "Qualche minuto per i ricordi di oggi?",
  "notifications.firstReviewTitle": "Primo ripasso pronto",
  "notifications.firstReviewBody": "«{term}» ti aspetta per il primo ripasso.",
```

`lib/i18n/en.ts`:

```ts

  // ---- notifications (local: first review + daily reminder, spec F3 2026-09-03) ----
  "notifications.channelName": "Review reminders",
  "notifications.dailyTitle": "Today's review",
  "notifications.dailyBody": "A few minutes for today's memories?",
  "notifications.firstReviewTitle": "First review ready",
  "notifications.firstReviewBody": "“{term}” is waiting for its first review.",
```

`lib/i18n/es.ts`:

```ts

  // ---- notifications (locales: primer repaso + recordatorio diario, spec F3 2026-09-03) ----
  "notifications.channelName": "Recordatorios de repaso",
  "notifications.dailyTitle": "Repaso de hoy",
  "notifications.dailyBody": "¿Unos minutos para los recuerdos de hoy?",
  "notifications.firstReviewTitle": "Primer repaso listo",
  "notifications.firstReviewBody": "«{term}» te espera para el primer repaso.",
```

`lib/i18n/fr.ts`:

```ts

  // ---- notifications (locales : première révision + rappel quotidien, spec F3 2026-09-03) ----
  "notifications.channelName": "Rappels de révision",
  "notifications.dailyTitle": "Révision du jour",
  "notifications.dailyBody": "Quelques minutes pour les souvenirs du jour ?",
  "notifications.firstReviewTitle": "Première révision prête",
  "notifications.firstReviewBody": "« {term} » t'attend pour la première révision.",
```

Run: `npm test -- lib/i18n/i18n.test.ts`
Expected: PASS — stessi insiemi di chiavi, `{term}` presente in tutte e quattro.

- [ ] **Step 2: Scrivere `lib/notifications.ts`**

```ts
/**
 * Notifiche locali — il wrapper su expo-notifications (spec 2026-09-02 §F3).
 *
 * È l'UNICO file che importa expo-notifications. Regole:
 *  - solo locali: nessun token push, nessun server;
 *  - ogni funzione esce subito se le notifiche non sono disponibili
 *    (flag NOTIFICATIONS_ENABLED spento, o demo mode);
 *  - nessuna funzione lancia: gli errori passano da reportError e i call
 *    site fanno `void fn()`;
 *  - la logica pura sta in lib/notifications-core.ts (testata); qui c'è
 *    solo l'I/O con l'OS.
 *
 * In Expo Go la libreria emette un warn all'import e le notifiche locali
 * funzionano; il plugin (icona Android) no — il test vero si fa sulla build 3.
 */

import * as Notifications from "expo-notifications";
import {
  AndroidImportance,
  DEFAULT_ACTION_IDENTIFIER,
  IosAuthorizationStatus,
  SchedulableTriggerInputTypes,
  type NotificationPermissionsStatus,
  type NotificationResponse,
} from "expo-notifications";
import { Linking, Platform } from "react-native";

import { NOTIFICATIONS_ENABLED } from "./constants";
import { t } from "@/lib/i18n";
import type { Memory, Profile } from "./mappers";
import { useNotificationPrefsStore } from "./notification-prefs-store";
import {
  DAILY_REMINDER_ID,
  REMINDER_CHANNEL_ID,
  canScheduleAt,
  dailyPayload,
  firstReviewIdentifier,
  firstReviewPayload,
  isFirstReviewInFolder,
  isFirstReviewPayload,
  parseSlot,
  routeForPayload,
  shouldScheduleDaily,
  shouldScheduleFirstReview,
  slotFromProfileTime,
  type NotificationRoute,
} from "./notifications-core";
import { reportError } from "./report-error";
import { isDemoMode } from "./supabase";

/** Il flag lo flippa il piano di configurazione nativa (build 3); in demo l'OS non si tocca mai. */
export function notificationsAvailable(): boolean {
  return NOTIFICATIONS_ENABLED && !isDemoMode;
}

/**
 * Come mostrare una notifica che arriva con l'app in PRIMO PIANO. Senza
 * handler l'OS non la mostra affatto. Va chiamato una volta, a livello di
 * modulo, nel root layout. Niente badge: Memika non conta niente in rosso.
 */
export function installNotificationHandler(): void {
  if (!notificationsAvailable()) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Canale Android; su iOS è un no-op. Importanza DEFAULT: un promemoria, non un allarme. */
async function ensureChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: t("notifications.channelName"),
    importance: AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200],
    showBadge: false,
  });
}

export type PermissionState = {
  /** Possiamo programmare. Su iOS anche PROVISIONAL (consegna silenziosa) conta come sì. */
  allowed: boolean;
  /** false = l'utente ha negato: solo le impostazioni del telefono possono riaprire. */
  canAskAgain: boolean;
  /** Mai chiesto su questo telefono: il pre-prompt ha senso solo qui. */
  undetermined: boolean;
};

const UNAVAILABLE: PermissionState = { allowed: false, canAskAgain: false, undetermined: false };

function toPermissionState(s: NotificationPermissionsStatus): PermissionState {
  return {
    allowed: s.granted || s.ios?.status === IosAuthorizationStatus.PROVISIONAL,
    canAskAgain: s.canAskAgain,
    // `status` è l'enum stringa di expo-modules-core; il confronto testuale
    // evita di importare quel pacchetto solo per una costante.
    undetermined: String(s.status) === "undetermined",
  };
}

export async function getPermission(): Promise<PermissionState> {
  if (!notificationsAvailable()) return UNAVAILABLE;
  try {
    return toPermissionState(await Notifications.getPermissionsAsync());
  } catch (e) {
    reportError("notifications/get-permission", e);
    return UNAVAILABLE;
  }
}

/**
 * Chiede il permesso di sistema. Su iOS il foglio compare UNA volta per
 * installazione: dopo un "no" resta solo Impostazioni. Per questo chi
 * chiama deve farlo solo su un'azione esplicita dell'utente.
 */
export async function requestPermission(): Promise<PermissionState> {
  if (!notificationsAvailable()) return UNAVAILABLE;
  try {
    const current = toPermissionState(await Notifications.getPermissionsAsync());
    if (current.allowed || !current.canAskAgain) return current;
    const next = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    });
    return toPermissionState(next);
  } catch (e) {
    reportError("notifications/request-permission", e);
    return UNAVAILABLE;
  }
}

/**
 * Apre le impostazioni di sistema dell'app. La guardia non è decorativa: in
 * demo (o a flag spento) `requestPermission` torna UNAVAILABLE, che ha
 * `canAskAgain: false`, e senza guardia il ramo "non possiamo più chiedere"
 * della schermata butterebbe l'utente fuori da Memika. In demo l'OS non si
 * tocca, mai.
 */
export function openSystemNotificationSettings(): void {
  if (!notificationsAvailable()) return;
  Linking.openSettings().catch((e) => reportError("notifications/open-settings", e));
}

/**
 * "Primo ripasso pronto" per UN ricordo, all'istante esatto di
 * nextReviewAt (T0+20h). Solo per la fase p20h: le fasi successive non
 * avvisano. Identificatore stabile → ri-programmare sostituisce.
 */
export async function scheduleFirstReview(
  memory: Pick<Memory, "id" | "folderId" | "term" | "nextReviewAt" | "phase">,
): Promise<void> {
  if (!notificationsAvailable()) return;
  try {
    if (memory.phase !== "p20h") return;
    if (!canScheduleAt(memory.nextReviewAt)) return;
    const prefs = useNotificationPrefsStore.getState().prefs;
    const perm = await getPermission();
    if (!shouldScheduleFirstReview({ enabled: prefs.enabled, firstReview: prefs.firstReview, allowed: perm.allowed })) {
      return;
    }
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      identifier: firstReviewIdentifier(memory.id),
      content: {
        title: t("notifications.firstReviewTitle"),
        body: t("notifications.firstReviewBody", { term: memory.term }),
        data: firstReviewPayload(memory.id, memory.folderId),
        sound: true,
      },
      trigger: {
        type: SchedulableTriggerInputTypes.DATE,
        date: Date.parse(memory.nextReviewAt),
        channelId: REMINDER_CHANNEL_ID,
      },
    });
  } catch (e) {
    reportError("notifications/schedule-first-review", e);
  }
}

/** Idempotente: risolve anche se per quell'id non c'è nulla in attesa. */
export async function cancelFirstReview(memoryId: string): Promise<void> {
  if (!notificationsAvailable()) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(firstReviewIdentifier(memoryId));
  } catch (e) {
    reportError("notifications/cancel-first-review", e);
  }
}

async function cancelFirstReviewsWhere(keep: (data: unknown) => boolean, tag: string): Promise<void> {
  if (!notificationsAvailable()) return;
  try {
    // Il trigger torna in forma NATIVA (diversa fra iOS e Android): si
    // filtra sul payload, mai sul trigger.
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    const mine = pending.filter((r) => keep(r.content.data));
    await Promise.all(mine.map((r) => Notifications.cancelScheduledNotificationAsync(r.identifier)));
  } catch (e) {
    reportError(tag, e);
  }
}

/** Cestino di una cartella: deleteFolder non restituisce gli id, il payload sì. */
export function cancelFirstReviewsInFolder(folderId: string): Promise<void> {
  return cancelFirstReviewsWhere((d) => isFirstReviewInFolder(d, folderId), "notifications/cancel-folder");
}

/** "Avvisami" spento: via tutti i primi ripassi in attesa, il giornaliero resta. */
export function cancelAllFirstReviews(): Promise<void> {
  return cancelFirstReviewsWhere(isFirstReviewPayload, "notifications/cancel-all-first-reviews");
}

/**
 * Riallinea il promemoria giornaliero a profilo + prefs + permesso. È
 * l'unico punto che lo programma o lo cancella: chiamarlo è sempre
 * corretto, in qualunque stato ci si trovi. Profilo null (demo, errore di
 * rete) = calma accesa = niente promemoria.
 */
export async function syncDailyReminder(
  profile: Pick<Profile, "calmMode" | "morningReviewAt"> | null,
): Promise<void> {
  if (!notificationsAvailable()) return;
  try {
    const prefs = useNotificationPrefsStore.getState().prefs;
    const perm = await getPermission();
    const calmMode = profile?.calmMode ?? true;
    if (!shouldScheduleDaily({ enabled: prefs.enabled, calmMode, allowed: perm.allowed })) {
      await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID);
      return;
    }
    const slot = parseSlot(slotFromProfileTime(profile?.morningReviewAt));
    if (!slot) {
      // Oggi irraggiungibile (slotFromProfileTime torna sempre uno slot
      // valido), ma se le due funzioni divergessero un `return` secco
      // lascerebbe programmato l'orario VECCHIO mentre il profilo ne dice
      // un altro. Meglio uscire senza promemoria che con quello sbagliato.
      await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID);
      return;
    }
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      identifier: DAILY_REMINDER_ID,
      content: {
        title: t("notifications.dailyTitle"),
        body: t("notifications.dailyBody"),
        data: dailyPayload(),
        sound: true,
      },
      trigger: {
        type: SchedulableTriggerInputTypes.DAILY,
        hour: slot.hour,
        minute: slot.minute,
        channelId: REMINDER_CHANNEL_ID,
      },
    });
  } catch (e) {
    reportError("notifications/sync-daily", e);
  }
}

/** Interruttore principale spento: niente resta in attesa. */
export async function cancelAllReminders(): Promise<void> {
  if (!notificationsAvailable()) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    reportError("notifications/cancel-all", e);
  }
}

function routeForResponse(r: NotificationResponse | null): NotificationRoute | null {
  if (!r || r.actionIdentifier !== DEFAULT_ACTION_IDENTIFIER) return null;
  return routeForPayload(r.notification.request.content.data);
}

/**
 * Tocco su una notifica. Avvio a freddo: la risposta che ha lanciato l'app
 * si legge in modo sincrono e si CANCELLA, altrimenti un reload la
 * rinavigherebbe. App viva: il listener. Torna l'unsubscribe.
 */
export function subscribeToNotificationTaps(onRoute: (route: NotificationRoute) => void): () => void {
  if (!notificationsAvailable()) return () => {};
  try {
    const cold = Notifications.getLastNotificationResponse();
    if (cold) {
      Notifications.clearLastNotificationResponse();
      const route = routeForResponse(cold);
      if (route) onRoute(route);
    }
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = routeForResponse(response);
      if (route) onRoute(route);
    });
    return () => sub.remove();
  } catch (e) {
    reportError("notifications/subscribe-taps", e);
    return () => {};
  }
}
```

- [ ] **Step 3: Installare l'handler nel root layout**

In `app/_layout.tsx`, subito dopo la chiusura di `Sentry.init({ … });` (riga 70), aggiungi a livello di modulo:

```ts
// Come mostrare una notifica locale che arriva con l'app aperta: senza
// questo l'OS non la mostra. Una volta sola, a livello di modulo, come
// Sentry.init. No-op finché NOTIFICATIONS_ENABLED è spento o in demo.
installNotificationHandler();
```

e tra gli import (sotto la riga 37, `useUIStore`):

```ts
import { installNotificationHandler } from "@/lib/notifications";
```

- [ ] **Step 4: Typecheck, test, commit**

```bash
npm run lint
npm test
git add lib/notifications.ts lib/i18n/ app/_layout.tsx
git commit -m "$(cat <<'EOF'
feat(notifications): wrapper expo-notifications — permessi, canale, primo ripasso, giornaliero, tocco

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: La schermata Notifiche e la riga in Impostazioni

**Files:**
- Modify: `components/SettingsRow.tsx:6-11,18-43,60-94`
- Create: `app/(app)/notifications.tsx`
- Modify: `app/(app)/_layout.tsx:129-130`
- Modify: `app/(app)/settings.tsx:24,339-353,371-406`
- Modify: `lib/i18n/{it,en,es,fr}.ts` (chiavi della schermata + `settings.calmModeHint`)
- Modify: `docs/ROUTING.md:24,51,52`

**Interfaces:**
- Consumes: Task 2 (`useNotificationPrefsStore`), Task 3 (`getPermission`, `requestPermission`, `openSystemNotificationSettings`, `syncDailyReminder`, `cancelAllReminders`, `cancelAllFirstReviews`, `scheduleFirstReview`), Task 1 (`reminderSlots`, `slotFromProfileTime`, `nextDailyTrigger`, `DEFAULT_REMINDER_SLOT`); `fetchProfile`/`updateProfile` da `lib/api.ts:62-87` e `fetchMemoriesInRange` da `lib/api.ts:932-951`; `shortDateTime` da `lib/format.ts:46`.
- Produces: `SettingsRow` accetta `chevron?: boolean`; la route `/(app)/notifications`.

- [ ] **Step 1: Estendere `SettingsRow` con la freccia**

Scelta: UN prop opzionale sul componente esistente, non un `Tappable` grezzo nella schermata — così ogni riga che apre un'altra schermata avrà lo stesso aspetto. In `components/SettingsRow.tsx`:

Riga 2, l'import diventa:

```ts
import { Switch, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
```

Il tipo (righe 6-11):

```ts
type RowProps = {
  label: string;
  hint?: string;
  value?: string;
  onPress?: () => void;
  /** Freccia a destra: la riga apre un'altra schermata (push). */
  chevron?: boolean;
};
```

La firma (riga 18) diventa `export function SettingsRow({ label, hint, value, onPress, chevron }: RowProps) {` e i due `<RowBody label={label} hint={hint} value={value} />` (righe 40 e 55) diventano `<RowBody label={label} hint={hint} value={value} chevron={chevron} />`.

`RowBody` (riga 60) diventa:

```tsx
function RowBody({ label, hint, value, chevron }: Omit<RowProps, "onPress">) {
  const colors = useColors();
  return (
    <>
      <View className="flex-1" style={{ minWidth: 0 }}>
        <Text
          className="text-navy"
          style={{ fontFamily: FONT.medium, fontSize: 15, letterSpacing: -0.07 }}
        >
          {label}
        </Text>
        {hint ? (
          <Text
            className="mt-0.5 text-caption text-mid-grey"
            style={{ fontFamily: FONT.regular, lineHeight: 18 }}
          >
            {hint}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text
          style={{
            fontFamily: FONT.medium,
            fontSize: 14.5,
            color: colors.midGrey,
            fontVariant: ["tabular-nums"],
          }}
        >
          {value}
        </Text>
      ) : null}
      {chevron ? <ChevronRight size={18} color={colors.midGrey} strokeWidth={2} /> : null}
    </>
  );
}
```

- [ ] **Step 2: Le chiavi della schermata, in tutti e quattro i cataloghi**

Aggiungi sotto le cinque chiavi `notifications.*` del Task 3 (stessa sezione, in fondo al catalogo).

`lib/i18n/it.ts`:

```ts
  "notifications.title": "Notifiche",
  "notifications.settingsRow": "Notifiche e promemoria",
  "notifications.settingsRowHint": "Promemoria giornaliero, avviso del primo ripasso, modalità calma.",
  "notifications.masterSwitch": "Notifiche",
  "notifications.masterSwitchHint": "Promemoria locali, solo su questo telefono. Nessun server: Memika non sa cosa c'è in coda finché non la apri.",
  "notifications.systemBlocked": "Le notifiche di Memika sono spente nelle impostazioni del telefono.",
  "notifications.openSystemSettings": "Apri le impostazioni del telefono",
  "notifications.deniedToast": "Permesso negato: puoi riattivarlo dalle impostazioni del telefono.",
  "notifications.slotSection": "Orario del promemoria",
  "notifications.slotHint": "Un promemoria al giorno, all'ora che scegli.",
  "notifications.slotNext": "Prossimo promemoria: {time}",
  "notifications.slotSuspendedByCalm": "Sospeso dalla modalità calma: resta solo l'avviso del primo ripasso.",
  "notifications.slotDisabled": "Accendi le notifiche per scegliere l'orario.",
  "notifications.slotA11y": "Promemoria alle {time}",
  "notifications.firstReviewSwitch": "Avvisami quando un ricordo è pronto per il primo ripasso",
  "notifications.firstReviewSwitchHint": "Venti ore dopo il salvataggio, per ogni ricordo nuovo. Non dipende dalla modalità calma.",
  "notifications.saveFailed": "Impostazione non salvata. Riprova.",
```

`lib/i18n/en.ts`:

```ts
  "notifications.title": "Notifications",
  "notifications.settingsRow": "Notifications and reminders",
  "notifications.settingsRowHint": "Daily reminder, first-review alert, calm mode.",
  "notifications.masterSwitch": "Notifications",
  "notifications.masterSwitchHint": "Local reminders, on this phone only. No server: Memika doesn't know what's due until you open it.",
  "notifications.systemBlocked": "Memika's notifications are turned off in your phone settings.",
  "notifications.openSystemSettings": "Open phone settings",
  "notifications.deniedToast": "Permission denied: you can turn it back on in your phone settings.",
  "notifications.slotSection": "Reminder time",
  "notifications.slotHint": "One reminder a day, at the time you choose.",
  "notifications.slotNext": "Next reminder: {time}",
  "notifications.slotSuspendedByCalm": "Paused by calm mode: only the first-review alert remains.",
  "notifications.slotDisabled": "Turn notifications on to choose a time.",
  "notifications.slotA11y": "Reminder at {time}",
  "notifications.firstReviewSwitch": "Tell me when a memory is ready for its first review",
  "notifications.firstReviewSwitchHint": "Twenty hours after saving, for every new memory. Calm mode doesn't affect it.",
  "notifications.saveFailed": "Setting not saved. Try again.",
```

`lib/i18n/es.ts`:

```ts
  "notifications.title": "Notificaciones",
  "notifications.settingsRow": "Notificaciones y recordatorios",
  "notifications.settingsRowHint": "Recordatorio diario, aviso del primer repaso, modo calma.",
  "notifications.masterSwitch": "Notificaciones",
  "notifications.masterSwitchHint": "Recordatorios locales, solo en este teléfono. Sin servidor: Memika no sabe qué hay pendiente hasta que la abres.",
  "notifications.systemBlocked": "Las notificaciones de Memika están desactivadas en los ajustes del teléfono.",
  "notifications.openSystemSettings": "Abrir los ajustes del teléfono",
  "notifications.deniedToast": "Permiso denegado: puedes reactivarlo en los ajustes del teléfono.",
  "notifications.slotSection": "Hora del recordatorio",
  "notifications.slotHint": "Un recordatorio al día, a la hora que elijas.",
  "notifications.slotNext": "Próximo recordatorio: {time}",
  "notifications.slotSuspendedByCalm": "Suspendido por el modo calma: solo queda el aviso del primer repaso.",
  "notifications.slotDisabled": "Activa las notificaciones para elegir la hora.",
  "notifications.slotA11y": "Recordatorio a las {time}",
  "notifications.firstReviewSwitch": "Avísame cuando un recuerdo esté listo para el primer repaso",
  "notifications.firstReviewSwitchHint": "Veinte horas después de guardarlo, para cada recuerdo nuevo. No depende del modo calma.",
  "notifications.saveFailed": "Ajuste no guardado. Inténtalo de nuevo.",
```

`lib/i18n/fr.ts`:

```ts
  "notifications.title": "Notifications",
  "notifications.settingsRow": "Notifications et rappels",
  "notifications.settingsRowHint": "Rappel quotidien, alerte de première révision, mode calme.",
  "notifications.masterSwitch": "Notifications",
  "notifications.masterSwitchHint": "Rappels locaux, sur ce téléphone seulement. Pas de serveur : Memika ne sait pas ce qui est à réviser avant que tu l'ouvres.",
  "notifications.systemBlocked": "Les notifications de Memika sont désactivées dans les réglages du téléphone.",
  "notifications.openSystemSettings": "Ouvrir les réglages du téléphone",
  "notifications.deniedToast": "Autorisation refusée : tu peux la réactiver dans les réglages du téléphone.",
  "notifications.slotSection": "Heure du rappel",
  "notifications.slotHint": "Un rappel par jour, à l'heure que tu choisis.",
  "notifications.slotNext": "Prochain rappel : {time}",
  "notifications.slotSuspendedByCalm": "Suspendu par le mode calme : seule l'alerte de première révision reste.",
  "notifications.slotDisabled": "Active les notifications pour choisir l'heure.",
  "notifications.slotA11y": "Rappel à {time}",
  "notifications.firstReviewSwitch": "Préviens-moi quand un souvenir est prêt pour sa première révision",
  "notifications.firstReviewSwitchHint": "Vingt heures après l'enregistrement, pour chaque nouveau souvenir. Le mode calme n'y change rien.",
  "notifications.saveFailed": "Réglage non enregistré. Réessaie.",
```

E `settings.calmModeHint` (riga 816 in tutti e quattro) smette di promettere un "prossimo aggiornamento" e descrive la semantica nuova (spec :331). `settings.weeklyDigestHint` (riga 870) resta com'è: è già vero — il digest non esiste e la riga salva solo la preferenza.

```ts
// it.ts:816
  "settings.calmModeHint": "Niente contatori rossi né promemoria giornaliero: con la modalità calma resta solo l'avviso del primo ripasso.",
// en.ts:816
  "settings.calmModeHint": "No red counters and no daily reminder: with calm mode only the first-review alert remains.",
// es.ts:816
  "settings.calmModeHint": "Sin contadores rojos ni recordatorio diario: con el modo calma solo queda el aviso del primer repaso.",
// fr.ts:816
  "settings.calmModeHint": "Pas de compteurs rouges ni de rappel quotidien : avec le mode calme, seule l'alerte de première révision reste.",
```

Run: `npm test -- lib/i18n/i18n.test.ts`
Expected: PASS.

- [ ] **Step 3: Scrivere `app/(app)/notifications.tsx`**

```tsx
import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";

import { SectionLabel } from "@/components/SectionLabel";
import { SettingsRow, SettingsToggle } from "@/components/SettingsRow";
import { Tappable } from "@/components/Tappable";
import { TopBar } from "@/components/TopBar";
import { fetchMemoriesInRange, fetchProfile, updateProfile } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { tap } from "@/lib/feedback";
import { shortDateTime } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { Profile } from "@/lib/mappers";
import { useNotificationPrefsStore } from "@/lib/notification-prefs-store";
import {
  cancelAllFirstReviews,
  cancelAllReminders,
  getPermission,
  openSystemNotificationSettings,
  requestPermission,
  scheduleFirstReview,
  syncDailyReminder,
  type PermissionState,
} from "@/lib/notifications";
import {
  DEFAULT_REMINDER_SLOT,
  nextDailyTrigger,
  reminderSlots,
  slotFromProfileTime,
} from "@/lib/notifications-core";
import { reportError } from "@/lib/report-error";
import { safeBack } from "@/lib/safe-back";
import { useUIStore } from "@/lib/ui-store";
import { FONT, radii, useColors } from "@/theme/tokens";

const SLOTS = reminderSlots();
const NO_PERMISSION: PermissionState = { allowed: false, canAskAgain: false, undetermined: false };
/** Orizzonte del primo ripasso: T0+20h. Oltre non c'è niente da riarmare. */
const FIRST_REVIEW_HORIZON_MS = 20 * 60 * 60 * 1000;

/**
 * Notifiche (spec 2026-09-02 §F3): tab nascosto, raggiunto da Impostazioni.
 *
 * Schermata deliberatamente MISTA: due preferenze di dispositivo (store:
 * interruttore principale, "Avvisami") e tre righe di profilo (orario,
 * modalità calma, riepilogo). L'orario riusa profiles.morning_review_at.
 *
 * Tre cancelli per il promemoria giornaliero — permesso OS, interruttore,
 * calma spenta — e la schermata dice quale è chiuso invece di mostrare un
 * orario che non scatterà mai.
 */
export default function NotificationsScreen() {
  const { t } = useT();
  const colors = useColors();
  const user = useAuthStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);
  const prefs = useNotificationPrefsStore((s) => s.prefs);
  const setPrefs = useNotificationPrefsStore((s) => s.setPrefs);

  // Profilo vero (null in demo: fetchProfile torna null, lib/api.ts:63).
  const [profile, setProfile] = useState<Profile | null>(null);
  const [permission, setPermission] = useState<PermissionState>(NO_PERMISSION);
  // Calma e orario stanno in uno stato PROPRIO, non derivati da `profile`:
  // con profilo null (demo, errore di rete) `profile?.calmMode ?? true`
  // resterebbe true anche dopo che l'utente ha spento l'interruttore, e la
  // griglia degli slot resterebbe grigia sotto un toggle che dice il
  // contrario. Qui l'idratazione arriva dal profilo, l'aggiornamento dal
  // gesto — e i due non si contraddicono mai.
  const [calmMode, setCalmMode] = useState(true);
  const [slot, setSlot] = useState<string>(DEFAULT_REMINDER_SLOT);
  // Rimonta l'interruttore principale dopo un tentativo fallito: il Switch
  // di SettingsToggle è uncontrolled (components/SettingsRow.tsx:105) e su
  // un rifiuto del permesso nessuno dei valori della key cambia.
  const [switchNonce, setSwitchNonce] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchProfile(user.id)
      .then((p) => {
        if (cancelled || !p) return;
        setProfile(p);
        setCalmMode(p.calmMode);
        setSlot(slotFromProfileTime(p.morningReviewAt));
      })
      .catch((err) => reportError("notifications/profile-load", err));
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Il permesso si rilegge a ogni focus: l'utente può tornare dalle
  // impostazioni del telefono avendolo appena cambiato.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getPermission().then((p) => {
        if (!cancelled) setPermission(p);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const active = prefs.enabled && permission.allowed;
  const slotsEnabled = active && !calmMode;

  /**
   * Riaccensione: spegnere un cancello CANCELLA i primi ripassi già in
   * attesa, e nessuno li riprogramma — `scheduleFirstReview` gira solo al
   * salvataggio e al ripristino. Senza questo, spegni-e-riaccendi perde in
   * silenzio l'avviso di ogni ricordo delle ultime 20 ore. Si riarma dalla
   * sorgente di verità, non da una cache: la coda vera dentro l'orizzonte.
   * `scheduleFirstReview` scarta da sola fasi diverse da p20h e date
   * passate, quindi qui non serve nessun `if`.
   */
  const rearmFirstReviews = async () => {
    if (!user) return;
    try {
      const now = Date.now();
      const items = await fetchMemoriesInRange(
        user.id,
        new Date(now).toISOString(),
        new Date(now + FIRST_REVIEW_HORIZON_MS).toISOString(),
      );
      for (const m of items) await scheduleFirstReview(m);
    } catch (err) {
      reportError("notifications/rearm-first-reviews", err);
    }
  };

  const onToggleMain = async (on: boolean) => {
    if (!on) {
      setPrefs({ enabled: false });
      await cancelAllReminders();
      return;
    }
    const perm = await requestPermission();
    setPermission(perm);
    if (perm.allowed) {
      setPrefs({ enabled: true });
      await syncDailyReminder({ calmMode, morningReviewAt: slot });
      await rearmFirstReviews();
      return;
    }
    // Negato: il nonce rimonta lo Switch, che torna visivamente spento
    // (senza, la key non cambierebbe e la schermata direbbe "acceso" con
    // tutti i cancelli chiusi). E se il sistema non ci lascia più chiedere,
    // si apre la strada giusta.
    setPrefs({ enabled: false });
    setSwitchNonce((n) => n + 1);
    showToast(t("notifications.deniedToast"));
    if (!perm.canAskAgain) openSystemNotificationSettings();
  };

  const saveProfile = (patch: Partial<Pick<Profile, "calmMode" | "weeklyDigest" | "morningReviewAt">>) => {
    if (!user) return;
    // Lo stato locale si muove PRIMA della rete: l'interruttore e la
    // griglia devono raccontare la stessa cosa anche con profilo null.
    if (profile) setProfile({ ...profile, ...patch });
    const nextCalm = patch.calmMode ?? calmMode;
    const nextSlot = patch.morningReviewAt ?? slot;
    if (patch.calmMode !== undefined) setCalmMode(patch.calmMode);
    if (patch.morningReviewAt !== undefined) setSlot(patch.morningReviewAt);
    updateProfile(user.id, patch)
      .then(() => syncDailyReminder({ calmMode: nextCalm, morningReviewAt: nextSlot }))
      .catch((err) => {
        reportError("notifications/profile-save", err);
        showToast(t("notifications.saveFailed"));
      });
  };

  const pickSlot = (value: string) => {
    if (!slotsEnabled || value === slot) return;
    tap();
    saveProfile({ morningReviewAt: value });
  };

  const onToggleFirstReview = (on: boolean) => {
    setPrefs({ firstReview: on });
    // setPrefs di zustand è sincrono: le due funzioni qui sotto leggono già
    // il valore nuovo da getState().
    if (on) void rearmFirstReviews();
    else void cancelAllFirstReviews();
  };

  const slotHint = calmMode
    ? t("notifications.slotSuspendedByCalm")
    : !active
      ? t("notifications.slotDisabled")
      : (() => {
          const next = nextDailyTrigger(slot);
          return next ? t("notifications.slotNext", { time: shortDateTime(next.toISOString()) }) : t("notifications.slotHint");
        })();

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <TopBar title={t("notifications.title")} onBack={() => safeBack("/(app)/settings")} />
      {/* 140 come l'altro tab nascosto di questo navigator (app/(app)/upcoming.tsx:115):
          sotto c'è la barra sfocata, 120 ci finiscono dentro. */}
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        {/* Interruttore principale — specchio del permesso OS su questo telefono. */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 10 }}>
          <SettingsToggle
            key={`master-${prefs.enabled && permission.allowed}-${switchNonce}`}
            label={t("notifications.masterSwitch")}
            hint={t("notifications.masterSwitchHint")}
            defaultOn={prefs.enabled && permission.allowed}
            onChange={(v) => void onToggleMain(v)}
          />
          {prefs.enabled && !permission.allowed ? (
            <SettingsRow
              label={t("notifications.systemBlocked")}
              value={t("notifications.openSystemSettings")}
              chevron
              onPress={() => {
                tap();
                openSystemNotificationSettings();
              }}
            />
          ) : null}
        </View>

        {/* Orario del promemoria — lista di slot da mezz'ora (precedente: TimeBudgetChips). */}
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 }}>
          <SectionLabel>{t("notifications.slotSection")}</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 16 }}>
          <Text
            style={{
              fontFamily: FONT.regular,
              fontSize: 13.5,
              lineHeight: 19,
              color: colors.midGrey,
              marginBottom: 10,
            }}
          >
            {slotHint}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, opacity: slotsEnabled ? 1 : 0.45 }}>
            {SLOTS.map((value) => {
              const on = value === slot;
              return (
                <Tappable
                  key={value}
                  onPress={() => pickSlot(value)}
                  disabled={!slotsEnabled}
                  accessibilityRole="button"
                  accessibilityLabel={t("notifications.slotA11y", { time: value })}
                  accessibilityState={{ selected: on }}
                  hitSlop={6}
                  pressedOpacity={0.7}
                  containerStyle={{ flexGrow: 1, flexBasis: "22%" }}
                  style={{
                    // 44 = area tattile minima iOS, come TimeBudgetChips
                    // (components/TimeBudgetChips.tsx:53). Con 48 chip fitti
                    // in griglia non è il posto dove risparmiare 4 punti.
                    minHeight: 44,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: radii.chip,
                    backgroundColor: on ? colors.accent : colors.surface,
                    borderWidth: on ? 0 : 1,
                    borderColor: colors.hairline,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: on ? FONT.semibold : FONT.medium,
                      fontSize: 13.5,
                      color: on ? colors.onAccent : colors.navy,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {value}
                  </Text>
                </Tappable>
              );
            })}
          </View>
        </View>

        {/* Avviso del primo ripasso + le due preferenze di profilo. */}
        <View style={{ paddingHorizontal: 16, paddingTop: 24, gap: 10 }}>
          <SettingsToggle
            key={`first-${prefs.firstReview}`}
            label={t("notifications.firstReviewSwitch")}
            hint={t("notifications.firstReviewSwitchHint")}
            defaultOn={prefs.firstReview}
            onChange={onToggleFirstReview}
          />
          {/* I toggle sono uncontrolled: la key li rimonta quando arriva il
              profilo vero. La calma legge lo stato locale, non `profile`,
              così resta coerente anche quando il profilo è null. */}
          <SettingsToggle
            key={`calm-${calmMode}`}
            label={t("settings.calmMode")}
            hint={t("settings.calmModeHint")}
            defaultOn={calmMode}
            onChange={(v) => saveProfile({ calmMode: v })}
          />
          <SettingsToggle
            key={profile ? `digest-${profile.weeklyDigest}` : "digest"}
            label={t("settings.weeklyDigest")}
            hint={t("settings.weeklyDigestHint")}
            defaultOn={profile ? profile.weeklyDigest : false}
            onChange={(v) => saveProfile({ weeklyDigest: v })}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

Cosa fa il toggle "Riepilogo settimanale": salva `profiles.weekly_digest` e basta — nessun codice lo legge, nessuna mail parte. L'hint (`settings.weeklyDigestHint`, "Non è ancora attivo…") lo dice all'utente. È il compromesso di spec :352-353; l'esposizione Apple 2.1 di un toggle-preferenza è annotata fra i passi umani.

- [ ] **Step 4: Registrare il tab nascosto**

In `app/(app)/_layout.tsx`, dopo la riga 130 (`<Tabs.Screen name="upcoming" options={{ href: null }} />`) aggiungi:

```tsx
      <Tabs.Screen name="notifications" options={{ href: null }} />
```

- [ ] **Step 5: La riga in Impostazioni al posto dei blocchi inline**

In `app/(app)/settings.tsx`:

1. Elimina il blocco "Schedule" (righe 339-353, da `{/* Schedule — hidden until…` fino al `)}` che chiude `{NOTIFICATIONS_ENABLED && (`). L'orario vive nella schermata nuova; `evening_review_at` non si mostra più.
2. Sostituisci il blocco "Notifications" (righe 371-406) con:

```tsx
        {NOTIFICATIONS_ENABLED && (
          <>
            {/* Notifiche: una riga che apre la schermata (spec F3), non un blocco inline. */}
            <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 }}>
              <SectionLabel>{tr("settings.notificationsSection")}</SectionLabel>
            </View>
            <View style={{ paddingHorizontal: 16, gap: 10 }}>
              <SettingsRow
                label={tr("notifications.settingsRow")}
                hint={tr("notifications.settingsRowHint")}
                chevron
                onPress={() => {
                  tap();
                  router.push("/(app)/notifications" as never);
                }}
              />
            </View>
          </>
        )}
```

3. `SettingsToggle` non è più usato in questo file: la riga 24 diventa `import { SettingsRow } from "@/components/SettingsRow";`.

Le chiavi `settings.scheduleSection`, `settings.morningReview`, `settings.eveningReview` restano nei cataloghi (nessun test le pretende usate); si tolgono quando `evening_review_at` uscirà dal DB.

- [ ] **Step 6: `docs/ROUTING.md` — la route nuova, e le due righe già sbagliate**

Il documento è rimasto alla tassonomia vecchia: la riga 24 dice `folder/[kind].tsx` e la riga 52 `/(app)/folder/[kind]`, mentre dalla migrazione `20260902130000` la route è `/folder/[id]` (AGENTS.md §3; il file è `app/(app)/folder/[id].tsx`, registrato così in `app/(app)/_layout.tsx:129`). Si correggono qui, nello stesso step: questo piano rende `/memory/[id]` una destinazione di deep link e la tabella deve poterlo dire senza mentire due righe sopra.

La riga 24:

```
│   ├── folder/[kind].tsx        Dettaglio cartella — tab nascosto (href: null)
```

diventa due righe:

```
│   ├── folder/[id].tsx          Dettaglio cartella — tab nascosto (href: null)
│   ├── notifications.tsx        Notifiche (spec F3) — tab nascosto (href: null), push da Impostazioni
```

Nella tabella, dopo la riga 51 (`/(app)/settings`) aggiungi:

```
| `/(app)/notifications` | `app/(app)/notifications.tsx` | Signed-in users (riga visibile solo con `NOTIFICATIONS_ENABLED`) |
```

e la riga 52:

```
| `/(app)/folder/[kind]` | `app/(app)/folder/[kind].tsx` | Signed-in users |
```

diventa due righe:

```
| `/(app)/folder/[id]` | `app/(app)/folder/[id].tsx` | Signed-in users |
| `/memory/[id]` | `app/memory/[id].tsx` | Signed-in users (destinazione del tocco su una notifica di primo ripasso; guardia auth propria, Task 7) |
```

- [ ] **Step 7: Typecheck, test, commit**

```bash
npm run lint
npm test
git add components/SettingsRow.tsx "app/(app)/notifications.tsx" "app/(app)/_layout.tsx" "app/(app)/settings.tsx" lib/i18n/ docs/ROUTING.md
git commit -m "$(cat <<'EOF'
feat(notifications): schermata Notifiche — interruttore, slot da mezz'ora, Avvisami, calma, riepilogo

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Il salvataggio programma il primo ripasso e chiede il permesso

**Files:**
- Modify: `app/add.tsx:1-39` (import), `:100-130` (stato + effetti), `:156-212` (`doSave`), `:651-654` (JSX di chiusura)
- Modify: `lib/i18n/{it,en,es,fr}.ts` (quattro chiavi del pre-prompt)

**Interfaces:**
- Consumes: `createMemory` (`lib/api.ts:432-466`, torna `Memory` con `nextReviewAt` = T0+20h e `phase` = `"p20h"`); Task 3 (`notificationsAvailable`, `getPermission`, `requestPermission`, `scheduleFirstReview`, `syncDailyReminder`); Task 2 (`prefs.promptSeen`, `setPrefs`); `MascotDialog` (`components/MascotDialog.tsx:10-18`).
- Produces: niente per gli altri task.

- [ ] **Step 1: Le chiavi del pre-prompt**

Nella sezione `notifications.*` di ogni catalogo:

```ts
// it.ts
  "notifications.promptTitle": "Ti avviso quando è ora?",
  "notifications.promptBody": "Il primo ripasso di questa parola è tra 20 ore. Con le notifiche te lo ricordo io — senza contatori e senza insistere.",
  "notifications.promptConfirm": "Sì, avvisami",
  "notifications.promptCancel": "Non ora",
// en.ts
  "notifications.promptTitle": "Want me to tell you when it's time?",
  "notifications.promptBody": "This word's first review is in 20 hours. With notifications I'll remind you — no counters, no nagging.",
  "notifications.promptConfirm": "Yes, remind me",
  "notifications.promptCancel": "Not now",
// es.ts
  "notifications.promptTitle": "¿Te aviso cuando sea la hora?",
  "notifications.promptBody": "El primer repaso de esta palabra es en 20 horas. Con las notificaciones te lo recuerdo yo, sin contadores y sin insistir.",
  "notifications.promptConfirm": "Sí, avísame",
  "notifications.promptCancel": "Ahora no",
// fr.ts
  "notifications.promptTitle": "Je te préviens quand c'est l'heure ?",
  "notifications.promptBody": "La première révision de ce mot est dans 20 heures. Avec les notifications, je te le rappelle — sans compteurs, sans insister.",
  "notifications.promptConfirm": "Oui, préviens-moi",
  "notifications.promptCancel": "Pas maintenant",
```

Run: `npm test -- lib/i18n/i18n.test.ts` → PASS.

- [ ] **Step 2: Import e stato in `app/add.tsx`**

Sotto la riga 39 (`import { itemTypesFor, … } from "@/lib/folder-taxonomy";`) aggiungi:

```ts
import { MascotDialog } from "@/components/MascotDialog";
import { useNotificationPrefsStore } from "@/lib/notification-prefs-store";
import {
  getPermission,
  notificationsAvailable,
  requestPermission,
  scheduleFirstReview,
  syncDailyReminder,
} from "@/lib/notifications";
```

e la riga 30 (`import type { FolderWithStats } from "@/lib/mappers";`) diventa `import type { FolderWithStats, Memory, Profile } from "@/lib/mappers";`.

Sotto `const [dailyMax, setDailyMax] = useState(DAILY_INPUT_CAP_DEFAULT);` (riga 111) aggiungi:

```ts
  // Profilo intero, non solo il tetto: serve per riallineare il promemoria
  // giornaliero appena il permesso viene concesso.
  const [profile, setProfile] = useState<Profile | null>(null);
  // Permesso notifiche: si chiede DOPO il primo ricordo salvato su questo
  // telefono, mai all'avvio (spec F3). Pre-caricato qui così dopo il
  // salvataggio la decisione è sincrona. Il dialogo trattiene il ricordo
  // appena salvato: la notifica si programma solo a permesso concesso.
  const promptSeen = useNotificationPrefsStore((s) => s.prefs.promptSeen);
  const notifEnabled = useNotificationPrefsStore((s) => s.prefs.enabled);
  const setPrefs = useNotificationPrefsStore((s) => s.setPrefs);
  const [canOfferPrompt, setCanOfferPrompt] = useState(false);
  const [notifPrompt, setNotifPrompt] = useState<{ memory: Memory; addAnother: boolean } | null>(null);
```

Nell'effetto esistente (righe 115-130), la riga `if (profile) setDailyMax(profile.dailyInputCap);` diventa:

```ts
        if (profile) {
          setDailyMax(profile.dailyInputCap);
          setProfile(profile);
        }
```

E subito dopo quell'effetto aggiungi:

```ts
  useEffect(() => {
    if (!notificationsAvailable() || promptSeen) {
      setCanOfferPrompt(false);
      return;
    }
    let cancelled = false;
    getPermission().then((p) => {
      // Il cancello NON può essere solo `undetermined`: su Android con
      // SDK_INT < 33 (Android 12 e giù, e il minSdk di Expo 54 è 24) il
      // modulo prende il ramo "classic" e mappa areNotificationsEnabled()
      // in GRANTED o DENIED — `undetermined` non arriva MAI
      // (node_modules/expo-notifications/android/src/main/java/expo/modules/
      // notifications/permissions/NotificationPermissionsModule.kt:36,91-112).
      // Lì il permesso di sistema c'è già ma l'interruttore di Memika no, e
      // senza dialogo `prefs.enabled` resterebbe false per sempre: nessuna
      // notifica, mai, su un intero intervallo di versioni Android. Il
      // dialogo serve a portare `enabled` a true, non solo a chiedere all'OS.
      if (!cancelled) setCanOfferPrompt(p.undetermined || (p.allowed && !notifEnabled));
    });
    return () => {
      cancelled = true;
    };
  }, [promptSeen, notifEnabled]);
```

`acceptPrompt` non cambia: `requestPermission()` restituisce `current` senza mostrare nulla quando `current.allowed` (Task 3), quindi sul ramo Android ≤ 12 il dialogo accende `prefs.enabled`, programma il primo ripasso e riallinea il giornaliero senza alcun foglio di sistema.

- [ ] **Step 3: `doSave` trattiene il ricordo finché il dialogo non risponde**

Sopra `const doSave = …` (riga 156) aggiungi:

```ts
  // "Salva e aggiungi un altro": campi puliti, si resta qui.
  const clearFields = () => {
    setTerm("");
    setReading("");
    setDefinition("");
    setExample("");
  };

  // Dopo il dialogo si riprende da dove il salvataggio si era fermato.
  const finishPrompt = (addAnother: boolean) => {
    setNotifPrompt(null);
    if (addAnother) termRef.current?.focus();
    else safeBack("/(app)/knowledge");
  };

  const acceptPrompt = async () => {
    if (!notifPrompt) return;
    const { memory, addAnother } = notifPrompt;
    setPrefs({ promptSeen: true });
    const perm = await requestPermission();
    if (perm.allowed) {
      setPrefs({ enabled: true });
      await scheduleFirstReview(memory);
      void syncDailyReminder(profile);
    }
    finishPrompt(addAnother);
  };

  // "Non ora" NON chiama il permesso di sistema: resta chiedibile dalla
  // schermata Notifiche. Il flag evita di riproporre il dialogo.
  const declinePrompt = () => {
    if (!notifPrompt) return;
    setPrefs({ promptSeen: true });
    finishPrompt(notifPrompt.addAnother);
  };
```

Dentro `doSave`, il blocco `try` (righe 181-205) diventa:

```ts
    try {
      const saved = await createMemory({
        userId: user.id,
        folderId: folderRow.id,
        term: term.trim(),
        reading: showReading && reading.trim() ? reading.trim() : undefined,
        definition: definition.trim(),
        example: example.trim() ? example.trim() : undefined,
        itemType: type,
      });
      setDailyCount((c) => (c ?? 0) + 1);
      showToast(t("add.savedToast", { name: folderRow.name }));
      if (saved && canOfferPrompt) {
        // Il dialogo è un Modal DENTRO questa schermata: la navigazione
        // aspetta la risposta, altrimenti lo smonterebbe.
        if (addAnother) clearFields();
        setCanOfferPrompt(false);
        setNotifPrompt({ memory: saved, addAnother });
        return;
      }
      // Notifica "primo ripasso pronto" a T0+20h — no-op senza permesso,
      // senza interruttore o con "Avvisami" spento.
      if (saved) void scheduleFirstReview(saved);
      if (addAnother) {
        clearFields();
        termRef.current?.focus();
      } else {
        // Toast is rendered at the root layout — it survives this unmount.
        // safeBack dismisses the keyboard first to avoid an Android race that
        // leaves the IME attached to the unmounted TextInput.
        safeBack("/(app)/knowledge");
      }
    } catch (e) {
```

- [ ] **Step 4: Montare il dialogo**

Alla riga 653 (la riga vuota tra `</KeyboardAvoidingView>` e `</SafeAreaView>`) inserisci:

```tsx
      {/* Pre-prompt del permesso: solo al primo salvataggio su questo telefono. */}
      <MascotDialog
        visible={notifPrompt !== null}
        title={t("notifications.promptTitle")}
        body={t("notifications.promptBody")}
        confirmLabel={t("notifications.promptConfirm")}
        cancelLabel={t("notifications.promptCancel")}
        onConfirm={() => void acceptPrompt()}
        onCancel={declinePrompt}
      />
```

- [ ] **Step 5: Typecheck, test, commit**

```bash
npm run lint
npm test
git add app/add.tsx lib/i18n/
git commit -m "$(cat <<'EOF'
feat(add): primo ripasso programmato al salvataggio, permesso chiesto dalla mascotte dopo il primo ricordo

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Cestino e ripristino tengono l'OS allineato

**Files:**
- Modify: `app/memory/[id].tsx:15,22,111-120,161-173` (cancella al cestino; riscrive il payload dopo uno spostamento)
- Modify: `app/folder-settings.tsx:133-146` (cancella i primi ripassi della cartella)
- Modify: `app/trash.tsx:12-17,64-92` (ri-programma al ripristino)
- Modify: `app/(app)/settings.tsx:189-195,228-238` (logout e richiesta di eliminazione account svuotano la coda)

**Interfaces:**
- Consumes: Task 3 (`cancelFirstReview`, `cancelFirstReviewsInFolder`, `scheduleFirstReview`, `cancelAllReminders`); `fetchMemoriesForFolder(folderId): Promise<Memory[]>` (`lib/api.ts:364`); `TrashMemory = Memory & { folderName }` (`lib/api.ts:982`) — porta `nextReviewAt` e `phase`.
- Produces: niente.

Perché qui e non in `lib/api.ts`: le funzioni del cestino sono inchiodate da un test-registratore (`lib/api.trash.test.ts:1-6`) che sostituisce il client Supabase; importare `expo-notifications` in `api.ts` costringerebbe a mockarlo in ogni test di `lib/`. I call site sono tre e sono schermate.

- [ ] **Step 1: `app/memory/[id].tsx` — cestino singolo e payload riallineato dopo uno spostamento**

Riga 22, all'import da `@/lib/api` non cambia nulla; sotto di essa aggiungi:

```ts
import { cancelFirstReview, scheduleFirstReview } from "@/lib/notifications";
```

In `doDelete` (righe 161-173), dopo `await deleteMemory(memory.id);` aggiungi:

```ts
      // Un "primo ripasso pronto" per un ricordo nel cestino prometterebbe
      // una coda che non lo contiene: via. Idempotente se non c'era.
      void cancelFirstReview(memory.id);
```

E subito DOPO il blocco `useFocusEffect` (che chiude alla riga 120), insieme agli altri hook — quindi prima della guardia che il Task 7 mette alla riga 175:

```ts
  // Il payload della notifica porta il folderId CONGELATO al salvataggio,
  // ma un ricordo può cambiare cartella (`moveMemory`, lib/api.ts:1165,
  // raggiungibile dal MoveSheet montato qui sotto e dal giro
  // /choose-topic). Senza riallineamento: cestinare la cartella NUOVA non
  // cancella l'avviso (il filtro cerca la vecchia) e cestinare la VECCHIA
  // cancella l'avviso di un ricordo vivo. L'identificatore è stabile, quindi
  // riprogrammare RISCRIVE il payload; scheduleFirstReview scarta da sé fase
  // ≠ p20h, date passate e cancelli chiusi. `load()` gira dopo ogni
  // spostamento (`onMoved`, riga 460) e al rientro da /choose-topic
  // (`useFocusEffect`), quindi entrambi i percorsi passano di qui.
  useEffect(() => {
    if (memory) void scheduleFirstReview(memory);
  }, [memory]);
```

- [ ] **Step 2: `app/folder-settings.tsx` — cestino della cartella**

Sotto l'import di riga 38 (`FONT, useColors`) aggiungi:

```ts
import { cancelFirstReviewsInFolder } from "@/lib/notifications";
```

In `handleDelete` (righe 133-146), dopo `await deleteFolder(folder.id);` aggiungi:

```ts
      // deleteFolder non restituisce gli id: il filtro passa dal payload
      // (folderId) delle notifiche in attesa.
      void cancelFirstReviewsInFolder(folder.id);
```

- [ ] **Step 3: `app/trash.tsx` — ripristino**

All'import da `@/lib/api` (righe 12-17) aggiungi `fetchMemoriesForFolder`; sotto la riga 25 aggiungi:

```ts
import { scheduleFirstReview } from "@/lib/notifications";
```

`onRestoreFolder` (righe 64-77): dopo `await restoreFolder(id);` aggiungi:

```ts
      // I ricordi tornati vivi con nextReviewAt ancora nel futuro riavranno
      // il loro avviso; gli altri sono già in coda e non serve nulla.
      fetchMemoriesForFolder(id)
        .then((items) => {
          for (const m of items) void scheduleFirstReview(m);
        })
        .catch((e) => reportError("trash/reschedule-folder", e));
```

`onRestoreMemory` (righe 79-92): dopo `await restoreMemory(id);` aggiungi:

```ts
      const restored = trash?.memories.find((m) => m.id === id);
      if (restored) void scheduleFirstReview(restored);
```

(`scheduleFirstReview` scarta da sola le fasi diverse da `p20h` e le date passate: nessun `if` qui.)

- [ ] **Step 4: `app/(app)/settings.tsx` — uscire spegne anche l'OS**

Le notifiche locali vivono nell'OS finché non le si cancella: il giornaliero è un trigger `DAILY` e il body dei `first-review:*` contiene il TERMINE scritto dall'utente. Dopo un logout o una richiesta di eliminazione account resterebbero fino a 20 ore di avvisi con dato personale dentro su un telefono che l'utente ha appena lasciato — e il tocco non porterebbe da nessuna parte, perché il Task 7 scarta la rotta senza utente. Le prefs in AsyncStorage sopravvivono al logout (`lib/auth-store.ts` rimuove solo la chiave demo), quindi nemmeno i cancelli si chiudono da soli.

Sotto l'import di riga 34 (`fetchDeletionPreview, fetchProfile, …` da `@/lib/api`) aggiungi:

```ts
import { cancelAllReminders } from "@/lib/notifications";
```

In `handleSignOut` (righe 189-195), la riga `await signOut();` diventa:

```ts
    // Le notifiche locali vivono nell'OS: senza sessione non hanno più
    // niente da promettere. No-op a flag spento e in demo.
    await cancelAllReminders();
    await signOut();
```

E lo stesso in `handleDeleteAccount` (righe 228-238), dove `await signOut();` (riga 234) segue `await requestAccountDeletion();`:

```ts
    await cancelAllReminders();
    await signOut();
```

(Si mette qui e non dentro `lib/auth-store.ts`: l'auth store è importato da mezza app e da `lib/api.ts`, e tirarci dentro `expo-notifications` significherebbe stubbarlo in ogni test di `lib/`. Le due chiamate a `signOut` dell'app sono entrambe in questo file.)

- [ ] **Step 5: Typecheck, test, commit**

```bash
npm run lint
npm test
git add "app/memory/[id].tsx" app/folder-settings.tsx app/trash.tsx "app/(app)/settings.tsx"
git commit -m "$(cat <<'EOF'
feat(notifications): cestino, spostamento, ripristino e logout tengono allineata la coda dell'OS

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Tocco → rotta, riallineamento all'avvio, guardia sulla scheda

**Files:**
- Modify: `app/_layout.tsx:212-220` (stato) e `:284-288` (dopo l'effetto della password)
- Modify: `app/(app)/_layout.tsx:9,41-54`
- Modify: `app/memory/[id].tsx:15,29-31,71,175`

**Interfaces:**
- Consumes: Task 3 (`subscribeToNotificationTaps`, `syncDailyReminder`, `notificationsAvailable`); `fetchProfile` (`lib/api.ts:62`); `hydrated`/`navReady` già definiti in `app/_layout.tsx:213,218`.
- Produces: niente.

- [ ] **Step 1: Il tocco nel root layout**

In `app/_layout.tsx`, dopo l'effetto della password (righe 284-288) aggiungi:

```ts
  // Tocco su una notifica locale → rotta (spec F3): il primo ripasso apre
  // la scheda del ricordo, il giornaliero apre Oggi. Dopo navigator e auth,
  // come l'effetto sopra. Senza utente la destinazione si perde: il gate
  // manda al login e dopo il login si atterra su Oggi — accettato.
  //
  // Oggi NON si può spingere. `(app)` è la radice di questo stack, quindi
  // quando il tocco arriva con un modale davanti (Aggiungi, scheda ricordo,
  // ripasso, cestino, impostazioni cartella…) la divergenza cade sullo
  // stack di root e push/navigate/replace montano un SECONDO tab navigator
  // sopra il modale: stato dei tab doppio e un back in più su Android.
  // `navigate` non basta — lo StackRouter riusa una rotta esistente solo se
  // è quella a fuoco (@react-navigation/routers 7.5.5 StackRouter.tsx:377-388,
  // e expo-router non passa mai `pop`). Quindi prima si chiudono i modali
  // (POP_TO_TOP riporta a fuoco la `(app)` che c'è già) e poi si cambia
  // scheda. La scheda del ricordo invece è una rotta sorella: lì il push è
  // quello giusto, anche sopra un altro modale.
  useEffect(() => {
    if (!hydrated || !navReady) return;
    return subscribeToNotificationTaps((route) => {
      if (!useAuthStore.getState().user) return;
      if (route.pathname === "/(app)/today") {
        if (router.canDismiss()) router.dismissAll();
        router.navigate(route as never);
        return;
      }
      router.push(route as never);
    });
  }, [hydrated, navReady]);
```

L'import di `installNotificationHandler` aggiunto nel Task 3 diventa:

```ts
import { installNotificationHandler, subscribeToNotificationTaps } from "@/lib/notifications";
```

- [ ] **Step 2: Il giornaliero si riallinea a ogni avvio con utente**

In `app/(app)/_layout.tsx`, riga 9 diventa:

```ts
import { fetchDeletionRequestedAt, fetchProfile } from "@/lib/api";
```

e sotto la riga 16 aggiungi:

```ts
import { notificationsAvailable, syncDailyReminder } from "@/lib/notifications";
```

Dopo l'effetto della richiesta di eliminazione (righe 41-54) aggiungi:

```ts
  // Promemoria giornaliero: riallineato al profilo a ogni avvio/login
  // (spec F3). Le notifiche per singolo ricordo NON si toccano qui: si
  // programmano solo al salvataggio. Senza flag niente query in più.
  useEffect(() => {
    if (!userId || !notificationsAvailable()) return;
    let cancelled = false;
    fetchProfile(userId)
      .then((p) => {
        if (!cancelled) return syncDailyReminder(p);
      })
      .catch((err) => {
        reportError("app-layout/daily-reminder-sync", err);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);
```

- [ ] **Step 3: La scheda del ricordo si protegge da sola**

`app/memory/[id].tsx` è uno Stack screen a livello di root (`app/_layout.tsx:349-357`), FUORI dal gate di `(app)`, e ora è la destinazione di un tocco a freddo. Servono DUE cose, e vanno distinte:

- il `<Redirect>` in fase di render manda al login invece di mostrare una scheda vuota;
- ma NON basta a fermare la query: `useEffect` (riga 101) e `useFocusEffect` (riga 111) sono registrati nello stesso render e vengono eseguiti al commit anche quando il componente restituisce un `<Redirect>`. La fetch va chiusa dov'è, cioè dentro `load`.

Stesso schema di `app/add.tsx:132-133` per la parte di render.

Riga 15 diventa:

```ts
import { Redirect, router, useFocusEffect, useLocalSearchParams } from "expo-router";
```

Sotto la riga 29 (`reportError`) aggiungi:

```ts
import { useAuthStore } from "@/lib/auth-store";
```

Dopo `const { colors, statusTint } = useThemeTokens();` (riga 47) aggiungi:

```ts
  // Fuori dal gate di (app) e raggiungibile da un deep link (notifica):
  // guardia esplicita, come Add.
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
```

In `load` (il `useCallback` di riga 71), la prima riga del corpo diventa:

```ts
  const load = useCallback(async () => {
    // Il render qui sotto redirige, ma gli effetti di QUESTO render sono già
    // registrati e girano lo stesso al commit: la query si ferma qui, non
    // nel JSX. Niente PostgREST da disconnessi.
    if (!useAuthStore.getState().user) return;
    if (!id) return;
```

E subito PRIMA di `const meta = memory ? STATE_META[memory.state] : null;` (riga 175, dopo tutti gli hook) aggiungi:

```ts
  if (!hydrated) return null;
  if (!user) return <Redirect href="/(auth)/login" />;
```

- [ ] **Step 4: Typecheck, test, commit**

```bash
npm run lint
npm test
git add app/_layout.tsx "app/(app)/_layout.tsx" "app/memory/[id].tsx"
git commit -m "$(cat <<'EOF'
feat(notifications): il tocco apre ricordo o Oggi, il giornaliero si riallinea all'avvio, scheda ricordo protetta

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: I documenti e il commento del flag dicono la verità

**Files:**
- Modify: `lib/constants.ts:235-242`
- Modify: `docs/DATA-MODEL.md:44-47`
- Modify: `docs/ROADMAP.md:176-178`

**Interfaces:**
- Produces: niente. Il valore di `NOTIFICATIONS_ENABLED` NON cambia.

- [ ] **Step 1: Il commento sopra il flag**

In `lib/constants.ts`, il blocco alle righe 235-242:

```ts
/**
 * Notifications (schedule rows, calm mode, weekly digest) are not built yet:
 * expo-notifications is not a dependency and the profile columns only store
 * a preference. Apple 2.1 rejects placeholder features, so the Settings
 * sections stay hidden until the definitive server push lands (deferred by
 * Angelo, 2026-08-27).
 */
export const NOTIFICATIONS_ENABLED = false;
```

diventa:

```ts
/**
 * Local notifications (spec 2026-09-02 §F3) are BUILT: lib/notifications.ts
 * schedules "primo ripasso pronto" at T0+20h per saved memory and one daily
 * reminder at profiles.morning_review_at; app/(app)/notifications.tsx is the
 * screen. Every entry point checks this flag, so `false` keeps the code
 * inert and the Settings row hidden.
 *
 * Flipping to `true` is the FINAL activation task of the native-config plan
 * for build 3: it needs the `expo-notifications` config plugin in app.json
 * (Android white-on-transparent icon + color), which changes the fingerprint
 * and therefore ships only with the native build — never via OTA. To test on
 * a device before that, flip it locally without committing.
 */
export const NOTIFICATIONS_ENABLED = false;
```

Il piano di configurazione nativa (`docs/superpowers/plans/2026-09-03-build3-config-nativa.md`, Task 5) è quello che porterà il flag a `true`, e nell'ordine di esecuzione viene **dopo** questo. Non serve ripararlo: il suo Task 5 è ancorato al TESTO e cerca già il commento nuovo, cioè il `/**` che apre il blocco che comincia con `Local notifications (spec 2026-09-02 §F3) are BUILT`. Quella frase è la prima riga del commento qui sopra: **non riformularla**, o l'ancora del piano nativo smette di trovare il blocco. Nessun file di piano va toccato in questo step.

- [ ] **Step 2: `docs/DATA-MODEL.md`**

Le righe 44-47 diventano:

```
| `calm_mode` | boolean | Suppresses the daily reminder (the first-review alert stays), default `true` — so the daily reminder is opt-out. Spec 2026-09-02 §F3 |
| `weekly_digest` | boolean | Saved preference only — no digest is sent yet; default `false` |
| `morning_review_at` | time | Daily reminder slot (HH:MM, the client floors to a 30-minute slot); default 08:00 |
| `evening_review_at` | time | UNUSED since 2026-09-03 (single reminder); kept for pre-OTA clients, drop in a later migration |
```

- [ ] **Step 3: `docs/ROADMAP.md`**

Le righe 176-178 diventano — casella ANCORA VUOTA: in una checklist pre-lancio la spunta è l'unica cosa che si legge a colpo d'occhio, e finché `NOTIFICATIONS_ENABLED` è `false` e il plugin non è in `app.json` non scatta niente. Lo stato vero sta nel corpo:

```
- [ ] Local notifications via `expo-notifications` — CODE READY (2026-09-03,
      plan `docs/superpowers/plans/2026-09-03-notifiche-locali.md`):
      first-review alert at T0+20h + one daily reminder. Inert until the
      build-3 native plan adds the config plugin and flips
      `NOTIFICATIONS_ENABLED`
```

- [ ] **Step 4: Verifica finale e commit**

```bash
npm run lint
npm test
git add lib/constants.ts docs/DATA-MODEL.md docs/ROADMAP.md
git commit -m "$(cat <<'EOF'
docs(notifications): stato vero del flag, semantica delle colonne, voce roadmap

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

## Verifica sul dispositivo

Serve un telefono con **build di sviluppo o build 3** (in Expo Go le notifiche locali funzionano ma l'icona Android è quella di Expo Go). Prima: `NOTIFICATIONS_ENABLED = true` in locale, **senza committare**; `.env` con le credenziali Supabase (in demo l'OS non si tocca).

1. Installazione pulita → salva un ricordo. Dopo il toast compare la mascotte "Ti avviso quando è ora?". **Non ora** → nessun foglio di sistema; Impostazioni → Notifiche → l'interruttore principale acceso apre il foglio di sistema (il prompt è ancora disponibile).
2. **Emulatore Android 12 (API 31), installazione pulita** — il caso che il gate `undetermined` da solo non copre: lì `getPermissionsAsync` torna GRANTED (le notifiche di sistema sono attive di default) e il dialogo deve comparire lo stesso dopo il primo salvataggio. **Sì, avvisami** → nessun foglio di sistema, l'interruttore in `Notifiche` risulta acceso e l'avviso arriva. Se il dialogo non compare, il gate è tornato a `p.undetermined` secco.
3. Nuova installazione → salva → **Sì, avvisami** → concedi. In `Notifiche` l'interruttore è acceso; la riga "Prossimo promemoria" compare solo dopo aver spento la Modalità calma (default a DB = accesa).
4. Su iOS, con il salvataggio fatto, verifica in Impostazioni di sistema → Notifiche che Memika sia presente. Per vedere lo scatto senza aspettare 20 ore: nella SQL console `update public.memories set next_review_at = now() + interval '3 minutes' where id = '<id>'`, poi cestina e ripristina il ricordo dal Cestino (il ripristino ri-programma sul nuovo `next_review_at`). Il tocco apre `/memory/<id>`.
5. Scegli uno slot a 2 minuti da adesso: il giornaliero arriva, il tocco apre Oggi. Cambia slot: il precedente non scatta più (stesso identificatore).
6. Modalità calma ON → il giornaliero non scatta; l'hint dice "Sospeso dalla modalità calma". "Avvisami" OFF → cestina/ripristina un ricordo: nessun avviso.
7. **Spegni e riaccendi** l'interruttore principale (e poi "Avvisami") con un ricordo a 3 minuti dallo scatto: l'avviso arriva lo stesso — è il riarmo da `fetchMemoriesInRange`. Senza, sparirebbe in silenzio.
8. **Nega il permesso** al foglio di sistema: l'interruttore principale deve tornare visibilmente SPENTO (è il nonce che lo rimonta) e comparire il toast "Permesso negato…". Se resta acceso, la schermata sta mentendo.
9. Cestina la cartella con un ricordo appena salvato → nessun avviso a T0+20h. **Sposta** un altro ricordo appena salvato in una seconda cartella, poi cestina QUELLA: nessun avviso (il payload è stato riscritto all'apertura della scheda).
10. Nelle impostazioni di sistema spegni le notifiche di Memika → torna nella schermata: compare la riga "spente nelle impostazioni del telefono" con la freccia che le riapre.
11. Chiudi l'app del tutto, tocca una notifica: l'app si apre sulla destinazione giusta (avvio a freddo). Da disconnessi: login → Oggi, senza crash.
12. **Esci** (Impostazioni → Esci) con un ricordo in attesa e il giornaliero programmato: né l'avviso né il promemoria del giorno dopo arrivano più. Stesso controllo dopo "Elimina account".

Alla fine: `git checkout -- lib/constants.ts`.

## Fuori da questo piano (e chi se ne occupa)

- **Plugin `expo-notifications` in `app.json` + icona Android 96×96 bianca su trasparente + `NOTIFICATIONS_ENABLED = true`** → piano di configurazione nativa, task finale di attivazione. Senza plugin Android usa il launcher icon come silhouette (blob bianco): non è un bug di questo piano. Su iOS il profilo `2JUGQ23636` porta già `aps-environment` (verificato dal critico): nessuna rigenerazione.
- **Cancellazione cross-dispositivo**: un ricordo cestinato sul telefono B non cancella l'avviso sul telefono A (notifiche locali). Accettato per l'uso a un telefono.
- **Cartella in pausa**: l'avviso del primo ripasso di un ricordo in una cartella messa in pausa scatta lo stesso e apre la scheda (non un ripasso). Accettato; la spec non lo menziona. Il riarmo alla riaccensione invece non lo ripristina, perché `fetchMemoriesInRange` esclude le cartelle in pausa (`lib/api.ts:940`): una piccola incoerenza dalla parte giusta, verso il silenzio.
- **Android 12+**: la libreria non dichiara `SCHEDULE_EXACT_ALARM`, quindi lo scatto può slittare di minuti sotto Doze. Va bene per un promemoria di studio.
- **iOS tiene al massimo 64 notifiche locali in attesa** per app: con il tetto giornaliero (10-50) e l'orizzonte di 20 ore non si arriva al limite in uso normale; oltre, iOS scarta le più lontane.

## Passi umani (non automatizzare)

1. **Decisione sul default di `calm_mode`** (Angelo/Maurizio). Oggi a DB è `true` per tutti e nessun utente ha mai potuto sceglierlo (il toggle era nascosto): con la semantica di spec :331 il promemoria giornaliero non arriva finché non si spegne la calma. Se si vuole il promemoria opt-in-con-un-solo-gesto, serve una migrazione separata, da applicare a mano come per B4:
   ```sql
   alter table public.profiles alter column calm_mode set default false;
   update public.profiles set calm_mode = false;
   ```
   più la riga di `docs/DATA-MODEL.md`. Non fa parte di questo piano.
2. **Riepilogo settimanale**: la riga salva una preferenza che nessuno legge (hint sincero). Se in revisione Apple la contesta come placeholder (2.1), la rimozione è un `SettingsToggle` in `app/(app)/notifications.tsx` — decisione di Maurizio.
3. **Da dire a Maurizio**: le notifiche esistono solo con la build 3; gli OTA ai binari attuali non le portano. Il permesso viene chiesto dopo il primo salvataggio, non all'avvio: se l'ha già negato una volta, si riattiva solo dalle impostazioni del telefono.
