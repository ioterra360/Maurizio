/**
 * Invarianti sulla migration dei piani (20260903100000_plans.sql).
 * Come per `lib/memory-photos-migration.test.ts` non c'è modo di ESEGUIRLA
 * qui (servirebbe un Postgres), quindi la si legge come TESTO: vitest gira
 * dalla root del repo.
 *
 * Il difetto che il primo gruppo tiene: il guard sul RIPRISTINO di una
 * cartella guardava solo `used >= cap`. La creazione di cartelle non è mai
 * stata applicata nei binari in circolazione, quindi un tester arriva a
 * questa migration con più cartelle vive del tetto free; con quel guard,
 * cestinare una cartella per sbaglio la rendeva IRRECUPERABILE (il ripristino
 * veniva rifiutato, `purge_trash()` la cancellava con tutti i suoi ricordi
 * 24 ore dopo) e la copy dell'app — "puoi ripristinarli entro 24 ore",
 * "spostane un'altra nel cestino" — lo mandava a perdere anche le altre.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SQL = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20260903100000_plans.sql"),
  "utf8",
);

/** Spazi normalizzati: le asserzioni non si rompono per un a capo. */
const flat = SQL.replace(/\s+/g, " ");

/** Il corpo di una `create or replace function public.<name>` fino al `$$;`. */
function fnBody(name: string): string {
  const start = SQL.indexOf(`create or replace function public.${name}()`);
  expect(start, `funzione ${name} assente`).toBeGreaterThan(-1);
  const end = SQL.indexOf("$$;", start);
  expect(end, `corpo di ${name} non terminato`).toBeGreaterThan(start);
  return SQL.slice(start, end).replace(/\s+/g, " ");
}

describe("20260903100000_plans.sql — ripristino cartelle e grandfathering", () => {
  it("il guard sul ripristino rifiuta solo dentro il ciclo cestina → crea → ripristina", () => {
    const body = fnBody("enforce_folder_restore_plan_limit");
    // La seconda condizione è quella che salva chi è sopra il tetto per
    // grandfathering: senza, ogni suo ripristino sarebbe rifiutato.
    expect(body).toContain("if used >= cap and exists (");
    expect(body).toContain("created_at > old.deleted_at");
    expect(body).toContain("errcode = 'P0005'");
    expect(body).toContain("hint = 'plan-limit:folders-restore'");
  });

  it("il guard sulla CREAZIONE resta un conto secco delle cartelle vive", () => {
    // È l'altra metà dell'invariante: se anche l'INSERT diventasse
    // condizionale, il ciclo si riaprirebbe da quel capo.
    const body = fnBody("enforce_folder_plan_limit");
    expect(body).toContain("and deleted_at is null; if used >= cap then");
    expect(body).not.toContain("created_at >");
  });

  it("il trigger di ripristino scatta solo sulla transizione cestino → vivo", () => {
    // Il `when` è ciò che rende `old.deleted_at` non-null nella condizione
    // nuova: senza, il confronto `created_at > old.deleted_at` sarebbe null
    // e l'exists non rifiuterebbe mai.
    expect(flat).toContain(
      "create trigger folders_enforce_plan_limit_on_restore before update on public.folders for each row when (old.deleted_at is not null and new.deleted_at is null)",
    );
  });

  it("la colonna plan nasce sulla fascia ALTA finche' gli store non vendono", () => {
    // ATTIVAZIONE 2026-09-04. Con le chiavi RevenueCat vuote purchasesAvailable
    // e' falso: chi incontra un tetto non ha via d'uscita dal client, nemmeno
    // il paywall (bottoni spenti). Il default 'pro' vale per TUTTI, compresi i
    // >=12 tester del test chiuso di Play che si iscriveranno DOPO il push —
    // che il seed di due email non puo' raggiungere. Va invertito con una
    // migrazione NUOVA, non riscrivendo questa riga.
    expect(flat).toContain(
      "add column plan text not null default 'pro' check (plan in ('free','plus','pro'))",
    );
    expect(flat).not.toContain("add column plan text not null default 'free'");
  });

  it("il default resta spiegato e datato nel file", () => {
    // Un default 'pro' senza il perche' accanto e' una riga che il prossimo
    // lettore prende per un errore di battitura e "corregge".
    expect(SQL).toContain("Il default e' 'pro', non 'free' — ATTIVAZIONE 2026-09-04");
    expect(SQL).toContain("alter table public.profiles alter column plan set default 'free';");
  });

  it("il seed pro dei due tester resta, e sta sopra il primo create trigger", () => {
    // Punto 6 della lista "Prima di lanciare" di docs/DEPLOY.md: la colonna
    // `plan` nasce in questa migration, quindi il seed non può stare in una
    // query a mano prima del push, e dopo lascerebbe Maurizio (vc11, senza
    // paywall) bloccato a 10 ricordi.
    const seed = SQL.indexOf("update public.profiles\n   set plan = 'pro'");
    // Ancorato a inizio riga: la parola "create trigger" compare prima nei
    // commenti, e un indexOf secco misurerebbe quelli.
    const firstTrigger = SQL.search(/^create trigger /m);
    expect(seed).toBeGreaterThan(-1);
    expect(firstTrigger).toBeGreaterThan(-1);
    expect(seed).toBeLessThan(firstTrigger);
    // Ridondante dal 2026-09-04 — `not null default 'pro'` riempie anche le
    // righe che esistono gia' — ma NON rimuovibile: e' l'unica riga applicata
    // che dice quali sono i due account di cortesia, cioe' quelli che la
    // migrazione futura dovra' escludere dalla revoca in blocco.
    expect(SQL).toContain("RIDONDANTE dal 2026-09-04, e RESTA");
  });
});
