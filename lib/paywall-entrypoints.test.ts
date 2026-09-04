/**
 * Chi puo' portare l'utente a `/paywall`, e a che condizione.
 *
 * Perche' esiste (attivazione 2026-09-04): finche' Google non approva il
 * profilo pagamenti e Apple non firma il contratto per le app a pagamento,
 * `EXPO_PUBLIC_REVENUECAT_*_KEY` sono stringhe vuote, `purchasesAvailable` e'
 * falso, l'SDK non viene mai chiamato e il paywall mostra le tre schede con
 * TUTTI i bottoni spenti. Un ingresso sempre montato porterebbe li' dentro
 * chiunque: e' un vicolo cieco per un tester Android e, su iOS, la
 * funzionalita' segnaposto che la linea guida 2.1 fa rifiutare.
 *
 * La regola che questi test tengono e' una sola: **al paywall si arriva solo
 * dietro un limite**. Nessuna schermata lo offre da sola, tranne le
 * Impostazioni — e li' l'intera sezione Abbonamento e' condizionata a
 * `purchasesAvailable`, esattamente come lo era gia' la sola riga "Ripristina
 * acquisti".
 *
 * Come lib/plans-migration.test.ts e lib/native-config.test.ts: qui non si
 * puo' RENDERIZZARE una schermata React Native, quindi si legge il sorgente
 * come TESTO. Vitest gira dalla radice del repo.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

/** Ogni .ts/.tsx sotto app/ e components/, in percorsi con la barra avanti. */
function sources(): string[] {
  const out: string[] = [];
  for (const dir of ["app", "components"]) {
    for (const entry of readdirSync(path.join(ROOT, dir), {
      recursive: true,
      withFileTypes: true,
    })) {
      if (!entry.isFile()) continue;
      if (!/\.tsx?$/.test(entry.name)) continue;
      const abs = path.join(entry.parentPath, entry.name);
      out.push(path.relative(ROOT, abs).split(path.sep).join("/"));
    }
  }
  return out.sort();
}

describe("ingressi al paywall", () => {
  it("sono esattamente tre, e nessuno di piu'", () => {
    // Il valore di questo test e' la LISTA CHIUSA: un quarto ingresso che
    // spuntasse da qualche parte (una card in Home, un banner in Conoscenza)
    // fallirebbe qui invece di finire in una build da sottomettere.
    const pushers = sources().filter((f) => read(f).includes('router.push("/paywall"'));
    expect(pushers).toEqual([
      "app/(app)/settings.tsx", // dietro purchasesAvailable — vedi sotto
      "app/add.tsx", // dietro !canUsePhotos(plan)
      "components/PlanLimitDialog.tsx", // dietro un errcode di limite
    ]);
  });

  it("Impostazioni: la sezione Abbonamento INTERA sta dietro purchasesAvailable", () => {
    const src = read("app/(app)/settings.tsx");
    const gate = src.indexOf("{purchasesAvailable ? (");
    const about = src.indexOf("{/* About */}");
    expect(gate).toBeGreaterThan(-1);
    expect(about).toBeGreaterThan(gate);
    // Intestazione, riga "Piano", ingresso al paywall e ripristino: tutti
    // dentro la stessa condizione, prima della sezione About.
    for (const needle of [
      'tr("settings.subscriptionSection")',
      'tr("settings.planLabel")',
      'router.push("/paywall" as never)',
      'tr("settings.restorePurchases")',
    ]) {
      const at = src.indexOf(needle);
      expect(at, `${needle} fuori dalla sezione condizionata`).toBeGreaterThan(gate);
      expect(at, `${needle} fuori dalla sezione condizionata`).toBeLessThan(about);
    }
  });

  it("Impostazioni: una sola condizione, non due annidate", () => {
    // La riga "Ripristina acquisti" aveva la propria guardia; ora e' la
    // sezione a portarla. Due condizioni identiche annidate direbbero al
    // lettore che ce n'e' una che puo' essere falsa da sola: non e' cosi'.
    const src = read("app/(app)/settings.tsx");
    expect(src.split("purchasesAvailable ?").length - 1).toBe(1);
  });

  it("Add: il gate foto e' un controllo di piano, non un bottone libero", () => {
    const src = read("app/add.tsx");
    const flat = src.replace(/\s+/g, " ");
    // openPhotoSheet apre il dialogo (che poi porta al paywall) SOLO quando il
    // piano non ha le foto; con le foto si apre il picker e il paywall non
    // entra mai in scena.
    expect(flat).toContain("if (!canUsePhotos(plan))");
    expect(flat).toContain("setPhotoAsk(true); return; } setPhotoSheetOpen(true);");
    expect(src).toContain("visible={photoAsk}");
  });

  it("PlanLimitDialog: si apre solo con un limite, e il limite viene da un errcode", () => {
    const src = read("components/PlanLimitDialog.tsx");
    // `limit` null = dialogo chiuso: senza un rifiuto del database non c'e'
    // nessuna strada verso il paywall da qui.
    expect(src).toContain("visible={limit !== null}");
    // E chi lo monta lo alimenta o con l'errcode del rifiuto del database
    // (planLimitFromCode) o con lo specchio client dello stesso tetto
    // (canAdd* di lib/plan.ts) — mai con una condizione inventata sul posto.
    // Conoscenza e' il caso dello specchio: blocca "crea cartella" con
    // canAddFolder prima ancora di chiamare il server.
    const feeders = sources().filter((f) => read(f).includes("<PlanLimitDialog"));
    expect(feeders.length).toBeGreaterThan(0);
    for (const f of feeders) {
      const src = read(f);
      const fromDb = src.includes("planLimitFromCode(");
      const fromMirror = /canAdd(Memory|Folder|Section)\(/.test(src);
      expect(fromDb || fromMirror, `${f} apre PlanLimitDialog fuori da un limite`).toBe(true);
    }
  });
});
