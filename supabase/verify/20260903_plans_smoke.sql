-- Verifica della migrazione 20260903100000_plans.sql. SOLA LETTURA.
--
-- Sul progetto remoto, DOPO che un umano ha eseguito il db push (Task 10),
-- dal worktree linkato memika-app:
--   npx supabase db query --linked -f supabase/verify/20260903_plans_smoke.sql
-- Su un database locale (richiede Docker):
--   npx supabase db query --local -f supabase/verify/20260903_plans_smoke.sql
--
-- Ogni riga deve avere ok = true.

select 'le tre colonne di piano esistono' as verifica,
       count(*) = 3 as ok
  from information_schema.columns
 where table_schema = 'public' and table_name = 'profiles'
   and column_name in ('plan', 'plan_until', 'rc_app_user_id')

union all
select 'plan e'' NOT NULL con default free',
       count(*) = 1
  from information_schema.columns
 where table_schema = 'public' and table_name = 'profiles'
   and column_name = 'plan' and is_nullable = 'NO'
   and column_default like '%free%'

union all
select 'le tre colonne NON sono aggiornabili da authenticated',
       count(*) = 0
  from information_schema.column_privileges
 where table_schema = 'public' and table_name = 'profiles'
   and grantee = 'authenticated' and privilege_type = 'UPDATE'
   and column_name in ('plan', 'plan_until', 'rc_app_user_id')

union all
select 'restano aggiornabili esattamente le sei colonne di preferenza',
       count(*) = 6
  from information_schema.column_privileges
 where table_schema = 'public' and table_name = 'profiles'
   and grantee = 'authenticated' and privilege_type = 'UPDATE'

union all
select 'current_plan non e'' eseguibile da authenticated',
       not has_function_privilege('authenticated', 'public.current_plan(uuid)', 'execute')

union all
select 'i tre trigger di piano sono attivi',
       count(*) = 3
  from pg_trigger
 where not tgisinternal
   and tgname in ('memories_enforce_plan_limit',
                  'folders_enforce_plan_limit',
                  'subfolders_enforce_rules')

union all
select 'nessun profilo con un piano fuori dai tre ammessi',
       count(*) = 0
  from public.profiles
 where plan not in ('free', 'pro', 'premium')

union all
select 'nessun piano scaduto continua a valere pro o premium',
       count(*) = 0
  from public.profiles
 where plan <> 'free'
   and plan_until is not null
   and plan_until < now()
   and public.current_plan(id) <> 'free';
