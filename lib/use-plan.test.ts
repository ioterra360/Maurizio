/**
 * startPlanSync — quando l'identita' RevenueCat viene legata (o slegata).
 *
 * La regressione che questi test fermano: `apply()` chiamato al primo render,
 * quando lo store e' ancora al suo `user: null` iniziale e `hydrate()` non ha
 * finito. Su una build con le chiavi quel ramo chiama Purchases.logOut() a
 * OGNI avvio — l'SDK ricorda l'appUserID fra un lancio e l'altro, quindi non
 * e' anonimo — creando un cliente anonimo nuovo, buttando l'entitlement fino
 * al logIn successivo e scatenando un refreshPlan() senza sessione.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const identify = vi.fn(async (_id: string) => "free");
const signOut = vi.fn(async () => {});
const configure = vi.fn();

vi.mock("./purchases", () => ({
  purchasesAvailable: true,
  configurePurchases: () => configure(),
  identifyPurchases: (id: string) => identify(id),
  signOutPurchases: () => signOut(),
  addCustomerPlanListener: () => () => {},
}));

vi.mock("./api", () => ({
  syncPlan: async () => ({ plan: "free", planUntil: null }),
}));

// report-error importa @sentry/react-native, che tira dentro il react-native
// vero (non lo stub di test/stubs). Qui nessun ramo catch e' esercitato.
vi.mock("./report-error", () => ({ reportError: vi.fn() }));

// auth-store parla con Supabase all'import: qui non serve nessun backend, si
// pilota lo store a mano con setState.
vi.mock("./supabase", () => ({
  isSupabaseConfigured: true,
  clearPersistedSession: async () => {},
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  },
}));

import { useAuthStore, type AuthUser } from "./auth-store";
import { startPlanSync } from "./use-plan";

const user = (id: string): AuthUser => ({
  id,
  email: `${id}@example.it`,
  name: id,
  role: "user",
  plan: "free",
  planUntil: null,
});

describe("startPlanSync — l'idratazione e' la condizione, non il primo render", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ user: null, hydrated: false });
  });

  it("non tocca l'SDK finche' lo store non e' idratato", () => {
    const stop = startPlanSync();
    expect(identify).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
    stop();
  });

  it("avvio a freddo con sessione persistita: un solo logIn, con l'id giusto", () => {
    const stop = startPlanSync();
    // hydrate() scrive PRIMA l'utente e POI alza `hydrated`: due notifiche
    // dallo store, un solo apply.
    useAuthStore.setState({ user: user("u1") });
    expect(identify).not.toHaveBeenCalled();
    useAuthStore.setState({ hydrated: true });
    expect(identify).toHaveBeenCalledTimes(1);
    expect(identify).toHaveBeenCalledWith("u1");
    expect(signOut).not.toHaveBeenCalled();
    stop();
  });

  it("avvio a freddo senza sessione: un solo logOut, all'idratazione", () => {
    const stop = startPlanSync();
    useAuthStore.setState({ hydrated: true });
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(identify).not.toHaveBeenCalled();
    stop();
  });

  it("montato quando l'idratazione e' gia' finita, applica subito", () => {
    useAuthStore.setState({ user: user("u2"), hydrated: true });
    const stop = startPlanSync();
    expect(identify).toHaveBeenCalledTimes(1);
    expect(identify).toHaveBeenCalledWith("u2");
    stop();
  });

  it("login e logout successivi continuano a passare", () => {
    useAuthStore.setState({ hydrated: true });
    const stop = startPlanSync();
    expect(signOut).toHaveBeenCalledTimes(1);
    useAuthStore.setState({ user: user("u3") });
    expect(identify).toHaveBeenCalledWith("u3");
    useAuthStore.setState({ user: null });
    expect(signOut).toHaveBeenCalledTimes(2);
    stop();
  });

  it("gli id demo non raggiungono mai RevenueCat", () => {
    useAuthStore.setState({ user: user("demo-user"), hydrated: true });
    const stop = startPlanSync();
    expect(identify).not.toHaveBeenCalled();
    expect(signOut).toHaveBeenCalledTimes(1);
    stop();
  });
});
