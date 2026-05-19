# Data model

> The Supabase schema, in plain language. The authoritative source is the SQL
> in `supabase/migrations/`. If they diverge, update this doc.

Project ref: `taekvxxljtgzsjrlmumo` (region: eu-central-1, Frankfurt).

## Entities

```
auth.users (Supabase-managed)
   │ 1:1
   ▼
public.profiles
   │ 1:N
   ├──────────────► public.folders
   │                   │ 1:N
   │                   ▼
   ├──────────────► public.memories
   │                   │ (queue key: next_review_at)
   │                   │
   │ 1:N               │
   ├──► public.review_sessions
   │       │ 1:N
   │       ▼
   │       public.review_items ◄────────┘  (each item refs one memory)
```

## Tables

### `profiles`

One row per registered user. Auto-created on signup by `handle_new_user()`
trigger. Role inferred from email shape — admin if it contains `admin` or
ends with `@memora.app`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | FK to `auth.users(id)`, cascade delete |
| `email` | text | Mirrors auth, kept for join-free reads |
| `name` | text | Display name (derived from email if not provided) |
| `role` | enum `user_role` | `user` or `admin` |
| `daily_input_cap` | int | Max new memories per day (default 20, 1–200) |
| `calm_mode` | boolean | Suppress notification badges, default `true` |
| `weekly_digest` | boolean | Sunday-evening summary, default `false` |
| `morning_review_at` | time | When the morning nudge fires (default 08:00) |
| `evening_review_at` | time | When the evening nudge fires (default 21:30) |
| `created_at` / `updated_at` | timestamptz | |

### `folders`

Knowledge categories owned by a user. The four seed folders (`jp`, `medicine`,
`es`, `law`) are inserted at first signup (Phase 2 task — not yet implemented;
created lazily in app code for now).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | gen_random_uuid() |
| `user_id` | uuid | FK to `profiles(id)`, cascade |
| `kind` | text | Machine slug. Unique with `user_id`. |
| `name` | text | Display name |
| `priority` | int | 1 = highest. Used for sort + SRS weighting later |
| `color` | text | Hex string, optional override |
| `icon` | text | Lucide icon name or emoji |
| `created_at` / `updated_at` | timestamptz | |

### `memories`

The atomic items the SRS engine drives. `next_review_at` is the queue key —
when it's `<= now()`, the memory is due.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid | FK to profiles (denormalized for RLS speed) |
| `folder_id` | uuid | FK to folders |
| `term` | text | Primary surface (e.g. "中心", "Tachycardia") |
| `reading` | text | Pronunciation / romaji, optional |
| `definition` | text | Body — what to remember |
| `example` | text | Example sentence, optional |
| `item_type` | text | Folder-specific subtype (word/kanji/concept/drug/…) |
| `state` | enum `memory_state` | `active` / `fading` / `archived` |
| `srs_interval_days` | int | Days until next review, ≥ 0 |
| `srs_ease_factor` | numeric(3,2) | SM-2 ease, ≥ 1.30, default 2.50 |
| `srs_repetitions` | int | Successful recall count |
| `last_reviewed_at` | timestamptz | Nullable until first review |
| `next_review_at` | timestamptz | The queue key. Default `now()` |
| `created_at` / `updated_at` | timestamptz | |

Indexed on `(user_id, next_review_at)` for the due-queue query and
`(folder_id, state)` for the folder-state filter.

### `review_sessions`

One pass through a single review layer. A "full daily review" is three rows
(Scan, Reinforcement, Focus) joined by being temporally adjacent — we do NOT
model that as a parent row, because each layer is allowed to run standalone.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid | FK to profiles |
| `layer` | enum `review_layer` | `scan` / `reinforcement` / `focus` |
| `started_at` | timestamptz | |
| `completed_at` | timestamptz | Nullable until the user finishes the session |
| `items_reviewed` | int | Counters denormalized for fast dashboard reads |
| `items_remembered` / `items_struggled` / `items_forgot` | int | |

### `review_items`

The per-memory outcome inside a session. This is the audit log used by SRS
to compute the next interval. Foreign-keyed to both the session and the memory.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `session_id` | uuid | FK to review_sessions, cascade |
| `memory_id` | uuid | FK to memories, cascade |
| `response` | enum `review_response` | `remembered` / `struggled` / `forgot` / `skipped` |
| `reviewed_at` | timestamptz | |

## Enums

```sql
user_role: 'user' | 'admin'
review_layer: 'scan' | 'reinforcement' | 'focus'
memory_state: 'active' | 'fading' | 'archived'
review_response: 'remembered' | 'struggled' | 'forgot' | 'skipped'
```

## Row Level Security

RLS is **enabled on every table**. Default-deny — without a matching policy,
no one sees anything.

Policy summary (full SQL in the migration):

| Table | Read | Write |
|---|---|---|
| `profiles` | self or admin | self updates own row; admin updates any |
| `folders` | self or admin | self for own; admin for any |
| `memories` | self or admin | self for own; admin for any |
| `review_sessions` | self or admin | self for own; admin for any |
| `review_items` | self via session join, or admin | same |

Admin bypass uses `public.is_admin()`, a `SECURITY DEFINER` function that
sidesteps the recursive-RLS-on-profiles problem.

## Triggers

| Trigger | Table | Fires | Purpose |
|---|---|---|---|
| `on_auth_user_created` | `auth.users` | AFTER INSERT | Creates the matching `profiles` row, inferring role from email |
| `profiles_set_updated_at` | `profiles` | BEFORE UPDATE | Touch `updated_at` |
| `folders_set_updated_at` | `folders` | BEFORE UPDATE | Touch `updated_at` |
| `memories_set_updated_at` | `memories` | BEFORE UPDATE | Touch `updated_at` |

## Common queries

### The due queue for a user
```sql
select id, term, folder_id, srs_interval_days, srs_repetitions
from public.memories
where user_id = auth.uid()
  and state <> 'archived'
  and next_review_at <= now()
order by next_review_at
limit 50;
```

### Memory health per folder
```sql
select f.name, m.state, count(*) as n
from public.folders f
join public.memories m on m.folder_id = f.id
where f.user_id = auth.uid()
group by f.name, m.state
order by f.priority;
```

### Today's completed reviews
```sql
select layer, items_remembered, items_struggled, items_forgot
from public.review_sessions
where user_id = auth.uid()
  and completed_at::date = current_date
order by completed_at desc;
```

## Adding to the schema

1. `npx supabase migration new <descriptive_name>`
2. Write SQL in the generated file. Do **not** edit older migrations.
3. `npx supabase db push`
4. Update this doc.
5. Commit both the migration and the doc change in the same commit.

## What's deliberately not modeled yet

These are conscious omissions, not oversights:

- **Subscription state** — comes in Phase 4 with Wix webhook integration.
- **Push notification tokens** — Phase 4.
- **Content templates / "marketplace" folders** — admin shipping pre-built
  decks. Deferred until after launch.
- **Sharing / social** — out of scope per `docs/PRODUCT.md`.
- **Multimedia memories** — photos, audio. Defer until we know we want them.
- **Custom item types** — `item_type` is a text column without a foreign-key
  enforced taxonomy. Loose on purpose for Phase 2.
