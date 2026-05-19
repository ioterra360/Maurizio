-- Memora — security hardening (addresses Phase 1 review findings)
--
-- This migration locks down the role assignment model, makes the new-user
-- trigger idempotent, restricts function execute privileges, adds length
-- caps + range checks on user-supplied columns, denormalizes user_id onto
-- review_items to close the cross-user-memory hole, and verifies all five
-- tables still have RLS enabled.

-- ============================================================================
-- 1. Kill email-based admin promotion
-- ============================================================================
-- The initial trigger promoted to admin any email matching '%admin%' or
-- ending with '@memora.app'. Combined with self-serve signup, that meant
-- anyone could claim admin by registering admin@anywhere.com.
--
-- New rule: every signup creates a profile with role='user'. Admin status
-- is granted out-of-band via the `is_admin_email` allowlist below. The
-- handle_new_user() trigger consults the allowlist instead of inferring.

create table if not exists public.admin_emails (
  email text primary key,
  granted_at timestamptz not null default now(),
  granted_by text
);

comment on table public.admin_emails is
  'Allowlist of emails that get role=admin at signup. Manually managed by an operator with service_role.';

alter table public.admin_emails enable row level security;

-- Nobody can read this table from the client. Only service_role (which
-- bypasses RLS) can see it. No SELECT policy needed.

-- Seed Maurizio as the sole admin (the codename product owner).
insert into public.admin_emails (email, granted_by)
values ('maurizio.cocco@memora.app', 'initial-seed')
on conflict (email) do nothing;

-- ============================================================================
-- 2. Rewrite handle_new_user — allowlist + idempotent + bounded input
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_role public.user_role;
  display_name text;
  raw_name text;
begin
  -- Role: only the allowlist gets admin. Everything else is a regular user.
  if exists (select 1 from public.admin_emails where lower(email) = lower(new.email)) then
    user_role := 'admin';
  else
    user_role := 'user';
  end if;

  -- Pull name from metadata, but cap length and strip control characters
  -- (raw_user_meta_data is client-controlled JSON).
  raw_name := coalesce(
    new.raw_user_meta_data ->> 'name',
    new.raw_user_meta_data ->> 'full_name',
    initcap(replace(split_part(new.email, '@', 1), '.', ' '))
  );
  display_name := regexp_replace(left(coalesce(raw_name, ''), 120), '[[:cntrl:]]', '', 'g');
  if display_name = '' then
    display_name := 'Memora user';
  end if;

  -- Idempotent: a retried auth.users insert (replica replay, retried webhook,
  -- manual re-run) will no-op the profile insert instead of aborting the auth
  -- row creation.
  insert into public.profiles (id, email, name, role)
  values (new.id, lower(new.email), display_name, user_role)
  on conflict (id) do nothing;

  return new;
exception
  -- Never let profile creation issues kill auth signup. Log and continue.
  when others then
    raise log 'handle_new_user failed for user_id=% email=%: %', new.id, new.email, sqlerrm;
    return new;
end;
$$;

-- ============================================================================
-- 3. Lock down function execute privileges
-- ============================================================================

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

revoke execute on function public.handle_new_user() from public;
-- handle_new_user is invoked by the auth.users trigger, not by clients —
-- no grant needed.

revoke execute on function public.set_updated_at() from public;
-- Same — trigger-invoked only.

-- ============================================================================
-- 4. Profile email canonical-form + length cap
-- ============================================================================

-- All existing profiles get their email lowercased so the unique-ish lookup
-- patterns ("did Maurizio sign up yet?") work case-insensitively without
-- ilike scans.
update public.profiles set email = lower(email) where email <> lower(email);

alter table public.profiles
  add constraint profiles_email_check check (char_length(email) between 3 and 254),
  add constraint profiles_name_check  check (char_length(name)  between 1 and 120);

-- ============================================================================
-- 5. Length caps on user-supplied text columns
-- ============================================================================

alter table public.folders
  add constraint folders_kind_check  check (char_length(kind)  between 1 and 32),
  add constraint folders_name_check  check (char_length(name)  between 1 and 120),
  add constraint folders_color_check check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  add constraint folders_icon_check  check (icon is null or char_length(icon) <= 64),
  add constraint folders_priority_check check (priority between 1 and 999);

alter table public.memories
  add constraint memories_term_check       check (char_length(term) between 1 and 200),
  add constraint memories_reading_check    check (reading is null or char_length(reading) <= 200),
  add constraint memories_definition_check check (char_length(definition) <= 4000),
  add constraint memories_example_check    check (example is null or char_length(example) <= 4000),
  add constraint memories_item_type_check  check (item_type is null or char_length(item_type) <= 32),
  add constraint memories_interval_check   check (srs_interval_days between 0 and 3650),
  add constraint memories_reps_check       check (srs_repetitions between 0 and 100000);

alter table public.review_sessions
  add constraint review_sessions_completed_after_started check (
    completed_at is null or completed_at >= started_at
  ),
  add constraint review_sessions_counts_check check (
    items_reviewed between 0 and 100000
    and items_remembered between 0 and 100000
    and items_struggled between 0 and 100000
    and items_forgot between 0 and 100000
  );

-- ============================================================================
-- 6. Denormalize user_id onto review_items + tighten RLS
-- ============================================================================
-- Initial policy let a user attach review_items pointing at *another user's*
-- memory_id, as long as the session_id was theirs. Now: review_items has its
-- own user_id, RLS requires it match auth.uid(), and a CHECK trigger ensures
-- the joined session + memory all belong to the same user.

alter table public.review_items
  add column user_id uuid references public.profiles(id) on delete cascade;

-- Backfill (table is empty in practice — Phase 1 has no real data — but
-- safe to run on any state):
update public.review_items ri
   set user_id = s.user_id
  from public.review_sessions s
 where s.id = ri.session_id
   and ri.user_id is null;

alter table public.review_items
  alter column user_id set not null;

create index if not exists review_items_user_idx on public.review_items(user_id);

-- Cross-table consistency trigger: session, memory, and item must all share
-- user_id. Enforced on every insert/update.
create or replace function public.review_items_consistency()
returns trigger
language plpgsql
as $$
declare
  session_user uuid;
  memory_user uuid;
begin
  select user_id into session_user from public.review_sessions where id = new.session_id;
  select user_id into memory_user  from public.memories         where id = new.memory_id;

  if session_user is null or memory_user is null then
    raise exception 'review_items must reference an existing session and memory';
  end if;
  if session_user <> new.user_id or memory_user <> new.user_id then
    raise exception 'review_items.user_id must match the session and memory user';
  end if;

  return new;
end;
$$;

create trigger review_items_consistency_check
  before insert or update on public.review_items
  for each row execute function public.review_items_consistency();

-- Tighten the RLS policy: require user_id match, not just session ownership.
drop policy if exists "review_items_all_via_session" on public.review_items;

create policy "review_items_all_own_or_admin"
  on public.review_items for all
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

-- ============================================================================
-- 7. Re-verify RLS on every table (defensive — should already be enabled)
-- ============================================================================

alter table public.profiles        enable row level security;
alter table public.folders         enable row level security;
alter table public.memories        enable row level security;
alter table public.review_sessions enable row level security;
alter table public.review_items    enable row level security;
alter table public.admin_emails    enable row level security;

-- ============================================================================
-- 8. Drop the old hairline policies that duplicated work
-- ============================================================================
-- The initial schema declared two separate policies for profile updates
-- ("profiles_update_own" and "profiles_update_admin"). PostgreSQL applies
-- them with OR semantics, but the admin-bypass already lives inside
-- is_admin(). Collapse to one policy for clarity.

drop policy if exists "profiles_update_own"   on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;

create policy "profiles_update_own_or_admin"
  on public.profiles for update
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());
