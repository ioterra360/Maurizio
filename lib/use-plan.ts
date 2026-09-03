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
