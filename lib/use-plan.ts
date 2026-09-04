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

/**
 * Rilegge il piano dal server e lo scrive nello store.
 *
 * Non lancia MAI — il chiamante e' quasi sempre un percorso di fondo — ma
 * ritorna `false` quando la lettura e' fallita e lo store e' rimasto com'era.
 * Chi mostra un esito all'utente DEVE guardare quel valore: `syncPlan()`
 * passa dalla edge function `revenuecat-sync`, che puo' non rispondere (rete,
 * 5xx a freddo, il ramo 500 `not_configured` quando manca un segreto). In quel
 * caso `profiles.plan` non e' stato riletto, `usePlan()` dice ancora "free" e
 * ogni gate dell'app — il `+` della foto, il badge "Piano attuale", i trigger
 * P0003/P0004/P0005 — si comporta di conseguenza. Annunciare "Ora sei
 * Premium" li' significa promettere un piano che l'app non sta applicando.
 */
export async function refreshPlan(): Promise<boolean> {
  try {
    const { plan, planUntil } = await syncPlan();
    useAuthStore.getState().setPlan(plan, planUntil);
    return true;
  } catch (err) {
    reportError("plan/sync", err);
    return false;
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

  // L'apply iniziale aspetta l'IDRATAZIONE, non il primo render.
  //
  // Lo store nasce con `user: null` (lib/auth-store.ts) e `hydrate()` e'
  // asincrona (app/_layout.tsx la lancia in un effetto). Chiamare apply qui
  // e basta significherebbe prendere SEMPRE, a ogni avvio a freddo, il ramo
  // "nessun utente" e chiamare Purchases.logOut(): l'SDK ricorda l'appUserID
  // fra un lancio e l'altro, quindi non e' anonimo, e il logOut creerebbe un
  // cliente anonimo NUOVO a ogni apertura dell'app, butterebbe l'entitlement
  // fino al logIn successivo e farebbe scattare un CustomerInfoUpdateListener
  // — cioe' un refreshPlan() quando nello store non c'e' ancora sessione
  // (401 + rumore su Sentry). Su una build con le chiavi RevenueCat e'
  // esattamente il percorso normale, non un caso limite.
  const first = useAuthStore.getState();
  if (first.hydrated) apply(first.user?.id);

  stopListener = addCustomerPlanListener(() => {
    // L'SDK dice "e' cambiato qualcosa"; QUANTO sia cambiato lo decide il
    // server, che rilegge da RevenueCat con la chiave segreta.
    void refreshPlan();
  });

  const unsubscribe = useAuthStore.subscribe((state, prev) => {
    // Prima dell'idratazione non si decide nulla: `user` e' ancora il null
    // iniziale, non una risposta. hydrate() scrive PRIMA l'utente e POI
    // alza `hydrated` (due notifiche), quindi si ignora la prima e si agisce
    // sulla seconda: un solo apply per avvio, con l'id giusto.
    if (!state.hydrated) return;
    if (prev.hydrated && state.user?.id === prev.user?.id) return;
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
