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

  it("una grazia gia' passata NON accorcia un abbonamento ancora valido", () => {
    // RevenueCat puo' lasciare la grace_period_expires_date del retry
    // andato a buon fine accanto a una expires_date futura: la grazia
    // PROLUNGA l'accesso, non lo sostituisce. Prendere la grazia qui
    // declasserebbe a free un abbonato che paga, e la Edge Function
    // scriverebbe quel verdetto in profiles.plan.
    const out = planFromRcEntitlements(
      {
        pro: {
          expires_date: "2026-10-03T10:00:00Z",
          grace_period_expires_date: "2026-08-20T10:00:00Z",
        },
      },
      REQ,
    );
    expect(out).toEqual({ plan: "pro", planUntil: "2026-10-03T10:00:00Z" });
  });

  it("la grazia non accorcia l'accesso a vita (expires_date null)", () => {
    const out = planFromRcEntitlements(
      {
        premium: {
          expires_date: null,
          grace_period_expires_date: "2026-08-20T10:00:00Z",
        },
      },
      REQ,
    );
    expect(out).toEqual({ plan: "premium", planUntil: null });
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

  // Un marcatore nei commenti e l'ordine premium/pro si possono lasciare
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

  it("si dichiara gemello e valuta premium prima di pro", () => {
    expect(twin).toContain("gemello di lib/plan.ts planFromRcEntitlements");
    const premium = twinCode.indexOf("ENTITLEMENT_PREMIUM]");
    const pro = twinCode.indexOf("ENTITLEMENT_PRO]");
    // indexOf torna -1 su un nome rinominato: senza queste due righe
    // l'ordine passerebbe a vuoto, perche' -1 e' minore di qualunque indice.
    expect(premium).toBeGreaterThanOrEqual(0);
    expect(pro).toBeGreaterThanOrEqual(0);
    expect(premium).toBeLessThan(pro);
  });
});
