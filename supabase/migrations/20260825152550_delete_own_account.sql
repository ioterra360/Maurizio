-- Cancellazione dell'account dall'app (Apple 5.1.1(v) / Google Play "Account
-- deletion").
--
-- Il client non può cancellare righe di auth.users (nessun privilegio, e la
-- chiave service_role non è — e non deve essere — nel repo). Questa funzione
-- security definer gira come owner e cancella SOLO l'utente chiamante:
-- auth.uid() viene letto dal JWT, non da un parametro, quindi non è possibile
-- cancellare un account diverso dal proprio.
--
-- Tutto il resto cade in cascata da auth.users:
--   profiles.id          -> auth.users(id)     on delete cascade  (initial_schema.sql:32)
--   folders.user_id      -> profiles(id)       on delete cascade  (initial_schema.sql:55)
--   memories.user_id     -> profiles(id)       on delete cascade  (initial_schema.sql:76)
--   memories.folder_id   -> folders(id)        on delete cascade  (initial_schema.sql:77)
--   review_sessions.user_id -> profiles(id)    on delete cascade  (initial_schema.sql:105)
--   review_items.session_id -> review_sessions on delete cascade  (initial_schema.sql:123)
--   review_items.memory_id  -> memories        on delete cascade  (initial_schema.sql:124)
--   review_items.user_id    -> profiles(id)    on delete cascade  (security_hardening.sql:156)
-- admin_emails è indicizzata per email, senza FK: un'email admin resta in
-- allowlist anche dopo la cancellazione dell'account (voluto). Nessun bucket
-- Storage è in uso oggi; quando arriverà il bucket foto andrà aggiunta qui la
-- pulizia di storage.objects per owner = auth.uid().
--
-- Chiamata dal client: supabase.rpc('delete_own_account') seguita da signOut
-- (il refresh token è già invalidato dal cascade su auth.refresh_tokens).

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'delete_own_account() requires an authenticated user'
      using errcode = '42501';
  end if;

  delete from auth.users where id = caller;
end;
$$;

comment on function public.delete_own_account() is
  'Cancella definitivamente l''account dell''utente chiamante (auth.users + cascade su profiles, folders, memories, review_sessions, review_items). Richiesto dalle policy store Apple 5.1.1(v) / Google Play. Solo authenticated; usa auth.uid(), nessun parametro.';

revoke execute on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
