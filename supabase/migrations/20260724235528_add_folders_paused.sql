-- Folder "dormiente": escluso dalla coda dei ripassi finché non riattivato.
-- Vedi docs/superpowers/specs/2026-07-25-core-loop-design.md §9.
alter table public.folders
  add column paused boolean not null default false;

comment on column public.folders.paused is
  'Paused folders are excluded from the review queue and Today counts.';
