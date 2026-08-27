-- Free-text notes on a memory ("appunti"): the user's own remarks about the
-- word, edited from the memory detail sheet (app/memory/[id].tsx).
-- Nullable, no default; covered by the existing memories_all_own_or_admin
-- policy (own rows only). Decided by Angelo on 2026-08-27.

alter table public.memories
  add column if not exists notes text;

comment on column public.memories.notes is
  'User notes about this memory (free text, optional). Edited in the memory detail sheet.';
