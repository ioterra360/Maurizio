-- Guardie sul cestino (fix dalla review del commit 1b92f1f, 2026-08-30).
--
-- 1) L'orologio del telefono non è affidabile: deleted_at scritto dal client
--    viene BLOCCATO a now() del server quando una riga entra nel cestino,
--    così la finestra di 24 ore promessa dall'app coincide sempre con quella
--    che purge_trash misura (entrambe ora lato server).
-- 2) Un ricordo non può nascere vivo dentro una cartella nel cestino (corsa
--    fra dispositivi: B salva mentre A ha appena eliminato la cartella): al
--    momento dell'insert eredita il cestino, così il cascade della purga non
--    può mai mangiarsi un ricordo che l'utente crede vivo.
-- 3) Un ricordo non può essere RIPRISTINATO mentre la sua cartella è ancora
--    nel cestino (l'app ripristina prima la cartella — lib/api.ts
--    restoreMemory; questo è il paracadute se un client vecchio fa
--    l'inverso): meglio un errore chiaro di una perdita silenziosa.

create or replace function public.clamp_folder_deleted_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.deleted_at is not null and (tg_op = 'INSERT' or old.deleted_at is null) then
    new.deleted_at := now();
  end if;
  return new;
end;
$$;

create or replace function public.guard_memory_deleted_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  folder_deleted timestamptz;
begin
  -- (1) ingresso nel cestino: timestamp del server, mai del client.
  if new.deleted_at is not null and (tg_op = 'INSERT' or old.deleted_at is null) then
    new.deleted_at := now();
  end if;
  if tg_op = 'INSERT' and new.deleted_at is null then
    -- (2) nato in una cartella nel cestino → nel cestino anche lui.
    select deleted_at into folder_deleted from public.folders where id = new.folder_id;
    if folder_deleted is not null then
      new.deleted_at := now();
    end if;
  elsif tg_op = 'UPDATE' and new.deleted_at is null and old.deleted_at is not null then
    -- (3) ripristino: la cartella deve essere viva.
    select deleted_at into folder_deleted from public.folders where id = new.folder_id;
    if folder_deleted is not null then
      raise exception 'restore the folder before restoring its memories'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists folders_clamp_deleted_at on public.folders;
create trigger folders_clamp_deleted_at
  before insert or update on public.folders
  for each row execute function public.clamp_folder_deleted_at();

drop trigger if exists memories_guard_deleted_at on public.memories;
create trigger memories_guard_deleted_at
  before insert or update on public.memories
  for each row execute function public.guard_memory_deleted_at();

comment on function public.clamp_folder_deleted_at() is
  'Trigger: deleted_at di folders al momento dell''ingresso nel cestino è sempre now() del server (l''orologio del client non conta).';
comment on function public.guard_memory_deleted_at() is
  'Trigger: deleted_at di memories clampato a now() all''ingresso nel cestino; insert in cartella nel cestino eredita il cestino; il ripristino richiede la cartella viva.';
