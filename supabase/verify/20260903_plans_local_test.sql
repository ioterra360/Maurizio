-- Test funzionale dei tre limiti. SOLO DATABASE LOCALE — scrive in
-- auth.users. Non eseguirlo mai sul progetto remoto.
--
--   npx supabase start
--   npx supabase db reset
--   npx supabase db query --local -f supabase/verify/20260903_plans_local_test.sql
--
-- Tutto dentro una transazione che finisce in rollback: se il file arriva
-- in fondo senza sollevare eccezioni, i limiti funzionano.

begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values (
  'aaaaaaaa-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'plan-test@example.com', 'x',
  now(), now(), now(), '{}'::jsonb, '{}'::jsonb
);

do $$
begin
  -- Il profilo nasce dal trigger handle_new_user, quindi free.
  if public.current_plan('aaaaaaaa-0000-4000-8000-000000000001') <> 'free' then
    raise exception 'un profilo nuovo dovrebbe nascere free';
  end if;
end $$;

-- 1) Cartelle: la prima passa, la seconda no.
insert into public.folders (user_id, kind, name, category, emoji)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'custom', 'Prima', 'custom', '📁');

do $$
begin
  insert into public.folders (user_id, kind, name, category, emoji)
  values ('aaaaaaaa-0000-4000-8000-000000000001', 'custom', 'Seconda', 'custom', '📁');
  raise exception 'ATTESO FALLIMENTO: la seconda cartella su free e'' passata';
exception when sqlstate 'P0005' then
  raise notice 'ok: seconda cartella bloccata (P0005)';
end $$;

-- 2) Sezioni: nessuna sul piano free.
do $$
declare fid uuid;
begin
  select id into fid from public.folders
   where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' limit 1;
  insert into public.subfolders (user_id, folder_id, name)
  values ('aaaaaaaa-0000-4000-8000-000000000001', fid, 'Sezione');
  raise exception 'ATTESO FALLIMENTO: una sezione su free e'' passata';
exception when sqlstate 'P0003' then
  raise notice 'ok: sezione bloccata (P0003)';
end $$;

-- 3) Ricordi: dieci passano, l'undicesimo no.
insert into public.memories (user_id, folder_id, term, definition)
select 'aaaaaaaa-0000-4000-8000-000000000001', f.id, 'parola ' || g, 'significato'
  from public.folders f, generate_series(1, 10) g
 where f.user_id = 'aaaaaaaa-0000-4000-8000-000000000001';

do $$
declare fid uuid;
begin
  select id into fid from public.folders
   where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' limit 1;
  insert into public.memories (user_id, folder_id, term, definition)
  values ('aaaaaaaa-0000-4000-8000-000000000001', fid, 'undicesima', 'significato');
  raise exception 'ATTESO FALLIMENTO: l''undicesimo ricordo su free e'' passato';
exception when sqlstate 'P0004' then
  raise notice 'ok: undicesimo ricordo bloccato (P0004)';
end $$;

-- 3-bis) Il cestino occupa lo slot: cestinare non libera quota.
update public.memories
   set deleted_at = now()
 where user_id = 'aaaaaaaa-0000-4000-8000-000000000001'
   and term = 'parola 1';

do $$
declare fid uuid;
begin
  select id into fid from public.folders
   where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' limit 1;
  insert into public.memories (user_id, folder_id, term, definition)
  values ('aaaaaaaa-0000-4000-8000-000000000001', fid, 'dopo il cestino', 'significato');
  raise exception 'ATTESO FALLIMENTO: cestinare un ricordo ha liberato una quota';
exception when sqlstate 'P0004' then
  raise notice 'ok: il cestino occupa lo slot (P0004)';
end $$;

-- E il ripristino, che e' una UPDATE, passa comunque: e' la meta' che
-- giustifica la scelta di contare tutto. Nessun grandfathered resta con un
-- ricordo prigioniero del cestino.
update public.memories
   set deleted_at = null
 where user_id = 'aaaaaaaa-0000-4000-8000-000000000001'
   and term = 'parola 1';

do $$
begin
  if (select count(*) from public.memories
       where user_id = 'aaaaaaaa-0000-4000-8000-000000000001'
         and deleted_at is null) <> 10 then
    raise exception 'il ripristino dal cestino non e'' andato a buon fine';
  end if;
end $$;

-- 3-ter) Un solo INSERT multi-riga non aggira il tetto. E' la superficie
-- raggiungibile con la chiave anon: PostgREST accetta un corpo array e lo
-- traduce in UN comando. Il trigger e' BEFORE ROW ma il conteggio passa da
-- SPI, che fa CommandCounterIncrement() e prende uno snapshot nuovo, quindi
-- la riga N vede le N-1 gia' inserite dallo stesso comando.
delete from public.memories
 where user_id = 'aaaaaaaa-0000-4000-8000-000000000001';

do $$
begin
  insert into public.memories (user_id, folder_id, term, definition)
  select 'aaaaaaaa-0000-4000-8000-000000000001', f.id, 'bulk ' || g, 'significato'
    from public.folders f, generate_series(1, 25) g
   where f.user_id = 'aaaaaaaa-0000-4000-8000-000000000001';
  raise exception 'ATTESO FALLIMENTO: 25 ricordi in un solo INSERT sono passati sul piano free';
exception when sqlstate 'P0004' then
  raise notice 'ok: insert multi-riga bloccato (P0004)';
end $$;

-- Ripristina lo stato "dieci ricordi" per il blocco 4.
insert into public.memories (user_id, folder_id, term, definition)
select 'aaaaaaaa-0000-4000-8000-000000000001', f.id, 'parola ' || g, 'significato'
  from public.folders f, generate_series(1, 10) g
 where f.user_id = 'aaaaaaaa-0000-4000-8000-000000000001';

-- 4) Con Pro il tetto dei ricordi sparisce e le sezioni si aprono.
update public.profiles
   set plan = 'pro', plan_until = now() + interval '30 days'
 where id = 'aaaaaaaa-0000-4000-8000-000000000001';

insert into public.memories (user_id, folder_id, term, definition)
select 'aaaaaaaa-0000-4000-8000-000000000001', f.id, 'undicesima', 'significato'
  from public.folders f
 where f.user_id = 'aaaaaaaa-0000-4000-8000-000000000001' limit 1;

insert into public.subfolders (user_id, folder_id, name)
select 'aaaaaaaa-0000-4000-8000-000000000001', f.id, 'Sezione ' || g
  from public.folders f, generate_series(1, 3) g
 where f.user_id = 'aaaaaaaa-0000-4000-8000-000000000001';

do $$
declare fid uuid;
begin
  select id into fid from public.folders
   where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' limit 1;
  insert into public.subfolders (user_id, folder_id, name)
  values ('aaaaaaaa-0000-4000-8000-000000000001', fid, 'Quarta sezione');
  raise exception 'ATTESO FALLIMENTO: la quarta sezione su pro e'' passata';
exception when sqlstate 'P0003' then
  raise notice 'ok: quarta sezione bloccata (P0003)';
end $$;

-- 5) Un piano scaduto torna free senza che nessuno faccia niente.
update public.profiles
   set plan_until = now() - interval '1 day'
 where id = 'aaaaaaaa-0000-4000-8000-000000000001';

do $$
begin
  if public.current_plan('aaaaaaaa-0000-4000-8000-000000000001') <> 'free' then
    raise exception 'un piano scaduto dovrebbe valere free';
  end if;
end $$;

rollback;
