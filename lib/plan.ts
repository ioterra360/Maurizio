/**
 * I piani di Memika — Free / Plus / Pro (spec 2026-09-02 §B4).
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

export const PLANS = ["free", "plus", "pro"] as const;
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
  /**
   * Cartelle VIVE dell'account, cestino ESCLUSO. null = illimitate.
   *
   * Regola opposta a quella dei ricordi, di proposito: il tetto free vale 1
   * e l'app non ha alcuna "elimina definitivamente", quindi contare anche il
   * cestino lascerebbe chi cestina la sua unica cartella con zero cartelle e
   * senza poterne creare una fino alla purga (24 ore). Lato server contano le
   * sole righe vive (`folders_enforce_plan_limit`) e il buco del ciclo
   * "cestina → crea → ripristina" si chiude sul ripristino
   * (`folders_enforce_plan_limit_on_restore`, stesso P0005).
   * `countFolders()` (lib/api.ts) filtra già `deleted_at is null`: il numero
   * che il client passa qui è lo stesso che il trigger conta.
   */
  folders: number | null;
  /** Sezioni (sottocartelle) per cartella. null = illimitate. */
  sections: number | null;
  /** Foto sui ricordi — consumato dal piano B5. */
  photos: boolean;
};

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: { memories: 10, folders: 1, sections: 0, photos: false },
  plus: { memories: null, folders: 5, sections: 3, photos: false },
  pro: { memories: null, folders: null, sections: null, photos: true },
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

/** `count` = cartelle VIVE dell'utente (cestino escluso, come countFolders). */
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

/** Le foto sui ricordi sono Pro (spec :640). Interfaccia del piano B5. */
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

export const ENTITLEMENT_PLUS = "plus";
export const ENTITLEMENT_PRO = "pro";

/** Dagli entitlement ATTIVI dell'SDK (customerInfo.entitlements.active). */
export function planFromEntitlements(activeIds: readonly string[]): Plan {
  if (activeIds.includes(ENTITLEMENT_PRO)) return "pro";
  if (activeIds.includes(ENTITLEMENT_PLUS)) return "plus";
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
 * La scadenza dell'ACCESSO: la PIÙ TARDA fra la scadenza normale e la
 * finestra di grazia. null = non scade.
 *
 * La grazia PROLUNGA l'accesso, non lo sostituisce: se RevenueCat lascia
 * una `grace_period_expires_date` vecchia accanto a una `expires_date`
 * futura — succede quando un pagamento va a buon fine dopo un retry, prima
 * che RC ripulisca il campo — prendere la grazia declasserebbe a free un
 * abbonato che PAGA, e la Edge Function scriverebbe quel verdetto in
 * `profiles.plan`. Quindi: massimo delle due, mai la sola grazia.
 */
function rcDeadline(ent: RcEntitlement): string | null {
  // expires_date null = accesso a vita: nessuna grazia può accorciarlo.
  if (ent.expires_date == null) return null;
  const grace = ent.grace_period_expires_date;
  if (!grace) return ent.expires_date;
  const graceTs = Date.parse(grace);
  if (Number.isNaN(graceTs)) return ent.expires_date;
  const expiresTs = Date.parse(ent.expires_date);
  if (Number.isNaN(expiresTs)) return grace;
  return graceTs > expiresTs ? grace : ent.expires_date;
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
  const pro = entitlements[ENTITLEMENT_PRO];
  if (pro && rcActive(pro, at)) {
    return { plan: "pro", planUntil: rcDeadline(pro) };
  }
  const plus = entitlements[ENTITLEMENT_PLUS];
  if (plus && rcActive(plus, at)) {
    return { plan: "plus", planUntil: rcDeadline(plus) };
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
  plus: { monthly: "memika_plus_monthly", yearly: "memika_plus_yearly" },
  pro: { monthly: "memika_pro_monthly", yearly: "memika_pro_yearly" },
} as const;

/**
 * Su Google Play l'identificativo arriva nella forma `prodotto:baseplan`,
 * quindi si confronta solo la parte prima dei due punti.
 */
export function planForProductId(productIdentifier: string): Plan | null {
  const base = productIdentifier.split(":")[0] ?? "";
  if (base === PRODUCT_IDS.pro.monthly || base === PRODUCT_IDS.pro.yearly) return "pro";
  if (base === PRODUCT_IDS.plus.monthly || base === PRODUCT_IDS.plus.yearly) return "plus";
  return null;
}
