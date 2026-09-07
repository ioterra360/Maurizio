import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// La migrazione si legge come testo: vitest non ha Postgres. Il test fissa
// il contratto che lib/mappers.ts e app/memory/[id].tsx danno per scontato.
const SQL = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "supabase",
    "migrations",
    "20260908090000_review_count.sql",
  ),
  "utf8",
);

describe("migrazione review_count", () => {
  it("aggiunge la colonna con default 0", () => {
    expect(SQL).toMatch(/add column if not exists review_count integer not null default 0/);
  });

  it("incrementa SOLO quando last_reviewed_at cambia, con un trigger BEFORE UPDATE", () => {
    expect(SQL).toMatch(/before update of last_reviewed_at on public\.memories/);
    expect(SQL).toMatch(/new\.last_reviewed_at is distinct from old\.last_reviewed_at/);
    expect(SQL).toMatch(/new\.review_count := coalesce\(old\.review_count, 0\) \+ 1/);
    // Un client che scrive review_count da solo non deve trovare un trigger
    // che lo sovrascriva a ogni UPDATE qualsiasi: l'incremento e' legato al
    // solo cambio di data.
    expect(SQL).not.toMatch(/before update on public\.memories/);
  });

  it("riempie il pregresso: righe di review_items, e almeno 1 se c'e' una data di ultimo ripasso", () => {
    expect(SQL).toMatch(/select count\(\*\) from public\.review_items ri where ri\.memory_id = m\.id/);
    expect(SQL).toMatch(/case when m\.last_reviewed_at is not null then 1 else 0 end/);
  });

  it("riporta ad active le righe rimaste fading: lo stato si calcola alla lettura", () => {
    expect(SQL).toMatch(/set state = 'active'\s+where state = 'fading'/);
  });
});
