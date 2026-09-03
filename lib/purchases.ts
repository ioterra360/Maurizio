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
