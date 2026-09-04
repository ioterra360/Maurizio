import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Invarianti sulla migration delle foto (20260903110000_memory_photos.sql).
 * Il file si dichiara idempotente e qui non c'è modo di ESEGUIRLO (servirebbe
 * un Postgres), quindi il test lo legge come TESTO: vitest gira dalla root del
 * repo, stessa tecnica di lib/native-config.test.ts con app.json.
 *
 * Il difetto che tiene: un `check` appeso a `add column if not exists` viene
 * saltato insieme al sotto-comando quando la colonna esiste già (riesecuzione,
 * o colonna creata a mano dalla dashboard). La migration riporterebbe successo
 * lasciando `memories` senza `memories_photo_path_check`, e un path da 4000
 * caratteri entrerebbe in colonna.
 */
const SQL = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20260903110000_memory_photos.sql"),
  "utf8",
);

/** Spazi normalizzati: le asserzioni non devono rompersi per un a capo. */
const flat = SQL.replace(/\s+/g, " ");

describe("20260903110000_memory_photos.sql", () => {
  it("aggiunge photo_path senza vincoli appesi al sotto-comando", () => {
    const addColumn = flat.match(
      /alter table public\.memories add column if not exists photo_path[^;]*;/,
    );
    expect(addColumn).not.toBeNull();
    expect(addColumn?.[0]).toBe(
      "alter table public.memories add column if not exists photo_path text;",
    );
  });

  it("crea il length check come constraint nominata e separata", () => {
    expect(flat).toContain(
      "add constraint memories_photo_path_check check (photo_path is null or char_length(photo_path) between 1 and 512)",
    );
  });

  it("protegge la constraint con una guardia su pg_constraint (add constraint non ha if not exists)", () => {
    expect(flat).toMatch(
      /do \$\$ begin if not exists \( select 1 from pg_constraint where conrelid = 'public\.memories'::regclass and conname = 'memories_photo_path_check' \) then/,
    );
  });
});
