-- Numero ESATTO di ripassi per ricordo, mantenuto dal database.
--
-- La scheda ricordo contava le righe di review_items, che per quattro mesi
-- non sono mai state scritte (trigger rotto, riparato il 7/9/2026): tutto
-- cio' che e' stato ripassato prima di quel giorno mostrava zero accanto a
-- una data di ultimo ripasso vera (Angelo, 8/9/2026: "deve dire il numero
-- esatto di review fatte, non solo la data dell'ultima").
--
-- Da qui in poi il contatore e' una colonna incrementata da un trigger
-- BEFORE UPDATE sul cambio di last_reviewed_at: e' la stessa UPDATE con cui
-- il client persiste ogni risposta (applyPhaseUpdate), quindi conta ogni
-- ripasso anche se l'insert in review_items fallisse. Backfill: le righe di
-- review_items dal 7/9, e almeno 1 per chi ha una data di ultimo ripasso.
--
-- Nello stesso passaggio: "fading" non si materializza piu'. Lo stato che
-- l'utente vede si calcola alla lettura (finestra scaduta adesso,
-- features/srs/phases.ts lifecycleOf); la colonna resta per "archived" e
-- per i client vecchi. Le righe rimaste a "fading" da una risposta in
-- ritardo tornano "active": la loro finestra e' nuova.

alter table public.memories
  add column if not exists review_count integer not null default 0;

create or replace function public.memories_count_review()
returns trigger
language plpgsql
as $$
begin
  if new.last_reviewed_at is not null
     and new.last_reviewed_at is distinct from old.last_reviewed_at then
    new.review_count := coalesce(old.review_count, 0) + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists memories_count_review on public.memories;
create trigger memories_count_review
  before update of last_reviewed_at on public.memories
  for each row execute function public.memories_count_review();

update public.memories m
set review_count = greatest(
  (select count(*) from public.review_items ri where ri.memory_id = m.id),
  case when m.last_reviewed_at is not null then 1 else 0 end
);

update public.memories
set state = 'active'
where state = 'fading';
