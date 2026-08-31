-- Guardie dalla review del commit 0512e90 (2026-08-31).
--
-- 1) moveMemory poteva spostare un ricordo VIVO in una cartella nel cestino
--    (lista del MoveSheet scattata prima che un altro dispositivo eliminasse
--    la destinazione): il ricordo spariva da ogni schermata E dal cestino,
--    restava in coda di ripasso, e la purga della cartella lo cancellava per
--    sempre senza finestra di recupero. Ora il cambio di folder_id su un
--    ricordo vivo verso una cartella nel cestino viene RIFIUTATO.
-- 2) Il limite di 3 sezioni era aggirabile: corsa fra due insert concorrenti
--    e UPDATE di folder_id non conteggiato. Ora il trigger blocca la riga
--    della cartella madre (for update) e conta anche sull'UPDATE.
-- 3) subfolders.name non aveva il CHECK di lunghezza che tutte le altre
--    colonne di testo utente hanno (security hardening, sezione 5).

-- (1) — sostituisce la versione di 20260830130000.
create or replace function public.guard_memory_deleted_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  folder_deleted timestamptz;
begin
  -- ingresso nel cestino: timestamp del server, mai del client.
  if new.deleted_at is not null and (tg_op = 'INSERT' or old.deleted_at is null) then
    new.deleted_at := now();
  end if;
  if tg_op = 'INSERT' and new.deleted_at is null then
    -- nato in una cartella nel cestino → nel cestino anche lui.
    select deleted_at into folder_deleted from public.folders where id = new.folder_id;
    if folder_deleted is not null then
      new.deleted_at := now();
    end if;
  elsif tg_op = 'UPDATE' and new.deleted_at is null then
    if old.deleted_at is not null then
      -- ripristino: la cartella deve essere viva.
      select deleted_at into folder_deleted from public.folders where id = new.folder_id;
      if folder_deleted is not null then
        raise exception 'restore the folder before restoring its memories'
          using errcode = 'P0001';
      end if;
    elsif new.folder_id is distinct from old.folder_id then
      -- spostamento di un ricordo vivo: la destinazione deve essere viva,
      -- altrimenti il cascade della purga lo mangerebbe in silenzio.
      select deleted_at into folder_deleted from public.folders where id = new.folder_id;
      if folder_deleted is not null then
        raise exception 'cannot move a memory into a trashed folder'
          using errcode = 'P0001';
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- (2) — sostituisce la versione di 20260831010000.
create or replace function public.enforce_subfolder_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent record;
begin
  -- Lock sulla cartella madre: serializza i creatori concorrenti (max 3
  -- senza corse) e congela deleted_at rispetto a un deleteFolder parallelo.
  select user_id, deleted_at into parent
    from public.folders where id = new.folder_id for update;
  if parent is null or parent.user_id <> new.user_id then
    raise exception 'subfolder must belong to a folder of the same user'
      using errcode = 'P0001';
  end if;
  if parent.deleted_at is not null then
    raise exception 'cannot add a subfolder to a trashed folder'
      using errcode = 'P0001';
  end if;
  if (tg_op = 'INSERT' or new.folder_id is distinct from old.folder_id)
     and (select count(*) from public.subfolders
            where folder_id = new.folder_id and id <> new.id) >= 3 then
    raise exception 'subfolder limit reached (3 per folder)'
      using errcode = 'P0003';
  end if;
  return new;
end;
$$;

-- (3)
alter table public.subfolders
  add constraint subfolders_name_length
  check (char_length(name) between 1 and 120);
