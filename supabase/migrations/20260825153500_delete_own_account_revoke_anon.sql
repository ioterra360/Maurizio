-- Il progetto hosted ha "alter default privileges in schema public grant
-- execute on functions to anon, authenticated, service_role": ogni nuova
-- funzione nasce eseguibile anche da `anon`, e `revoke ... from public` (come
-- in 20260825152550_delete_own_account.sql) non tocca quel grant esplicito.
-- delete_own_account() protegge già da sola (auth.uid() null -> raise), ma
-- non deve nemmeno essere raggiungibile senza sessione.

revoke execute on function public.delete_own_account() from anon;
