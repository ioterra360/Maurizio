-- Foto anche sul FRONTE del ricordo (Angelo, 8/9/2026: "aggiungere il
-- bottone + per mettere foto anche in Termine da ricordare, non solo in
-- Cosa significa").
--
-- Stesso bucket privato memory-photos e stesse policy (prefisso
-- <user_id>/): la chiave del fronte e' <user_id>/<memory_id>-front.jpg,
-- quella del retro resta <user_id>/<memory_id>.jpg. Nel ripasso la foto
-- del fronte si vede subito accanto al termine, quella del retro solo dopo
-- "Mostra risposta". Il gate di piano e' lo stesso (foto = Plus e Pro).
-- photo_added_at (tetto giornaliero del Free, non implementato) si scrive
-- per entrambi i lati.

alter table public.memories
  add column if not exists photo_front_path text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.memories'::regclass
      and conname = 'memories_photo_front_path_check'
  ) then
    alter table public.memories
      add constraint memories_photo_front_path_check
      check (photo_front_path is null or char_length(photo_front_path) between 1 and 512);
  end if;
end $$;

comment on column public.memories.photo_front_path is
  'Chiave dell''oggetto nel bucket privato memory-photos per la foto del FRONTE (<user_id>/<memory_id>-front.jpg). null = nessuna foto. Mai un URL: si legge con URL firmati (lib/photos.ts).';
