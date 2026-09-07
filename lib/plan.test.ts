import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
  periodForProductId,
  periodFromIso,
  pickPlanPackage,
  planForProductId,
  planFromEntitlements,
  planFromRcEntitlements,
  planLimitFromCode,
  yearlySavingsPercent,
  hasPeriodChoice,
  oldProductForChange,
  resolveBillingPeriod,
} from "./plan";

const NOW = new Date("2026-09-03T10:00:00.000Z");
const DAY = 86_400_000;

describe("PLAN_LIMITS — la tabella della spec, alla lettera", () => {
  it("free: 10 ricordi totali, 1 cartella, 0 sezioni, niente foto", () => {
    expect(PLAN_LIMITS.free).toEqual({ memories: 10, folders: 1, sections: 0, photos: false });
  });

  it("plus: ricordi illimitati, 5 cartelle, 3 sezioni, FOTO incluse", () => {
    // 2026-09-04: il listino di Maurizio da' le foto sia a Plus sia a Pro.
    expect(PLAN_LIMITS.plus).toEqual({ memories: null, folders: 5, sections: 3, photos: true });
  });

  it("pro: tutto illimitato, foto incluse", () => {
    expect(PLAN_LIMITS.pro).toEqual({
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
    expect(effectivePlan("plus", until, NOW)).toBe("plus");
    expect(effectivePlan("pro", until, NOW)).toBe("pro");
  });

  it("degrada a free un piano scaduto", () => {
    const until = new Date(NOW.getTime() - 1).toISOString();
    expect(effectivePlan("plus", until, NOW)).toBe("free");
    expect(effectivePlan("pro", until, NOW)).toBe("free");
  });

  it("plan_until null significa 'non scade', non 'scaduto'", () => {
    expect(effectivePlan("plus", null, NOW)).toBe("plus");
    expect(effectivePlan("pro", undefined, NOW)).toBe("pro");
  });

  it("free resta free comunque", () => {
    expect(effectivePlan("free", null, NOW)).toBe("free");
    expect(effectivePlan("free", new Date(NOW.getTime() + DAY).toISOString(), NOW)).toBe("free");
  });

  it("un valore sconosciuto o assente vale free, mai di più", () => {
    expect(effectivePlan(null, null, NOW)).toBe("free");
    expect(effectivePlan(undefined, undefined, NOW)).toBe("free");
    expect(effectivePlan("platinum", null, NOW)).toBe("free");
    expect(effectivePlan("plus", "non-una-data", NOW)).toBe("free");
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

  it("non blocca mai plus e pro", () => {
    expect(canAddMemory(4000, "plus")).toBe(true);
    expect(canAddMemory(4000, "pro")).toBe(true);
  });

  it("un utente grandfathered oltre quota non può aggiungerne", () => {
    // 40 ricordi da prima dei piani: li tiene, ma il prossimo è no.
    expect(canAddMemory(40, "free")).toBe(false);
  });
});

describe("canAddFolder / canAddSection", () => {
  it("cartelle: 1 free, 5 plus, illimitate pro", () => {
    expect(canAddFolder(0, "free")).toBe(true);
    expect(canAddFolder(1, "free")).toBe(false);
    expect(canAddFolder(4, "plus")).toBe(true);
    expect(canAddFolder(5, "plus")).toBe(false);
    expect(canAddFolder(99, "pro")).toBe(true);
  });

  it("sezioni: nessuna sul free, 3 su plus, illimitate pro", () => {
    expect(canAddSection(0, "free")).toBe(false);
    expect(canAddSection(2, "plus")).toBe(true);
    expect(canAddSection(3, "plus")).toBe(false);
    expect(canAddSection(9, "pro")).toBe(true);
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
    expect(memoriesLeft(3, "plus")).toBeNull();
    expect(memoriesLeft(3, "pro")).toBeNull();
  });
});

describe("canUsePhotos — l'interfaccia che consuma il piano B5", () => {
  it("Plus e Pro si', Free no", () => {
    // Il listino da' "foto illimitate nella sezione Meaning" a Plus e a Pro;
    // il Free ha un tetto di due al giorno che NON e' implementato, quindi
    // qui e' false. Un false onesto batte un tetto finto.
    expect(canUsePhotos("free")).toBe(false);
    expect(canUsePhotos("plus")).toBe(true);
    expect(canUsePhotos("pro")).toBe(true);
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

describe("planFromEntitlements — pro batte plus, plus batte free", () => {
  it("pro vince anche se ci sono entrambi", () => {
    expect(planFromEntitlements(["plus", "pro"])).toBe("pro");
  });

  it("plus da solo vale plus", () => {
    expect(planFromEntitlements(["plus"])).toBe("plus");
  });

  it("nessun entitlement attivo = free", () => {
    expect(planFromEntitlements([])).toBe("free");
    expect(planFromEntitlements(["qualcosaltro"])).toBe("free");
  });
});

describe("planFromRcEntitlements — la risposta REST di RevenueCat", () => {
  const REQ = "2026-09-03T10:00:00Z";

  it("pro attivo vince e porta la sua scadenza", () => {
    const out = planFromRcEntitlements(
      {
        plus: { expires_date: "2026-10-03T10:00:00Z" },
        pro: { expires_date: "2026-12-03T10:00:00Z" },
      },
      REQ,
    );
    expect(out).toEqual({ plan: "pro", planUntil: "2026-12-03T10:00:00Z" });
  });

  it("un entitlement scaduto non conta", () => {
    const out = planFromRcEntitlements(
      { pro: { expires_date: "2026-09-01T10:00:00Z" }, plus: { expires_date: "2026-10-03T10:00:00Z" } },
      REQ,
    );
    expect(out).toEqual({ plan: "plus", planUntil: "2026-10-03T10:00:00Z" });
  });

  it("expires_date null = accesso a vita", () => {
    const out = planFromRcEntitlements({ pro: { expires_date: null } }, REQ);
    expect(out).toEqual({ plan: "pro", planUntil: null });
  });

  it("il periodo di grazia tiene vivo l'abbonamento FINO alla fine della grazia", () => {
    // planUntil e' la scadenza dell'ACCESSO, non quella di fatturazione:
    // se qui finisse la expires_date passata, effectivePlan e current_plan
    // degraderebbero subito a free e la grazia non varrebbe niente.
    const out = planFromRcEntitlements(
      {
        plus: {
          expires_date: "2026-09-02T10:00:00Z",
          grace_period_expires_date: "2026-09-10T10:00:00Z",
        },
      },
      REQ,
    );
    expect(out).toEqual({ plan: "plus", planUntil: "2026-09-10T10:00:00Z" });
  });

  it("una grazia gia' passata NON accorcia un abbonamento ancora valido", () => {
    // RevenueCat puo' lasciare la grace_period_expires_date del retry
    // andato a buon fine accanto a una expires_date futura: la grazia
    // PROLUNGA l'accesso, non lo sostituisce. Prendere la grazia qui
    // declasserebbe a free un abbonato che paga, e la Edge Function
    // scriverebbe quel verdetto in profiles.plan.
    const out = planFromRcEntitlements(
      {
        plus: {
          expires_date: "2026-10-03T10:00:00Z",
          grace_period_expires_date: "2026-08-20T10:00:00Z",
        },
      },
      REQ,
    );
    expect(out).toEqual({ plan: "plus", planUntil: "2026-10-03T10:00:00Z" });
  });

  it("la grazia non accorcia l'accesso a vita (expires_date null)", () => {
    const out = planFromRcEntitlements(
      {
        pro: {
          expires_date: null,
          grace_period_expires_date: "2026-08-20T10:00:00Z",
        },
      },
      REQ,
    );
    expect(out).toEqual({ plan: "pro", planUntil: null });
  });

  it("nessun entitlement = free senza scadenza", () => {
    expect(planFromRcEntitlements({}, REQ)).toEqual({ plan: "free", planUntil: null });
  });
});

describe("planForProductId", () => {
  // L'offerta `default` porta i quattro pacchetti, mensili e annuali
  // (selettore Mensile/Annuale nel paywall, 7/9/2026): la mappa deve
  // riconoscerli tutti, e su Google Play nella forma `prodotto:baseplan`.
  it("riconosce i quattro identificativi, mensili e annuali", () => {
    expect(planForProductId(PRODUCT_IDS.plus.monthly)).toBe("plus");
    expect(planForProductId(PRODUCT_IDS.plus.yearly)).toBe("plus");
    expect(planForProductId(PRODUCT_IDS.pro.monthly)).toBe("pro");
    expect(planForProductId(PRODUCT_IDS.pro.yearly)).toBe("pro");
  });

  it("regge la forma 'prodotto:baseplan' di Google Play", () => {
    expect(planForProductId("memika_plus_monthly:monthly")).toBe("plus");
  });

  it("non inventa piani per prodotti sconosciuti", () => {
    expect(planForProductId("qualcosa_altro")).toBeNull();
  });
});

describe("periodForProductId — il periodo dall'id, che e' nostro", () => {
  // Gli id dei prodotti li scegliamo noi e sono identici nei due store: sono
  // la fonte piu' stabile del periodo, prima ancora della durata ISO che lo
  // store dichiara (e che Amazon, per dire, non dichiara affatto).
  it("riconosce i due mensili e i due annuali", () => {
    expect(periodForProductId(PRODUCT_IDS.plus.monthly)).toBe("monthly");
    expect(periodForProductId(PRODUCT_IDS.pro.monthly)).toBe("monthly");
    expect(periodForProductId(PRODUCT_IDS.plus.yearly)).toBe("yearly");
    expect(periodForProductId(PRODUCT_IDS.pro.yearly)).toBe("yearly");
  });

  it("regge la forma 'prodotto:baseplan' di Google Play", () => {
    expect(periodForProductId("memika_plus_yearly:yearly")).toBe("yearly");
    expect(periodForProductId("memika_pro_monthly:monthly")).toBe("monthly");
  });

  it("un id ignoto vale null, non un periodo inventato", () => {
    expect(periodForProductId("qualcosa_altro")).toBeNull();
    expect(periodForProductId("")).toBeNull();
  });
});

describe("periodFromIso — la durata ISO 8601 che lo store dichiara", () => {
  it("P1M e' mensile, P1Y e' annuale", () => {
    expect(periodFromIso("P1M")).toBe("monthly");
    expect(periodFromIso("P1Y")).toBe("yearly");
  });

  it("qualunque altra durata, o nessuna, e' other", () => {
    // Trimestrale, semestrale e settimanale non hanno una riga di prezzo
    // nel paywall: il chiamante li scarta, qui si limitano a non mentire.
    expect(periodFromIso("P3M")).toBe("other");
    expect(periodFromIso("P6M")).toBe("other");
    expect(periodFromIso("P1W")).toBe("other");
    expect(periodFromIso("")).toBe("other");
    expect(periodFromIso(null)).toBe("other");
    expect(periodFromIso(undefined)).toBe("other");
  });
});

describe("yearlySavingsPercent — quanto si risparmia con l'annuale", () => {
  const eur = (price: number) => ({ price, currencyCode: "EUR" });

  it("con i prezzi di Maurizio: Plus 37%, Pro 40%", () => {
    // 3,99 x 12 = 47,88 contro 29,99; 6,99 x 12 = 83,88 contro 49,99.
    expect(yearlySavingsPercent(eur(3.99), eur(29.99))).toBe(37);
    expect(yearlySavingsPercent(eur(6.99), eur(49.99))).toBe(40);
  });

  it("null quando manca uno dei due pacchetti", () => {
    expect(yearlySavingsPercent(undefined, eur(29.99))).toBeNull();
    expect(yearlySavingsPercent(eur(3.99), undefined)).toBeNull();
    expect(yearlySavingsPercent(undefined, undefined)).toBeNull();
  });

  it("null con valute diverse: non si confrontano numeri di due monete", () => {
    expect(yearlySavingsPercent(eur(3.99), { price: 29.99, currencyCode: "USD" })).toBeNull();
  });

  it("null con un mensile a zero o negativo", () => {
    expect(yearlySavingsPercent(eur(0), eur(29.99))).toBeNull();
    expect(yearlySavingsPercent(eur(-1), eur(29.99))).toBeNull();
  });

  it("null quando l'annuale non conviene: nessuna pillola 'Risparmi lo 0%'", () => {
    expect(yearlySavingsPercent(eur(2), eur(24))).toBeNull(); // esattamente dodici mensili
    expect(yearlySavingsPercent(eur(2), eur(30))).toBeNull(); // piu' caro di dodici mensili
  });
});

describe("pickPlanPackage — un solo posto decide cosa si mostra e cosa si compra", () => {
  const list = [
    { plan: "plus", period: "monthly", id: "plus-m" },
    { plan: "plus", period: "yearly", id: "plus-y" },
    { plan: "pro", period: "monthly", id: "pro-m" },
  ] as const;

  it("trova la coppia esatta piano + periodo", () => {
    expect(pickPlanPackage(list, "plus", "yearly")?.id).toBe("plus-y");
    expect(pickPlanPackage(list, "plus", "monthly")?.id).toBe("plus-m");
  });

  it("ripiega sull'altro periodo dello stesso piano", () => {
    // Pro ha solo il mensile: con "Annuale" selezionato la scheda mostra e
    // vende il mensile, invece di restare muta.
    expect(pickPlanPackage(list, "pro", "yearly")?.id).toBe("pro-m");
  });

  it("null se il piano non ha pacchetti", () => {
    expect(pickPlanPackage([], "plus", "monthly")).toBeNull();
    expect(pickPlanPackage(list, "free", "monthly")).toBeNull();
  });

  it("mai un pacchetto di un altro piano", () => {
    const onlyPlus = list.filter((p) => p.plan === "plus");
    expect(pickPlanPackage(onlyPlus, "pro", "monthly")).toBeNull();
    expect(pickPlanPackage(onlyPlus, "pro", "yearly")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Il gemello Deno (supabase/functions/revenuecat-sync/index.ts)
// ---------------------------------------------------------------------------

/**
 * Toglie commenti di riga e di blocco senza farsi ingannare dalle stringhe:
 * nel gemello c'e' "https://api.revenuecat.com/v1/subscribers/", che una
 * regex ingenua taglierebbe a meta'. Serve a due cose: confrontare il CODICE
 * dei due file ignorando la prosa, e impedire che un commento soddisfi da
 * solo un'asserzione sull'aritmetica.
 */
function stripComments(src: string): string {
  let out = "";
  let quote: string | null = null;
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1] ?? "";
    if (quote !== null) {
      if (c === "\\") {
        out += c + next;
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      out += c;
      i += 1;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      out += c;
      i += 1;
      continue;
    }
    if (c === "/" && next === "/") {
      while (i < src.length && src[i] !== "\n") i += 1;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

/**
 * Il testo di `function <nome>(…) { … }`, dalla firma alla graffa di chiusura
 * in colonna 0 — entrambi i file dichiarano queste tre funzioni al livello
 * superiore. Il pareggio delle graffe verifica che il taglio abbia preso il
 * corpo intero e non si sia fermato prima; l'assenza del nome e' un errore,
 * non un confronto fra due stringhe vuote.
 */
function fnSource(src: string, name: string): string {
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`funzione ${name} non trovata`);
  const end = src.indexOf("\n}", start);
  if (end < 0) throw new Error(`corpo di ${name} mai chiuso`);
  const body = src.slice(start, end + 2);
  if (body.split("{").length !== body.split("}").length) {
    throw new Error(`corpo di ${name} sbilanciato`);
  }
  return body;
}

/** Forma confrontabile fra i due file: niente commenti, accenti, spaziatura. */
function twinShape(src: string, name: string): string {
  return fnSource(stripComments(src), name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

describe("il gemello Deno della derivazione RevenueCat", () => {
  // Path ancorati al file di test, non alla cwd: la guardia deve mordere
  // anche se vitest parte da un'altra radice, non sparire in silenzio.
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const twin = readFileSync(resolve(root, "supabase/functions/revenuecat-sync/index.ts"), "utf8");
  const mine = readFileSync(resolve(root, "lib/plan.ts"), "utf8");
  const twinCode = stripComments(twin);

  // Un marcatore nei commenti e l'ordine pro/plus si possono lasciare
  // intatti riscrivendo l'aritmetica sotto: qui si confronta il CORPO delle
  // tre funzioni, che e' la cosa che deve restare identica.
  it.each(["rcDeadline", "rcActive", "planFromRcEntitlements"])(
    "%s e' la stessa funzione di lib/plan.ts",
    (name) => {
      expect(twinShape(twin, name)).toBe(twinShape(mine, name));
    },
  );

  it("prende la PIU' TARDA fra scadenza e grazia, non la sola grazia", () => {
    // La regressione da fermare e' `return grace ?? ent.expires_date;`: con
    // una grazia vecchia accanto a una expires_date futura la funzione
    // scriverebbe plan_until nel passato e current_plan() declasserebbe a
    // free un abbonato che paga. Vincolata alla lettera, e sul codice senza
    // commenti, cosi' non passa nemmeno se i due file regrediscono insieme.
    expect(twinCode).toContain("return graceTs > expiresTs ? grace : ent.expires_date;");
    expect(twinCode).not.toContain("grace ?? ent.expires_date");
  });

  it("non declassa a free una concessione di cortesia", () => {
    // Il seed di 20260903100000_plans.sql porta i due tester a
    // plan='pro', plan_until null, rc_app_user_id null. RevenueCat non
    // ha alcun entitlement per quegli account, quindi la derivazione dice
    // 'free': senza questa guardia la cortesia durerebbe fino al primo
    // avvio della build 3 (startPlanSync → refreshPlan → edge function),
    // che e' il percorso normale, non un caso limite.
    expect(twinCode).toContain(
      'current.plan !== "free" && current.plan_until === null && current.rc_app_user_id === null',
    );
    expect(twinCode).toContain('if (plan === "free" && courtesyGrant)');
    // La guardia deve stare PRIMA della scrittura, altrimenti non guarda
    // nulla.
    const guard = twinCode.indexOf("courtesyGrant");
    const write = twinCode.indexOf(".update({ plan,");
    expect(guard).toBeGreaterThanOrEqual(0);
    expect(write).toBeGreaterThanOrEqual(0);
    expect(guard).toBeLessThan(write);
  });

  it("si dichiara gemello e valuta pro prima di plus", () => {
    expect(twin).toContain("gemello di lib/plan.ts planFromRcEntitlements");
    const pro = twinCode.indexOf("ENTITLEMENT_PRO]");
    const plus = twinCode.indexOf("ENTITLEMENT_PLUS]");
    // indexOf torna -1 su un nome rinominato: senza queste due righe
    // l'ordine passerebbe a vuoto, perche' -1 e' minore di qualunque indice.
    expect(pro).toBeGreaterThanOrEqual(0);
    expect(plus).toBeGreaterThanOrEqual(0);
    expect(pro).toBeLessThan(plus);
  });
});

describe("resolveBillingPeriod", () => {
  it("l'id decide quando la durata ISO e' d'accordo o manca", () => {
    expect(resolveBillingPeriod("memika_plus_monthly", "P1M")).toBe("monthly");
    expect(resolveBillingPeriod("memika_pro_yearly", "P1Y")).toBe("yearly");
    expect(resolveBillingPeriod("memika_plus_yearly", null)).toBe("yearly");
    expect(resolveBillingPeriod("memika_plus_monthly", "")).toBe("monthly");
  });
  it("id ignoto: vale la durata ISO", () => {
    expect(resolveBillingPeriod("altro_prodotto", "P1M")).toBe("monthly");
    expect(resolveBillingPeriod("altro_prodotto", "P3M")).toBe("other");
    expect(resolveBillingPeriod("altro_prodotto", null)).toBe("other");
  });
  it("id e durata in disaccordo: 'other', mai venduto come l'uno o l'altro", () => {
    // Un secondo base plan annuale sotto il prodotto MENSILE su Play:
    // l'id direbbe mensile, lo store dice un anno. Non si vende.
    expect(resolveBillingPeriod("memika_plus_monthly:yearly", "P1Y")).toBe("other");
    expect(resolveBillingPeriod("memika_pro_yearly:monthly", "P1M")).toBe("other");
  });
});

describe("hasPeriodChoice", () => {
  const pkg = (plan: "free" | "plus" | "pro", period: string) => ({ plan, period });
  it("vero solo se almeno un piano ha ENTRAMBI i periodi", () => {
    expect(hasPeriodChoice([pkg("plus", "monthly"), pkg("plus", "yearly")])).toBe(true);
    expect(hasPeriodChoice([pkg("plus", "monthly"), pkg("pro", "monthly"), pkg("pro", "yearly")])).toBe(true);
  });
  it("falso con i soli mensili, con i soli annuali, e con periodi diversi su piani diversi", () => {
    expect(hasPeriodChoice([pkg("plus", "monthly"), pkg("pro", "monthly")])).toBe(false);
    expect(hasPeriodChoice([pkg("plus", "yearly")])).toBe(false);
    // Plus solo mensile, Pro solo annuale: due segmenti che non cambierebbero nulla.
    expect(hasPeriodChoice([pkg("plus", "monthly"), pkg("pro", "yearly")])).toBe(false);
    expect(hasPeriodChoice([])).toBe(false);
  });
});

describe("oldProductForChange", () => {
  it("trova l'abbonamento attivo del piano corrente, senza il base plan di Play", () => {
    expect(oldProductForChange(["memika_plus_monthly:monthly"], "plus")).toBe("memika_plus_monthly");
    expect(oldProductForChange(["memika_plus_yearly"], "plus")).toBe("memika_plus_yearly");
    expect(oldProductForChange(["altro", "memika_pro_monthly:monthly"], "pro")).toBe("memika_pro_monthly");
  });
  it("null per il piano free, per una lista vuota o senza un prodotto di quel piano", () => {
    expect(oldProductForChange(["memika_plus_monthly"], "free")).toBeNull();
    expect(oldProductForChange([], "plus")).toBeNull();
    expect(oldProductForChange(["memika_pro_monthly"], "plus")).toBeNull();
  });
});
