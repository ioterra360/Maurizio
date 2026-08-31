-- Sottocartelle (Maurizio/Angelo, 2026-08-31): sezioni dentro una cartella,
-- max 3 (SUBFOLDERS_MAX in lib/constants.ts — pensate per la modalità Pro,
-- per ora nessun paywall come FOLDER_LIMIT_ENFORCED). Esempi d'uso: Law
-- (ita/eng/spanish), Motori (macchine/moto).
--
-- Scelta architetturale: tabella SEPARATA, non folders.parent_id — le
-- cartelle sono identificate da kind (unique(user_id, kind), rotte per kind)
-- e un parent_id avrebbe richiesto il refactor a id già rimandato. I ricordi
-- restano agganciati a folder_id (coda di ripasso, statistiche e cestino
-- INVARIATI); subfolder_id è solo una sezione facoltativa dentro la
-- cartella. Eliminare una sottocartella riporta i suoi ricordi nella
-- cartella madre (on delete set null): mai perdita di dati.

create table public.subfolders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  folder_id uuid not null references public.folders(id) on delete cascade,
  name text not null,
  position int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (folder_id, name)
);

comment on table public.subfolders is
  'Sezioni dentro una cartella (max 3, enforce_subfolder_rules). I ricordi le referenziano con memories.subfolder_id; null = radice della cartella.';

create index subfolders_folder_idx on public.subfolders (folder_id);

alter table public.memories
  add column subfolder_id uuid references public.subfolders(id) on delete set null;

comment on column public.memories.subfolder_id is
  'Sezione della cartella a cui appartiene il ricordo; null = radice. Deve appartenere alla stessa folder_id (memories_subfolder_coherence).';

create index memories_subfolder_idx on public.memories (subfolder_id)
  where subfolder_id is not null;

-- RLS: stesso modello di folders/memories.
alter table public.subfolders enable row level security;

create policy "subfolders_all_own_or_admin"
  on public.subfolders for all
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

-- updated_at come sulle altre tabelle.
create trigger subfolders_set_updated_at
  before update on public.subfolders
  for each row execute function public.set_updated_at();

-- Regole di integrità che il client non può aggirare:
--   1) max 3 sottocartelle per cartella;
--   2) la cartella madre deve appartenere allo stesso utente;
--   3) la cartella madre non deve essere nel cestino.
create or replace function public.enforce_subfolder_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent record;
begin
  select user_id, deleted_at into parent from public.folders where id = new.folder_id;
  if parent is null or parent.user_id <> new.user_id then
    raise exception 'subfolder must belong to a folder of the same user'
      using errcode = 'P0001';
  end if;
  if parent.deleted_at is not null then
    raise exception 'cannot add a subfolder to a trashed folder'
      using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT'
     and (select count(*) from public.subfolders where folder_id = new.folder_id) >= 3 then
    raise exception 'subfolder limit reached (3 per folder)'
      using errcode = 'P0003';
  end if;
  return new;
end;
$$;

create trigger subfolders_enforce_rules
  before insert or update on public.subfolders
  for each row execute function public.enforce_subfolder_rules();

-- Un ricordo può stare solo in una sezione DELLA SUA cartella.
create or replace function public.enforce_memory_subfolder_coherence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sub_folder uuid;
begin
  if new.subfolder_id is not null then
    select folder_id into sub_folder from public.subfolders where id = new.subfolder_id;
    if sub_folder is null or sub_folder <> new.folder_id then
      raise exception 'subfolder does not belong to the memory''s folder'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger memories_subfolder_coherence
  before insert or update on public.memories
  for each row execute function public.enforce_memory_subfolder_coherence();
