-- Foto sui ricordi (Premium) — spec 2026-09-02 §B5 + design approvato ad
-- agosto (memoria photo_upload_feature): bucket PRIVATO, una foto per
-- ricordo, path <user_id>/<memory_id>.jpg, foto solo sul retro.
--
-- Cosa fa:
--   1. memories.photo_path — la CHIAVE dell'oggetto nel bucket, mai un URL
--      (il bucket è privato e gli URL firmati scadono). null = nessuna foto.
--      Nessun grant di colonna: memories ha solo la policy per riga
--      (memories_all_own_or_admin, initial_schema.sql:237), come notes.
--   2. bucket 'memory-photos', privato, 5 MiB, solo image/jpeg. Il client
--      ridimensiona a 1600px di lato lungo e ricodifica JPEG q0.8 PRIMA di
--      caricare (lib/photos.ts): 5 MiB è un tetto di sicurezza, non un target.
--      file_size_limit è in BYTE (bigint), allowed_mime_types è text[].
--   3. RLS su storage.objects: ogni utente vede, scrive e cancella SOLO gli
--      oggetti sotto la propria cartella <auth.uid()>/…  —
--      (storage.foldername(name))[1] è il primo segmento del path. La spec
--      diceva "owner = auth.uid()": la colonna storage.objects.owner è
--      DEPRECATA sull'hosted (esiste owner_id text); il prefisso del path è la
--      forma canonica dei docs e in più vincola DOVE si può scrivere.
--      `to authenticated`: anon non tocca il bucket. Le policy stanno su
--      storage.objects e basta: nessuna chiamata dello SDK ha bisogno di
--      permessi su storage.buckets. La policy update serve perché il client
--      carica con upsert:true (sostituire una foto = stesso path).
--
-- Cosa NON fa, di proposito — pulizia dei FILE:
--   `delete from storage.objects` in SQL non cancella il file su S3: toglie la
--   riga di metadati e lascia il blob (fatturato, irraggiungibile — docs
--   Supabase: "Deleting objects via a SQL query will not remove the object
--   from the bucket and will result in the object being orphaned"). Sui
--   progetti con la migrazione storage 0055 il delete diretto è bloccato
--   (storage.protect_delete, 42501). E una riga cancellata rende il file
--   INVISIBILE a list()/remove(): impossibile da pulire dopo.
--   Quindi purge_trash(), purge_expired_accounts() e delete_own_account()
--   NON toccano storage.objects — il TODO in 20260825152550:20-22 è superato.
--   - Ricordi purgati dal cestino: il client riconcilia la propria cartella
--     (lib/photos.ts reconcilePhotos) via Storage API, con le policy qui sotto.
--   - Account purgati (72h): nessun client resta; i file restano orfani finché
--     non esiste un job con service_role (Edge Function). Decisione aperta,
--     vedi docs/DATA-MODEL.md § Storage.

-- (1) colonna — il length check NON viaggia sull'`add column if not exists`: se
--     la colonna esiste già (riesecuzione della migration, o colonna creata a
--     mano dalla dashboard) Postgres salta l'INTERO sotto-comando, vincolo
--     compreso, e riporta successo lasciando `memories` senza check. Quindi
--     constraint SEPARATA e nominata, come ogni altro length check di questa
--     tabella (20260519224817_security_hardening.sql:128-131). `add constraint`
--     non ha un `if not exists`: la guardia è un do-block su pg_constraint. Il
--     nome è quello che Postgres genererebbe da sé per un vincolo di colonna
--     (<tabella>_<colonna>_check), così anche su un database dove fosse già
--     passata la forma vecchia il blocco è un no-op.
alter table public.memories
  add column if not exists photo_path text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.memories'::regclass
      and conname = 'memories_photo_path_check'
  ) then
    alter table public.memories
      add constraint memories_photo_path_check
      check (photo_path is null or char_length(photo_path) between 1 and 512);
  end if;
end;
$$;

comment on column public.memories.photo_path is
  'Chiave dell''oggetto nel bucket privato memory-photos (<user_id>/<memory_id>.jpg). null = nessuna foto. Mai un URL: si legge con URL firmati (lib/photos.ts).';

-- (2) bucket — idempotente: rieseguire la migration aggiorna i limiti.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('memory-photos', 'memory-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- (3) policy — i nomi sono globali per tabella: drop-if-exists prima.
-- auth.uid() dentro (select …) viene valutato una volta per query (initPlan).
drop policy if exists "memory_photos_select_own" on storage.objects;
create policy "memory_photos_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'memory-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "memory_photos_insert_own" on storage.objects;
create policy "memory_photos_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'memory-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "memory_photos_update_own" on storage.objects;
create policy "memory_photos_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'memory-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'memory-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "memory_photos_delete_own" on storage.objects;
create policy "memory_photos_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'memory-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
