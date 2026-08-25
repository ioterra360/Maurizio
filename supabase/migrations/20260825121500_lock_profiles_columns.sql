-- Privilegi di colonna su public.profiles.
--
-- Prima di questa migration la policy RLS `profiles_update_own_or_admin`
-- (20260519224817_security_hardening.sql, sezione 7) limitava le RIGHE ma non
-- le COLONNE: un utente autenticato poteva fare
--
--   PATCH /rest/v1/profiles?id=eq.<uid>   {"role": "admin"}
--
-- sulla propria riga, is_admin() diventava vero e ogni policy con
-- "or public.is_admin()" gli apriva folders/memories/review_sessions di tutti.
--
-- I privilegi di colonna vengono verificati PRIMA delle policy RLS: un UPDATE
-- che tocca una colonna non concessa fallisce con "permission denied for table
-- profiles" a prescindere dalla policy. Il client aggiorna solo le colonne
-- elencate in lib/api.ts updateProfile(); id/email/role/created_at restano
-- scrivibili solo da service_role e dalle funzioni security definer.
--
-- Insert e delete: le righe di profiles nascono dal trigger handle_new_user
-- (security definer → gira come owner, non come `authenticated`) e muoiono
-- col cascade da auth.users. Nessun client deve inserirle o cancellarle
-- direttamente. `set_updated_at` è un trigger BEFORE UPDATE: scrive
-- updated_at dentro la riga, non è soggetto ai privilegi di colonna.

revoke insert, update, delete on public.profiles from anon, authenticated;

grant update (
  name,
  daily_input_cap,
  calm_mode,
  weekly_digest,
  morning_review_at,
  evening_review_at
) on public.profiles to authenticated;
