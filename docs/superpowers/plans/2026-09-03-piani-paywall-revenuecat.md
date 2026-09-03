# Piani, limiti e paywall RevenueCat — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tre piani — Free / Pro / Premium — con i limiti applicati **dal database** (10 ricordi totali, 1/5/∞ cartelle, 0/3/∞ sezioni), un paywall a schede alimentato dalle offerte RevenueCat, e una edge function che verifica l'abbonamento con l'API REST di RevenueCat prima di scrivere `profiles.plan`.

**Architecture:** La verità sta in Postgres: tre colonne su `profiles` (mai nella grant di UPDATE), una funzione `current_plan(uid)` che degrada a `free` un piano scaduto, e tre trigger `BEFORE INSERT` con errcode dedicati (`P0004` ricordi, `P0005` cartelle, `P0003` sezioni). Il client rispecchia gli stessi numeri con un modulo puro `lib/plan.ts` coperto da vitest — disabilita, spiega e propone l'upgrade — ma non decide mai: legge l'errcode e apre il paywall. L'SDK RevenueCat vive dietro `lib/purchases.ts`, sempre facoltativo (Expo Go, chiave vuota o modalità demo ⇒ acquisti non disponibili, mai un crash).

**Tech Stack:** TypeScript, Expo SDK 54 / React Native 0.81, expo-router, zustand, vitest, Supabase (PostgREST + migrazioni SQL + Edge Function Deno 2), `react-native-purchases` 10.8.1, RevenueCat REST v1.

**Spec:** `docs/superpowers/specs/2026-09-02-feedback-maurizio-design.md` (§B4, righe 611-727; ordine di esecuzione righe 764-810). Decisioni vincolanti: memoria `freemium_tier.md` (parametri dei piani, 2026-09-02) e `payments_pivot_revenuecat.md` (solo acquisti in-app, mai checkout web).

## Global Constraints

- **Ordine rispetto agli altri tre piani della build 3, sullo stesso branch `build-3`:** `build3-config-nativa Task 1-4` → `notifiche-locali` → **questo piano** → `foto-ricordi` → `build3-config-nativa Task 5-6`. Due conseguenze operative: (a) `app.json` ed `eas.json` sono **già** a posto — gli slot `EXPO_PUBLIC_REVENUECAT_*_KEY` e il permesso `com.android.vending.BILLING` esistono, qui non si toccano; (b) `app/add.tsx`, `app/(app)/settings.tsx`, `app/_layout.tsx`, `app/(app)/_layout.tsx` e i quattro cataloghi i18n sono **già stati modificati** dal piano notifiche, quindi i numeri di riga di quel file sono cambiati e ogni innesto qui sotto va ancorato al testo. Ciò che questo piano produce (`lib/plan.ts`, `lib/use-plan.ts`, `app/paywall.tsx`, `supabase/functions/revenuecat-sync/`, la migrazione `20260903100000_plans.sql` con il seed dei tester) è consumato dal piano foto e dal gate umano della configurazione nativa.
- **Test:** `npm test` = `vitest run`. Il config raccoglie SOLO `features/**/*.test.ts` e `lib/**/*.test.ts` (`vitest.config.ts:9`). Niente test su `app/`, `components/` o `supabase/`.
- **Typecheck:** `npm run lint` = `tsc --noEmit`. Deve passare a ogni commit.
- **i18n:** `TKey = keyof typeof it` (`lib/i18n/index.ts:32`) — una chiave aggiunta al solo `it.ts` è un errore di compilazione. `lib/i18n/i18n.test.ts` impone insiemi di chiavi identici, `{placeholder}` identici, coppie `_one`/`_other` e nessuna stringa vuota su **it/en/fr/es**.
- **Demo mode:** ogni funzione di `lib/api.ts` che tocca la rete inizia con `if (isDemoMode) return …`. Qualsiasi codice che tocchi l'SDK RevenueCat dirama su `isDemoMode` **prima** della prima chiamata (spec :697-698).
- **Purezza:** `lib/plan.ts` non importa mai React, React Native, Supabase o `lib/api`. Solo tipi e aritmetica — è il file che i test coprono e che il piano B5 (foto) consuma.
- **Le tre colonne di piano non entrano MAI nella grant di UPDATE per `authenticated`.** Il blocco `grant update (…)` in `supabase/migrations/20260825121500_lock_profiles_columns.sql:26-33` elenca esattamente `name, daily_input_cap, calm_mode, weekly_digest, morning_review_at, evening_review_at` (righe 27-32) e resta tale. `daily_input_cap` è la lezione: è scrivibile dall'utente, quindi qualunque limite che ci si appoggi è decorativo.
- **Gli errcode si mappano per codice, mai per sottostringa del messaggio.** Oggi `app/(app)/folder/[id].tsx:518` e `app/folder-settings.tsx:482` fanno `msg.includes("limit")`: si rompono alla prima traduzione. Il Task 8 li sostituisce.
- **Il `service_role` non entra nel repo** (AGENTS.md:80-84). L'unica scrittura privilegiata è dentro la Edge Function, che sulla piattaforma legge `SUPABASE_SERVICE_ROLE_KEY` da `Deno.env` — nessuna chiave nel codice, nessuna chiave nel git.
- **Le migrazioni NON si applicano a produzione dentro questo piano.** `npx supabase db push` è un passo umano (Task 10), e va eseguito dal worktree `memika-app` — `memika-build3` non è linkato (`supabase/.temp` non esiste qui) e `db push` ci fallisce con "Cannot find project ref".
- **Nomi delle variabili d'ambiente:** `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`. Sono gli stessi nomi che il piano `2026-09-03-build3-config-nativa.md` (Task 3, "`eas.json` — slot per Sentry e RevenueCat") scrive in `eas.json` e in `.env.example` con valore `""`, e gli stessi di `docs/PAYMENTS.md`. Quel task gira **prima** di questo piano: gli slot esistono già, qui non si tocca `eas.json`. **Stringa vuota = SDK non configurato ⇒ utente Free, nessuna chiamata a `Purchases`.**
- **Lingua:** commenti e copy in italiano, come il resto del repo. I nomi di simboli restano in inglese.

---

## I piani, in una tabella

Tabella della spec (:636-642), memoria `freemium_tier.md`. È l'unica fonte dei numeri di questo piano:

| | Free | Pro | Premium |
|---|---|---|---|
| Ricordi | **10 totali** (non al giorno) | illimitati | illimitati |
| Cartelle | 1 | 5 | illimitate |
| Sezioni per cartella | 0 | 3 | illimitate |
| Foto sui ricordi | — | — | ✓ (piano B5) |
| Statistiche avanzate | — | — | **fuori da questo ciclo** (spec :650-653) |

Tre cose che *non* cambiano qui:

- **Il cursore del limite giornaliero** (`profiles.daily_input_cap`, Impostazioni) resta com'è: è autoregolazione del carico per Pro/Premium, non un confine commerciale. Un utente free esaurisce i 10 ricordi totali molto prima di incontrarlo (spec :658-661).
- **Gli avvisi della mascotte a 20/25/30** sulla riga del limite giornaliero (spec :704-716) sono **già stati implementati** nel commit `35aad6a`: `MascotDialog` esiste (`components/MascotDialog.tsx`), è montato in `app/(app)/settings.tsx:755-765` e la copy è in `settings.loadWarn*`. Questo piano lo riusa per i limiti di piano, non lo riscrive.
- **Grandfathering**: chi ha già più di 10 ricordi, più di 1 cartella o delle sezioni li tiene tutti. Cade fuori gratis perché i trigger sono `BEFORE INSERT`: non toccano le righe esistenti (spec :679-681).

### Errcode

| Errcode | Chi lo solleva | Significato |
|---|---|---|
| `P0004` | `memories_enforce_plan_limit` | 10 ricordi raggiunti sul piano free (**cestino compreso**) |
| `P0005` | `folders_enforce_plan_limit` | tetto cartelle raggiunto (1 free, 5 pro) — cestino compreso |
| `P0003` | `subfolders_enforce_rules` | tetto sezioni raggiunto (0 free, 3 pro) — **codice già in uso** dal 2026-08-31, non cambia |
| `P0001` | guardie di integrità esistenti | cartella nel cestino, proprietario diverso, ecc. — **non** un limite di piano |

`P0004`/`P0005` sono codici della classe `P0` di PL/pgSQL (`P0004` = `assert_failure`). Sono riusabili qui senza ambiguità perché **nessuna migrazione di questo schema usa `ASSERT`** (verificato: `grep -rn "assert" supabase/migrations/` non restituisce nulla) e perché `P0003` era già stato preso in prestito con lo stesso criterio (`20260831020000_subfolder_guards.sql:82-83`).

**PostgREST li serve come HTTP 500.** La sua tabella SQLSTATE→HTTP promuove a `400` solo `P0001`; ogni altro `P0*` diventa `500`. Il corpo JSON con `code: "P0004"` arriva comunque al client — è così che il tetto sezioni (`P0003`) funziona già oggi — e `lib/network.ts` non ha alcun retry sui 5xx, quindi il comportamento dell'app non cambia. L'unico effetto è di osservabilità: nei log del progetto Supabase i rifiuti di piano, che sono un esito normale per un utente free, compaiono come 500. È una scelta consapevole, non un guasto: cambiare classe di errcode (es. `PT402`) romperebbe i binari già in circolazione che riconoscono `P0003` per le sezioni. La stessa frase va in `docs/DATA-MODEL.md` (Task 9).

---

## File Structure

| File | Responsabilità |
|---|---|
| `lib/plan.ts` **(nuovo)** | Tabella dei limiti, piano efficace, `canAdd*`, mappa errcode, derivazione del piano dagli entitlement. Puro. |
| `lib/plan.test.ts` **(nuovo)** | Copertura completa del modulo puro. |
| `supabase/migrations/20260903100000_plans.sql` **(nuovo)** | Colonne, `current_plan()`, tre trigger. |
| `supabase/verify/20260903_plans_smoke.sql` **(nuovo)** | Verifica in sola lettura, eseguibile su remoto o locale. |
| `supabase/verify/20260903_plans_local_test.sql` **(nuovo)** | Test funzionale dei tre limiti — solo database locale, in transazione con rollback. |
| `supabase/functions/revenuecat-sync/index.ts` **(nuovo)** | Edge Function Deno: chiamata dal client (JWT) o dal webhook RevenueCat; verifica con REST e scrive `profiles.plan`. |
| `supabase/config.toml` | Blocco `[functions.revenuecat-sync]`. |
| `lib/mappers.ts` | `ProfileRow`/`Profile` portano `plan`, `plan_until`, `rc_app_user_id`. |
| `lib/auth-store.ts` | `AuthUser` porta `plan`/`planUntil`; la select del profilo li legge; `setPlan`. |
| `lib/api.ts` | `countMemories(userId)` e `syncPlan()`. |
| `lib/purchases.ts` **(nuovo)** | Wrapper RevenueCat, sempre facoltativo. Nessun import di `lib/api`. |
| `lib/use-plan.ts` **(nuovo)** | `usePlan()` per le schermate + `startPlanSync()`, la colla store ⇄ SDK ⇄ edge function. |
| `app/paywall.tsx` **(nuovo)** | Le tre schede, i prezzi veri, "Ripristina acquisti", il piede legale. Vive nello stack **ROOT**, come `/add` e `/trash`. |
| `app/_layout.tsx` | Registra `paywall` nello stack radice (presentazione a foglio) e avvia `usePlanSync()`. |
| `app/(app)/settings.tsx` | Sezione "Abbonamento". |
| `components/PlanLimitDialog.tsx` **(nuovo)** | La mascotte che spiega il limite e porta al paywall. Usato da 4 schermate. |
| `app/add.tsx` · `app/choose-topic.tsx` · `app/(app)/knowledge.tsx` · `app/(app)/folder/[id].tsx` · `app/folder-settings.tsx` | Specchi lato client, per errcode. |
| `lib/constants.ts` | Ritira `FREE_FOLDER_LIMIT`, `FOLDER_LIMIT_ENFORCED`, `PREMIUM_ENABLED`, `SUBFOLDERS_MAX`. |
| `lib/i18n/{it,en,fr,es}.ts` | Le chiavi del paywall, dei limiti e della sezione Abbonamento. |
| `docs/PAYMENTS.md` · `docs/DATA-MODEL.md` · `docs/ROUTING.md` · `AGENTS.md` | Documentazione allineata al modello a tre piani. |

---

### Task 1: `lib/plan.ts` — i limiti, puri

**Files:**
- Create: `lib/plan.ts`
- Create: `lib/plan.test.ts`

**Interfaces:**
- Consumes: niente. È il modulo di base di tutto il piano.
- Produces:
  - `type Plan = "free" | "pro" | "premium"` e `PLANS: readonly Plan[]`
  - `type PlanLimits = { memories: number | null; folders: number | null; sections: number | null; photos: boolean }`
  - `PLAN_LIMITS: Record<Plan, PlanLimits>`
  - `effectivePlan(plan: string | null | undefined, planUntil: string | null | undefined, now?: Date): Plan`
  - `canAddMemory(count: number, plan: Plan): boolean` · `canAddFolder(count, plan)` · `canAddSection(count, plan)`
  - `memoriesLeft(count: number, plan: Plan): number | null`
  - `canUsePhotos(plan: Plan): boolean` ← **consumato dal piano B5 (foto)**
  - `type PlanLimitKind = "memories" | "folders" | "sections"`, `PLAN_ERRCODE: Record<PlanLimitKind, string>`, `planLimitFromCode(code: string | null | undefined): PlanLimitKind | null`
  - `ENTITLEMENT_PRO`, `ENTITLEMENT_PREMIUM`, `planFromEntitlements(activeIds: readonly string[]): Plan`
  - `type RcEntitlement`, `planFromRcEntitlements(entitlements, requestDate): { plan: Plan; planUntil: string | null }`
  - `PRODUCT_IDS`, `planForProductId(productIdentifier: string): Plan | null`

- [ ] **Step 1: Scrivere i test che falliscono**

Crea `lib/plan.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  PLAN_ERRCODE,
  PLAN_LIMITS,
  PLANS,
  PRODUCT_IDS,
  canAddFolder,
  canAddMemory,
  canAddSection,
  canUsePhotos,
  effectivePlan,
  memoriesLeft,
  planForProductId,
  planFromEntitlements,
  planFromRcEntitlements,
  planLimitFromCode,
} from "./plan";

const NOW = new Date("2026-09-03T10:00:00.000Z");
const DAY = 86_400_000;

describe("PLAN_LIMITS — la tabella della spec, alla lettera", () => {
  it("free: 10 ricordi totali, 1 cartella, 0 sezioni, niente foto", () => {
    expect(PLAN_LIMITS.free).toEqual({ memories: 10, folders: 1, sections: 0, photos: false });
  });

  it("pro: ricordi illimitati, 5 cartelle, 3 sezioni, niente foto", () => {
    expect(PLAN_LIMITS.pro).toEqual({ memories: null, folders: 5, sections: 3, photos: false });
  });

  it("premium: tutto illimitato, foto incluse", () => {
    expect(PLAN_LIMITS.premium).toEqual({
      memories: null,
      folders: null,
      sections: null,
      photos: true,
    });
  });

  it("copre ogni piano dichiarato — nessun buco", () => {
    for (const p of PLANS) expect(PLAN_LIMITS[p]).toBeDefined();
  });
});

describe("effectivePlan — specchio esatto di public.current_plan(uid)", () => {
  it("tiene il piano quando la scadenza è nel futuro", () => {
    const until = new Date(NOW.getTime() + 30 * DAY).toISOString();
    expect(effectivePlan("pro", until, NOW)).toBe("pro");
    expect(effectivePlan("premium", until, NOW)).toBe("premium");
  });

  it("degrada a free un piano scaduto", () => {
    const until = new Date(NOW.getTime() - 1).toISOString();
    expect(effectivePlan("pro", until, NOW)).toBe("free");
    expect(effectivePlan("premium", until, NOW)).toBe("free");
  });

  it("plan_until null significa 'non scade', non 'scaduto'", () => {
    expect(effectivePlan("pro", null, NOW)).toBe("pro");
    expect(effectivePlan("premium", undefined, NOW)).toBe("premium");
  });

  it("free resta free comunque", () => {
    expect(effectivePlan("free", null, NOW)).toBe("free");
    expect(effectivePlan("free", new Date(NOW.getTime() + DAY).toISOString(), NOW)).toBe("free");
  });

  it("un valore sconosciuto o assente vale free, mai di più", () => {
    expect(effectivePlan(null, null, NOW)).toBe("free");
    expect(effectivePlan(undefined, undefined, NOW)).toBe("free");
    expect(effectivePlan("platinum", null, NOW)).toBe("free");
    expect(effectivePlan("pro", "non-una-data", NOW)).toBe("free");
  });
});

describe("canAddMemory — 10 TOTALI sul free, illimitati sopra", () => {
  it("lascia passare fino al decimo compreso", () => {
    expect(canAddMemory(0, "free")).toBe(true);
    expect(canAddMemory(9, "free")).toBe(true);
  });

  it("blocca dal decimo in poi", () => {
    expect(canAddMemory(10, "free")).toBe(false);
    expect(canAddMemory(11, "free")).toBe(false);
  });

  it("non blocca mai pro e premium", () => {
    expect(canAddMemory(4000, "pro")).toBe(true);
    expect(canAddMemory(4000, "premium")).toBe(true);
  });

  it("un utente grandfathered oltre quota non può aggiungerne", () => {
    // 40 ricordi da prima dei piani: li tiene, ma il prossimo è no.
    expect(canAddMemory(40, "free")).toBe(false);
  });
});

describe("canAddFolder / canAddSection", () => {
  it("cartelle: 1 free, 5 pro, illimitate premium", () => {
    expect(canAddFolder(0, "free")).toBe(true);
    expect(canAddFolder(1, "free")).toBe(false);
    expect(canAddFolder(4, "pro")).toBe(true);
    expect(canAddFolder(5, "pro")).toBe(false);
    expect(canAddFolder(99, "premium")).toBe(true);
  });

  it("sezioni: nessuna sul free, 3 su pro, illimitate premium", () => {
    expect(canAddSection(0, "free")).toBe(false);
    expect(canAddSection(2, "pro")).toBe(true);
    expect(canAddSection(3, "pro")).toBe(false);
    expect(canAddSection(9, "premium")).toBe(true);
  });
});

describe("memoriesLeft", () => {
  it("dice quanti ne restano sul free", () => {
    expect(memoriesLeft(0, "free")).toBe(10);
    expect(memoriesLeft(7, "free")).toBe(3);
  });

  it("non scende sotto zero per i grandfathered", () => {
    expect(memoriesLeft(40, "free")).toBe(0);
  });

  it("null = illimitati", () => {
    expect(memoriesLeft(3, "pro")).toBeNull();
    expect(memoriesLeft(3, "premium")).toBeNull();
  });
});

describe("canUsePhotos — l'interfaccia che consuma il piano B5", () => {
  it("solo premium", () => {
    expect(canUsePhotos("free")).toBe(false);
    expect(canUsePhotos("pro")).toBe(false);
    expect(canUsePhotos("premium")).toBe(true);
  });
});

describe("planLimitFromCode — si mappa il codice, mai il messaggio", () => {
  it("riconosce i tre limiti", () => {
    expect(planLimitFromCode(PLAN_ERRCODE.memories)).toBe("memories");
    expect(planLimitFromCode(PLAN_ERRCODE.folders)).toBe("folders");
    expect(planLimitFromCode(PLAN_ERRCODE.sections)).toBe("sections");
  });

  it("usa i codici concordati con il database", () => {
    expect(PLAN_ERRCODE).toEqual({ memories: "P0004", folders: "P0005", sections: "P0003" });
  });

  it("non confonde le guardie di integrità con un limite di piano", () => {
    expect(planLimitFromCode("P0001")).toBeNull();
    expect(planLimitFromCode("23505")).toBeNull();
    expect(planLimitFromCode(null)).toBeNull();
    expect(planLimitFromCode(undefined)).toBeNull();
  });
});

describe("planFromEntitlements — premium batte pro, pro batte free", () => {
  it("premium vince anche se ci sono entrambi", () => {
    expect(planFromEntitlements(["pro", "premium"])).toBe("premium");
  });

  it("pro da solo vale pro", () => {
    expect(planFromEntitlements(["pro"])).toBe("pro");
  });

  it("nessun entitlement attivo = free", () => {
    expect(planFromEntitlements([])).toBe("free");
    expect(planFromEntitlements(["qualcosaltro"])).toBe("free");
  });
});

describe("planFromRcEntitlements — la risposta REST di RevenueCat", () => {
  const REQ = "2026-09-03T10:00:00Z";

  it("premium attivo vince e porta la sua scadenza", () => {
    const out = planFromRcEntitlements(
      {
        pro: { expires_date: "2026-10-03T10:00:00Z" },
        premium: { expires_date: "2026-12-03T10:00:00Z" },
      },
      REQ,
    );
    expect(out).toEqual({ plan: "premium", planUntil: "2026-12-03T10:00:00Z" });
  });

  it("un entitlement scaduto non conta", () => {
    const out = planFromRcEntitlements(
      { premium: { expires_date: "2026-09-01T10:00:00Z" }, pro: { expires_date: "2026-10-03T10:00:00Z" } },
      REQ,
    );
    expect(out).toEqual({ plan: "pro", planUntil: "2026-10-03T10:00:00Z" });
  });

  it("expires_date null = accesso a vita", () => {
    const out = planFromRcEntitlements({ premium: { expires_date: null } }, REQ);
    expect(out).toEqual({ plan: "premium", planUntil: null });
  });

  it("il periodo di grazia tiene vivo l'abbonamento FINO alla fine della grazia", () => {
    // planUntil e' la scadenza dell'ACCESSO, non quella di fatturazione:
    // se qui finisse la expires_date passata, effectivePlan e current_plan
    // degraderebbero subito a free e la grazia non varrebbe niente.
    const out = planFromRcEntitlements(
      {
        pro: {
          expires_date: "2026-09-02T10:00:00Z",
          grace_period_expires_date: "2026-09-10T10:00:00Z",
        },
      },
      REQ,
    );
    expect(out).toEqual({ plan: "pro", planUntil: "2026-09-10T10:00:00Z" });
  });

  it("nessun entitlement = free senza scadenza", () => {
    expect(planFromRcEntitlements({}, REQ)).toEqual({ plan: "free", planUntil: null });
  });
});

describe("planForProductId", () => {
  // In questo ciclo l'offerta `default` vende SOLO i due mensili (Task 10):
  // gli id annuali sono riservati e la mappa li riconosce gia', cosi'
  // aggiungerli all'offerta non richiedera' una modifica di codice.
  it("riconosce i quattro identificativi, mensili e annuali", () => {
    expect(planForProductId(PRODUCT_IDS.pro.monthly)).toBe("pro");
    expect(planForProductId(PRODUCT_IDS.pro.yearly)).toBe("pro");
    expect(planForProductId(PRODUCT_IDS.premium.monthly)).toBe("premium");
    expect(planForProductId(PRODUCT_IDS.premium.yearly)).toBe("premium");
  });

  it("regge la forma 'prodotto:baseplan' di Google Play", () => {
    expect(planForProductId("memika_pro_monthly:monthly")).toBe("pro");
  });

  it("non inventa piani per prodotti sconosciuti", () => {
    expect(planForProductId("qualcosa_altro")).toBeNull();
  });
});
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npm test -- lib/plan.test.ts`
Expected: FAIL — `Failed to resolve import "./plan"`.

- [ ] **Step 3: Scrivere `lib/plan.ts`**

```ts
/**
 * I piani di Memika — Free / Pro / Premium (spec 2026-09-02 §B4).
 *
 * Modulo PURO: niente React, niente React Native, niente Supabase. Serve a
 * due cose e a nessun'altra:
 *   1. dire all'interfaccia cosa può fare l'utente, per disabilitare e
 *      spiegare PRIMA che il server rifiuti;
 *   2. tradurre l'errcode del rifiuto in un limite riconoscibile.
 *
 * La verità NON è qui: sta nei trigger di
 * supabase/migrations/20260903100000_plans.sql. Se i due divergono vince il
 * database, e questo file è il bug.
 */

export const PLANS = ["free", "pro", "premium"] as const;
export type Plan = (typeof PLANS)[number];

export type PlanLimits = {
  /**
   * Ricordi dell'account, CESTINO COMPRESO. null = illimitati.
   * Si contano tutte le righe dell'utente perche' il ripristino dal cestino
   * e' una UPDATE e non passa dai trigger BEFORE INSERT: contando solo le
   * righe vive, "cestina 5 → inserisci 5 → ripristina 5" aggirerebbe il
   * tetto all'infinito. Stessa semantica del contatore giornaliero
   * (lib/api.ts:468-471, "eliminare e reinserire non deve liberare quota").
   */
  memories: number | null;
  /** Cartelle dell'account, cestino compreso. null = illimitate. */
  folders: number | null;
  /** Sezioni (sottocartelle) per cartella. null = illimitate. */
  sections: number | null;
  /** Foto sui ricordi — consumato dal piano B5. */
  photos: boolean;
};

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: { memories: 10, folders: 1, sections: 0, photos: false },
  pro: { memories: null, folders: 5, sections: 3, photos: false },
  premium: { memories: null, folders: null, sections: null, photos: true },
};

function isPlan(value: string | null | undefined): value is Plan {
  return (PLANS as readonly string[]).includes(value ?? "");
}

/**
 * Il piano che vale ADESSO. Specchio esatto di `public.current_plan(uid)`:
 *
 *   case when plan_until is not null and plan_until < now() then 'free'
 *        else plan end
 *
 * Niente job di downgrade, niente cron: la valutazione pigra è sempre
 * corretta per costruzione — stessa scelta della finestra di ripasso
 * (20260902100000_review_phases.sql:8-10).
 */
export function effectivePlan(
  plan: string | null | undefined,
  planUntil: string | null | undefined,
  now: Date = new Date(),
): Plan {
  if (!isPlan(plan) || plan === "free") return "free";
  if (planUntil === null || planUntil === undefined) return plan;
  const until = Date.parse(planUntil);
  // Una data illeggibile è un dato che non capiamo: si degrada, non si
  // concede.
  if (Number.isNaN(until)) return "free";
  return until > now.getTime() ? plan : "free";
}

function under(count: number, cap: number | null): boolean {
  return cap === null || count < cap;
}

/** `count` = ricordi dell'utente (cestino compreso) PRIMA di questo inserimento. */
export function canAddMemory(count: number, plan: Plan): boolean {
  return under(count, PLAN_LIMITS[plan].memories);
}

/** `count` = cartelle dell'utente, cestino compreso. */
export function canAddFolder(count: number, plan: Plan): boolean {
  return under(count, PLAN_LIMITS[plan].folders);
}

/** `count` = sezioni già presenti NELLA cartella. */
export function canAddSection(count: number, plan: Plan): boolean {
  return under(count, PLAN_LIMITS[plan].sections);
}

/** Quanti ricordi restano; null = illimitati. Mai negativo (grandfathering). */
export function memoriesLeft(count: number, plan: Plan): number | null {
  const cap = PLAN_LIMITS[plan].memories;
  if (cap === null) return null;
  return Math.max(0, cap - count);
}

/** Le foto sui ricordi sono Premium (spec :640). Interfaccia del piano B5. */
export function canUsePhotos(plan: Plan): boolean {
  return PLAN_LIMITS[plan].photos;
}

// ---------------------------------------------------------------------------
// Errcode → limite
// ---------------------------------------------------------------------------

export type PlanLimitKind = "memories" | "folders" | "sections";

/**
 * Gli SQLSTATE sollevati dai tre trigger. P0003 era già il codice del tetto
 * sezioni dal 2026-08-31 e resta invariato; P0004/P0005 sono nuovi.
 * Nessuno di questi è P0001, che le cinque guardie di integrità già usano.
 */
export const PLAN_ERRCODE: Record<PlanLimitKind, string> = {
  memories: "P0004",
  folders: "P0005",
  sections: "P0003",
};

const CODE_TO_LIMIT: Record<string, PlanLimitKind> = {
  P0004: "memories",
  P0005: "folders",
  P0003: "sections",
};

/** `PostgrestError.code` → limite, o null se non è un limite di piano. */
export function planLimitFromCode(code: string | null | undefined): PlanLimitKind | null {
  if (!code) return null;
  return CODE_TO_LIMIT[code] ?? null;
}

// ---------------------------------------------------------------------------
// RevenueCat
// ---------------------------------------------------------------------------

export const ENTITLEMENT_PRO = "pro";
export const ENTITLEMENT_PREMIUM = "premium";

/** Dagli entitlement ATTIVI dell'SDK (customerInfo.entitlements.active). */
export function planFromEntitlements(activeIds: readonly string[]): Plan {
  if (activeIds.includes(ENTITLEMENT_PREMIUM)) return "premium";
  if (activeIds.includes(ENTITLEMENT_PRO)) return "pro";
  return "free";
}

/** Un entitlement come lo restituisce l'API REST v1 di RevenueCat. */
export type RcEntitlement = {
  /** ISO 8601, oppure null per l'accesso a vita. */
  expires_date: string | null;
  /** Finestra di grazia dopo un problema di pagamento. */
  grace_period_expires_date?: string | null;
};

/**
 * La scadenza dell'ACCESSO: la grazia, se c'è, altrimenti la scadenza
 * normale. null = non scade.
 */
function rcDeadline(ent: RcEntitlement): string | null {
  return ent.grace_period_expires_date ?? ent.expires_date ?? null;
}

function rcActive(ent: RcEntitlement, at: number): boolean {
  // La risposta REST NON ha un campo is_active: si calcola.
  const deadline = rcDeadline(ent);
  if (deadline === null) return true;
  const ts = Date.parse(deadline);
  return Number.isNaN(ts) ? false : ts > at;
}

/**
 * Piano e scadenza da `subscriber.entitlements` + `request_date` della
 * risposta REST.
 *
 * `planUntil` è la scadenza dell'ACCESSO — la stessa che `rcActive` usa per
 * dire che l'entitlement è vivo: durante il periodo di grazia la grazia la
 * PROLUNGA. Scriverci la `expires_date` (già passata, in quel caso) sarebbe
 * un autogol: `effectivePlan()` e `public.current_plan()` degradano a free
 * tutto ciò che ha `plan_until` nel passato, e un abbonato in billing-retry
 * — il caso per cui la grazia esiste — verrebbe declassato all'istante.
 *
 * GEMELLO: la stessa funzione esiste, identica, dentro
 * supabase/functions/revenuecat-sync/index.ts, perché Deno non può
 * importare da lib/. Se cambi qui, cambia là.
 */
export function planFromRcEntitlements(
  entitlements: Record<string, RcEntitlement | undefined>,
  requestDate: string,
): { plan: Plan; planUntil: string | null } {
  const parsed = Date.parse(requestDate);
  const at = Number.isNaN(parsed) ? Date.now() : parsed;
  const premium = entitlements[ENTITLEMENT_PREMIUM];
  if (premium && rcActive(premium, at)) {
    return { plan: "premium", planUntil: rcDeadline(premium) };
  }
  const pro = entitlements[ENTITLEMENT_PRO];
  if (pro && rcActive(pro, at)) {
    return { plan: "pro", planUntil: rcDeadline(pro) };
  }
  return { plan: "free", planUntil: null };
}

/**
 * Gli identificativi dei prodotti negli store. Devono essere IDENTICI in
 * App Store Connect, Play Console e RevenueCat (checklist, Task 10): il
 * paywall raggruppa i pacchetti per piano a partire da questi.
 *
 * In QUESTO ciclo l'offerta `default` contiene solo i due mensili: il
 * paywall ha un bottone per scheda e non ha un selettore di periodicita',
 * quindi un pacchetto annuale accanto a un mensile resterebbe invendibile.
 * Gli id annuali sono RISERVATI e gia' riconosciuti qui: aggiungere il
 * piano annuale in futuro sara' un lavoro di interfaccia, non di mappa.
 */
export const PRODUCT_IDS = {
  pro: { monthly: "memika_pro_monthly", yearly: "memika_pro_yearly" },
  premium: { monthly: "memika_premium_monthly", yearly: "memika_premium_yearly" },
} as const;

/**
 * Su Google Play l'identificativo arriva nella forma `prodotto:baseplan`,
 * quindi si confronta solo la parte prima dei due punti.
 */
export function planForProductId(productIdentifier: string): Plan | null {
  const base = productIdentifier.split(":")[0] ?? "";
  if (base === PRODUCT_IDS.premium.monthly || base === PRODUCT_IDS.premium.yearly) return "premium";
  if (base === PRODUCT_IDS.pro.monthly || base === PRODUCT_IDS.pro.yearly) return "pro";
  return null;
}
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npm test -- lib/plan.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck e commit**

```bash
npm run lint
git add lib/plan.ts lib/plan.test.ts
git commit -F- <<'MSG'
feat(plan): tabella dei limiti Free/Pro/Premium come modulo puro

I numeri della spec §B4 in un solo posto, con il piano efficace che
degrada da solo quando plan_until e' passato — stesso criterio della
funzione SQL current_plan che arriva col trigger.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
```

---

### Task 2: Migrazione — colonne, `current_plan`, tre trigger

**Files:**
- Create: `supabase/migrations/20260903100000_plans.sql`
- Create: `supabase/verify/20260903_plans_smoke.sql`
- Create: `supabase/verify/20260903_plans_local_test.sql`

**Interfaces:**
- Consumes: `PLAN_ERRCODE` del Task 1 come contratto (`P0004`/`P0005`/`P0003`).
- Produces:
  - su `public.profiles`: `plan text not null default 'free' check (plan in ('free','pro','premium'))`, `plan_until timestamptz`, `rc_app_user_id text` — **fuori** dalla grant di UPDATE;
  - il seed `plan = 'premium'` dei due tester (`angelo.casula@gmail.com`, `memikaapp@gmail.com`) **dentro la migrazione e sopra i `create trigger`** — è il punto 6 della lista "Prima di lanciare" di `docs/superpowers/plans/2026-09-03-build3-config-nativa.md`, che lo verifica con un `grep`;
  - `public.current_plan(uid uuid) returns text`, `security definer`, execute revocato a `anon`/`authenticated`;
  - trigger `memories_enforce_plan_limit` (P0004), `folders_enforce_plan_limit` (P0005), e `enforce_subfolder_rules` riscritta consapevole del piano (P0003).

- [ ] **Step 1: Scrivere la migrazione**

Crea `supabase/migrations/20260903100000_plans.sql`:

```sql
-- Piani Free / Pro / Premium (spec 2026-09-02 §B4).
--
-- Perche' server-side: oggi NESSUNO dei tre limiti e' applicato davvero.
-- FREE_FOLDER_LIMIT e' codice morto, il tetto giornaliero e' un avviso
-- testuale, e daily_input_cap e' persino nella grant di UPDATE dell'utente
-- (20260825121500_lock_profiles_columns.sql) — chiunque se lo porta a 200
-- con una PATCH. Un limite che vive solo nel client non e' un limite.
--
-- Le tre colonne NON entrano nella grant: la lista li' e' esplicita
-- (name, daily_input_cap, calm_mode, weekly_digest, morning_review_at,
-- evening_review_at) e resta quella. Dopo il revoke della stessa migrazione
-- una colonna nuova nasce NON aggiornabile da `authenticated`: e' esattamente
-- quello che vogliamo. L'unico scrittore e' la Edge Function
-- revenuecat-sync, che gira con il service_role.
--
-- GRANDFATHERING: i tre trigger sono BEFORE INSERT e non toccano le righe
-- esistenti. Chi ha 40 ricordi li tiene tutti e semplicemente non puo'
-- aggiungerne. E' la semantica scelta nella spec (:679-681).

alter table public.profiles
  add column plan text not null default 'free'
    check (plan in ('free','pro','premium')),
  add column plan_until timestamptz,
  add column rc_app_user_id text;

comment on column public.profiles.plan is
  'Piano acquistato: free/pro/premium. Scritto SOLO dalla edge function revenuecat-sync (service_role). Non e'' nella grant di UPDATE per authenticated: leggilo con current_plan(), non da solo.';
comment on column public.profiles.plan_until is
  'Scadenza dell''entitlement RevenueCat. null = non scade (a vita o promozionale). Nel passato = il piano vale free, senza bisogno di alcun job di downgrade.';
comment on column public.profiles.rc_app_user_id is
  'App User ID con cui RevenueCat conosce questo utente. Uguale a profiles.id per costruzione (Purchases.logIn(user.id)); serve a riconoscere una riga gia'' sincronizzata e come chiave di audit.';

-- ---------------------------------------------------------------------------
-- I due tester passano a premium PRIMA che i trigger esistano
-- ---------------------------------------------------------------------------
-- Deve stare QUI dentro, e sopra i `create trigger`, non in una query a mano
-- prima del push: la colonna `plan` nasce tre istruzioni fa, quindi un
-- `update public.profiles set plan = 'premium'` eseguito PRIMA del db push
-- fallirebbe con SQLSTATE 42703 (column "plan" does not exist). E farlo DOPO
-- il push aprirebbe una finestra in cui i tetti valgono anche per Maurizio,
-- che ha vc11 e quindi non ha ne' paywall ne' schermata dei piani: si
-- troverebbe bloccato a 10 ricordi senza alcun modo di uscirne.
--
-- La stessa istruzione, dentro la stessa transazione della migrazione, chiude
-- la finestra a zero. E' il punto 6 della lista "Prima di lanciare" del piano
-- 2026-09-03-build3-config-nativa.md, che lo verifica con
-- `grep -n "premium" supabase/migrations/20260903100000_plans.sql`.
--
-- plan_until null = non scade: e' un accesso di cortesia, non un abbonamento.
-- Idempotente e innocua sugli altri progetti: se quelle email non esistono,
-- aggiorna zero righe.
update public.profiles
   set plan = 'premium', plan_until = null
 where email in ('angelo.casula@gmail.com', 'memikaapp@gmail.com');

-- ---------------------------------------------------------------------------
-- Il piano efficace, valutato pigramente
-- ---------------------------------------------------------------------------
-- Niente cron di downgrade: sarebbe una dipendenza in piu' e una finestra
-- di un'ora in cui il trigger direbbe ancora "pro". Il confronto con now()
-- e' sempre corretto per costruzione — stessa scelta gia' fatta per la
-- finestra di ripasso (20260902100000_review_phases.sql:8-10).
--
-- security definer perche' i trigger la chiamano su righe di profiles a cui
-- la policy RLS del chiamante potrebbe non dare accesso; l'execute viene
-- revocato subito dopo, altrimenti le default privileges del progetto
-- ospitato la renderebbero chiamabile da anon/authenticated
-- (20260825153500_delete_own_account_revoke_anon.sql lo documenta) e
-- chiunque potrebbe leggere il piano altrui passando un uuid qualsiasi.
create or replace function public.current_plan(uid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p.plan_until is not null and p.plan_until < now() then 'free'
    else p.plan
  end
  from public.profiles p
  where p.id = uid;
$$;

revoke execute on function public.current_plan(uuid) from public, anon, authenticated;

comment on function public.current_plan(uuid) is
  'Piano che vale adesso: plan, degradato a free se plan_until e'' passato. Specchio esatto di effectivePlan() in lib/plan.ts.';

-- ---------------------------------------------------------------------------
-- Ricordi: 10 totali sul piano free
-- ---------------------------------------------------------------------------
-- Si contano TUTTE le righe dell'utente, cestino compreso: nessun filtro su
-- deleted_at.
--
-- Perche' non le sole righe vive: il ripristino dal cestino e' una UPDATE
-- (restoreFolder lib/api.ts:1042-1055, restoreMemory :1063-1095) e non passa
-- da un trigger BEFORE INSERT. Contando solo le righe vive, il ciclo
-- "cestina 5 → inserisci 5 → ripristina 5" e' ripetibile all'infinito e il
-- tetto smette di esistere; sulle cartelle basterebbe "cestina l'unica →
-- creane una nuova → ripristina la vecchia" per averne due, poi tre, poi
-- quante si vuole. L'alternativa (un trigger anche sulla transizione
-- deleted_at→NULL) impedirebbe a un utente grandfathered di ripristinare
-- cio' che ha cestinato: perdita di dati per difendere una quota.
--
-- Contando tutto, il totale puo' solo SCENDERE (purga a 24 ore): il
-- ripristino non puo' mai portare sopra il tetto, quindi non serve nessun
-- trigger su UPDATE e il grandfathering resta intatto. E' la stessa
-- semantica gia' scelta dal repo per il contatore giornaliero
-- (lib/api.ts:468-471: "eliminare e reinserire non deve liberare quota").
-- Costo accettato e dichiarato nella copy: una riga nel cestino occupa il
-- suo posto fino alla purga.
--
-- L'ordine delle istruzioni conta: si legge PRIMA il piano e si esce subito
-- per chi non ha tetto, poi si prende il lock. Cosi' un abbonato Pro o
-- Premium non serializza tutti i suoi inserimenti su un lock esclusivo
-- della propria riga di profiles per un limite che non lo riguarda. Per chi
-- il tetto ce l'ha la garanzia e' identica: il lock e' comunque preso PRIMA
-- del conteggio, e in READ COMMITTED chi aspetta il lock rilegge con uno
-- snapshot nuovo — due dispositivi che vedono entrambi 9 non arrivano a 11.
--
-- INSERT multi-riga (PostgREST accetta un corpo array e lo traduce in UN
-- solo comando): il conteggio vede anche le righe gia' inserite dallo stesso
-- comando. Ogni query di una funzione plpgsql passa da SPI, che per una
-- funzione VOLATILE fa CommandCounterIncrement() e prende uno snapshot
-- nuovo prima di eseguire — quindi la riga 1 e' visibile al trigger della
-- riga 2. Il test funzionale (_plans_local_test.sql, blocco 3-ter) lo
-- verifica esplicitamente con 25 righe in un solo INSERT.
--
-- La riga NUOVA non e' ancora nella tabella, quindi l'ordine alfabetico dei
-- trigger BEFORE INSERT su memories (…_enforce_plan_limit <
-- …_guard_deleted_at < …_subfolder_coherence) non influenza il conteggio —
-- e con il predicato "tutte le righe" non conta nemmeno che
-- guard_memory_deleted_at possa riscrivere deleted_at.
create or replace function public.enforce_memory_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  eff text;
  cap int;
  used int;
begin
  eff := coalesce(public.current_plan(new.user_id), 'free');
  cap := case eff when 'free' then 10 else null end;
  if cap is null then
    return new;
  end if;
  -- Lock DOPO il controllo del piano: serializza solo chi ha davvero un
  -- tetto, mai gli abbonati.
  perform 1 from public.profiles where id = new.user_id for update;
  select count(*) into used
    from public.memories
   where user_id = new.user_id;
  if used >= cap then
    raise exception 'memories limit reached (% on the free plan)', cap
      using errcode = 'P0004', hint = 'plan-limit:memories';
  end if;
  return new;
end;
$$;

create trigger memories_enforce_plan_limit
  before insert on public.memories
  for each row execute function public.enforce_memory_plan_limit();

-- ---------------------------------------------------------------------------
-- Cartelle: 1 free / 5 pro / illimitate premium
-- ---------------------------------------------------------------------------
-- Tutte le righe di public.folders sono di primo livello: le sezioni vivono
-- nella tabella separata public.subfolders (20260831010000_subfolders.sql)
-- e folders non ha alcuna colonna parent. Non serve nessun filtro.
--
-- Le cartelle in pausa CONTANO: `paused` e' una scelta di carico
-- (20260724235528_add_folders_paused.sql), non di proprieta', ed e'
-- scrivibile dall'utente — escluderle sarebbe un modo per aggirare il tetto.
--
-- E contano anche le cartelle NEL CESTINO, per la stessa ragione del tetto
-- ricordi qui sopra: restoreFolder e' una UPDATE, e senza questo predicato
-- "cestina l'unica cartella → creane una nuova → ripristina la vecchia"
-- darebbe due cartelle su un piano da una, ripetibile all'infinito.
-- Stesso ordine: piano prima, lock dopo, conteggio per ultimo.
create or replace function public.enforce_folder_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  eff text;
  cap int;
  used int;
begin
  eff := coalesce(public.current_plan(new.user_id), 'free');
  cap := case eff when 'free' then 1 when 'pro' then 5 else null end;
  if cap is null then
    return new;
  end if;
  perform 1 from public.profiles where id = new.user_id for update;
  select count(*) into used
    from public.folders
   where user_id = new.user_id;
  if used >= cap then
    raise exception 'folders limit reached (% on the % plan)', cap, eff
      using errcode = 'P0005', hint = 'plan-limit:folders';
  end if;
  return new;
end;
$$;

create trigger folders_enforce_plan_limit
  before insert on public.folders
  for each row execute function public.enforce_folder_plan_limit();

-- ---------------------------------------------------------------------------
-- Sezioni: 0 free / 3 pro / illimitate premium
-- ---------------------------------------------------------------------------
-- Sostituisce la versione di 20260831020000_subfolder_guards.sql: identica
-- nelle due guardie di integrita' (stesso P0001, stesso testo), diverso solo
-- il tetto, che ora dipende dal piano. subfolders non ha deleted_at — una
-- sezione muore col cascade della cartella — quindi si contano tutte le
-- righe della cartella madre, come prima.
--
-- Il messaggio contiene ancora la parola inglese "limit" di proposito: i
-- binari gia' in circolazione (Play vc12, iOS build 2) riconoscono il tetto
-- SOLO con msg.includes("limit") e senza quella parola mostrerebbero
-- l'errore generico. Il Task 8 toglie quel controllo dal client nuovo.
create or replace function public.enforce_subfolder_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent record;
  eff text;
  cap int;
begin
  -- Lock sulla cartella madre: serializza i creatori concorrenti e congela
  -- deleted_at rispetto a un deleteFolder parallelo.
  select user_id, deleted_at into parent
    from public.folders where id = new.folder_id for update;
  if parent is null or parent.user_id <> new.user_id then
    raise exception 'subfolder must belong to a folder of the same user'
      using errcode = 'P0001';
  end if;
  if parent.deleted_at is not null then
    raise exception 'cannot add a subfolder to a trashed folder'
      using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' or new.folder_id is distinct from old.folder_id then
    eff := coalesce(public.current_plan(new.user_id), 'free');
    cap := case eff when 'free' then 0 when 'pro' then 3 else null end;
    if cap is not null
       and (select count(*) from public.subfolders
             where folder_id = new.folder_id and id <> new.id) >= cap then
      raise exception 'section limit reached (% per folder on the % plan)', cap, eff
        using errcode = 'P0003', hint = 'plan-limit:sections';
    end if;
  end if;
  return new;
end;
$$;

-- Il trigger subfolders_enforce_rules (20260831010000_subfolders.sql:83)
-- punta gia' a questa funzione: sostituirne il corpo basta, non va ricreato.
```

- [ ] **Step 2: Scrivere la verifica in sola lettura**

Crea `supabase/verify/20260903_plans_smoke.sql`:

```sql
-- Verifica della migrazione 20260903100000_plans.sql. SOLA LETTURA.
--
-- Sul progetto remoto, DOPO che un umano ha eseguito il db push (Task 10),
-- dal worktree linkato memika-app:
--   npx supabase db query --linked -f supabase/verify/20260903_plans_smoke.sql
-- Su un database locale (richiede Docker):
--   npx supabase db query --local -f supabase/verify/20260903_plans_smoke.sql
--
-- Ogni riga deve avere ok = true.

select 'le tre colonne di piano esistono' as verifica,
       count(*) = 3 as ok
  from information_schema.columns
 where table_schema = 'public' and table_name = 'profiles'
   and column_name in ('plan', 'plan_until', 'rc_app_user_id')

union all
select 'plan e'' NOT NULL con default free',
       count(*) = 1
  from information_schema.columns
 where table_schema = 'public' and table_name = 'profiles'
   and column_name = 'plan' and is_nullable = 'NO'
   and column_default like '%free%'

union all
select 'le tre colonne NON sono aggiornabili da authenticated',
       count(*) = 0
  from information_schema.column_privileges
 where table_schema = 'public' and table_name = 'profiles'
   and grantee = 'authenticated' and privilege_type = 'UPDATE'
   and column_name in ('plan', 'plan_until', 'rc_app_user_id')

union all
select 'restano aggiornabili esattamente le sei colonne di preferenza',
       count(*) = 6
  from information_schema.column_privileges
 where table_schema = 'public' and table_name = 'profiles'
   and grantee = 'authenticated' and privilege_type = 'UPDATE'

union all
select 'current_plan non e'' eseguibile da authenticated',
       not has_function_privilege('authenticated', 'public.current_plan(uuid)', 'execute')

union all
select 'i tre trigger di piano sono attivi',
       count(*) = 3
  from pg_trigger
 where not tgisinternal
   and tgname in ('memories_enforce_plan_limit',
                  'folders_enforce_plan_limit',
                  'subfolders_enforce_rules')

union all
select 'nessun profilo con un piano fuori dai tre ammessi',
       count(*) = 0
  from public.profiles
 where plan not in ('free', 'pro', 'premium')

union all
select 'nessun piano scaduto continua a valere pro o premium',
       count(*) = 0
  from public.profiles
 where plan <> 'free'
   and plan_until is not null
   and plan_until < now()
   and public.current_plan(id) <> 'free';
```

- [ ] **Step 3: Scrivere il test funzionale locale**

Crea `supabase/verify/20260903_plans_local_test.sql`:

```sql
-- Test funzionale dei tre limiti. SOLO DATABASE LOCALE — scrive in
-- auth.users. Non eseguirlo mai sul progetto remoto.
--
--   npx supabase start
--   npx supabase db reset
--   npx supabase db query --local -f supabase/verify/20260903_plans_local_test.sql
--
-- Tutto dentro una transazione che finisce in rollback: se il file arriva
-- in fondo senza sollevare eccezioni, i limiti funzionano.

begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values (
  'aaaaaaaa-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'plan-test@example.com', 'x',
  now(), now(), now(), '{}'::jsonb, '{}'::jsonb
);

do $$
begin
  -- Il profilo nasce dal trigger handle_new_user, quindi free.
  if public.current_plan('aaaaaaaa-0000-4000-8000-000000000001') <> 'free' then
    raise exception 'un profilo nuovo dovrebbe nascere free';
  end if;
end $$;

-- 1) Cartelle: la prima passa, la seconda no.
insert into public.folders (user_id, kind, name, category, emoji)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'custom', 'Prima', 'custom', '📁');

do $$
begin
  insert into public.folders (user_id, kind, name, category, emoji)
  values ('aaaaaaaa-0000-4000-8000-000000000001', 'custom', 'Seconda', 'custom', '📁');
  raise exception 'ATTESO FALLIMENTO: la seconda cartella su free e'' passata';
exception when sqlstate 'P0005' then
  raise notice 'ok: seconda cartella bloccata (P0005)';
end $$;

-- 2) Sezioni: nessuna sul piano free.
do $$
declare fid uuid;
begin
  select id into fid from public.folders
   where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' limit 1;
  insert into public.subfolders (user_id, folder_id, name)
  values ('aaaaaaaa-0000-4000-8000-000000000001', fid, 'Sezione');
  raise exception 'ATTESO FALLIMENTO: una sezione su free e'' passata';
exception when sqlstate 'P0003' then
  raise notice 'ok: sezione bloccata (P0003)';
end $$;

-- 3) Ricordi: dieci passano, l'undicesimo no.
insert into public.memories (user_id, folder_id, term, definition)
select 'aaaaaaaa-0000-4000-8000-000000000001', f.id, 'parola ' || g, 'significato'
  from public.folders f, generate_series(1, 10) g
 where f.user_id = 'aaaaaaaa-0000-4000-8000-000000000001';

do $$
declare fid uuid;
begin
  select id into fid from public.folders
   where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' limit 1;
  insert into public.memories (user_id, folder_id, term, definition)
  values ('aaaaaaaa-0000-4000-8000-000000000001', fid, 'undicesima', 'significato');
  raise exception 'ATTESO FALLIMENTO: l''undicesimo ricordo su free e'' passato';
exception when sqlstate 'P0004' then
  raise notice 'ok: undicesimo ricordo bloccato (P0004)';
end $$;

-- 3-bis) Il cestino occupa lo slot: cestinare non libera quota.
update public.memories
   set deleted_at = now()
 where user_id = 'aaaaaaaa-0000-4000-8000-000000000001'
   and term = 'parola 1';

do $$
declare fid uuid;
begin
  select id into fid from public.folders
   where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' limit 1;
  insert into public.memories (user_id, folder_id, term, definition)
  values ('aaaaaaaa-0000-4000-8000-000000000001', fid, 'dopo il cestino', 'significato');
  raise exception 'ATTESO FALLIMENTO: cestinare un ricordo ha liberato una quota';
exception when sqlstate 'P0004' then
  raise notice 'ok: il cestino occupa lo slot (P0004)';
end $$;

-- E il ripristino, che e' una UPDATE, passa comunque: e' la meta' che
-- giustifica la scelta di contare tutto. Nessun grandfathered resta con un
-- ricordo prigioniero del cestino.
update public.memories
   set deleted_at = null
 where user_id = 'aaaaaaaa-0000-4000-8000-000000000001'
   and term = 'parola 1';

do $$
begin
  if (select count(*) from public.memories
       where user_id = 'aaaaaaaa-0000-4000-8000-000000000001'
         and deleted_at is null) <> 10 then
    raise exception 'il ripristino dal cestino non e'' andato a buon fine';
  end if;
end $$;

-- 3-ter) Un solo INSERT multi-riga non aggira il tetto. E' la superficie
-- raggiungibile con la chiave anon: PostgREST accetta un corpo array e lo
-- traduce in UN comando. Il trigger e' BEFORE ROW ma il conteggio passa da
-- SPI, che fa CommandCounterIncrement() e prende uno snapshot nuovo, quindi
-- la riga N vede le N-1 gia' inserite dallo stesso comando.
delete from public.memories
 where user_id = 'aaaaaaaa-0000-4000-8000-000000000001';

do $$
begin
  insert into public.memories (user_id, folder_id, term, definition)
  select 'aaaaaaaa-0000-4000-8000-000000000001', f.id, 'bulk ' || g, 'significato'
    from public.folders f, generate_series(1, 25) g
   where f.user_id = 'aaaaaaaa-0000-4000-8000-000000000001';
  raise exception 'ATTESO FALLIMENTO: 25 ricordi in un solo INSERT sono passati sul piano free';
exception when sqlstate 'P0004' then
  raise notice 'ok: insert multi-riga bloccato (P0004)';
end $$;

-- Ripristina lo stato "dieci ricordi" per il blocco 4.
insert into public.memories (user_id, folder_id, term, definition)
select 'aaaaaaaa-0000-4000-8000-000000000001', f.id, 'parola ' || g, 'significato'
  from public.folders f, generate_series(1, 10) g
 where f.user_id = 'aaaaaaaa-0000-4000-8000-000000000001';

-- 4) Con Pro il tetto dei ricordi sparisce e le sezioni si aprono.
update public.profiles
   set plan = 'pro', plan_until = now() + interval '30 days'
 where id = 'aaaaaaaa-0000-4000-8000-000000000001';

insert into public.memories (user_id, folder_id, term, definition)
select 'aaaaaaaa-0000-4000-8000-000000000001', f.id, 'undicesima', 'significato'
  from public.folders f
 where f.user_id = 'aaaaaaaa-0000-4000-8000-000000000001' limit 1;

insert into public.subfolders (user_id, folder_id, name)
select 'aaaaaaaa-0000-4000-8000-000000000001', f.id, 'Sezione ' || g
  from public.folders f, generate_series(1, 3) g
 where f.user_id = 'aaaaaaaa-0000-4000-8000-000000000001';

do $$
declare fid uuid;
begin
  select id into fid from public.folders
   where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' limit 1;
  insert into public.subfolders (user_id, folder_id, name)
  values ('aaaaaaaa-0000-4000-8000-000000000001', fid, 'Quarta sezione');
  raise exception 'ATTESO FALLIMENTO: la quarta sezione su pro e'' passata';
exception when sqlstate 'P0003' then
  raise notice 'ok: quarta sezione bloccata (P0003)';
end $$;

-- 5) Un piano scaduto torna free senza che nessuno faccia niente.
update public.profiles
   set plan_until = now() - interval '1 day'
 where id = 'aaaaaaaa-0000-4000-8000-000000000001';

do $$
begin
  if public.current_plan('aaaaaaaa-0000-4000-8000-000000000001') <> 'free' then
    raise exception 'un piano scaduto dovrebbe valere free';
  end if;
end $$;

rollback;
```

- [ ] **Step 4: Eseguire il test funzionale, se c'è Docker**

Questo repo non ha mai avviato un Supabase locale (`supabase/.temp` non esiste in questo worktree, e AGENTS.md §5 documenta solo `db push` verso il progetto remoto). Se Docker Desktop è in esecuzione:

```bash
npx supabase start
npx supabase db reset
npx supabase db query --local -f supabase/verify/20260903_plans_local_test.sql
npx supabase db query --local -f supabase/verify/20260903_plans_smoke.sql
```

Expected: il primo file arriva a `ROLLBACK` senza eccezioni non gestite, con sei `notice` "ok:" (seconda cartella, sezione su free, undicesimo ricordo, cestino che occupa lo slot, insert multi-riga, quarta sezione su Pro); il secondo restituisce otto righe tutte con `ok = true`.

Se il blocco 3-ter (insert multi-riga) **non** solleva `P0004`, non aggirare il problema e non proseguire: significa che il conteggio dentro il trigger BEFORE ROW non vede le righe dello stesso comando, cioè che l'assunzione documentata nel commento della migrazione è sbagliata su questa versione di Postgres. Fermati e riportalo ad Angelo — il rimedio (un secondo trigger `after insert … for each statement` che rifà il conteggio) cambia la forma della migrazione e va deciso, non improvvisato.

Se Docker non c'è, **non applicare nulla**: la verifica avviene dopo il `db push` umano del Task 10, con il solo file `_plans_smoke.sql` e `--linked`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260903100000_plans.sql supabase/verify/
git commit -F- <<'MSG'
feat(db): piani su profiles e i tre limiti applicati dai trigger

plan/plan_until/rc_app_user_id fuori dalla grant di UPDATE, current_plan()
che degrada da sola i piani scaduti, e i tetti di ricordi (P0004), cartelle
(P0005) e sezioni (P0003, ora consapevole del piano). Il grandfathering cade
fuori gratis: i trigger sono BEFORE INSERT.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
```

---

### Task 3: Edge Function `revenuecat-sync`

**Files:**
- Create: `supabase/functions/revenuecat-sync/index.ts`
- Modify: `supabase/config.toml` (in fondo)
- Modify: `supabase/.gitignore`
- Modify: `lib/plan.test.ts` (guardia sul gemello)
- Modify: `tsconfig.json:8-14` (escludere l'albero Deno dal programma TypeScript dell'app)

**Interfaces:**
- Consumes: le colonne del Task 2; la logica di `planFromRcEntitlements` del Task 1, ricopiata (Deno non può importare da `lib/`).
- Produces: `POST /functions/v1/revenuecat-sync` → `{ plan: "free"|"pro"|"premium", planUntil: string | null }`. Due modi di ingresso: `Authorization: Bearer <JWT utente>` (l'app) oppure `Authorization: <valore esatto configurato in RevenueCat>` (il webhook). In entrambi i casi l'`app_user_id` **non** viene dal payload.

- [ ] **Step 1: Scrivere la funzione**

Crea `supabase/functions/revenuecat-sync/index.ts`:

```ts
/**
 * revenuecat-sync — l'unica cosa autorizzata a scrivere profiles.plan.
 *
 * Due ingressi, una sola strada:
 *   a) l'app, con il JWT dell'utente: app_user_id = auth.uid();
 *   b) il webhook di RevenueCat, con l'header Authorization concordato:
 *      app_user_id = event.app_user_id.
 * In entrambi i casi il piano NON viene dal corpo della richiesta: si
 * ri-legge da GET /v1/subscribers/{app_user_id} con la chiave segreta. Il
 * client non e' una fonte attendibile per un permesso, e il payload di un
 * webhook nemmeno (RevenueCat stessa consiglia di richiamare la REST dopo
 * ogni evento).
 *
 * verify_jwt = false in config.toml perche' il webhook non ha un JWT; la
 * verifica del JWT la fa questa funzione con auth.getUser(token). Nessuna
 * chiave nel repo: REVENUECAT_SECRET_KEY e REVENUECAT_WEBHOOK_SECRET sono
 * secrets del progetto, SUPABASE_SERVICE_ROLE_KEY la inietta la piattaforma.
 *
 * QUESTO FILE NON PASSA DA `npm run lint`: e' Deno, non l'app. Gli
 * specificatori `npm:` e il globale `Deno` non esistono nel programma
 * TypeScript dell'app, quindi supabase/functions e' escluso in
 * tsconfig.json. Chi lo controlla e' `deno check` / il deploy della
 * funzione.
 */
import { createClient } from "npm:@supabase/supabase-js@2.106.2";

type Plan = "free" | "pro" | "premium";

const RC_SUBSCRIBERS = "https://api.revenuecat.com/v1/subscribers/";
const ENTITLEMENT_PRO = "pro";
const ENTITLEMENT_PREMIUM = "premium";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RcEntitlement = {
  expires_date: string | null;
  grace_period_expires_date?: string | null;
};

type RcSubscriberResponse = {
  request_date: string;
  subscriber: { entitlements?: Record<string, RcEntitlement | undefined> };
};

/** La scadenza dell'ACCESSO: la grazia, se c'e', altrimenti quella normale. */
function rcDeadline(ent: RcEntitlement): string | null {
  return ent.grace_period_expires_date ?? ent.expires_date ?? null;
}

function rcActive(ent: RcEntitlement, at: number): boolean {
  const deadline = rcDeadline(ent);
  if (deadline === null) return true;
  const ts = Date.parse(deadline);
  return Number.isNaN(ts) ? false : ts > at;
}

/**
 * gemello di lib/plan.ts planFromRcEntitlements — Deno non puo' importare
 * da lib/, quindi la funzione e' ricopiata. Se cambi una delle due, cambia
 * l'altra e il test lib/plan.test.ts.
 *
 * planUntil e' la scadenza dell'ACCESSO, non quella di fatturazione: durante
 * il periodo di grazia vale la grace_period_expires_date, altrimenti
 * current_plan() degraderebbe a free un abbonato in billing-retry nel
 * momento esatto in cui la grazia dovrebbe proteggerlo.
 */
function planFromRcEntitlements(
  entitlements: Record<string, RcEntitlement | undefined>,
  requestDate: string,
): { plan: Plan; planUntil: string | null } {
  const parsed = Date.parse(requestDate);
  const at = Number.isNaN(parsed) ? Date.now() : parsed;
  const premium = entitlements[ENTITLEMENT_PREMIUM];
  if (premium && rcActive(premium, at)) {
    return { plan: "premium", planUntil: rcDeadline(premium) };
  }
  const pro = entitlements[ENTITLEMENT_PRO];
  if (pro && rcActive(pro, at)) {
    return { plan: "pro", planUntil: rcDeadline(pro) };
  }
  return { plan: "free", planUntil: null };
}

/** Confronto a tempo costante: l'header del webhook e' un segreto. */
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const rcKey = Deno.env.get("REVENUECAT_SECRET_KEY") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!rcKey || !supabaseUrl || !serviceKey) {
    console.error("revenuecat-sync: secrets mancanti");
    return json({ error: "not_configured" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const authHeader = req.headers.get("Authorization") ?? "";
  const webhookSecret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET") ?? "";
  const isWebhook = webhookSecret.length > 0 && safeEqual(authHeader, webhookSecret);

  let appUserId: string;
  if (isWebhook) {
    let payload: { event?: { type?: string; app_user_id?: string } };
    try {
      payload = (await req.json()) as typeof payload;
    } catch {
      return json({ error: "bad_json" }, 400);
    }
    const event = payload.event;
    // 200 e non un errore: RevenueCat riprova cinque volte su tutto cio'
    // che non e' 2xx, e questi tre casi non migliorano riprovando.
    if (!event?.app_user_id) return json({ ok: true, ignored: "no_app_user_id" }, 200);
    if (event.type === "TEST") return json({ ok: true, ignored: "test_event" }, 200);
    if (!UUID_RE.test(event.app_user_id)) {
      // $RCAnonymousID:… — un acquisto non ancora legato a un account.
      return json({ ok: true, ignored: "anonymous_app_user_id" }, 200);
    }
    appUserId = event.app_user_id;
  } else {
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return json({ error: "unauthorized" }, 401);
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) return json({ error: "unauthorized" }, 401);
    appUserId = data.user.id;
  }

  // ATTENZIONE: questa GET CREA il subscriber se non esiste ("Get or Create
  // Customer"). Va chiamata solo con un id verificato — mai con uno preso
  // dal corpo di una richiesta non autenticata.
  const rcRes = await fetch(`${RC_SUBSCRIBERS}${encodeURIComponent(appUserId)}`, {
    headers: { Authorization: `Bearer ${rcKey}`, "Content-Type": "application/json" },
  });
  if (!rcRes.ok) {
    console.error(`revenuecat-sync: RevenueCat ha risposto ${rcRes.status}`);
    // 502 anche per il webhook: qui riprovare ha senso.
    return json({ error: "revenuecat_unavailable" }, 502);
  }
  const body = (await rcRes.json()) as RcSubscriberResponse;
  const { plan, planUntil } = planFromRcEntitlements(
    body.subscriber?.entitlements ?? {},
    body.request_date,
  );

  const { data: updated, error: updateError } = await admin
    .from("profiles")
    .update({ plan, plan_until: planUntil, rc_app_user_id: appUserId })
    .eq("id", appUserId)
    .select("id");
  if (updateError) {
    console.error("revenuecat-sync: scrittura fallita", updateError.message);
    return json({ error: "write_failed" }, 500);
  }
  if (!updated || updated.length === 0) {
    // Nessun profilo con quell'id: account cancellato, o un app_user_id che
    // non e' mai stato nostro. Riprovare non lo fara' comparire.
    return isWebhook
      ? json({ ok: true, ignored: "no_profile" }, 200)
      : json({ error: "no_profile" }, 404);
  }

  return json({ plan, planUntil }, 200);
});
```

- [ ] **Step 2: Dichiarare la funzione e proteggere il suo `.env`**

In fondo a `supabase/config.toml` aggiungi:

```toml
[functions.revenuecat-sync]
# Il webhook di RevenueCat non porta un JWT: la verifica la fa la funzione,
# che accetta o l'header segreto del webhook o un access token utente
# validato con auth.getUser(). Vedi supabase/functions/revenuecat-sync/index.ts.
verify_jwt = false
```

In fondo a `supabase/.gitignore` aggiungi:

```
# Secrets locali delle edge function (supabase functions serve --env-file)
functions/.env
```

- [ ] **Step 3: Guardia contro la divergenza dal gemello**

Aggiungi in fondo a `lib/plan.test.ts`:

```ts
describe("il gemello Deno della derivazione RevenueCat", () => {
  it("dichiara di essere un gemello e ordina premium prima di pro", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("supabase/functions/revenuecat-sync/index.ts", "utf8");
    expect(src).toContain("gemello di lib/plan.ts planFromRcEntitlements");
    expect(src.indexOf("ENTITLEMENT_PREMIUM]")).toBeLessThan(src.indexOf("ENTITLEMENT_PRO]"));
  });
});
```

Run: `npm test -- lib/plan.test.ts`
Expected: PASS (vitest gira dalla root del repo, quindi il path relativo risolve).

- [ ] **Step 4: Escludere l'albero Deno dal programma TypeScript dell'app**

`npm run lint` è `tsc --noEmit`, e il `tsconfig.json` di questo repo raccoglie `**/*.ts` **senza alcun `exclude` proprio**: la funzione appena creata finisce dentro il programma dell'app e lo fa fallire. Verificato in questo worktree con un file di prova che conteneva la stessa riga di import e `Deno.serve` / `Deno.env.get`:

```
supabase/functions/_tsprobe/index.ts(1,30): error TS2307: Cannot find module 'npm:@supabase/supabase-js@2.106.2' or its corresponding type declarations.
supabase/functions/_tsprobe/index.ts(2,1): error TS2304: Cannot find name 'Deno'.
```

Senza questo passo ogni `npm run lint` da qui in avanti (Task 4, 6, 7, 8) fallisce.

Sostituisci l'intero `tsconfig.json` con:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": [
    "**/*.ts",
    "**/*.tsx",
    ".expo/types/**/*.ts",
    "expo-env.d.ts",
    "nativewind-env.d.ts"
  ],
  "exclude": [
    "node_modules",
    "babel.config.js",
    "metro.config.js",
    "jest.config.js",
    "android",
    "ios",
    "supabase/functions"
  ]
}
```

Le prime sei voci di `exclude` sono quelle di `expo/tsconfig.base` (`node_modules/expo/tsconfig.base.json:20`) e vanno **ripetute**: un `exclude` nel file figlio non si somma a quello della base, la sostituisce.

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 5: Provare la funzione in locale — passo con prerequisiti**

Serve Docker e una chiave `sk_` vera di RevenueCat: finché il progetto RevenueCat non esiste (Task 10) questo passo si salta e si annota come non eseguito.

```bash
mkdir -p supabase/functions
printf 'REVENUECAT_SECRET_KEY=sk_xxx\nREVENUECAT_WEBHOOK_SECRET=un-valore-lungo-a-caso\n' > supabase/functions/.env
npx supabase start
npx supabase functions serve revenuecat-sync --env-file supabase/functions/.env
```

In un altro terminale — chiamata "app" (JWT di un utente vero, preso da una sessione di sviluppo):

```bash
curl -i -X POST http://127.0.0.1:54321/functions/v1/revenuecat-sync \
  -H "Authorization: Bearer <ACCESS_TOKEN_UTENTE>" \
  -H "Content-Type: application/json" -d '{}'
```

Expected: `200` con `{"plan":"free","planUntil":null}` per un utente senza acquisti.

Chiamata "webhook":

```bash
curl -i -X POST http://127.0.0.1:54321/functions/v1/revenuecat-sync \
  -H "Authorization: un-valore-lungo-a-caso" \
  -H "Content-Type: application/json" \
  -d '{"api_version":"1.0","event":{"type":"INITIAL_PURCHASE","id":"evt_1","app_user_id":"<UUID_UTENTE>","entitlement_ids":["pro"]}}'
```

Expected: `200` con il piano ri-letto da RevenueCat (non quello dichiarato nel payload).

Header sbagliato e senza JWT:

```bash
curl -i -X POST http://127.0.0.1:54321/functions/v1/revenuecat-sync \
  -H "Authorization: valore-sbagliato" -d '{}'
```

Expected: `401 {"error":"unauthorized"}`.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/revenuecat-sync/index.ts supabase/config.toml supabase/.gitignore lib/plan.test.ts tsconfig.json
git commit -F- <<'MSG'
feat(functions): revenuecat-sync verifica l'abbonamento e scrive il piano

Due ingressi (JWT dell'app, webhook di RevenueCat) e una sola strada: in
entrambi i casi l'app_user_id viene da una fonte verificata e il piano si
rilegge da GET /v1/subscribers con la chiave segreta. supabase/functions
esce dal programma di tsc: e' Deno, non l'app. Il deploy e i secrets sono
passi umani (checklist).

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
```

---

### Task 4: Il piano arriva al client

**Files:**
- Modify: `lib/mappers.ts:21-68` (`ProfileRow`, `Profile`, `mapProfile`)
- Modify: `lib/auth-store.ts:17-22` (`AuthUser`), `:77-79` (tipo dello store), `:104-117` (`DEMO_ACCOUNTS`), `:146-163` (`buildAuthUserFromSession`), `:252-262` (accanto a `setUserName`), `:349-365` (utente demo)
- Modify: `lib/api.ts` (accanto a `countMemoriesInFolder`, e accanto ai wrapper `rpc` a riga 127-151)
- Create: `lib/mappers.plan.test.ts`

**Interfaces:**
- Consumes: `Plan`, `effectivePlan` da `@/lib/plan`.
- Produces:
  - `Profile.plan: Plan`, `Profile.planUntil: string | null`, `Profile.rcAppUserId: string | null`
  - `AuthUser.plan: Plan`, `AuthUser.planUntil: string | null`, `useAuthStore().setPlan(plan: Plan, planUntil: string | null): void`
  - `countMemories(userId: string): Promise<number>` — **tutti** i ricordi dell'utente, cestino compreso: stesso predicato del trigger
  - `syncPlan(): Promise<{ plan: Plan; planUntil: string | null }>`

- [ ] **Step 1: Scrivere il test che fallisce**

Crea `lib/mappers.plan.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { mapProfile, type ProfileRow } from "./mappers";

const row = (over: Partial<ProfileRow> = {}): ProfileRow => ({
  id: "u1",
  email: "angelo@example.com",
  name: "Angelo",
  role: "user",
  daily_input_cap: 20,
  calm_mode: true,
  weekly_digest: false,
  morning_review_at: "08:00:00",
  evening_review_at: "21:30:00",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...over,
});

describe("mapProfile — le colonne di piano", () => {
  it("porta piano, scadenza e app user id sul modello camelCase", () => {
    const p = mapProfile(
      row({
        plan: "pro",
        plan_until: "2026-12-01T00:00:00.000Z",
        rc_app_user_id: "u1",
      }),
    );
    expect(p.plan).toBe("pro");
    expect(p.planUntil).toBe("2026-12-01T00:00:00.000Z");
    expect(p.rcAppUserId).toBe("u1");
  });

  it("una riga senza le colonne (client vecchio, demo) vale free", () => {
    const p = mapProfile(row());
    expect(p.plan).toBe("free");
    expect(p.planUntil).toBeNull();
    expect(p.rcAppUserId).toBeNull();
  });

  it("non si fida di un valore fuori dai tre piani", () => {
    const p = mapProfile(row({ plan: "platinum" as never }));
    expect(p.plan).toBe("free");
  });
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `npm test -- lib/mappers.plan.test.ts`
Expected: FAIL — `plan` non esiste su `Profile`.

- [ ] **Step 3: Estendere i mappers**

In `lib/mappers.ts`, aggiungi l'import in cima al file:

```ts
import { PLANS, type Plan } from "./plan";
```

In `ProfileRow` (dopo `evening_review_at`, riga 30):

```ts
  /** Piano acquistato (migration 20260903100000). Assente sulle righe lette da client vecchi. */
  plan?: string | null;
  plan_until?: string | null;
  rc_app_user_id?: string | null;
```

In `Profile` (dopo `eveningReviewAt`, riga 46):

```ts
  /** Piano SCRITTO a DB. Per sapere cosa vale adesso passa da effectivePlan(). */
  plan: Plan;
  planUntil: string | null;
  rcAppUserId: string | null;
```

In `mapProfile`, dopo `eveningReviewAt: row.evening_review_at,`:

```ts
    plan: (PLANS as readonly string[]).includes(row.plan ?? "") ? (row.plan as Plan) : "free",
    planUntil: row.plan_until ?? null,
    rcAppUserId: row.rc_app_user_id ?? null,
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

Run: `npm test -- lib/mappers.plan.test.ts`
Expected: PASS.

- [ ] **Step 5: Portare il piano nello store di autenticazione**

In `lib/auth-store.ts`:

1. Import in cima, accanto agli altri:

```ts
import { PLANS, type Plan } from "./plan";
```

2. `AuthUser` (riga 17-22) diventa:

```ts
export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  /**
   * Piano scritto a DB. NON e' il piano che vale adesso: passa sempre da
   * effectivePlan(plan, planUntil) (lib/plan.ts) o da usePlan().
   * Come `role`, arriva SOLO dal database — mai dedotto dal client.
   */
  plan: Plan;
  planUntil: string | null;
};
```

3. Nel tipo `AuthState`, accanto a `setUserName` (riga 79):

```ts
  /** Aggiorna il piano dopo una sincronizzazione con RevenueCat. */
  setPlan: (plan: Plan, planUntil: string | null) => void;
```

4. `buildAuthUserFromSession` (righe 146-163): la select e il ritorno.

```ts
  const { data: profile, error } = await supabase
    .from("profiles")
    // select("*") e non l'elenco delle colonne: la build 3 arriva sugli
    // store PRIMA che la migrazione dei piani sia applicata (e' l'ordine
    // imposto dalla checklist, Task 10 Step 3), e un select che nomina
    // `plan` fallirebbe con SQLSTATE 42703 portandosi via anche role e
    // name — l'admin perderebbe la shell di amministrazione e il nome
    // tornerebbe a quello derivato dall'email. Stessa scelta di
    // fetchProfile (lib/api.ts:62-71).
    .select("*")
    .eq("id", u.id)
    .maybeSingle();

  if (error) reportError("auth/profile-lookup", error);

  const role: UserRole = profile?.role === "admin" ? "admin" : "user";
  // Stesso principio del ruolo: il piano viene dal database e in mancanza
  // di risposta si degrada, mai si concede.
  const rawPlan = typeof profile?.plan === "string" ? profile.plan : "free";
  const plan: Plan = (PLANS as readonly string[]).includes(rawPlan) ? (rawPlan as Plan) : "free";
  const planUntil = typeof profile?.plan_until === "string" ? profile.plan_until : null;
  const name =
    (typeof profile?.name === "string" && profile.name) ||
    safeMetaName(u.user_metadata) ||
    deriveName(email);

  return { id: u.id, email, name, role, plan, planUntil };
```

5. Implementazione di `setPlan`, subito dopo `setUserName` (riga 262):

```ts
  setPlan: (plan, planUntil) => {
    const user = get().user;
    if (!user) return;
    const next = { ...user, plan, planUntil };
    set({ user: next });
    if (!isSupabaseConfigured) {
      void AsyncStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    }
  },
```

6. Utente demo in `signIn` (riga 356-361). La demo non deve mai incontrare un paywall che non può pagare:

```ts
        const user: AuthUser = {
          id: `demo-${match.role}`,
          email: match.email,
          name: match.name,
          role: match.role,
          // La modalita' demo non ha backend ne' store: nessun limite di
          // piano ha senso li' dentro. Il paywall resta visitabile da
          // Impostazioni, con i bottoni disattivati.
          plan: "premium",
          planUntil: null,
        };
```

Nota per chi sviluppa: una sessione demo salvata **prima** di questa modifica
è in AsyncStorage senza `plan`, quindi al primo avvio dopo l'aggiornamento
vale free (`effectivePlan(undefined)`). Basta uscire e rientrare dall'account
demo. Non riguarda i binari veri, dove l'utente si ricostruisce sempre dal
profilo.

- [ ] **Step 6: Le due funzioni nuove di `lib/api.ts`**

Import in cima al file, accanto agli altri:

```ts
import type { Plan } from "./plan";
```

Subito dopo `countMemoriesInFolder` (riga 487-496):

```ts
/**
 * Quanti ricordi possiede l'utente, in tutto — CESTINO COMPRESO. E' lo
 * specchio esatto del trigger memories_enforce_plan_limit: stesso predicato
 * (solo user_id), nessun filtro su deleted_at e nessuno sulle cartelle in
 * pausa. La pausa e' carico, non proprieta'; il cestino occupa lo slot
 * finche' la purga a 24 ore non se lo porta via, altrimenti il ripristino
 * (che e' una UPDATE) aggirerebbe il tetto.
 * NON riusare countFolders / countMemoriesInFolder: quelli contano le sole
 * righe vive, predicato diverso.
 * Demo: zero, tanto la demo e' premium.
 */
export async function countMemories(userId: string): Promise<number> {
  if (isDemoMode) return 0;
  const { count, error } = await supabase
    .from("memories")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) throw error;
  return count ?? 0;
}
```

Accanto ai wrapper `rpc` (dopo `cancelAccountDeletion`, riga 151):

```ts
/**
 * Chiede al server di rileggere l'abbonamento da RevenueCat e di riscrivere
 * profiles.plan. Il client non puo' scriverlo (le colonne non sono nella
 * grant) e non deve: l'entitlement dell'SDK e' una lettura locale, la
 * edge function lo verifica con l'API REST prima di fidarsi.
 * Demo: premium, senza rete.
 */
export async function syncPlan(): Promise<{ plan: Plan; planUntil: string | null }> {
  if (isDemoMode) return { plan: "premium", planUntil: null };
  const { data, error } = await supabase.functions.invoke<{
    plan: Plan;
    planUntil: string | null;
  }>("revenuecat-sync", { method: "POST", body: {} });
  if (error) throw error;
  return { plan: data?.plan ?? "free", planUntil: data?.planUntil ?? null };
}
```

- [ ] **Step 7: Typecheck, test e commit**

```bash
npm run lint
npm test
git add lib/mappers.ts lib/mappers.plan.test.ts lib/auth-store.ts lib/api.ts
git commit -F- <<'MSG'
feat(plan): il piano viaggia col profilo e con l'utente autenticato

plan/plan_until entrano nei mappers e in AuthUser (letti dal database come
role, mai dedotti), piu' countMemories per lo specchio del tetto free e
syncPlan che chiama la edge function.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
```

---

### Task 5: La copy — quattro cataloghi

**Files:**
- Modify: `lib/i18n/it.ts`, `lib/i18n/en.ts`, `lib/i18n/fr.ts`, `lib/i18n/es.ts`

**Interfaces:**
- Consumes: niente. Non dipende da nessun altro task.
- Produces: le chiavi `plan.*`, `paywall.*`, `planLimit.*`, le nuove `settings.*` e le due nuove `add.*`, usate dai Task 6, 7 e 8. Riscrive inoltre `chooseTopic.subtitleLimitEnforced`, che oggi manda l'utente free verso il piano sbagliato.

**Questo task viene PRIMA di quello sull'SDK, e non è un dettaglio d'ordine.** `TKey = keyof typeof it` (`lib/i18n/index.ts:32`): finché le chiavi `plan.free` / `plan.pro` / `plan.premium` non esistono nel catalogo italiano, la `PLAN_NAME_KEY: Record<Plan, TKey>` del Task 6 non compila e il suo `npm run lint` non può passare.

Le chiavi vanno inserite nella sezione alfabetica corrispondente di ogni catalogo (`add.*` con le altre `add.`, `settings.*` con le altre `settings.`); `plan.*`, `paywall.*` e `planLimit.*` sono blocchi nuovi, da mettere fra le sezioni esistenti in ordine alfabetico. I `{segnaposto}` devono essere identici in tutte e quattro le lingue o `lib/i18n/i18n.test.ts` fallisce.

- [ ] **Step 1: `lib/i18n/it.ts`**

```ts
  // ---- add (aggiunte) ------------------------------------------------------
  "add.totalCounter": "{count} / {max} ricordi in tutto",
  "add.totalLimitReached": "Hai usato i {max} ricordi del piano Free.",

  // ---- plan (nomi dei piani, usati ovunque) --------------------------------
  "plan.free": "Free",
  "plan.pro": "Pro",
  "plan.premium": "Premium",

  // ---- planLimit (la mascotte spiega e propone) ----------------------------
  "planLimit.memoriesTitle": "Dieci ricordi, per ora",
  "planLimit.memoriesBody": "Il piano Free ne tiene dieci in tutto, cestino compreso: un ricordo eliminato occupa il suo posto finché non viene ripulito. Con Pro diventano illimitati, e le cartelle passano da una a cinque.",
  "planLimit.foldersTitleFree": "Una cartella sola",
  "planLimit.foldersBodyFree": "Il piano Free ne tiene una. Pro ne tiene cinque, Premium quante ne vuoi.",
  "planLimit.foldersTitlePro": "Cinque cartelle piene",
  "planLimit.foldersBodyPro": "Cinque è il tetto di Pro. Con Premium le cartelle sono illimitate.",
  "planLimit.sectionsTitleFree": "Le sezioni arrivano con Pro",
  "planLimit.sectionsBodyFree": "Le sezioni dividono una cartella in parti. Con Pro ne hai tre per cartella, con Premium quante vuoi.",
  "planLimit.sectionsTitlePro": "Tre sezioni per cartella",
  "planLimit.sectionsBodyPro": "Tre è il tetto di Pro. Con Premium le sezioni sono illimitate.",
  "planLimit.seePlans": "Vedi i piani",
  "planLimit.notNow": "Non ora",

  // ---- paywall -------------------------------------------------------------
  "paywall.title": "Scegli il tuo piano",
  "paywall.subtitle": "Memika resta calmo con qualsiasi piano. Cambia solo quanto puoi tenerci dentro.",
  "paywall.currentBadge": "Piano attuale",
  "paywall.freeMemories": "10 ricordi in tutto",
  "paywall.freeFolders": "1 cartella",
  "paywall.freeSections": "Nessuna sezione",
  "paywall.proMemories": "Ricordi illimitati",
  "paywall.proFolders": "5 cartelle",
  "paywall.proSections": "3 sezioni per cartella",
  "paywall.premiumMemories": "Ricordi illimitati",
  "paywall.premiumFolders": "Cartelle illimitate",
  "paywall.premiumSections": "Sezioni illimitate",
  "paywall.premiumPhotos": "Foto sui ricordi",
  "paywall.chooseCta": "Passa a {plan}",
  "paywall.monthlyPrice": "{price} al mese",
  "paywall.yearlyPrice": "{price} all'anno",
  "paywall.loadingPrices": "Carico i prezzi…",
  "paywall.noPrices": "Prezzi non disponibili in questo momento.",
  "paywall.unavailable": "Gli acquisti non sono disponibili su questo dispositivo.",
  "paywall.demoNotice": "Modalità demo: gli acquisti sono disattivati.",
  "paywall.restore": "Ripristina acquisti",
  "paywall.restored": "Acquisti ripristinati: piano {plan}.",
  "paywall.restoreNone": "Nessun acquisto da ripristinare su questo account.",
  "paywall.restoreFailed": "Ripristino non riuscito. Riprova.",
  "paywall.purchased": "Ora sei {plan}. Buon ripasso.",
  "paywall.purchasePending": "Pagamento in attesa: il piano si attiva appena viene confermato.",
  "paywall.purchaseFailed": "Acquisto non riuscito. Riprova.",
  "paywall.legal": "Abbonamento con rinnovo automatico. Si rinnova al prezzo indicato finché non lo disdici dalle impostazioni dello store, almeno 24 ore prima della scadenza.",

  // ---- settings (aggiunte) -------------------------------------------------
  "settings.subscriptionSection": "Abbonamento",
  "settings.planLabel": "Piano",
  "settings.planHint": "Quanto puoi tenere dentro Memika.",
  "settings.seePlans": "Vedi i piani",
  "settings.upgrade": "Passa a Pro",
  "settings.upgradePremium": "Passa a Premium",
  "settings.restorePurchases": "Ripristina acquisti",
  "settings.restorePurchasesHint": "Se hai già un abbonamento su questo store.",
```

- [ ] **Step 2: `lib/i18n/en.ts`**

```ts
  "add.totalCounter": "{count} / {max} memories in total",
  "add.totalLimitReached": "You have used the {max} memories of the Free plan.",

  "plan.free": "Free",
  "plan.pro": "Pro",
  "plan.premium": "Premium",

  "planLimit.memoriesTitle": "Ten memories, for now",
  "planLimit.memoriesBody": "The Free plan holds ten in total, trash included: a deleted memory keeps its slot until it is cleared. With Pro they become unlimited, and folders go from one to five.",
  "planLimit.foldersTitleFree": "One folder only",
  "planLimit.foldersBodyFree": "The Free plan holds one. Pro holds five, Premium as many as you like.",
  "planLimit.foldersTitlePro": "Five folders, all taken",
  "planLimit.foldersBodyPro": "Five is the Pro ceiling. With Premium folders are unlimited.",
  "planLimit.sectionsTitleFree": "Sections come with Pro",
  "planLimit.sectionsBodyFree": "Sections split a folder into parts. Pro gives you three per folder, Premium as many as you like.",
  "planLimit.sectionsTitlePro": "Three sections per folder",
  "planLimit.sectionsBodyPro": "Three is the Pro ceiling. With Premium sections are unlimited.",
  "planLimit.seePlans": "See the plans",
  "planLimit.notNow": "Not now",

  "paywall.title": "Choose your plan",
  "paywall.subtitle": "Memika stays calm on any plan. Only how much you can keep in it changes.",
  "paywall.currentBadge": "Current plan",
  "paywall.freeMemories": "10 memories in total",
  "paywall.freeFolders": "1 folder",
  "paywall.freeSections": "No sections",
  "paywall.proMemories": "Unlimited memories",
  "paywall.proFolders": "5 folders",
  "paywall.proSections": "3 sections per folder",
  "paywall.premiumMemories": "Unlimited memories",
  "paywall.premiumFolders": "Unlimited folders",
  "paywall.premiumSections": "Unlimited sections",
  "paywall.premiumPhotos": "Photos on memories",
  "paywall.chooseCta": "Go {plan}",
  "paywall.monthlyPrice": "{price} per month",
  "paywall.yearlyPrice": "{price} per year",
  "paywall.loadingPrices": "Loading prices…",
  "paywall.noPrices": "Prices are not available right now.",
  "paywall.unavailable": "Purchases are not available on this device.",
  "paywall.demoNotice": "Demo mode: purchases are disabled.",
  "paywall.restore": "Restore purchases",
  "paywall.restored": "Purchases restored: {plan} plan.",
  "paywall.restoreNone": "No purchases to restore on this account.",
  "paywall.restoreFailed": "Restore failed. Try again.",
  "paywall.purchased": "You are {plan} now. Enjoy your reviews.",
  "paywall.purchasePending": "Payment pending: the plan starts as soon as it is confirmed.",
  "paywall.purchaseFailed": "Purchase failed. Try again.",
  "paywall.legal": "Auto-renewing subscription. It renews at the price shown until you cancel it in your store settings, at least 24 hours before it expires.",

  "settings.subscriptionSection": "Subscription",
  "settings.planLabel": "Plan",
  "settings.planHint": "How much you can keep inside Memika.",
  "settings.seePlans": "See the plans",
  "settings.upgrade": "Go Pro",
  "settings.upgradePremium": "Go Premium",
  "settings.restorePurchases": "Restore purchases",
  "settings.restorePurchasesHint": "If you already subscribed on this store.",
```

- [ ] **Step 3: `lib/i18n/fr.ts`**

```ts
  "add.totalCounter": "{count} / {max} souvenirs au total",
  "add.totalLimitReached": "Tu as utilisé les {max} souvenirs du plan Free.",

  "plan.free": "Free",
  "plan.pro": "Pro",
  "plan.premium": "Premium",

  "planLimit.memoriesTitle": "Dix souvenirs, pour l'instant",
  "planLimit.memoriesBody": "Le plan Free en garde dix au total, corbeille comprise : un souvenir supprimé garde sa place jusqu'au nettoyage. Avec Pro ils deviennent illimités, et les dossiers passent de un à cinq.",
  "planLimit.foldersTitleFree": "Un seul dossier",
  "planLimit.foldersBodyFree": "Le plan Free en garde un. Pro en garde cinq, Premium autant que tu veux.",
  "planLimit.foldersTitlePro": "Cinq dossiers, tous pris",
  "planLimit.foldersBodyPro": "Cinq est le plafond de Pro. Avec Premium les dossiers sont illimités.",
  "planLimit.sectionsTitleFree": "Les sections arrivent avec Pro",
  "planLimit.sectionsBodyFree": "Les sections divisent un dossier en parties. Pro t'en donne trois par dossier, Premium autant que tu veux.",
  "planLimit.sectionsTitlePro": "Trois sections par dossier",
  "planLimit.sectionsBodyPro": "Trois est le plafond de Pro. Avec Premium les sections sont illimitées.",
  "planLimit.seePlans": "Voir les plans",
  "planLimit.notNow": "Pas maintenant",

  "paywall.title": "Choisis ton plan",
  "paywall.subtitle": "Memika reste calme avec n'importe quel plan. Seule change la quantité que tu peux y garder.",
  "paywall.currentBadge": "Plan actuel",
  "paywall.freeMemories": "10 souvenirs au total",
  "paywall.freeFolders": "1 dossier",
  "paywall.freeSections": "Aucune section",
  "paywall.proMemories": "Souvenirs illimités",
  "paywall.proFolders": "5 dossiers",
  "paywall.proSections": "3 sections par dossier",
  "paywall.premiumMemories": "Souvenirs illimités",
  "paywall.premiumFolders": "Dossiers illimités",
  "paywall.premiumSections": "Sections illimitées",
  "paywall.premiumPhotos": "Photos sur les souvenirs",
  "paywall.chooseCta": "Passer à {plan}",
  "paywall.monthlyPrice": "{price} par mois",
  "paywall.yearlyPrice": "{price} par an",
  "paywall.loadingPrices": "Chargement des prix…",
  "paywall.noPrices": "Les prix ne sont pas disponibles pour le moment.",
  "paywall.unavailable": "Les achats ne sont pas disponibles sur cet appareil.",
  "paywall.demoNotice": "Mode démo : les achats sont désactivés.",
  "paywall.restore": "Restaurer les achats",
  "paywall.restored": "Achats restaurés : plan {plan}.",
  "paywall.restoreNone": "Aucun achat à restaurer sur ce compte.",
  "paywall.restoreFailed": "La restauration a échoué. Réessaie.",
  "paywall.purchased": "Tu es {plan} maintenant. Bonnes révisions.",
  "paywall.purchasePending": "Paiement en attente : le plan s'active dès qu'il est confirmé.",
  "paywall.purchaseFailed": "L'achat a échoué. Réessaie.",
  "paywall.legal": "Abonnement à renouvellement automatique. Il se renouvelle au prix indiqué jusqu'à ce que tu le résilies dans les réglages du store, au moins 24 heures avant l'échéance.",

  "settings.subscriptionSection": "Abonnement",
  "settings.planLabel": "Plan",
  "settings.planHint": "Ce que tu peux garder dans Memika.",
  "settings.seePlans": "Voir les plans",
  "settings.upgrade": "Passer à Pro",
  "settings.upgradePremium": "Passer à Premium",
  "settings.restorePurchases": "Restaurer les achats",
  "settings.restorePurchasesHint": "Si tu as déjà un abonnement sur ce store.",
```

- [ ] **Step 4: `lib/i18n/es.ts`**

```ts
  "add.totalCounter": "{count} / {max} recuerdos en total",
  "add.totalLimitReached": "Has usado los {max} recuerdos del plan Free.",

  "plan.free": "Free",
  "plan.pro": "Pro",
  "plan.premium": "Premium",

  "planLimit.memoriesTitle": "Diez recuerdos, por ahora",
  "planLimit.memoriesBody": "El plan Free guarda diez en total, papelera incluida: un recuerdo eliminado ocupa su sitio hasta que se limpia. Con Pro son ilimitados, y las carpetas pasan de una a cinco.",
  "planLimit.foldersTitleFree": "Una sola carpeta",
  "planLimit.foldersBodyFree": "El plan Free guarda una. Pro guarda cinco, Premium las que quieras.",
  "planLimit.foldersTitlePro": "Cinco carpetas, todas ocupadas",
  "planLimit.foldersBodyPro": "Cinco es el techo de Pro. Con Premium las carpetas son ilimitadas.",
  "planLimit.sectionsTitleFree": "Las secciones llegan con Pro",
  "planLimit.sectionsBodyFree": "Las secciones dividen una carpeta en partes. Pro te da tres por carpeta, Premium las que quieras.",
  "planLimit.sectionsTitlePro": "Tres secciones por carpeta",
  "planLimit.sectionsBodyPro": "Tres es el techo de Pro. Con Premium las secciones son ilimitadas.",
  "planLimit.seePlans": "Ver los planes",
  "planLimit.notNow": "Ahora no",

  "paywall.title": "Elige tu plan",
  "paywall.subtitle": "Memika sigue tranquila con cualquier plan. Solo cambia cuánto puedes guardar dentro.",
  "paywall.currentBadge": "Plan actual",
  "paywall.freeMemories": "10 recuerdos en total",
  "paywall.freeFolders": "1 carpeta",
  "paywall.freeSections": "Sin secciones",
  "paywall.proMemories": "Recuerdos ilimitados",
  "paywall.proFolders": "5 carpetas",
  "paywall.proSections": "3 secciones por carpeta",
  "paywall.premiumMemories": "Recuerdos ilimitados",
  "paywall.premiumFolders": "Carpetas ilimitadas",
  "paywall.premiumSections": "Secciones ilimitadas",
  "paywall.premiumPhotos": "Fotos en los recuerdos",
  "paywall.chooseCta": "Pasar a {plan}",
  "paywall.monthlyPrice": "{price} al mes",
  "paywall.yearlyPrice": "{price} al año",
  "paywall.loadingPrices": "Cargando los precios…",
  "paywall.noPrices": "Los precios no están disponibles ahora mismo.",
  "paywall.unavailable": "Las compras no están disponibles en este dispositivo.",
  "paywall.demoNotice": "Modo demo: las compras están desactivadas.",
  "paywall.restore": "Restaurar compras",
  "paywall.restored": "Compras restauradas: plan {plan}.",
  "paywall.restoreNone": "No hay compras que restaurar en esta cuenta.",
  "paywall.restoreFailed": "No se pudo restaurar. Inténtalo de nuevo.",
  "paywall.purchased": "Ya eres {plan}. Buen repaso.",
  "paywall.purchasePending": "Pago pendiente: el plan se activa en cuanto se confirme.",
  "paywall.purchaseFailed": "No se pudo completar la compra. Inténtalo de nuevo.",
  "paywall.legal": "Suscripción con renovación automática. Se renueva al precio indicado hasta que la canceles en los ajustes de la tienda, al menos 24 horas antes del vencimiento.",

  "settings.subscriptionSection": "Suscripción",
  "settings.planLabel": "Plan",
  "settings.planHint": "Cuánto puedes guardar dentro de Memika.",
  "settings.seePlans": "Ver los planes",
  "settings.upgrade": "Pasar a Pro",
  "settings.upgradePremium": "Pasar a Premium",
  "settings.restorePurchases": "Restaurar compras",
  "settings.restorePurchasesHint": "Si ya tienes una suscripción en esta tienda.",
```

- [ ] **Step 5: Riscrivere una chiave che ora manda al piano sbagliato**

`chooseTopic.subtitleLimitEnforced` esiste già (`lib/i18n/it.ts:251` e la riga omologa 251 di `en.ts`, `fr.ts`, `es.ts`) e dice che le altre cartelle "arriveranno con **Premium**". Col modello a tre piani la seconda cartella arriva con **Pro**: è la schermata in cui l'utente free incontra il limite, e indirizzarlo al piano sbagliato lì è il momento peggiore per farlo. Nessun `{segnaposto}` è coinvolto, quindi la parità non cambia.

`lib/i18n/it.ts:251`:

```ts
  "chooseTopic.subtitleLimitEnforced": "Memika parte da una cartella sola: quella che vuoi proteggere dall'oblio. Con Pro ne tieni cinque, con Premium quante vuoi.",
```

`lib/i18n/en.ts:251`:

```ts
  "chooseTopic.subtitleLimitEnforced": "Memika starts with a single folder: the one you want to protect from being forgotten. With Pro you keep five, with Premium as many as you like.",
```

`lib/i18n/fr.ts:251`:

```ts
  "chooseTopic.subtitleLimitEnforced": "Memika commence avec un seul dossier : celui que tu veux protéger de l'oubli. Avec Pro tu en gardes cinq, avec Premium autant que tu veux.",
```

`lib/i18n/es.ts:251`:

```ts
  "chooseTopic.subtitleLimitEnforced": "Memika empieza con una sola carpeta: la que quieres proteger del olvido. Con Pro tienes cinco, con Premium las que quieras.",
```

- [ ] **Step 6: Verificare la parità dei cataloghi**

Run: `npm test -- lib/i18n/i18n.test.ts`
Expected: PASS — stessi insiemi di chiavi, stessi `{segnaposto}`, nessuna stringa vuota.

- [ ] **Step 7: Typecheck e commit**

```bash
npm run lint
git add lib/i18n/
git commit -F- <<'MSG'
feat(i18n): copy dei piani, del paywall e dei limiti in quattro lingue

Riscritta anche chooseTopic.subtitleLimitEnforced, che mandava a Premium
chi al massimo deve passare a Pro.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
```

---

### Task 6: `lib/purchases.ts` — l'SDK, sempre facoltativo

**Files:**
- Create: `lib/purchases.ts`
- Create: `lib/use-plan.ts`
- Modify: `app/_layout.tsx` (accanto a `subscribeAuthChanges`)

> **Niente numeri di riga per `app/_layout.tsx` in questo piano.** Il piano
> notifiche, che gira prima, ci ha già aggiunto tre cose (l'idratazione delle
> prefs, `installNotificationHandler()` a livello di modulo, l'effetto del
> tocco sulle notifiche): ogni riga sotto la 33 si è spostata. Usa i testi di
> ancoraggio, che sono univoci.

**Interfaces:**
- Consumes: `Plan`, `planFromEntitlements`, `planForProductId`, `ENTITLEMENT_*` da `@/lib/plan`; `syncPlan` da `@/lib/api`; `useAuthStore` da `@/lib/auth-store`; le chiavi `plan.*` del Task 5 (senza le quali `PLAN_NAME_KEY` non compila).
- Produces:
  - `purchasesAvailable: boolean`
  - `planFromCustomerInfo(info: CustomerInfo): Plan`
  - `configurePurchases(): void` (idempotente)
  - `identifyPurchases(userId: string): Promise<Plan>` · `signOutPurchases(): Promise<void>`
  - `type PlanPackage = { plan: "pro" | "premium"; period: "monthly" | "yearly" | "other"; priceString: string; pkg: PurchasesPackage }`
  - `loadPlanPackages(): Promise<PlanPackage[]>`
  - `type PurchaseOutcome = { status: "purchased"; plan: Plan } | { status: "cancelled" } | { status: "pending" }`
  - `purchasePlan(pkg: PlanPackage): Promise<PurchaseOutcome>` · `purchaseOutcomeFromError(err: unknown): PurchaseOutcome | null` · `restorePlan(): Promise<Plan>`
  - `addCustomerPlanListener(cb: (plan: Plan) => void): () => void`
  - da `lib/use-plan.ts`: `usePlan(): Plan`, `refreshPlan(): Promise<void>`, `startPlanSync(): () => void`, `usePlanSync(): void`, `PLAN_NAME_KEY: Record<Plan, TKey>`

- [ ] **Step 1: Scrivere `lib/purchases.ts`**

```ts
/**
 * RevenueCat, dietro una porta che si puo' sempre chiudere.
 *
 * L'SDK e' assente o inerte in tre situazioni normali, e in nessuna delle
 * tre l'app deve rompersi:
 *   - Expo Go: il modulo nativo non c'e' e configure() lancia un'eccezione
 *     sincrona con una chiave appl_/goog_;
 *   - build senza le chiavi (EXPO_PUBLIC_REVENUECAT_*_KEY vuote, come
 *     nascono in eas.json finche' Angelo non le riempie);
 *   - modalita' demo, che non ha ne' backend ne' store.
 * In tutti e tre `purchasesAvailable` e' false, nessuna funzione di questo
 * file tocca l'SDK, e l'interfaccia mostra i piani con i bottoni spenti.
 *
 * Questo modulo NON conosce ne' lo store zustand ne' lib/api: la colla sta
 * in lib/use-plan.ts.
 */
import { NativeModules, Platform } from "react-native";
import { isRunningInExpoGo } from "expo";
import Purchases, {
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesError,
  type PurchasesPackage,
} from "react-native-purchases";

import { isDemoMode } from "./supabase";
import { reportError } from "./report-error";
import {
  ENTITLEMENT_PREMIUM,
  ENTITLEMENT_PRO,
  planForProductId,
  planFromEntitlements,
  type Plan,
} from "./plan";

// Metro sostituisce process.env.EXPO_PUBLIC_* a build time SOLO se
// l'accesso e' letterale: niente indicizzazione dinamica.
const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? "";
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? "";
const API_KEY = Platform.OS === "ios" ? IOS_KEY : ANDROID_KEY;

/** Vero solo in un binario che contiene il modulo nativo E ha una chiave. */
export const purchasesAvailable: boolean =
  !isDemoMode &&
  !isRunningInExpoGo() &&
  NativeModules.RNPurchases != null &&
  API_KEY !== "";

let configured = false;

/** Da chiamare una volta sola, prima di qualunque altra chiamata. Sincrona. */
export function configurePurchases(): void {
  if (!purchasesAvailable || configured) return;
  try {
    void Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
    Purchases.configure({ apiKey: API_KEY, appUserID: null });
    configured = true;
  } catch (err) {
    // Binario senza modulo nativo, chiave malformata: si resta senza
    // acquisti, non si cade.
    reportError("purchases/configure", err);
  }
}

export function planFromCustomerInfo(info: CustomerInfo): Plan {
  const active = Object.keys(info.entitlements.active).filter(
    (id) => info.entitlements.active[id]?.isActive === true,
  );
  return planFromEntitlements(active);
}

/** Lega l'utente Supabase all'identita' RevenueCat. Ritorna il piano visto dall'SDK. */
export async function identifyPurchases(userId: string): Promise<Plan> {
  if (!purchasesAvailable || !configured) return "free";
  const { customerInfo } = await Purchases.logIn(userId);
  return planFromCustomerInfo(customerInfo);
}

/** All'uscita dall'account. logOut() rifiuta se l'utente e' gia' anonimo. */
export async function signOutPurchases(): Promise<void> {
  if (!purchasesAvailable || !configured) return;
  try {
    if (!(await Purchases.isAnonymous())) await Purchases.logOut();
  } catch (err) {
    reportError("purchases/log-out", err);
  }
}

export type PlanPackage = {
  plan: "pro" | "premium";
  period: "monthly" | "yearly" | "other";
  /** Prezzo gia' formattato nella valuta dello store. */
  priceString: string;
  pkg: PurchasesPackage;
};

function periodOf(pkg: PurchasesPackage): PlanPackage["period"] {
  const period = pkg.product.subscriptionPeriod ?? "";
  if (period === "P1M") return "monthly";
  if (period === "P1Y") return "yearly";
  return "other";
}

/**
 * I pacchetti dell'offerta corrente, raggruppabili per piano. `current` e'
 * null quando nessuna offerta e' marcata corrente o quando lo store non ha
 * restituito prodotti (prodotti non approvati, app non ancora su un canale
 * di test): in quel caso il paywall mostra le schede senza prezzo.
 */
export async function loadPlanPackages(): Promise<PlanPackage[]> {
  if (!purchasesAvailable || !configured) return [];
  const offerings = await Purchases.getOfferings();
  const packages = offerings.current?.availablePackages ?? [];
  const out: PlanPackage[] = [];
  for (const pkg of packages) {
    const plan = planForProductId(pkg.product.identifier);
    if (plan === "pro" || plan === "premium") {
      out.push({ plan, period: periodOf(pkg), priceString: pkg.product.priceString, pkg });
    }
  }
  return out;
}

export type PurchaseOutcome =
  | { status: "purchased"; plan: Plan }
  | { status: "cancelled" }
  | { status: "pending" };

/**
 * L'annullamento dell'utente NON e' un errore da segnalare; il pagamento in
 * attesa (Android) nemmeno: l'entitlement arrivera' dal listener.
 */
export async function purchasePlan(pkg: PlanPackage): Promise<PurchaseOutcome> {
  const { customerInfo } = await Purchases.purchasePackage(pkg.pkg).catch((e: unknown) => {
    const err = e as PurchasesError;
    if (err?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
      throw { memikaOutcome: "cancelled" as const };
    }
    if (err?.code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) {
      throw { memikaOutcome: "pending" as const };
    }
    throw e;
  });
  return { status: "purchased", plan: planFromCustomerInfo(customerInfo) };
}

/** Traduce il rifiuto "gentile" di purchasePlan; rilancia tutto il resto. */
export function purchaseOutcomeFromError(err: unknown): PurchaseOutcome | null {
  const tagged = err as { memikaOutcome?: "cancelled" | "pending" };
  if (tagged?.memikaOutcome === "cancelled") return { status: "cancelled" };
  if (tagged?.memikaOutcome === "pending") return { status: "pending" };
  return null;
}

/** "Ripristina acquisti". Nessun entitlement trovato NON e' un errore. */
export async function restorePlan(): Promise<Plan> {
  if (!purchasesAvailable || !configured) return "free";
  return planFromCustomerInfo(await Purchases.restorePurchases());
}

/**
 * L'SDK avvisa quando l'abbonamento cambia (rinnovo, ripristino, acquisto
 * su un altro dispositivo). add/remove sono sincroni e per riferimento:
 * si rimuove passando la STESSA funzione.
 */
export function addCustomerPlanListener(cb: (plan: Plan) => void): () => void {
  if (!purchasesAvailable || !configured) return () => {};
  const listener = (info: CustomerInfo) => cb(planFromCustomerInfo(info));
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
}

/** Esportati per la copy del paywall: gli id degli entitlement RevenueCat. */
export const ENTITLEMENTS = { pro: ENTITLEMENT_PRO, premium: ENTITLEMENT_PREMIUM } as const;
```

- [ ] **Step 2: Scrivere `lib/use-plan.ts` — la colla**

```ts
/**
 * Il piano, lato client: un hook per le schermate e una sincronizzazione
 * sola per tutta l'app.
 *
 * Perche' una sottoscrizione allo store invece di sei chiamate sparse:
 * l'utente entra da signIn, da hydrate (sessione persistita), da un deep
 * link di conferma e dal ramo differito di onAuthStateChange (l'unico che
 * vede una registrazione), ed esce da signOut e da un SIGNED_OUT remoto.
 * Tutte e sei finiscono in `set({ user })`: si guarda quello.
 */
import { useEffect } from "react";

import { useAuthStore } from "./auth-store";
import { syncPlan } from "./api";
import type { TKey } from "./i18n";
import { effectivePlan, type Plan } from "./plan";
import {
  addCustomerPlanListener,
  configurePurchases,
  identifyPurchases,
  purchasesAvailable,
  signOutPurchases,
} from "./purchases";
import { reportError } from "./report-error";

/**
 * Il nome visibile di un piano, tipizzato. Evita il `as never` che servirebbe
 * per costruire la chiave con un template literal.
 */
export const PLAN_NAME_KEY: Record<Plan, TKey> = {
  free: "plan.free",
  pro: "plan.pro",
  premium: "plan.premium",
};

/** Il piano che vale ADESSO per l'utente in sessione. */
export function usePlan(): Plan {
  const plan = useAuthStore((s) => s.user?.plan);
  const planUntil = useAuthStore((s) => s.user?.planUntil);
  return effectivePlan(plan, planUntil);
}

/** Rilegge il piano dal server e lo scrive nello store. Non lancia mai. */
export async function refreshPlan(): Promise<void> {
  try {
    const { plan, planUntil } = await syncPlan();
    useAuthStore.getState().setPlan(plan, planUntil);
  } catch (err) {
    reportError("plan/sync", err);
  }
}

/**
 * Da chiamare UNA volta dal layout radice. Ritorna la funzione di pulizia.
 */
export function startPlanSync(): () => void {
  configurePurchases();
  let stopListener: () => void = () => {};

  const apply = (userId: string | undefined) => {
    if (!purchasesAvailable) return;
    // Gli id demo (`demo-user`, `demo-admin`) non devono mai raggiungere
    // RevenueCat: creerebbero clienti fantasma nel progetto.
    if (!userId || userId.startsWith("demo-")) {
      void signOutPurchases();
      return;
    }
    identifyPurchases(userId)
      .then(() => refreshPlan())
      .catch((err) => reportError("plan/identify", err));
  };

  apply(useAuthStore.getState().user?.id);
  stopListener = addCustomerPlanListener(() => {
    // L'SDK dice "e' cambiato qualcosa"; QUANTO sia cambiato lo decide il
    // server, che rilegge da RevenueCat con la chiave segreta.
    void refreshPlan();
  });

  const unsubscribe = useAuthStore.subscribe((state, prev) => {
    if (state.user?.id === prev.user?.id) return;
    apply(state.user?.id);
  });

  return () => {
    unsubscribe();
    stopListener();
  };
}

/** Comodita' per il layout radice. */
export function usePlanSync(): void {
  useEffect(() => startPlanSync(), []);
}
```

- [ ] **Step 3: Avviare la sincronizzazione dal layout radice**

In `app/_layout.tsx`, accanto all'import di `subscribeAuthChanges` aggiungi:

```ts
import { usePlanSync } from "@/lib/use-plan";
```

e dentro il componente, subito dopo l'effetto che monta `subscribeAuthChanges`:

```ts
  // RevenueCat: configura l'SDK, lega l'identita' all'utente in sessione e
  // rilegge il piano dal server a ogni cambio di abbonamento. Inerte in
  // Expo Go, in demo e con le chiavi vuote (lib/purchases.ts).
  usePlanSync();
```

- [ ] **Step 4: Typecheck**

Run: `npm run lint`
Expected: PASS.

Run: `npm test`
Expected: PASS (nessun test nuovo: `lib/purchases.ts` importa React Native e l'SDK, fuori dal perimetro di vitest; la logica testabile sta in `lib/plan.ts`).

- [ ] **Step 5: Commit**

```bash
git add lib/purchases.ts lib/use-plan.ts app/_layout.tsx
git commit -F- <<'MSG'
feat(purchases): wrapper RevenueCat facoltativo e sincronizzazione del piano

purchasesAvailable e' falso in Expo Go, in demo e con le chiavi vuote: li'
nessuna riga tocca l'SDK. La colla vive in use-plan.ts e passa sempre dalla
edge function — l'entitlement letto dal telefono non decide un permesso.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
```

---

### Task 7: Paywall e sezione Abbonamento

**Files:**
- Create: `app/paywall.tsx` (stack **ROOT**, non `(app)`)
- Modify: `app/_layout.tsx` (accanto alle registrazioni di `add` e `memory/[id]`)
- Modify: `app/(app)/settings.tsx` (blocco degli import; nuova sezione fra Lingua e Informazioni)
- Modify: `docs/ROUTING.md` (mappa dei file, blocco root-level; tabella delle rotte)

> **Niente numeri di riga per `app/(app)/settings.tsx` e `docs/ROUTING.md`.**
> Il piano notifiche, che gira prima, ha tolto da `settings.tsx` il blocco
> "Schedule" e riscritto quello "Notifications" (~30 righe in meno) e ha già
> corretto `ROUTING.md` per la tassonomia a `folder/[id]`, aggiungendoci due
> righe. Ogni riga oltre la 330 di `settings.tsx` si è spostata: qui si va di
> testo di ancoraggio.

**Interfaces:**
- Consumes: `usePlan`, `refreshPlan`, `PLAN_NAME_KEY` da `@/lib/use-plan`; `loadPlanPackages`, `purchasePlan`, `purchaseOutcomeFromError`, `restorePlan`, `purchasesAvailable`, `type PlanPackage` da `@/lib/purchases`; `type Plan` da `@/lib/plan`; `isDemoMode` da `@/lib/supabase`.
- Produces: la rotta `/paywall`, raggiunta con `router.push("/paywall" as never)` da Impostazioni e dal `PlanLimitDialog` del Task 8.

**Perché nello stack radice e non dentro `(app)`.** Tre dei cinque punti di ingresso — `app/add.tsx`, `app/choose-topic.tsx`, `app/folder-settings.tsx` — sono schermate del **root stack**, montate SOPRA il gruppo `(app)`. Spingere da lì una rotta di `(app)` fa rientrare il navigatore a tab e ne crea una seconda istanza: è l'incidente già documentato a parole in `app/choose-topic.tsx:52-60` ("two Tabs navigators alive, and Android back landing on the stale zero-folder Knowledge underneath"), il motivo per cui `goToday()` usa `router.dismissTo`. Nello stack radice `router.push("/paywall")` si comporta allo stesso identico modo da tutte e cinque le origini e il back torna da dove si è partiti — la regola che `app/trash.tsx:27-33` scrive già per `/trash`, `/add` e `/folder-settings`. In più sparisce il problema della tab bar `position: absolute` sopra il piede legale: nel root stack la tab bar non c'è.

- [ ] **Step 1: Scrivere `app/paywall.tsx`**

```tsx
import { useEffect, useState } from "react";
import { Linking, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Check } from "lucide-react-native";

import { TopBar } from "@/components/TopBar";
import { PrimaryButton } from "@/components/PrimaryButton";
import { GhostButton } from "@/components/GhostButton";
import { useT } from "@/lib/i18n";
import { useUIStore } from "@/lib/ui-store";
import { reportError } from "@/lib/report-error";
import { isDemoMode } from "@/lib/supabase";
import { PRIVACY_URL, TERMS_URL } from "@/lib/constants";
import { type Plan } from "@/lib/plan";
import { PLAN_NAME_KEY, refreshPlan, usePlan } from "@/lib/use-plan";
import {
  loadPlanPackages,
  purchaseOutcomeFromError,
  purchasePlan,
  purchasesAvailable,
  restorePlan,
  type PlanPackage,
} from "@/lib/purchases";
import { FONT, radii, useColors } from "@/theme/tokens";

/**
 * Il paywall: tre schede, i prezzi veri di RevenueCat, un solo bottone per
 * piano.
 *
 * Vive nello stack ROOT come /add, /trash e /folder-settings: ci si arriva
 * sia da Impostazioni e da /folder/[id] (dentro i tab) sia da /add,
 * /choose-topic e /folder-settings (fuori dai tab), e una rotta di (app)
 * spinta da una schermata root creerebbe una SECONDA istanza del navigatore
 * a tab (choose-topic.tsx:52-60). Di conseguenza qui la tab bar non c'e' e
 * il piede legale — obbligatorio su una schermata di abbonamento, Apple
 * 3.1.2 — non rischia di finirci sotto.
 *
 * In questo ciclo si vende solo l'abbonamento MENSILE: un bottone per
 * scheda, nessun selettore di periodicita' (Task 10, offerta `default`).
 *
 * Quando gli acquisti non sono disponibili (Expo Go, demo, chiavi vuote,
 * prodotti non ancora approvati dagli store) le schede restano visibili con
 * i bottoni spenti e una riga che dice perche': mai una schermata vuota,
 * mai un bottone che non fa niente in silenzio.
 */
export default function PaywallScreen() {
  const colors = useColors();
  const { t } = useT();
  const plan = usePlan();
  const showToast = useUIStore((s) => s.showToast);
  const [packages, setPackages] = useState<PlanPackage[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!purchasesAvailable) {
      setPackages([]);
      return;
    }
    let cancelled = false;
    loadPlanPackages()
      .then((pkgs) => {
        if (!cancelled) setPackages(pkgs);
      })
      .catch((err) => {
        reportError("paywall/offerings", err);
        if (!cancelled) setPackages([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // L'offerta `default` di questo ciclo porta solo i due pacchetti mensili
  // (checklist, Task 10). Il ramo annuale resta come rete di sicurezza: se
  // un giorno l'offerta contenesse SOLO un annuale, la scheda mostrerebbe
  // il suo prezzo e `buy` comprerebbe quello, invece di restare muta.
  const priceFor = (target: Plan): string | null => {
    if (!packages) return null;
    const monthly = packages.find((p) => p.plan === target && p.period === "monthly");
    if (monthly) return t("paywall.monthlyPrice", { price: monthly.priceString });
    const yearly = packages.find((p) => p.plan === target && p.period === "yearly");
    if (yearly) return t("paywall.yearlyPrice", { price: yearly.priceString });
    return null;
  };

  const buy = async (target: Plan) => {
    // Stesso ordine di priceFor: quello che si compra e' quello di cui si
    // e' letto il prezzo, altrimenti il piede legale parlerebbe di un
    // rinnovo diverso da quello mostrato.
    const pkg =
      packages?.find((p) => p.plan === target && p.period === "monthly") ??
      packages?.find((p) => p.plan === target);
    if (!pkg || busy) return;
    setBusy(true);
    try {
      const outcome = await purchasePlan(pkg);
      // L'entitlement locale e' solo la via rapida: la verita' la riscrive
      // la edge function dopo aver interrogato RevenueCat.
      await refreshPlan();
      if (outcome.status === "purchased") {
        showToast(t("paywall.purchased", { plan: t(PLAN_NAME_KEY[outcome.plan]) }));
      }
    } catch (err) {
      const outcome = purchaseOutcomeFromError(err);
      if (outcome?.status === "cancelled") return; // l'utente ha detto no: nessun rumore
      if (outcome?.status === "pending") {
        showToast(t("paywall.purchasePending"));
        return;
      }
      reportError("paywall/purchase", err, { plan: target });
      showToast(t("paywall.purchaseFailed"));
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const restored = await restorePlan();
      await refreshPlan();
      showToast(
        restored === "free"
          ? t("paywall.restoreNone")
          : t("paywall.restored", { plan: t(PLAN_NAME_KEY[restored]) }),
      );
    } catch (err) {
      reportError("paywall/restore", err);
      showToast(t("paywall.restoreFailed"));
    } finally {
      setBusy(false);
    }
  };

  const openExternal = (url: string) => {
    Linking.openURL(url).catch((err) => {
      reportError("paywall/open-url", err, { url });
      showToast(t("settings.openPageError"));
    });
  };

  const notice = isDemoMode
    ? t("paywall.demoNotice")
    : !purchasesAvailable
      ? t("paywall.unavailable")
      : packages === null
        ? t("paywall.loadingPrices")
        : packages.length === 0
          ? t("paywall.noPrices")
          : null;

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <TopBar title={t("paywall.title")} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Text
          style={{
            paddingHorizontal: 22,
            paddingTop: 8,
            paddingBottom: 18,
            fontFamily: FONT.regular,
            fontSize: 14,
            lineHeight: 20,
            color: colors.midGrey,
          }}
        >
          {t("paywall.subtitle")}
        </Text>

        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          <PlanCard
            name={t("plan.free")}
            price={null}
            features={[
              t("paywall.freeMemories"),
              t("paywall.freeFolders"),
              t("paywall.freeSections"),
            ]}
            current={plan === "free"}
            cta={null}
          />
          <PlanCard
            name={t("plan.pro")}
            price={priceFor("pro")}
            features={[
              t("paywall.proMemories"),
              t("paywall.proFolders"),
              t("paywall.proSections"),
            ]}
            current={plan === "pro"}
            cta={
              plan === "pro"
                ? null
                : {
                    label: t("paywall.chooseCta", { plan: t("plan.pro") }),
                    disabled: busy || !packages?.some((p) => p.plan === "pro"),
                    onPress: () => void buy("pro"),
                  }
            }
          />
          <PlanCard
            name={t("plan.premium")}
            price={priceFor("premium")}
            features={[
              t("paywall.premiumMemories"),
              t("paywall.premiumFolders"),
              t("paywall.premiumSections"),
              t("paywall.premiumPhotos"),
            ]}
            current={plan === "premium"}
            cta={
              plan === "premium"
                ? null
                : {
                    label: t("paywall.chooseCta", { plan: t("plan.premium") }),
                    disabled: busy || !packages?.some((p) => p.plan === "premium"),
                    onPress: () => void buy("premium"),
                  }
            }
          />
        </View>

        {notice ? (
          <Text
            style={{
              paddingHorizontal: 22,
              paddingTop: 16,
              textAlign: "center",
              fontFamily: FONT.medium,
              fontSize: 12.5,
              lineHeight: 18,
              color: colors.midGrey,
            }}
          >
            {notice}
          </Text>
        ) : null}

        <View style={{ paddingHorizontal: 18, paddingTop: 14 }}>
          <GhostButton
            variant="link"
            label={t("paywall.restore")}
            onPress={() => void restore()}
            disabled={busy || !purchasesAvailable}
          />
        </View>

        <Text
          style={{
            paddingHorizontal: 22,
            paddingTop: 18,
            fontFamily: FONT.regular,
            fontSize: 11.5,
            lineHeight: 17,
            color: colors.midGrey,
          }}
        >
          {t("paywall.legal")}
        </Text>
        <View style={{ flexDirection: "row", gap: 18, paddingHorizontal: 22, paddingTop: 10 }}>
          <Text
            accessibilityRole="link"
            onPress={() => openExternal(TERMS_URL)}
            style={{ fontFamily: FONT.medium, fontSize: 12, color: colors.navy }}
          >
            {t("settings.termsOfService")}
          </Text>
          <Text
            accessibilityRole="link"
            onPress={() => openExternal(PRIVACY_URL)}
            style={{ fontFamily: FONT.medium, fontSize: 12, color: colors.navy }}
          >
            {t("settings.privacyPolicy")}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PlanCard({
  name,
  price,
  features,
  current,
  cta,
}: {
  name: string;
  price: string | null;
  features: string[];
  current: boolean;
  cta: { label: string; disabled: boolean; onPress: () => void } | null;
}) {
  const colors = useColors();
  const { t } = useT();
  return (
    <View
      style={{
        borderRadius: radii.card,
        backgroundColor: colors.surface,
        borderWidth: current ? 1.5 : 1,
        borderColor: current ? colors.navy : colors.hairline,
        padding: 18,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ fontFamily: FONT.bold, fontSize: 19, color: colors.navy }}>{name}</Text>
        {current ? (
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: colors.tagProBg,
            }}
          >
            <Text style={{ fontFamily: FONT.semibold, fontSize: 11, color: colors.tagProText }}>
              {t("paywall.currentBadge")}
            </Text>
          </View>
        ) : null}
      </View>
      {price ? (
        <Text style={{ fontFamily: FONT.semibold, fontSize: 14.5, color: colors.navy }}>
          {price}
        </Text>
      ) : null}
      <View style={{ gap: 7 }}>
        {features.map((f) => (
          <View key={f} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Check size={15} color={colors.navy} strokeWidth={2.2} />
            <Text style={{ fontFamily: FONT.regular, fontSize: 13.5, color: colors.midGrey }}>
              {f}
            </Text>
          </View>
        ))}
      </View>
      {cta ? (
        <View style={{ marginTop: 4 }}>
          <PrimaryButton label={cta.label} onPress={cta.onPress} disabled={cta.disabled} />
        </View>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 2: Registrare la rotta nello stack radice**

In `app/_layout.tsx`, subito dopo la `<Stack.Screen name="memory/[id]" … />` e prima della `</Stack>`:

```tsx
            {/* Paywall: raggiunto da Impostazioni, da /folder/[id] e dai
                dialoghi di limite di /add, /choose-topic e
                /folder-settings — cioe' sia da dentro che da fuori i tab.
                Nello stack ROOT come /add e /trash: una rotta di (app)
                spinta da una schermata root monterebbe un SECONDO
                navigatore a tab (choose-topic.tsx:52-60). */}
            <Stack.Screen
              name="paywall"
              options={{
                presentation: Platform.OS === "ios" ? "modal" : "card",
                animation: "slide_from_bottom",
                contentStyle: { backgroundColor: themeColors.warmWhite },
              }}
            />
```

`Platform` e `themeColors` sono già in scope in quel file: li usano le due registrazioni sopra.

- [ ] **Step 3: La sezione "Abbonamento" in Impostazioni**

In `app/(app)/settings.tsx`:

1. Import aggiuntivi, accanto agli altri in testa al file:

```ts
import { purchasesAvailable, restorePlan } from "@/lib/purchases";
import { PLAN_NAME_KEY, refreshPlan, usePlan } from "@/lib/use-plan";
```

2. Dentro il componente, accanto agli altri hook (dopo `const [pendingCap, setPendingCap] = useState<number | null>(null);`):

```ts
  const plan = usePlan();
  const [restoring, setRestoring] = useState(false);
  const restorePurchases = () => {
    if (restoring) return;
    tap();
    setRestoring(true);
    restorePlan()
      .then(async (restored) => {
        await refreshPlan();
        showToast(
          restored === "free"
            ? tr("paywall.restoreNone")
            : tr("paywall.restored", { plan: tr(PLAN_NAME_KEY[restored]) }),
        );
      })
      .catch((err) => {
        reportError("settings/restore-purchases", err);
        showToast(tr("paywall.restoreFailed"));
      })
      .finally(() => setRestoring(false));
  };
```

3. Il blocco JSX, fra la sezione Lingua (il `View` che contiene `<LanguagePicker />`) e il commento `{/* About */}`:

```tsx
        {/* Abbonamento — ricreata dopo la cancellazione del vecchio
            checkout esterno (3cd141e). Il paywall e' in-app: nessun link
            fuori dall'app (Apple 3.1.1 / Play Payments). */}
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 }}>
          <SectionLabel>{tr("settings.subscriptionSection")}</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          <SettingsRow
            label={tr("settings.planLabel")}
            hint={tr("settings.planHint")}
            value={tr(PLAN_NAME_KEY[plan])}
          />
          {/* Tre casi, non due: `settings.upgrade` e' la stringa fissa
              "Passa a Pro", e un abbonato Pro se la leggerebbe due righe
              sotto "Piano: Pro". */}
          <SettingsRow
            label={
              plan === "free"
                ? tr("settings.upgrade")
                : plan === "pro"
                  ? tr("settings.upgradePremium")
                  : tr("settings.seePlans")
            }
            value={tr("settings.open")}
            onPress={() => {
              tap();
              router.push("/paywall" as never);
            }}
          />
          {purchasesAvailable ? (
            <SettingsRow
              label={tr("settings.restorePurchases")}
              hint={tr("settings.restorePurchasesHint")}
              value={tr("settings.open")}
              onPress={restorePurchases}
            />
          ) : null}
        </View>
```

- [ ] **Step 4: Aggiornare `docs/ROUTING.md`**

Nella mappa dei file, nel blocco **root-level** in cima, dopo la riga di `folder-settings.tsx`:

```
├── paywall.tsx                  Piani Free/Pro/Premium — root-level (foglio dal basso), fuori dai tab
```

Nella tabella delle rotte, dopo la riga di `/folder-settings?kind=`:

```
| `/paywall` | `app/paywall.tsx` | Signed-in users — da Impostazioni, da `/folder/[id]` o da un limite di piano |
```

- [ ] **Step 5: Typecheck e prova a mano**

```bash
npm run lint
npm test
```
Expected: PASS.

Poi, in Expo Go (dove `purchasesAvailable` è falso per costruzione): apri Impostazioni → Abbonamento → "Passa a Pro". La schermata deve mostrare le tre schede, la riga "Gli acquisti non sono disponibili su questo dispositivo", i bottoni spenti, **nessuna tab bar** e il piede legale con i due link. Torna indietro: devi ritrovarti in Impostazioni, con i tab al loro posto e una sola barra.

- [ ] **Step 6: Commit**

```bash
git add app/paywall.tsx app/_layout.tsx app/\(app\)/settings.tsx docs/ROUTING.md
git commit -F- <<'MSG'
feat(paywall): tre schede, prezzi da RevenueCat e sezione Abbonamento

Il paywall sta nello stack radice come /add e /trash: tre dei cinque punti
di ingresso sono schermate root, e una rotta di (app) spinta da li'
monterebbe un secondo navigatore a tab. Senza SDK o senza prodotti le
schede restano, i bottoni si spengono e una riga dice perche'.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
```

---

### Task 8: Gli specchi lato client, per errcode

**Files:**
- Create: `components/PlanLimitDialog.tsx`
- Modify: `app/add.tsx` (import; effetto di caricamento; calcolo del limite; `doSave`; contatore; JSX di chiusura) — **senza numeri di riga: il piano notifiche, che gira prima, ha già aggiunto ~50 righe a questo file** (pre-prompt del permesso, `clearFields`, `acceptPrompt`/`declinePrompt`, un `MascotDialog` in fondo). Ogni step qui sotto dà il testo di ancoraggio.
- Modify: `app/choose-topic.tsx:23` (import), `:98`, `:181-183` (catch), `:199-203` (sottotitolo)
- Modify: `app/(app)/knowledge.tsx:24` (import), `:102-106` (stato), `:127-132` (il "+" e il suo onPress), `:376` (dialogo)
- Modify: `app/(app)/folder/[id].tsx:11` (import), `:373`, `:396`, `:511-522` (catch)
- Modify: `app/folder-settings.tsx:29` (import), `:368`, `:475-486` (catch) — righe **+2** rispetto a queste se il piano notifiche è già a bordo (ci ha aggiunto un import e una riga in `handleDelete`); gli anchor testuali reggono comunque
- Modify: `lib/constants.ts:21-26`, `:137-151`, `:226-233`
- Modify: `lib/api.ts:1099` (commento)
- Modify: `lib/i18n/{it,en,fr,es}.ts` (rimozione di `subfolders.limit`)

**Interfaces:**
- Consumes: `PLAN_LIMITS`, `canAddMemory`, `canAddFolder`, `canAddSection`, `memoriesLeft`, `planLimitFromCode`, `type PlanLimitKind`, `type Plan` da `@/lib/plan`; `usePlan` da `@/lib/use-plan`; `countMemories` da `@/lib/api`; `errorCode` da `@/lib/report-error`.
- Produces: `<PlanLimitDialog limit={PlanLimitKind | null} plan={Plan} onClose={() => void} />`.

- [ ] **Step 1: Scrivere `components/PlanLimitDialog.tsx`**

```tsx
import { router } from "expo-router";

import { MascotDialog } from "@/components/MascotDialog";
import { useT } from "@/lib/i18n";
import type { Plan, PlanLimitKind } from "@/lib/plan";

type Props = {
  /** null = chiuso. */
  limit: PlanLimitKind | null;
  plan: Plan;
  onClose: () => void;
};

/**
 * La mascotte spiega quale limite hai incontrato e propone l'upgrade.
 *
 * Un solo componente per quattro schermate (Add, Nuova cartella, Sezioni in
 * due punti): la copy cambia col limite E col piano — a un utente Pro non
 * si dice "passa a Pro".
 *
 * Il dialogo si chiude PRIMA della navigazione: un Modal ancora montato
 * mentre il router spinge una rotta lascia il backdrop sopra la schermata
 * nuova (stessa precauzione di settings.tsx col picker del limite).
 */
export function PlanLimitDialog({ limit, plan, onClose }: Props) {
  const { t } = useT();
  const copy = (): { title: string; body: string } => {
    if (limit === "memories") {
      return { title: t("planLimit.memoriesTitle"), body: t("planLimit.memoriesBody") };
    }
    if (limit === "folders") {
      return plan === "free"
        ? { title: t("planLimit.foldersTitleFree"), body: t("planLimit.foldersBodyFree") }
        : { title: t("planLimit.foldersTitlePro"), body: t("planLimit.foldersBodyPro") };
    }
    return plan === "free"
      ? { title: t("planLimit.sectionsTitleFree"), body: t("planLimit.sectionsBodyFree") }
      : { title: t("planLimit.sectionsTitlePro"), body: t("planLimit.sectionsBodyPro") };
  };
  const { title, body } = limit ? copy() : { title: "", body: "" };
  return (
    <MascotDialog
      visible={limit !== null}
      title={title}
      body={body}
      confirmLabel={t("planLimit.seePlans")}
      cancelLabel={t("planLimit.notNow")}
      onConfirm={() => {
        onClose();
        router.push("/paywall" as never);
      }}
      onCancel={onClose}
    />
  );
}
```

- [ ] **Step 2: Ritirare i tre flag morti da `lib/constants.ts`**

Cancella `SUBFOLDERS_MAX` (righe 21-26), `FREE_FOLDER_LIMIT` + `FOLDER_LIMIT_ENFORCED` (righe 137-151) e `PREMIUM_ENABLED` (righe 226-233). Al loro posto, dove stava `FREE_FOLDER_LIMIT`, una sola riga di rimando:

```ts
/**
 * I limiti dei piani NON stanno piu' qui: stanno in lib/plan.ts
 * (PLAN_LIMITS), che e' l'unico specchio della verita' server-side dei
 * trigger di 20260903100000_plans.sql. FREE_FOLDER_LIMIT (codice morto),
 * FOLDER_LIMIT_ENFORCED, SUBFOLDERS_MAX e PREMIUM_ENABLED (orfano, importato
 * da zero file) sono stati rimossi il 2026-09-03.
 */
```

Aggiorna anche il commento di `lib/api.ts:1099`, che cita `SUBFOLDERS_MAX`:

```ts
// spostamento dei ricordi. Il tetto per cartella dipende dal piano
// (PLAN_LIMITS in lib/plan.ts) ed e' applicato dal trigger
// enforce_subfolder_rules.
```

Run: `npm run lint`
Expected: FAIL, con un errore per ogni call site rimasto — è la lista di lavoro degli step successivi.

- [ ] **Step 3: Add — contatore su 10 e blocco vero**

In `app/add.tsx`:

1. Import. `DAILY_INPUT_CAP_DEFAULT` resta (serve ancora a Pro/Premium); la riga di `lib/api` guadagna `countMemories`, quella di `lib/report-error` guadagna `errorCode`:

```ts
import { countMemories, createMemory, fetchProfile, fetchTodayInputCount } from "@/lib/api";
import { errorCode, reportError } from "@/lib/report-error";
import { PLAN_LIMITS, canAddMemory, planLimitFromCode, type PlanLimitKind } from "@/lib/plan";
import { usePlan } from "@/lib/use-plan";
import { PlanLimitDialog } from "@/components/PlanLimitDialog";
```

2. Stato, accanto a `const [dailyMax, setDailyMax] = useState(DAILY_INPUT_CAP_DEFAULT);`:

```ts
  const plan = usePlan();
  // Totale dei ricordi dell'account, CESTINO COMPRESO (stesso predicato del
  // trigger): e' il contatore del piano free (10 in tutto), diverso dal
  // contatore giornaliero, che resta l'autoregolazione di Pro/Premium.
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [planBlock, setPlanBlock] = useState<PlanLimitKind | null>(null);
```

3. L'effetto di caricamento legge anche il totale. **Attenzione a cosa c'è già dentro il ramo `if (profile)`:** il piano notifiche, che gira prima di questo, ci ha aggiunto `setProfile(profile)` — gli serve per riallineare il promemoria giornaliero quando l'utente concede il permesso dopo il primo salvataggio (`syncDailyReminder(profile)` in `acceptPrompt`). Cancellarlo non fa fallire `tsc` (lo stato resta dichiarato e usato) ma lascia `profile` a `null` per sempre e il promemoria non si riallinea più: un guasto silenzioso. Quindi il blocco diventa:

```ts
    Promise.all([fetchTodayInputCount(user.id), fetchProfile(user.id), countMemories(user.id)])
      .then(([count, profile, total]) => {
        if (cancelled) return;
        setDailyCount(count);
        setTotalCount(total);
        if (profile) {
          setDailyMax(profile.dailyInputCap);
          setProfile(profile);
        }
      })
```

Se `grep -n "setProfile" app/add.tsx` non trova nulla (stai eseguendo questo piano senza quello delle notifiche), togli la riga `setProfile(profile);` e lascia `if (profile) setDailyMax(profile.dailyInputCap);` su una riga sola.

4. Sopra `doSave`, accanto alla riga che calcola `dailyLimitReached`:

```ts
  const totalMax = PLAN_LIMITS[plan].memories;
  const planLimitReached = totalMax !== null && !canAddMemory(totalCount ?? 0, plan);
```

5. In testa a `doSave`, prima di qualunque validazione dei campi:

```ts
    // Il tetto totale del piano free e' un blocco vero, non un avviso: si
    // spiega e si propone l'upgrade invece di far scrivere una parola che
    // il server rifiuterebbe.
    if (planLimitReached) {
      setPlanBlock("memories");
      return;
    }
```

6. Nel `catch` di `doSave` (quello che oggi contiene `reportError("add/save", e)`), la doppia cintura — se il conteggio locale era vecchio, il codice del server decide. La mappatura dell'errcode deve restare la **prima** cosa dentro il `catch`: il piano foto, che gira dopo, ha l'ordine di non toccarlo:

```ts
    } catch (e) {
      const limit = planLimitFromCode(errorCode(e));
      if (limit) {
        setPlanBlock(limit);
        return;
      }
      reportError("add/save", e);
      showToast(t("add.saveFailed"));
    } finally {
```

7. Dopo un salvataggio riuscito, tieni allineato il totale (accanto a `setDailyCount((c) => (c ?? 0) + 1);`):

```ts
      setTotalCount((c) => (c ?? 0) + 1);
```

8. Il contatore sotto i campi — il `<Text>` che oggi rende `add.dailyCounter` / `add.overDailyLimit` — diventa consapevole del piano:

```tsx
          <Text
            style={{
              fontFamily: dailyLimitReached || planLimitReached ? FONT.medium : FONT.regular,
              fontSize: dailyLimitReached || planLimitReached ? 12.5 : 12,
              color: dailyLimitReached || planLimitReached ? colors.danger : colors.midGrey,
              fontVariant: ["tabular-nums"],
              textAlign: "center",
              paddingHorizontal: 8,
            }}
          >
            {totalMax !== null
              ? totalCount === null
                ? "…"
                : planLimitReached
                  ? t("add.totalLimitReached", { max: totalMax })
                  : t("add.totalCounter", { count: totalCount, max: totalMax })
              : dailyCount === null
                ? "…"
                : dailyLimitReached
                  ? t("add.overDailyLimit", { count: dailyCount, max: dailyMax })
                  : t("add.dailyCounter", { count: dailyCount, max: dailyMax })}
          </Text>
```

9. Il dialogo, in fondo al JSX prima della chiusura di `</SafeAreaView>`. Lì c'è già il `MascotDialog` del pre-prompt notifiche: **affiancalo**, non sostituirlo (i due `visible` sono mutuamente esclusivi).

```tsx
      <PlanLimitDialog limit={planBlock} plan={plan} onClose={() => setPlanBlock(null)} />
```

- [ ] **Step 4: Cartelle — Knowledge e Nuova cartella**

In `app/(app)/knowledge.tsx`:

1. Import (riga 24, dove oggi c'è `FOLDER_LIMIT_ENFORCED`):

```ts
import { type FolderKind } from "@/lib/constants";
import { canAddFolder, type PlanLimitKind } from "@/lib/plan";
import { usePlan } from "@/lib/use-plan";
import { PlanLimitDialog } from "@/components/PlanLimitDialog";
```

2. Al posto delle righe 102-106:

```ts
  // Il "+" resta VISIBILE anche al tetto, e dirama al tocco. Farlo sparire
  // sarebbe la scelta peggiore: un utente free ha esattamente una cartella
  // per costruzione, quindi in tutta la schermata Cartelle non incontrerebbe
  // mai un motivo per passare a Pro. La spec chiede l'opposto — "il client
  // rispecchia i limiti per l'UX (disabilita, spiega, propone l'upgrade)" —
  // ed e' lo stesso comportamento di Add e delle sezioni.
  const plan = usePlan();
  const [planBlock, setPlanBlock] = useState<PlanLimitKind | null>(null);
  const canAdd = !loading && !error && folders.length > 0;
```

(l'uso a riga 127 diventa `{canAdd ? (`: la variabile non può più chiamarsi `canAddFolder`, ombreggerebbe la funzione importata.)

3. L'`onPress` del `Tappable` di riga 129-132:

```tsx
            onPress={() => {
              if (!canAddFolder(folders.length, plan)) {
                setPlanBlock("folders");
                return;
              }
              router.push({ pathname: "/choose-topic", params: { mode: "new" } } as never);
            }}
```

4. Il dialogo, subito prima della `</SafeAreaView>` di riga 376:

```tsx
      <PlanLimitDialog limit={planBlock} plan={plan} onClose={() => setPlanBlock(null)} />
```

In `app/choose-topic.tsx`:

1. Import:

```ts
import { FOLDER_NAME_MAX_LENGTH } from "@/lib/constants";
import { planLimitFromCode, type PlanLimitKind } from "@/lib/plan";
import { usePlan } from "@/lib/use-plan";
import { errorCode, reportError } from "@/lib/report-error";
import { PlanLimitDialog } from "@/components/PlanLimitDialog";
```

2. Riga 98:

```ts
  const addingAnother = mode === "new" || Boolean(moveMemoryId);
```

3. Stato, accanto a `saving`:

```ts
  const plan = usePlan();
  const [planBlock, setPlanBlock] = useState<PlanLimitKind | null>(null);
```

4. Il `catch` di `create` (righe 181-183):

```ts
    } catch (e) {
      const limit = planLimitFromCode(errorCode(e));
      if (limit) {
        setPlanBlock(limit);
        return;
      }
      reportError("choose-topic/create-folder", e);
      setError(t("chooseTopic.createFailed"));
    } finally {
```

5. Il sottotitolo (righe 199-203):

```ts
  const subtitle = addingAnother
    ? t("chooseTopic.subtitleNewFolder")
    : plan === "free"
      ? t("chooseTopic.subtitleLimitEnforced")
      : t("chooseTopic.subtitleLimitOff");
```

6. Il dialogo, prima della chiusura di `</SafeAreaView>` del ramo principale:

```tsx
      <PlanLimitDialog limit={planBlock} plan={plan} onClose={() => setPlanBlock(null)} />
```

- [ ] **Step 5: Sezioni — i due punti che oggi leggono il messaggio**

In `app/(app)/folder/[id].tsx`:

1. Import — via `SUBFOLDERS_MAX` (riga 11), e:

```ts
import { errorCode, reportError } from "@/lib/report-error";
import { canAddSection, planLimitFromCode, type PlanLimitKind } from "@/lib/plan";
import { usePlan } from "@/lib/use-plan";
import { PlanLimitDialog } from "@/components/PlanLimitDialog";
```

2. Stato:

```ts
  const plan = usePlan();
  const [planBlock, setPlanBlock] = useState<PlanLimitKind | null>(null);
```

3. Righe 373 e 396, dove c'era `SUBFOLDERS_MAX`:

```tsx
        {subfolders.length > 0 || canAddSection(subfolders.length, plan) ? (
```

```tsx
            {canAddSection(subfolders.length, plan) ? (
```

4. Il `catch` di `createSubfolder` (righe 511-522) — via la sottostringa:

```ts
            .catch((e) => {
              const limit = planLimitFromCode(errorCode(e));
              if (limit) {
                setPlanBlock(limit);
                return;
              }
              reportError("folder/subfolder-create", e);
              showToast(
                errorCode(e) === "23505"
                  ? t("subfolders.duplicate")
                  : t("subfolders.failed"),
              );
            })
```

5. Il dialogo, prima della chiusura di `</SafeAreaView>`:

```tsx
      <PlanLimitDialog limit={planBlock} plan={plan} onClose={() => setPlanBlock(null)} />
```

In `app/folder-settings.tsx`:

1. Import — via `SUBFOLDERS_MAX` (riga 29, che il Task 8 Step 2 ha già cancellato da `constants.ts`), e:

```ts
import { errorCode, reportError } from "@/lib/report-error";
import { canAddSection, planLimitFromCode, type PlanLimitKind } from "@/lib/plan";
import { usePlan } from "@/lib/use-plan";
import { PlanLimitDialog } from "@/components/PlanLimitDialog";
```

2. Stato, accanto a `subSaving` (riga 59):

```ts
  const plan = usePlan();
  const [planBlock, setPlanBlock] = useState<PlanLimitKind | null>(null);
```

3. Riga 368, il bottone "Nuova sezione":

```tsx
          {canAddSection(subfolders.length, plan) ? (
```

4. Il `catch` di riga 475-486:

```ts
            .catch((err) => {
              const limit = planLimitFromCode(errorCode(err));
              if (limit) {
                setPlanBlock(limit);
                return;
              }
              reportError("folder-settings/subfolder-save", err);
              showToast(
                errorCode(err) === "23505"
                  ? t("subfolders.duplicate")
                  : t("subfolders.failed"),
              );
            })
```

5. Il dialogo, subito prima della `</SafeAreaView>` finale (in fondo al file, dopo l'ultimo `</Modal>`):

```tsx
      <PlanLimitDialog limit={planBlock} plan={plan} onClose={() => setPlanBlock(null)} />
```

- [ ] **Step 6: Togliere la chiave ormai morta**

`subfolders.limit` non è più usata da nessuno (la spiegazione la dà il dialogo). Toglila da `lib/i18n/it.ts:979` e dalle righe corrispondenti di `en.ts`, `fr.ts`, `es.ts`.

Run: `npm test -- lib/i18n/i18n.test.ts`
Expected: PASS (le quattro rimozioni sono simmetriche).

- [ ] **Step 7: Typecheck, test, commit**

```bash
npm run lint
npm test
```
Expected: PASS. Se `tsc` segnala ancora un `SUBFOLDERS_MAX` / `FOLDER_LIMIT_ENFORCED` / `PREMIUM_ENABLED`, è un call site dimenticato: sistemalo prima di proseguire.

```bash
git add app/ components/PlanLimitDialog.tsx lib/constants.ts lib/api.ts lib/i18n/
git commit -F- <<'MSG'
feat(plan): il client rispecchia i limiti e apre il paywall per errcode

Il contatore di Add diventa "n/10" sul piano free e blocca davvero, il "+"
delle cartelle resta visibile e apre la mascotte quando il tetto e' pieno,
il "+" delle sezioni segue il piano, e i quattro punti di errore mappano
P0004/P0005/P0003 invece della sottostringa "limit" del messaggio.
Ritirati FREE_FOLDER_LIMIT, FOLDER_LIMIT_ENFORCED, SUBFOLDERS_MAX e
PREMIUM_ENABLED.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
```

---

### Task 9: Documentazione

**Files:**
- Modify: `docs/PAYMENTS.md` (riscritto)
- Modify: `docs/DATA-MODEL.md:37-48` (tabella `profiles`), `:59` (frase sulle cartelle free), `:165-172` (trigger), `:174-182` (funzioni), `:278-285` (non modellato)
- Modify: `AGENTS.md:22-25` (freemium), `:70-73` (dentro la regola dura sulle cartelle), `:43-99` (coda delle regole dure), `:234-238` (anti-pattern sul checkout web)
- Modify (Step 2bis, bonifica delle costanti ritirate): `docs/PRODUCT.md:57,95`, `docs/ARCHITECTURE.md:18`, `docs/ROADMAP.md:119,158`, `docs/app-store-listing.md:226`, `docs/store-listing.md:37`, `README.md:25`

**Interfaces:**
- Produces: nessuna interfaccia di codice. È il commit che impedisce al prossimo agente di disfare il lavoro.

- [ ] **Step 1: Riscrivere `docs/PAYMENTS.md`**

```bash
cat > docs/PAYMENTS.md <<'MD'
# Payments

> Tre piani — Free / Pro / Premium — venduti come **abbonamenti in-app via
> RevenueCat**. Decisione 2026-07-25, confermata 2026-08-25, parametri fissati
> 2026-09-02. Nessun checkout web: un binario che rimanda a un pagamento
> esterno viene rifiutato sotto Apple 3.1.1 e Google Play Payments.

## Stato (2026-09-03)

Implementato in codice, **non ancora attivo**: mancano il progetto RevenueCat,
i prodotti negli store e le chiavi. Fino ad allora
`EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `_ANDROID_KEY` sono stringhe vuote in
`eas.json`, `purchasesAvailable` è falso e il paywall mostra le schede con i
bottoni spenti. La migrazione dei limiti **non va applicata a produzione**
finché la build 3 non è sugli store (vedi "Ordine di attivazione").

## I piani

| | Free | Pro | Premium |
|---|---|---|---|
| Ricordi | **10 totali** sull'account | illimitati | illimitati |
| Cartelle | 1 | 5 | illimitate |
| Sezioni per cartella | 0 | 3 | illimitate |
| Foto sui ricordi | — | — | ✓ |

I 10 ricordi sono un tetto **totale**, non giornaliero. Il cursore in
Impostazioni (`profiles.daily_input_cap`) è un'altra cosa: autoregolazione del
carico per chi ha Pro o Premium, con gli avvisi della mascotte a 20/25/30. Un
utente free non lo incontra mai.

Prezzi, durata e periodo di prova sono configurazione RevenueCat: non toccano
una riga di codice. Gli identificativi dei prodotti sì, e sono in
`lib/plan.ts` (`PRODUCT_IDS`): `memika_pro_monthly`, `memika_pro_yearly`,
`memika_premium_monthly`, `memika_premium_yearly`. Ogni id che viene creato
deve essere identico in App Store Connect, Play Console e RevenueCat.

Entitlement RevenueCat: **`pro` e `premium`** (due, non uno). Offerta:
`default`, che **in questo ciclo contiene solo i due pacchetti mensili**. Il
paywall ha un bottone per scheda e nessun selettore di periodicità: un
pacchetto annuale accanto a un mensile sarebbe configurato, caricato e mai
vendibile. I due id annuali restano riservati e `planForProductId()` li
riconosce già, così aggiungere il piano annuale in futuro sarà lavoro di
interfaccia e di offerta, non di mappa.

## Grandfathering

Chi ha già più di 10 ricordi, più di una cartella o delle sezioni li tiene
tutti e semplicemente non può aggiungerne. Cade fuori gratis dai trigger, che
sono `BEFORE INSERT` e non guardano le righe esistenti.

I tetti contano **tutte** le righe dell'utente, cestino compreso. È voluto: il
ripristino dal cestino è una UPDATE e non passa dai trigger, quindi contando
le sole righe vive il ciclo "cestina, inserisci, ripristina" aggirerebbe il
tetto all'infinito. Contando tutto, il totale può solo scendere (purga a 24
ore): nessun ripristino può mai fallire e il grandfathering resta intatto. Il
prezzo — una riga nel cestino occupa il suo posto fino alla purga — è detto
nella copy del limite.

## Dove vive la verità

**Nel database.** `supabase/migrations/20260903100000_plans.sql`:

```sql
alter table public.profiles
  add column plan text not null default 'free' check (plan in ('free','pro','premium')),
  add column plan_until timestamptz,
  add column rc_app_user_id text;
```

Nessuna delle tre entra nella grant di UPDATE per `authenticated`
(`20260825121500_lock_profiles_columns.sql` elenca esattamente sei colonne, e
resta così). È la lezione diretta di `daily_input_cap`, che è scrivibile
dall'utente e quindi inutile come limite.

`public.current_plan(uid)` degrada a `free` un piano con `plan_until` nel
passato — valutazione pigra, nessun cron di downgrade. `lib/plan.ts`
`effectivePlan()` ne è lo specchio esatto lato client.

Tre trigger `BEFORE INSERT` applicano i tetti e sollevano errcode dedicati:

| Errcode | Trigger | Limite |
|---|---|---|
| `P0004` | `memories_enforce_plan_limit` | 10 ricordi, cestino compreso (free) |
| `P0005` | `folders_enforce_plan_limit` | 1 cartella (free), 5 (pro) — cestino compreso |
| `P0003` | `subfolders_enforce_rules` | 0 sezioni (free), 3 (pro) |

Il client li mappa **per codice**, mai per sottostringa del messaggio
(`planLimitFromCode()` in `lib/plan.ts`).

PostgREST serve `P0003`/`P0004`/`P0005` come **HTTP 500** (solo `P0001`
diventa 400): il corpo JSON con `code` arriva comunque al client e l'app si
comporta correttamente, ma nei log del progetto i rifiuti di piano — un esito
normale per un utente free — compaiono come 500. È noto e voluto: cambiare
classe di errcode romperebbe i binari già in circolazione che riconoscono
`P0003` per le sezioni.

## Sincronizzazione con RevenueCat

`supabase/functions/revenuecat-sync/index.ts` è l'unica cosa che scrive
`profiles.plan`. Due ingressi:

1. **L'app**, con il JWT dell'utente (`supabase.functions.invoke`): l'app user
   id è `auth.uid()`.
2. **Il webhook RevenueCat**, con l'header `Authorization` concordato nel
   cruscotto: l'app user id è `event.app_user_id`.

In entrambi i casi il piano **non** viene dal corpo della richiesta: si rilegge
da `GET https://api.revenuecat.com/v1/subscribers/{app_user_id}` con la chiave
segreta `sk_`. Il client non è una fonte attendibile per un permesso, e il
payload di un webhook nemmeno.

`verify_jwt = false` per quella funzione (`supabase/config.toml`) perché il
webhook non ha un JWT; la verifica del token utente la fa la funzione con
`auth.getUser(token)`.

Secrets (mai nel repo):

```bash
npx supabase secrets set \
  REVENUECAT_SECRET_KEY=sk_xxx \
  REVENUECAT_WEBHOOK_SECRET=<valore identico a quello nel cruscotto RevenueCat> \
  --project-ref taekvxxljtgzsjrlmumo
npx supabase functions deploy revenuecat-sync --project-ref taekvxxljtgzsjrlmumo
```

`SUPABASE_SERVICE_ROLE_KEY` la inietta la piattaforma: il `service_role` non
entra mai nel repo (AGENTS.md).

## Il client

- `lib/plan.ts` — puro: tabella dei limiti, piano efficace, `canAdd*`,
  `canUsePhotos` (consumato dalle foto), mappa errcode. Coperto da vitest.
- `lib/purchases.ts` — l'SDK dietro `purchasesAvailable`, falso in Expo Go, in
  modalità demo e con le chiavi vuote. Nessuna riga tocca l'SDK in quei casi.
- `lib/use-plan.ts` — `usePlan()` per le schermate; `startPlanSync()` lega
  l'identità RevenueCat all'utente Supabase (`Purchases.logIn(user.id)`),
  ascolta i cambi di abbonamento e chiama la edge function.
- `app/paywall.tsx` — stack ROOT (come `/add` e `/trash`, perché tre dei
  cinque punti di ingresso sono schermate root e una rotta di `(app)` spinta
  da lì monterebbe un secondo navigatore a tab), tre schede, "Ripristina
  acquisti", piede legale con Termini e Privacy (Apple 3.1.2).
- Impostazioni → Abbonamento: piano attuale, "Passa a Pro", "Ripristina
  acquisti".

## Prerequisiti lato proprietario (Maurizio)

Nulla di tutto questo si fa da questo repo.

**Apple**: Paid Apps Agreement, W-8BEN, IBAN, gruppo di abbonamenti con i due
prodotti mensili (`memika_pro_monthly`, `memika_premium_monthly`), In-App
Purchase Key per RevenueCat, tester sandbox.

**Google Play**: profilo pagamenti, i due abbonamenti con il solo piano base
mensile, service account con permesso sui dati finanziari collegato a
RevenueCat, license tester.

**RevenueCat**: progetto "Memika", un'app per piattaforma
(`studio.tailor.memika`), entitlement `pro` e `premium`, offerta `default`
con i due pacchetti mensili, chiavi pubbliche in `eas.json`, chiave segreta e
header del webhook nei secrets Supabase, URL del webhook =
`https://taekvxxljtgzsjrlmumo.supabase.co/functions/v1/revenuecat-sync`.

## Ordine di attivazione

La sequenza completa e autorevole è in `docs/DEPLOY.md` § "Build 3 (vc13 /
iOS 3)". Per la parte piani, in breve:

1. Build 3 `FINISHED` su EAS (contiene `react-native-purchases`), **prima del
   submit**.
2. `npx supabase db push` dal worktree linkato `memika-app`, poi
   `supabase secrets set` + `functions deploy revenuecat-sync`. Solo dopo,
   `eas submit` / upload Play: le colonne devono esistere prima che un tester
   installi vc13, perché il client legge `profiles.plan` e la edge function la
   scrive.
3. I due tester passano a `plan = 'premium'` **dentro la migrazione stessa**,
   sopra i `create trigger` — non con una query prima del push, che
   fallirebbe con `42703` perché la colonna non esiste ancora, né dopo, che
   lascerebbe una finestra in cui chi ha già più di 10 ricordi si trova
   bloccato su un binario senza paywall. Verifica dopo il push:
   `select email, plan from public.profiles where plan <> 'free';`
4. `eas submit -p ios` + upload manuale dell'AAB in Play Console.
5. Acquisto sandbox su entrambe le piattaforme, con verifica che
   `profiles.plan` cambi entro pochi secondi.

## Contesto fiscale (Italia)

Maurizio opera come ditta individuale in regime forfettario. Apple e Google
sono merchant of record: incassano l'IVA, trattengono la commissione e pagano
il netto. La quota del 40 % ad Angelo si calcola sul **netto incassato dallo
store**, non sul lordo: da confermare con Maurizio prima del primo pagamento,
perché il vecchio piano Wix la calcolava sul lordo. Sopra gli 85k€ annui il
regime forfettario decade e gli account store (Individual / Personal) vanno
migrati a un'organizzazione — procedura di store, non modifica di codice.
MD
```

- [ ] **Step 2: Aggiornare `docs/DATA-MODEL.md`**

1. Nella tabella `profiles` (dopo la riga `evening_review_at`):

```markdown
| `plan` | text | `free` / `pro` / `premium`, default `free`. **Non** nella grant di UPDATE: la scrive solo la edge function `revenuecat-sync` |
| `plan_until` | timestamptz | Scadenza dell'entitlement; nel passato = il piano vale `free` (`current_plan()`). null = non scade |
| `rc_app_user_id` | text | App User ID RevenueCat (= `profiles.id`) |
```

2. Nella tabella dei trigger, tre righe nuove:

```markdown
| `memories_enforce_plan_limit` | `memories` | BEFORE INSERT | 10 ricordi sul piano free, **cestino compreso** (`where user_id`, nessun filtro su `deleted_at`) → `P0004` |
| `folders_enforce_plan_limit` | `folders` | BEFORE INSERT | 1 cartella (free) / 5 (pro), cestino compreso → `P0005` |
| `subfolders_enforce_rules` | `subfolders` | BEFORE INSERT OR UPDATE | 0 sezioni (free) / 3 (pro) → `P0003`, più le guardie di integrità (`P0001`) |
```

3. Nella tabella delle funzioni, una riga:

```markdown
| `current_plan(uid)` | DEFINER, execute revocato a `anon`/`authenticated` | solo i trigger | Piano che vale adesso: `plan`, degradato a `free` se `plan_until` è passato |
```

4. Subito sotto la tabella dei trigger, la tabella degli errcode:

```markdown
### Errcode dei limiti

I client mappano il **codice**, mai la sottostringa del messaggio (una
traduzione lo romperebbe). `lib/plan.ts` `planLimitFromCode()` è l'unico posto
che li conosce.

| Errcode | Limite | i18n |
|---|---|---|
| `P0004` | ricordi (10 totali, cestino compreso, free) | `planLimit.memories*` |
| `P0005` | cartelle (1 free, 5 pro, cestino compreso) | `planLimit.folders*` |
| `P0003` | sezioni (0 free, 3 pro) | `planLimit.sections*` |
| `P0001` | guardie di integrità, **non** un limite di piano | messaggio generico |

PostgREST serve `P0003`/`P0004`/`P0005` come **HTTP 500** — la sua tabella
SQLSTATE→HTTP promuove a 400 solo `P0001` — ma il corpo con `code` arriva
comunque al client, che è ciò su cui `planLimitFromCode()` lavora. Quindi i
rifiuti di piano, che sono un esito normale, compaiono come 500 nei log del
progetto: non è un guasto da inseguire.
```

5. In "What's deliberately not modeled yet", togli il punto su
   `profiles.premium_until` (ora esiste, con un nome diverso) e sostituiscilo
   con:

```markdown
- **Storico degli abbonamenti** — `profiles.plan` + `plan_until` bastano per
  un permesso con scadenza; lo storico completo vive in RevenueCat. Se
  servisse in locale, allora una tabella.
```

6. Nella sezione `folders` (frase finale del paragrafo introduttivo), sostituisci
   `Free accounts own one folder (\`FREE_FOLDER_LIMIT\`, enforced in the UI for now).` con:

```markdown
Free accounts own one folder, pro accounts five, premium unlimited —
enforced by `folders_enforce_plan_limit` (`P0005`, migration
20260903100000), counting the trash too.
```

- [ ] **Step 2bis: Bonifica dei documenti che citano le costanti ritirate**

Il Task 8 ha cancellato `PREMIUM_ENABLED`, `FREE_FOLDER_LIMIT`,
`FOLDER_LIMIT_ENFORCED` e `SUBFOLDERS_MAX`. Fuori da `PAYMENTS.md`,
`DATA-MODEL.md` e `AGENTS.md` restano **otto punti** in altri sei documenti
che le descrivono ancora come meccanismo vigente (`grep` verificato il
2026-09-03: `docs/PRODUCT.md` ×2, `docs/ROADMAP.md` ×2, `docs/ARCHITECTURE.md`,
`docs/app-store-listing.md`, `docs/store-listing.md`, `README.md`). Vanno chiusi **in questo
commit**: `AGENTS.md` §2 impone quei documenti come lettura obbligatoria, e
lasciarli lì è il rischio 7 della spec (il prossimo agente cerca un simbolo
che non esiste e `npm run lint` non se ne accorge). È anche la precondizione
verificata dal Task 5, Step 2 del piano `2026-09-03-build3-config-nativa.md`,
che si **ferma** se ne trova ancora uno.

1. `docs/PRODUCT.md` — il paragrafo che comincia con `**Freemium:** a free account owns exactly ONE folder (\`FREE_FOLDER_LIMIT\`).` (fino a `affordance after onboarding.`) diventa:

```markdown
**Freemium:** three plans (2026-09-02). Free = 10 memories in total, ONE
folder, no sections; Pro = unlimited memories, 5 folders, 3 sections;
Premium = everything unlimited plus photos on memories. The caps are enforced
by Postgres triggers (`20260903100000_plans.sql`), mirrored client-side by
`PLAN_LIMITS` in `lib/plan.ts`. Hitting one raises the mascot dialog that
leads to `/paywall`.
```

2. `docs/PRODUCT.md` — nel paragrafo dei pagamenti, sostituisci
   `The old external-checkout screen was deleted on 2026-08-29; the paywall will be rebuilt on RevenueCat behind \`PREMIUM_ENABLED\`. Free = one`
   … fino a `quota for free users (not decided).` con:

```markdown
The old external-checkout screen was deleted on 2026-08-29 and replaced on
2026-09-03 by the in-app paywall `app/paywall.tsx` (RevenueCat, entitlements
`pro` and `premium`). Free = 10 memories and one folder; Pro and Premium as
in `docs/PAYMENTS.md`.
```

3. `docs/ARCHITECTURE.md` — la riga della tabella che comincia con `| Payments |`:

```markdown
| Payments | RevenueCat in-app subscriptions — paywall `app/paywall.tsx`, three plans enforced by Postgres triggers (see `PAYMENTS.md`); inert until the store products and keys exist |
```

4. `docs/ROADMAP.md` — nel blocco "Batch 1", sostituisci `\`PREMIUM_ENABLED=false\` kill-switch.` con `\`PREMIUM_ENABLED=false\` kill-switch (constant removed on 2026-09-03).` (è un registro storico: si annota, non si riscrive).

5. `docs/ROADMAP.md` — la voce `- [ ] **RevenueCat Premium** …` (sei righe, fino a `See \`docs/PAYMENTS.md\`.`) diventa:

```markdown
- [x] **RevenueCat plans** — three plans Free/Pro/Premium built 2026-09-03
      (`lib/plan.ts`, `app/paywall.tsx`, `lib/purchases.ts`, edge function
      `revenuecat-sync`, migration `20260903100000_plans.sql`). INERT until
      the owner prerequisites are done (Paid Apps Agreement, W-8BEN, banking;
      Play payments profile) and the RevenueCat keys are in `eas.json`. See
      `docs/PAYMENTS.md` § "Ordine di attivazione".
```

6. `docs/app-store-listing.md` — il punto 6, sostituisci
   `chiavi di catalogo; \`PREMIUM_ENABLED\` resta per il paywall RevenueCat.` con
   `chiavi di catalogo; dalla build 3 il paywall in-app è \`app/paywall.tsx\` (RevenueCat).`

7. `docs/store-listing.md` — la nota che comincia con `> Nota 2026-08-27:` diventa:

```markdown
> Nota 2026-09-03: dalla build 3 il limite delle cartelle è applicato dal database (free = 1, pro = 5, premium illimitate; trigger `folders_enforce_plan_limit`). Gli account dei due tester sono `premium` dal seed della migrazione, quindi non lo incontrano. La frase "gratuita con una cartella" è di nuovo vera.
```

8. `README.md` — la riga della tabella che comincia con `| Payments |`:

```markdown
| Payments | RevenueCat in-app subscriptions — three plans (free = 10 memories + 1 folder; pro; premium + photos), enforced by Postgres triggers; paywall `app/paywall.tsx` |
```

Verifica (deve stampare **solo** righe al passato — nessun documento che li descriva come meccanismo in funzione):

```bash
grep -rn "PREMIUM_ENABLED\|FREE_FOLDER_LIMIT\|FOLDER_LIMIT_ENFORCED\|SUBFOLDERS_MAX" docs README.md AGENTS.md --exclude-dir=superpowers
```

- [ ] **Step 3: Aggiornare `AGENTS.md`**

1. Il paragrafo freemium della sezione 1 (righe 22-25) diventa:

```markdown
Freemium: tre piani **Free / Pro / Premium** (2026-09-02). Free = 10 ricordi
TOTALI, 1 cartella, 0 sezioni; Pro = ricordi illimitati, 5 cartelle, 3 sezioni;
Premium = tutto illimitato più le foto sui ricordi. I limiti sono applicati da
tre trigger Postgres (`20260903100000_plans.sql`), non dal client. Pagamenti:
abbonamenti in-app via RevenueCat. Vedi `docs/PAYMENTS.md`.
```

2. Dentro la regola dura sulle cartelle, le righe 70-73 finiscono con una frase che questo piano rende falsa: `FOLDER_LIMIT_ENFORCED` non esiste più dal Task 8. Sostituisci la frase finale ("Freemium gating (`FOLDER_LIMIT_ENFORCED`, still `false` in the test phase) returns with the Free/Pro/Premium plans.") con:

```markdown
  Freemium gating is now server-side: three plans Free/Pro/Premium enforced
  by the triggers of `20260903100000_plans.sql` (free = 1 folder, pro = 5,
  premium unlimited), counting every row of the user including the trash.
  The client mirrors the caps with `PLAN_LIMITS` in `lib/plan.ts`;
  `FOLDER_LIMIT_ENFORCED` and `FREE_FOLDER_LIMIT` were removed on
  2026-09-03.
```

3. Nell'anti-pattern sul checkout web (righe 234-238), la coda "the old external-checkout screen was deleted on 2026-08-29; the IAP paywall is not built yet." diventa:

```markdown
  the old external-checkout screen was deleted on 2026-08-29 and replaced on
  2026-09-03 by the in-app paywall `app/paywall.tsx` (RevenueCat).
```

4. Tre regole dure nuove, in coda alla sezione 3:

```markdown
- **`profiles.plan`, `plan_until` e `rc_app_user_id` non entrano MAI nella
  grant di UPDATE per `authenticated`** (`20260825121500_lock_profiles_columns.sql`).
  L'unico scrittore è la Edge Function `revenuecat-sync`, che gira con il
  `service_role` iniettato dalla piattaforma. Un piano scrivibile dal client è
  un piano regalato.
- **I limiti si mappano per errcode, mai per il testo dell'errore.**
  `P0004` ricordi, `P0005` cartelle, `P0003` sezioni; `P0001` sono le guardie
  di integrità e NON è un limite di piano. Il solo posto che li conosce è
  `planLimitFromCode()` in `lib/plan.ts`. Un `msg.includes("limit")` si rompe
  alla prima traduzione — è già successo.
- **Il client rispecchia i limiti, non li decide.** `lib/plan.ts` esiste per
  disabilitare e spiegare prima del rifiuto; se diverge dai trigger, il bug è
  nel client.
```

- [ ] **Step 4: Commit**

```bash
git add docs/PAYMENTS.md docs/DATA-MODEL.md AGENTS.md docs/PRODUCT.md docs/ARCHITECTURE.md docs/ROADMAP.md docs/app-store-listing.md docs/store-listing.md README.md
git commit -F- <<'MSG'
docs(payments): tre piani, trigger, errcode e edge function

PAYMENTS.md riscritta sul modello a tre piani (era ferma a un solo
premium_until e al webhook mai scritto); DATA-MODEL.md guadagna le colonne,
i trigger e la tabella degli errcode; AGENTS.md le tre regole dure che
impediscono di disfare il lavoro, piu' le due frasi che questo ciclo rende
false (FOLDER_LIMIT_ENFORCED cancellato, paywall ora costruito). Bonificati
anche PRODUCT, ARCHITECTURE, ROADMAP, app-store-listing, store-listing e
README, che descrivevano ancora le quattro costanti ritirate dal Task 8 come
meccanismo vigente.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
MSG
```

---

### Task 10: Checklist umana — il gate

**Files:** nessuno. È il passo che il codice non può fare da solo.

**Interfaces:**
- Consumes: tutto quanto sopra.
- Produces: il sistema **attivo**. Finché questa checklist non è completa, i piani sono codice inerte: chiavi vuote ⇒ nessun acquisto, migrazione non applicata ⇒ nessun limite.

L'agente **non** esegue nessuno di questi passi: li riporta ad Angelo e si ferma.

- [ ] **Step 1: Progetto RevenueCat (Angelo + Maurizio)**

1. Account RevenueCat sotto `memikaapp@gmail.com`, progetto "Memika".
2. Due app nel progetto: iOS e Android, entrambe bundle `studio.tailor.memika`.
3. Prodotti, con **gli stessi identificativi** in App Store Connect, Play
   Console e RevenueCat (sono in `lib/plan.ts` `PRODUCT_IDS`). In questo ciclo
   se ne creano **due**, entrambi mensili:
   - `memika_pro_monthly`
   - `memika_premium_monthly`

   `memika_pro_yearly` e `memika_premium_yearly` sono id **riservati**: non
   vanno creati adesso. Il paywall ha un bottone per scheda e nessun
   selettore di periodicità, quindi un pacchetto annuale accanto a un mensile
   verrebbe caricato e non sarebbe mai acquistabile — configurazione e
   adempimenti fiscali per niente. `planForProductId()` li riconosce già:
   aggiungere l'annuale un domani sarà lavoro di interfaccia.
4. Due entitlement: `pro` (il prodotto Pro) e `premium` (quello Premium).
5. Un'offerta chiamata **`default`**, marcata come corrente, con esattamente
   quei due pacchetti.
6. In App Store Connect: In-App Purchase Key caricata in RevenueCat (StoreKit 2
   è il default dell'SDK e senza quella chiave i prodotti iOS non si caricano).
   In Play Console: service account con permesso sui dati finanziari collegato
   a RevenueCat.

- [ ] **Step 2: Le chiavi**

Le pubbliche vanno in `eas.json` (gli slot vuoti li crea il piano
`2026-09-03-build3-config-nativa.md`, Task 3) **e** nel `.env` locale, perché
`eas update` legge da lì:

```
EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_…
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=goog_…
```

`eas.json` è un input del fingerprint: vanno messe **prima** di lanciare la
build 3, altrimenti servirà un'altra build.

La segreta e l'header del webhook vanno solo nei secrets Supabase. **I due
comandi qui sotto si lanciano DOPO il `db push` dello Step 3**, non adesso: la
function scrive `profiles.plan` e prima della migrazione quella colonna non
esiste (è il punto 3b della "Sequenza" di `docs/DEPLOY.md` § "Build 3"). Qui
si preparano solo i valori.

```bash
npx supabase secrets set \
  REVENUECAT_SECRET_KEY=sk_… \
  REVENUECAT_WEBHOOK_SECRET=<stringa lunga a caso> \
  --project-ref taekvxxljtgzsjrlmumo
npx supabase functions deploy revenuecat-sync --project-ref taekvxxljtgzsjrlmumo
```

Nel cruscotto RevenueCat → Integrations → Webhooks:
- URL `https://taekvxxljtgzsjrlmumo.supabase.co/functions/v1/revenuecat-sync`
- Authorization header: **lo stesso identico valore** di
  `REVENUECAT_WEBHOOK_SECRET` (viene inviato verbatim, senza `Bearer`).

- [ ] **Step 3: L'ordine di applicazione della migrazione — il punto delicato**

> **La sequenza umana della build 3 è UNA sola e vive in `docs/DEPLOY.md`
> § "Build 3 (vc13 / iOS 3)"** (la scrive il piano
> `2026-09-03-build3-config-nativa.md`, Task 4; la esegue il suo Task 6).
> Questo step ne è il dettaglio per la parte B4, non una seconda sequenza:
> se le due divergono, vale DEPLOY.md.

La migrazione dei limiti si applica **fra la build FINISHED e il submit agli
store**: le colonne devono esistere prima che un tester installi vc13, perché
il codice di B4 nella build 3 legge `profiles.plan` e la edge function
`revenuecat-sync` la scrive — con lo schema vecchio ogni acquisto fallirebbe
con `42703`.

La finestra dalla parte opposta — `db push` fatto mentre in circolazione ci
sono ancora vc11 e vc12, senza paywall — è **chiusa dal seed dentro la
migrazione**: nella stessa transazione in cui i tetti nascono, Angelo e
Maurizio sono già Premium, e non esistono altri utenti. I due tester **non**
si portano a Premium con una query prima del push: la colonna `plan` non
esiste ancora e quella `update` fallirebbe con `42703`; il seed sta dentro la
migrazione, sopra i `create trigger` (Task 2 Step 1).

Regge comunque anche una finestra inversa (vc13 installata prima del push),
perché **la build 3 sopravvive allo schema pre-migrazione**:
`buildAuthUserFromSession` legge il profilo con `select("*")` e non con
l'elenco delle colonne (Task 4 Step 5.4), quindi non chiede a PostgREST
colonne che ancora non esistono — l'utente resta semplicemente `free`. Se
qualcuno rimettesse lì `.select("role, name, plan, plan_until")`, in quella
finestra ogni accesso fallirebbe con `42703`, l'admin perderebbe il ruolo e
il nome tornerebbe a quello derivato dall'email.

Ordine corretto:

1. Build 3 `FINISHED` su EAS per entrambe le piattaforme (**non ancora
   sottomessa** agli store): è il punto 2 della "Sequenza" di
   `docs/DEPLOY.md` § "Build 3".
2. Controllare che il seed sia davvero nel file, **prima** di lanciare il push:

```bash
grep -n "premium\|create trigger" supabase/migrations/20260903100000_plans.sql
```

Expected: la riga `update public.profiles` con le due email compare **sopra**
la prima riga `create trigger`. Se non c'è, fermarsi: il push bloccherebbe
Maurizio a 10 ricordi su un binario senza paywall.

3. Applicare la migrazione — solo da `memika-app`, che è l'unico worktree
   linkato (`memika-build3` non ha `supabase/.temp` e `db push` ci fallisce):

```bash
cd ../memika-app
npx supabase db push --dry-run    # deve elencare SOLO le migrazioni di B4 e B5
npx supabase db push
```

4. Verificare, subito dopo:

```bash
npx supabase db query --linked -f supabase/verify/20260903_plans_smoke.sql
npx supabase db query --linked "select email, plan, plan_until from public.profiles where plan <> 'free';"
```

Expected: otto righe tutte `ok = true`; la seconda query mostra i due tester a
`premium` con `plan_until` nullo. Se non li mostra, il seed non ha trovato le
email — rimediare subito, con la colonna che adesso esiste:

```bash
npx supabase db query --linked "update public.profiles set plan = 'premium', plan_until = null where email in ('angelo.casula@gmail.com', 'memikaapp@gmail.com');"
```

5. Deploy della edge function con i suoi segreti (Step 2 qui sopra: `secrets
   set` + `functions deploy` + `functions list` = `ACTIVE`) — **dopo** il
   push, così la function non gira mai contro uno schema senza `plan`.
6. **Solo ora** il submit agli store: `eas submit -p ios --latest` e upload
   manuale dell'AAB in Play Console (punto 4 della "Sequenza" di
   `docs/DEPLOY.md` § "Build 3").

- [ ] **Step 4: Acquisto sandbox, una volta per piattaforma**

Con un Apple ID sandbox e un license tester Play: comprare `memika_pro_monthly`
dal paywall e controllare che entro pochi secondi

```bash
npx supabase db query --linked "select email, plan, plan_until, rc_app_user_id from public.profiles where plan <> 'free';"
```

mostri il piano aggiornato. Se non cambia, il webhook non arriva: controllare
l'header nel cruscotto RevenueCat e i log della funzione
(`npx supabase functions logs revenuecat-sync --project-ref taekvxxljtgzsjrlmumo`).

- [ ] **Step 5: Dirlo a Maurizio, prima**

Due cose vanno annunciate, o sembrano guasti:

1. Le sezioni diventano una funzione Pro: chi ne ha le tiene, ma non può
   crearne di nuove sul piano free.
2. Il piano free si ferma a 10 ricordi in tutto. Gli account dei tester sono a
   Premium, quindi loro non lo vedranno — ma è quello che vedrà un utente nuovo.

---

## Verifica finale sul dispositivo

Automatizzare questo non ha senso: servono un telefono, uno store e un
account vero.

1. **Con un account free nuovo**: Add mostra "0 / 10 ricordi in tutto". Al
   decimo salvataggio il contatore diventa rosso; all'undicesimo tocco su
   "Salva" compare la mascotte, non un toast di errore, e "Vedi i piani" apre
   il paywall. Poi elimina un ricordo: il contatore **resta** a 10/10 e il
   salvataggio resta bloccato — il cestino occupa lo slot, ed è quello che
   dice la copy della mascotte.
2. **Cartelle**: con una cartella sola, il "+" in Cartelle **c'è ancora** e al
   tocco apre la mascotte con "Vedi i piani" (non sparisce: un utente free
   non incontrerebbe mai un motivo per passare a Pro in quella schermata).
   Arrivandoci dal foglio "Sposta" → "Nuova cartella…", la creazione fallisce
   con la stessa mascotte, non con "Non siamo riusciti a creare la cartella".
3. **Sezioni**: su free il bottone "Nuova sezione" non compare né nella scheda
   cartella né in Impostazioni cartella. Su un account Pro compare e si ferma a
   tre.
4. **Paywall**: le tre schede mostrano i prezzi veri dello store (non
   "Prezzi non disponibili"), la tab bar non si vede, il piede legale e i due
   link ci sono. Aprilo da tutte e cinque le origini — Impostazioni,
   `/folder/[id]`, `/add`, `/choose-topic`, Impostazioni cartella — e da
   ognuna il back deve riportare esattamente lì, con una sola barra dei tab
   sotto (il sintomo della doppia istanza è un back che atterra su una
   schermata Cartelle vuota).
5. **Acquisto**: dopo l'acquisto sandbox, tornando in Impostazioni la riga
   "Piano" dice Pro senza bisogno di riavviare l'app, e Add torna al contatore
   giornaliero.
6. **Ripristina acquisti**: disinstalla e reinstalla, accedi, tocca
   "Ripristina acquisti": il piano torna Pro.
7. **Un utente grandfathered** (uno dei tester, riportato a `plan = 'free'` per
   la prova, con più di 10 ricordi): vede tutti i suoi ricordi, li ripassa
   normalmente, e solo l'aggiunta è bloccata. Riportalo a Premium dopo la prova.
