-- Cestino (Maurizio, 2026-08-30): l'eliminazione di cartelle e ricordi non è
-- più immediata. Le righe ricevono deleted_at e spariscono dall'app (filtri
-- in lib/api.ts); un job pg_cron le elimina definitivamente dopo 24 ore
-- (TRASH_RETENTION_HOURS in lib/trash.ts — tenere i due valori allineati).
--
-- Invariante: una cartella nel cestino ha TUTTI i suoi ricordi nel cestino
-- (deleteFolder li marca insieme; restoreMemory ripristina anche la
-- cartella). La purga della cartella può quindi affidarsi al cascade.
-- RLS: nessuna modifica — le righe nel cestino restano leggibili dal
-- proprietario (serve alla schermata Cestino), i filtri stanno nelle query.

alter table public.folders  add column deleted_at timestamptz;
alter table public.memories add column deleted_at timestamptz;

comment on column public.folders.deleted_at  is 'Nel cestino da questo istante; null = viva. Purga dopo 24h (purge_trash).';
comment on column public.memories.deleted_at is 'Nel cestino da questo istante; null = vivo. Purga dopo 24h (purge_trash).';

-- La purga scandisce solo le righe nel cestino: indici parziali minuscoli.
create index folders_deleted_at_idx  on public.folders  (deleted_at) where deleted_at is not null;
create index memories_deleted_at_idx on public.memories (deleted_at) where deleted_at is not null;

-- Svuota il cestino scaduto. SECURITY DEFINER (owner postgres): gira dal job
-- cron, mai dai client. I ricordi prima, poi le cartelle (il cui cascade
-- copre eventuali resti — vedi invariante sopra).
create or replace function public.purge_trash()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.memories where deleted_at < now() - interval '24 hours';
  delete from public.folders  where deleted_at < now() - interval '24 hours';
$$;

comment on function public.purge_trash() is
  'Elimina definitivamente cartelle e ricordi nel cestino da più di 24 ore. Chiamata dal job pg_cron memika-purge-trash, ogni ora.';

revoke execute on function public.purge_trash() from public, anon, authenticated;

-- Job orario. cron.schedule(nome, …) è un upsert: rieseguire la migration
-- non duplica il job.
create extension if not exists pg_cron;
select cron.schedule('memika-purge-trash', '7 * * * *', $$select public.purge_trash()$$);
