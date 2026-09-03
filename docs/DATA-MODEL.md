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
is in the `admin_emails` allowlist (currently `memikaapp@gmail.com`).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | FK to `auth.users(id)`, cascade delete |
| `email` | text | Mirrors auth, kept for join-free reads |
| `name` | text | Display name (derived from email if not provided) |
| `role` | enum `user_role` | `user` or `admin` |
| `daily_input_cap` | int | Max new memories per day (default 20, 1–200) |
| `calm_mode` | boolean | Suppresses the daily reminder (the first-review alert stays), default `true` — so the daily reminder is opt-out. Spec 2026-09-02 §F3 |
| `weekly_digest` | boolean | Saved preference only — no digest is sent yet; default `false` |
| `morning_review_at` | time | Daily reminder slot (HH:MM, the client floors to a 30-minute slot); default 08:00 |
| `evening_review_at` | time | UNUSED since 2026-09-03 (single reminder); kept for pre-OTA clients, drop in a later migration |
| `plan` | text | `free` / `pro` / `premium`, default `free`. **Not** in the UPDATE grant: only the `revenuecat-sync` edge function writes it (migration 20260903100000) |
| `plan_until` | timestamptz | Entitlement expiry; in the past = the plan is worth `free` (`current_plan()`). null = never expires (lifetime, promo, or a courtesy grant) |
| `rc_app_user_id` | text | RevenueCat App User ID (= `profiles.id`). null on a row RevenueCat has never synced |
| `created_at` / `updated_at` | timestamptz | |

### `folders`

Knowledge categories owned by a user. Nothing is auto-seeded: the user picks
ONE topic at onboarding (`/choose-topic`, "Cosa vuoi ricordare?") from the
taxonomy — 4 macrocategories, ~44 subcategories (`lib/folder-taxonomy.ts`) —
or names a custom folder (1–40 chars client-side). **Identity is `id`**
(migration 20260902130000): `unique(user_id, kind)` is gone, duplicates are
legal, the route is `/folder/[id]`. Insert is allowed by
`folders_all_own_or_admin` (user_id = auth.uid()). Free accounts own one
folder, pro accounts five, premium unlimited — enforced by
`folders_enforce_plan_limit` (`P0005`, migration 20260903100000), counting
**live** folders only; a restore from the trash that would push past the cap
is refused by `folders_enforce_plan_limit_on_restore` with the same code.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | gen_random_uuid() — **l'identità della cartella** |
| `user_id` | uuid | FK to `profiles(id)`, cascade |
| `kind` | text | **LEGACY** bridge slug (`legacyKindFor`), for pre-OTA clients only; removed with a future migration |
| `category` | text | Macrocategoria: `lingue/materie/lavoro/interessi/custom` |
| `template_id` | text | Sottocategoria della tassonomia (es. `ja`, `medicina`, `vino`); null = personalizzata |
| `emoji` | text | Glifo del FolderTile, sempre scritto dal client (backfill sulle righe storiche) |
| `name` | text | Display name |
| `priority` | int | 1 = highest. Written at createFolder (max+1) and on every drag in Cartelle (`updateFolderPriorities`); the review deck fills from the top folder first (`lib/queue.ts allocateByFolderPriority`, 2026-08-29). |
| `color` | text | Hex string, optional override |
| `icon` | text | Lucide icon name or emoji |
| `paused` | boolean | Cartella dormiente: esclusa dalla coda ripassi e dai conteggi di Oggi, default `false` |
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
| `notes` | text | null | Free-text user notes ("appunti"), edited in the memory detail sheet (migration 20260827160000). |
| `example` | text | Example sentence, optional |
| `item_type` | text | Folder-specific subtype (word/kanji/concept/drug/…) |
| `state` | enum `memory_state` | `active` / `fading` / `archived` |
| `review_phase` | text | Fase della scala di Maurizio (migration 20260902100000): `p20h/p48h/p7d/p30d/p3m/p6m/p1y/done` + recuperi `r24h/r48h/r3d/r7d/r14d/r30d/r2m`. Default `'p20h'`. Decide il layer (docs/SRS.md). |
| `review_window_end` | timestamptz | Fine finestra: `< now()` = ricordo in ritardo. `null` = la fase non scade. |
| `recovery_from` | text | Fase in cui è avvenuto il "dimenticato" del recupero in corso; `null` = non in recupero. |
| `last_result` | text | Ultima risposta (`remembered/struggled/forgot`), telemetria. |
| `srs_interval_days` | int | **LEGACY SM-2** — non più letto né scritto dallo scheduler (2026-09-02); da rimuovere con una migrazione futura |
| `srs_ease_factor` | numeric(3,2) | **LEGACY SM-2** — idem |
| `srs_repetitions` | int | **LEGACY SM-2** — idem |
| `last_reviewed_at` | timestamptz | Nullable until first review |
| `next_review_at` | timestamptz | The queue key = inizio finestra. `createMemory` lo semina a **T0+20h** (`firstReview()`); il default DB `now()` non viene mai esercitato |
| `created_at` / `updated_at` | timestamptz | |

Indexed on `(user_id, next_review_at)` for the due-queue query,
`(folder_id, state)` for the folder-state filter, plus
`(user_id, review_phase, next_review_at)` (coda per fase) and
`(user_id, review_window_end)` (ritardatari) from migration 20260902100000.

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
| `memories_enforce_plan_limit` | `memories` | BEFORE INSERT | 10 memories on the free plan, **trash included** (`where user_id`, no `deleted_at` filter) → `P0004` |
| `folders_enforce_plan_limit` | `folders` | BEFORE INSERT | 1 folder (free) / 5 (pro), **live rows only** (`deleted_at is null`) → `P0005` |
| `folders_enforce_plan_limit_on_restore` | `folders` | BEFORE UPDATE, only on `deleted_at` non-null → null | Restore from the trash while the live folders are already at the cap → `P0005` (hint `plan-limit:folders-restore`) |
| `subfolders_enforce_rules` | `subfolders` | BEFORE INSERT OR UPDATE | 0 sections (free) / 3 (pro) → `P0003`, plus the integrity guards (`P0001`) |

The two caps count the trash the opposite way on purpose: a memory restore can
never fail (the total only goes down), while a folder cap of ONE must not lock
out a user who trashed their only folder and owns none — the loop is closed on
the restore instead. The reasoning is in `docs/PAYMENTS.md` § "Grandfathering,
e come contano i tetti" and, at length, in the migration's comments.

### Errcode dei limiti

Clients map the **code**, never a substring of the message (a translation would
break it). `lib/plan.ts` `planLimitFromCode()` is the only place that knows
them.

| Errcode | Limit | i18n |
|---|---|---|
| `P0004` | memories (10 in total, trash included, free) | `planLimit.memories*` |
| `P0005` | folders (1 free, 5 pro, live rows only) — both on create and on restore | `planLimit.folders*`, `planLimit.foldersRestore*` |
| `P0003` | sections (0 free, 3 pro) | `planLimit.sections*` |
| `P0001` | integrity guards, **not** a plan limit | generic message |

PostgREST serves `P0003`/`P0004`/`P0005` as **HTTP 500** — its SQLSTATE→HTTP
table promotes only `P0001` to 400 — but the body with `code` still reaches the
client, which is what `planLimitFromCode()` works on. So plan refusals, a
normal outcome for a free user, show up as 500 in the project logs: not a fault
to chase.

## Functions

| Function | Security | Callable by | Purpose |
|---|---|---|---|
| `is_admin()` | DEFINER | `authenticated` | Admin bypass used by every `or public.is_admin()` policy; reads the caller's `profiles.role` without recursing into RLS |
| `handle_new_user()` | DEFINER (trigger) | nobody (trigger-only) | Creates the `profiles` row on `auth.users` insert, inferring role from the `admin_emails` allowlist |
| `set_updated_at()` | trigger | nobody (trigger-only) | Touches `updated_at` |
| `review_items_consistency()` | trigger | nobody (trigger-only) | Session, memory and item must share `user_id` |
| `delete_own_account()` | DEFINER | `authenticated` only (revoked from `public` and `anon`) | In-app account deletion (Apple 5.1.1(v) / Google Play): `delete from auth.users where id = auth.uid()`; raises `42501` when there is no authenticated caller |
| `current_plan(uid)` | DEFINER, execute revoked from `public`/`anon`/`authenticated` | the plan triggers only | The plan that is worth something now: `plan`, degraded to `free` when `plan_until` is past. Mirrored client-side by `effectivePlan()` in `lib/plan.ts` |

### Account deletion

`delete_own_account()` (migration `20260825152550`) is the only way the client
can remove an account: the app never holds the `service_role` key, and
`auth.users` is not writable by `authenticated`. The function takes **no
parameters** — the target is always `auth.uid()` from the caller's JWT, so a
user can only delete themselves. Everything else goes with the cascade chain:

```
auth.users ─▶ profiles ─▶ folders ─▶ memories ─▶ review_items
                     └──▶ review_sessions ─▶ review_items
```

(`profiles.id → auth.users` cascade in `20260519220216_initial_schema.sql:32`;
`folders/memories/review_sessions.user_id → profiles` at lines 55/76/105;
`review_items.session_id/memory_id` at 123/124; `review_items.user_id` added
with cascade in `20260519224817_security_hardening.sql:156`.) `admin_emails`
is keyed by email with no FK and is intentionally left alone. Supabase's own
`auth.refresh_tokens`, `auth.sessions`, `auth.identities` also cascade from
`auth.users`, so the caller's session is dead the moment the call returns —
the client should still `signOut()` to clear SecureStore.

Client usage: `deleteOwnAccount()` in `lib/api.ts` wraps the RPC (demo mode
is a no-op); Settings → "Elimina account" shows live counts from
`fetchDeletionPreview(userId)` (two `head` count queries on `folders` and
`memories`), calls `deleteOwnAccount()`, resets the review store, then
`signOut()` from the auth store and routes to login. Copy/error mapping lives
in `lib/account-deletion.ts` (tested). The web path
(`ACCOUNT_DELETION_URL` in `lib/constants.ts`) is linked under the card for
Google Play's "delete without the app" requirement.

```ts
const { error } = await supabase.rpc("delete_own_account");
if (!error) await supabase.auth.signOut();
```

Migration `20260825153500` additionally revokes execute from `anon`: the
hosted project's default privileges grant execute on new `public` functions to
`anon`/`authenticated`/`service_role`, and `revoke … from public` does not undo
that explicit grant. No Storage bucket exists yet; when the photo bucket lands,
`storage.objects` cleanup for `owner = auth.uid()` must be added to this
function in a new migration.

## Common queries

### The due queue for a user
```sql
select id, term, folder_id, review_phase, review_window_end
from public.memories
where user_id = auth.uid()
  and deleted_at is null
  and state <> 'archived'
  and next_review_at <= now()
order by next_review_at
limit 50;
```

### I ricordi in ritardo (sezione "Da recuperare")
```sql
select count(*)
from public.memories
where user_id = auth.uid()
  and deleted_at is null
  and state <> 'archived'
  and review_window_end < now();  -- i NULL sono esclusi dal confronto
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

- **Subscription history** — `profiles.plan` + `plan_until` are enough for a
  permission with an expiry; the full history lives in RevenueCat. If we ever
  need it locally, then a table.
- **Push notification tokens** — Phase 4.
- **Content templates / "marketplace" folders** — admin shipping pre-built
  decks. Deferred until after launch.
- **Sharing / social** — out of scope per `docs/PRODUCT.md`.
- **Multimedia memories** — photos, audio. Defer until we know we want them.
- **Custom item types** — `item_type` is a text column without a foreign-key
  enforced taxonomy. Loose on purpose for Phase 2.
