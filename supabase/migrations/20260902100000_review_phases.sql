-- Scala a fasi di Maurizio (screenshot 2026-08-28) al posto di SM-2.
--
-- Perché: il primo ripasso deve cadere a T0+20h e ogni fase ha una scadenza.
-- Il vecchio motore lavorava a GIORNI INTERI per scelta dichiarata
-- (features/srs/scheduler.ts) e la colonna srs_interval_days è un int: 20 ore
-- non erano rappresentabili.
--
-- "In ritardo" NON diventa una colonna di stato né un job schedulato: è il
-- confronto review_window_end < now(), che il client fa come un normale
-- filtro. Sempre corretto per costruzione, niente da monitorare.
--
-- NOTA: questa migrazione NON archivia nulla. Il superamento della finestra
-- produce solo "in ritardo". L'archiviazione automatica arriva insieme alla
-- lista Archiviati con recupero a un tocco: senza via di ritorno sarebbe
-- perdita di dati silenziosa.

alter table public.memories
  add column review_phase text not null default 'p20h'
    check (review_phase in (
      'p20h','p48h','p7d','p30d','p3m','p6m','p1y','done',
      'r24h','r48h','r3d','r7d','r14d','r30d','r2m'
    )),
  add column review_window_end timestamptz,
  add column recovery_from text
    check (recovery_from is null or recovery_from in (
      'p20h','p48h','p7d','p30d','p3m','p6m','p1y','done'
    )),
  add column last_result text
    check (last_result is null or last_result in ('remembered','struggled','forgot'));

comment on column public.memories.review_phase is
  'Fase della scala di Maurizio. p* = scala canonica, r* = percorso di recupero dopo un "dimenticato". Decide il layer di ripasso (features/srs/phases.ts layerForPhase).';
comment on column public.memories.review_window_end is
  'Fine della finestra di ripasso. now() oltre questo valore = ricordo in ritardo. null = la fase non scade.';
comment on column public.memories.recovery_from is
  'Fase in cui e'' avvenuto il "dimenticato" che ha aperto il recupero; decide dove si rientra. null = non in recupero.';

-- Backfill deterministico dalle ripetizioni SM-2 esistenti.
-- I due consolidamenti si ancorano alla CREAZIONE (come da spec: tutto il
-- timing iniziale parte da T0); da 7 giorni in poi all'ultimo ripasso, con
-- created_at come rete di sicurezza se last_reviewed_at fosse null.
update public.memories set
  review_phase = case
    when srs_repetitions <= 0 then 'p20h'
    when srs_repetitions = 1 then 'p48h'
    when srs_repetitions = 2 then 'p7d'
    when srs_repetitions = 3 then 'p30d'
    else 'p3m'
  end,
  next_review_at = case
    when srs_repetitions <= 0 then created_at + interval '20 hours'
    when srs_repetitions = 1 then created_at + interval '48 hours'
    when srs_repetitions = 2 then coalesce(last_reviewed_at, created_at) + interval '7 days'
    when srs_repetitions = 3 then coalesce(last_reviewed_at, created_at) + interval '30 days'
    else coalesce(last_reviewed_at, created_at) + interval '90 days'
  end,
  review_window_end = case
    when srs_repetitions <= 0 then created_at + interval '48 hours'
    when srs_repetitions = 1 then created_at + interval '72 hours'
    when srs_repetitions = 2 then coalesce(last_reviewed_at, created_at) + interval '8 days'
    when srs_repetitions = 3 then coalesce(last_reviewed_at, created_at) + interval '32 days'
    else coalesce(last_reviewed_at, created_at) + interval '94 days'
  end
where deleted_at is null;

-- I ricordi gia' nel cestino non vengono ritoccati: se qualcuno li recupera
-- devono tornare com'erano.

-- La coda si legge per utente + fase + scadenza.
create index memories_user_phase_idx
  on public.memories (user_id, review_phase, next_review_at)
  where deleted_at is null;

-- I ritardatari si leggono per finestra.
create index memories_user_window_idx
  on public.memories (user_id, review_window_end)
  where deleted_at is null and review_window_end is not null;
