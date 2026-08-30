-- Recupero account entro 72 ore (Maurizio, 2026-08-30). "Elimina account"
-- non cancella più subito: marca profiles.deletion_requested_at e disconnette.
-- Riaccedendo entro 72 ore l'app propone "Recupera account"
-- (cancel_account_deletion). Il job pg_cron elimina definitivamente i profili
-- marcati da più di 72 ore con lo stesso cascade di delete_own_account
-- (che resta per usi d'emergenza ma non è più chiamato dall'app).
-- ACCOUNT_DELETION_GRACE_HOURS in lib/trash.ts va tenuto allineato.
--
-- La colonna NON è tra i grant di update di 20260825121500: i client la
-- toccano solo via RPC (auth.uid(), mai un parametro).

alter table public.profiles add column deletion_requested_at timestamptz;

comment on column public.profiles.deletion_requested_at is
  'Eliminazione account richiesta in questo istante; null = account attivo. Purga dopo 72h (purge_expired_accounts).';

create index profiles_deletion_requested_idx
  on public.profiles (deletion_requested_at) where deletion_requested_at is not null;

create or replace function public.request_account_deletion()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'request_account_deletion() requires an authenticated user'
      using errcode = '42501';
  end if;
  update public.profiles set deletion_requested_at = now() where id = caller;
end;
$$;

create or replace function public.cancel_account_deletion()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'cancel_account_deletion() requires an authenticated user'
      using errcode = '42501';
  end if;
  update public.profiles set deletion_requested_at = null where id = caller;
end;
$$;

comment on function public.request_account_deletion() is
  'Avvia l''eliminazione account con periodo di grazia di 72 ore (Apple 5.1.1(v) / Play). Solo authenticated; usa auth.uid().';
comment on function public.cancel_account_deletion() is
  'Annulla un''eliminazione account richiesta, se la purga non è ancora passata. Solo authenticated; usa auth.uid().';

revoke execute on function public.request_account_deletion() from public, anon;
revoke execute on function public.cancel_account_deletion() from public, anon;
grant execute on function public.request_account_deletion() to authenticated;
grant execute on function public.cancel_account_deletion()  to authenticated;

-- Purga: elimina auth.users (tutto il resto cade in cascata come in
-- delete_own_account, vedi 20260825152550). SECURITY DEFINER, solo cron.
create or replace function public.purge_expired_accounts()
returns void
language sql
security definer
set search_path = public
as $$
  delete from auth.users u
  using public.profiles p
  where p.id = u.id
    and p.deletion_requested_at < now() - interval '72 hours';
$$;

comment on function public.purge_expired_accounts() is
  'Elimina definitivamente gli account con richiesta di eliminazione più vecchia di 72 ore. Chiamata dal job pg_cron memika-purge-accounts, ogni ora.';

revoke execute on function public.purge_expired_accounts() from public, anon, authenticated;

create extension if not exists pg_cron;
select cron.schedule('memika-purge-accounts', '17 * * * *', $$select public.purge_expired_accounts()$$);
