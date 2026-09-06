import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Il trigger review_items_consistency() e' rimasto rotto da maggio a
 * settembre 2026 perche' una variabile PL/pgSQL si chiamava `session_user`,
 * che in SQL e' una funzione riservata: nel confronto vinceva la funzione
 * ("operator does not exist: name <> uuid") e nessun review_items veniva
 * mai scritto. Questo test impedisce che il nome torni in una migrazione.
 */
const ROOT = process.cwd();
const MIGRATIONS = path.join(ROOT, "supabase", "migrations");

describe("review_items_consistency", () => {
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();
  const fix = files.find((f) => f.includes("fix_review_items_trigger"));

  it("la migrazione che la ripara esiste e usa variabili con prefisso", () => {
    expect(fix).toBeDefined();
    const sql = readFileSync(path.join(MIGRATIONS, fix!), "utf8");
    expect(sql).toMatch(/create or replace function public\.review_items_consistency\(\)/);
    expect(sql).toMatch(/v_session_user\s+uuid/);
    expect(sql).toMatch(/v_memory_user\s+uuid/);
    expect(sql).toMatch(/if v_session_user <> new\.user_id or v_memory_user <> new\.user_id then/);
  });

  it("nessuna migrazione SUCCESSIVA alla correzione dichiara una variabile chiamata session_user", () => {
    // Le riserve di SQL non si usano come nomi di variabile: session_user,
    // current_user, user sono funzioni, e PL/pgSQL le preferisce alla
    // variabile omonima nelle espressioni.
    const after = files.filter((f) => fix && f > fix);
    for (const f of [fix!, ...after]) {
      const sql = readFileSync(path.join(MIGRATIONS, f), "utf8");
      expect(sql, f).not.toMatch(/declare[\s\S]*?\b(session_user|current_user)\s+uuid/i);
    }
  });
});
