-- Memora — initial schema
--
-- Domain: spaced-repetition app. Users own folders; folders contain memories;
-- memories progress through Scan → Reinforcement → Focus review layers with an
-- SRS algorithm (interval / ease / repetitions). Each review run is a session
-- and its individual recall outcomes are review_items.
--
-- Auth model: every authenticated user has a row in `profiles` (1:1 with auth.users).
-- Row Level Security restricts data strictly per user, with an `is_admin()`
-- helper allowing admins to bypass (used by the in-app admin panel).

-- ============================================================================
-- Extensions
-- ============================================================================

create extension if not exists "pgcrypto"; -- for gen_random_uuid()

-- ============================================================================
-- Enums
-- ============================================================================

create type public.user_role as enum ('user', 'admin');
create type public.review_layer as enum ('scan', 'reinforcement', 'focus');
create type public.memory_state as enum ('active', 'fading', 'archived');
create type public.review_response as enum ('remembered', 'struggled', 'forgot', 'skipped');

-- ============================================================================
-- profiles — 1:1 with auth.users
-- ============================================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null default '',
  role public.user_role not null default 'user',
  daily_input_cap int not null default 20 check (daily_input_cap between 1 and 200),
  calm_mode boolean not null default true,
  weekly_digest boolean not null default false,
  morning_review_at time not null default '08:00',
  evening_review_at time not null default '21:30',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'User profiles, 1:1 with auth.users. Owns folders & memories.';

create index profiles_role_idx on public.profiles(role);

-- ============================================================================
-- folders — knowledge categories owned by a user (Japanese, Medicine, etc.)
-- ============================================================================

create table public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,              -- machine slug: 'jp', 'medicine', 'es', 'law', or custom
  name text not null,              -- display name
  priority int not null default 1, -- 1 = highest, used for sort + SRS weighting
  color text,                      -- hex color for UI (optional, falls back to design system)
  icon text,                       -- lucide icon name or emoji
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind)
);

comment on table public.folders is 'Knowledge categories. Each user starts with 4 defaults but can add custom ones.';

create index folders_user_priority_idx on public.folders(user_id, priority);

-- ============================================================================
-- memories — individual items inside folders (the things being remembered)
-- ============================================================================

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  folder_id uuid not null references public.folders(id) on delete cascade,
  term text not null,
  reading text,
  definition text not null default '',
  example text,
  item_type text,
  state public.memory_state not null default 'active',
  srs_interval_days int not null default 1 check (srs_interval_days >= 0),
  srs_ease_factor numeric(3, 2) not null default 2.50 check (srs_ease_factor >= 1.30),
  srs_repetitions int not null default 0,
  last_reviewed_at timestamptz,
  next_review_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.memories is 'Atomic items to remember. Driven by SRS algorithm: next_review_at is the queue.';

create index memories_user_next_review_idx on public.memories(user_id, next_review_at);
create index memories_folder_state_idx on public.memories(folder_id, state);
create index memories_user_state_idx on public.memories(user_id, state);

-- ============================================================================
-- review_sessions — one run of Scan / Reinforcement / Focus
-- ============================================================================

create table public.review_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  layer public.review_layer not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  items_reviewed int not null default 0,
  items_remembered int not null default 0,
  items_struggled int not null default 0,
  items_forgot int not null default 0
);

create index review_sessions_user_started_idx on public.review_sessions(user_id, started_at desc);

-- ============================================================================
-- review_items — per-memory outcome within a session
-- ============================================================================

create table public.review_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.review_sessions(id) on delete cascade,
  memory_id uuid not null references public.memories(id) on delete cascade,
  response public.review_response not null,
  reviewed_at timestamptz not null default now()
);

create index review_items_session_idx on public.review_items(session_id);
create index review_items_memory_idx on public.review_items(memory_id);

-- ============================================================================
-- updated_at trigger
-- ============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger folders_set_updated_at before update on public.folders
  for each row execute function public.set_updated_at();

create trigger memories_set_updated_at before update on public.memories
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Profile auto-creation: every new auth.users gets a public.profiles row.
-- Role inferred from email shape (admin if ends with @memora.app or contains 'admin').
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
begin
  if new.email ilike '%admin%' or new.email ilike '%@memora.app' then
    user_role := 'admin';
  else
    user_role := 'user';
  end if;

  display_name := coalesce(
    new.raw_user_meta_data ->> 'name',
    new.raw_user_meta_data ->> 'full_name',
    initcap(replace(split_part(new.email, '@', 1), '.', ' '))
  );

  insert into public.profiles (id, email, name, role)
  values (new.id, new.email, display_name, user_role);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- Helper: is_admin() — used by RLS policies. SECURITY DEFINER avoids the
-- recursive-RLS-on-profiles problem.
-- ============================================================================

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.folders enable row level security;
alter table public.memories enable row level security;
alter table public.review_sessions enable row level security;
alter table public.review_items enable row level security;

create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles_update_admin"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "folders_all_own_or_admin"
  on public.folders for all
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

create policy "memories_all_own_or_admin"
  on public.memories for all
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

create policy "review_sessions_all_own_or_admin"
  on public.review_sessions for all
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

create policy "review_items_all_via_session"
  on public.review_items for all
  using (
    exists (
      select 1 from public.review_sessions s
      where s.id = session_id and (s.user_id = auth.uid() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.review_sessions s
      where s.id = session_id and (s.user_id = auth.uid() or public.is_admin())
    )
  );
