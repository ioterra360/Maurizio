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
  STORE_REPLACEMENT_MODE,
  type StoreProductChangeInfo,
  type CustomerInfo,
  type PurchasesError,
  type PurchasesPackage,
} from "react-native-purchases";

import { isDemoMode } from "./supabase";
import { reportError } from "./report-error";
import {
  ENTITLEMENT_PLUS,
  ENTITLEMENT_PRO,
  oldProductForChange,
  resolveBillingPeriod,
  planForProductId,
  planFromEntitlements,
  type BillingPeriod,
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
  plan: "plus" | "pro";
  /** Solo mensile o annuale: un periodo diverso non entra mai in lista. */
  period: BillingPeriod;
  /** Prezzo gia' formattato nella valuta dello store. */
  priceString: string;
  /** Prezzo numerico e valuta: servono al calcolo del risparmio annuale. */
  price: number;
  currencyCode: string;
  /**
   * L'annuale diviso dodici, gia' formattato dallo store
   * (`product.pricePerMonthString`, nullo per i prodotti una tantum). Nel
   * paywall e' la riga "pari a X al mese" sotto il prezzo annuale.
   */
  pricePerMonthString: string | null;
  pkg: PurchasesPackage;
};

/**
 * L'id del prodotto e' nostro ed e' la fonte piu' stabile del periodo; la
 * durata ISO dichiarata dallo store e' la seconda, e se le due non sono
 * d'accordo il pacchetto non si vende (resolveBillingPeriod, lib/plan.ts).
 */
function periodOf(pkg: PurchasesPackage): BillingPeriod | "other" {
  return resolveBillingPeriod(pkg.product.identifier, pkg.product.subscriptionPeriod);
}

/**
 * I pacchetti dell'offerta corrente, raggruppabili per piano e periodo.
 * `current` e' null quando nessuna offerta e' marcata corrente o quando lo
 * store non ha restituito prodotti (prodotti non approvati, app non ancora
 * su un canale di test): in quel caso il paywall mostra le schede senza
 * prezzo.
 *
 * Un pacchetto con un periodo che non e' mensile ne' annuale (trimestrale,
 * semestrale) viene SCARTATO e segnalato, non messo in lista: il paywall
 * non ha una riga di prezzo per lui, e in lista diventerebbe una scheda
 * senza prezzo con il bottone acceso (docs/PAYMENTS.md).
 */
export async function loadPlanPackages(): Promise<PlanPackage[]> {
  if (!purchasesAvailable || !configured) return [];
  const offerings = await Purchases.getOfferings();
  const packages = offerings.current?.availablePackages ?? [];
  const out: PlanPackage[] = [];
  for (const pkg of packages) {
    const { product } = pkg;
    const plan = planForProductId(product.identifier);
    if (plan !== "plus" && plan !== "pro") continue;
    const period = periodOf(pkg);
    if (period === "other") {
      reportError(
        "purchases/unknown-period",
        new Error(`periodo non riconosciuto: ${product.subscriptionPeriod ?? "null"}`),
        { productId: product.identifier },
      );
      continue;
    }
    out.push({
      plan,
      period,
      priceString: product.priceString,
      price: product.price,
      currencyCode: product.currencyCode,
      pricePerMonthString: product.pricePerMonthString,
      pkg,
    });
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
export async function purchasePlan(pkg: PlanPackage, currentPlan: Plan): Promise<PurchaseOutcome> {
  const change = await productChangeFor(currentPlan);
  const { customerInfo } = await Purchases.purchasePackage(pkg.pkg, null, change).catch((e: unknown) => {
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

/**
 * Solo Google Play: chi ha gia' un abbonamento (Plus) e ne compra uno
 * superiore (Pro) deve dire quale sostituisce, altrimenti Play ne apre un
 * SECONDO e i due si rinnovano insieme. Su iOS non serve: i quattro
 * prodotti stanno nello stesso gruppo e Apple fa il cambio da se'. Il tempo
 * gia' pagato del vecchio piano viene convertito in tempo del nuovo
 * (WITH_TIME_PRORATION), che e' il cambio meno sorprendente per chi paga.
 * Se RevenueCat non riporta nessun prodotto del piano corrente si compra
 * senza cambio: e' il caso di una concessione di cortesia (piano scritto a
 * mano, nessun abbonamento vero da sostituire).
 */
async function productChangeFor(currentPlan: Plan): Promise<StoreProductChangeInfo | null> {
  if (Platform.OS !== "android" || currentPlan === "free") return null;
  const info = await Purchases.getCustomerInfo();
  const old = oldProductForChange(info.activeSubscriptions, currentPlan);
  return old
    ? { oldProductIdentifier: old, replacementMode: STORE_REPLACEMENT_MODE.WITH_TIME_PRORATION }
    : null;
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
export const ENTITLEMENTS = { plus: ENTITLEMENT_PLUS, pro: ENTITLEMENT_PRO } as const;
