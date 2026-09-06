-- review_items_consistency() non ha mai lasciato passare un insert.
--
-- Le sue variabili si chiamavano `session_user` e `memory_user`, e
-- `session_user` e' una funzione riservata di SQL (restituisce il nome
-- dell'utente di sessione, tipo `name`). Nell'INTO PL/pgSQL usava la
-- variabile, ma nel confronto `session_user <> new.user_id` risolveva la
-- funzione: "operator does not exist: name <> uuid" (42883) su OGNI riga.
--
-- Effetto in produzione al 2026-09-07: 69 review_sessions, ZERO review_items,
-- e il "Numero di ripassi" della scheda ricordo sempre a zero (Angelo). L'app
-- non se n'e' mai accorta perche' recordReviewItem e' fire-and-forget e
-- l'errore finiva in reportError con Sentry spento.
--
-- La storia persa non e' ricostruibile: quelle righe non sono mai esistite.
-- Il contatore riparte da qui.
--
-- Stessa logica di 20260519224817_security_hardening.sql, variabili con
-- prefisso. CREATE OR REPLACE lascia il trigger agganciato.
create or replace function public.review_items_consistency()
returns trigger
language plpgsql
as $$
declare
  v_session_user uuid;
  v_memory_user  uuid;
begin
  select user_id into v_session_user from public.review_sessions where id = new.session_id;
  select user_id into v_memory_user  from public.memories        where id = new.memory_id;

  if v_session_user is null or v_memory_user is null then
    raise exception 'review_items must reference an existing session and memory';
  end if;
  if v_session_user <> new.user_id or v_memory_user <> new.user_id then
    raise exception 'review_items.user_id must match the session and memory user';
  end if;

  return new;
end;
$$;
