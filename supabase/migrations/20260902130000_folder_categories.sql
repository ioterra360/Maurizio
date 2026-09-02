-- Cartelle: da "kind = identità" a "id = identità" (spec 2026-09-02 §F4).
--
-- Perché: la tassonomia di Maurizio (4 macrocategorie, ~44 sottocategorie)
-- non sta nei 5 kind chiusi, e unique(user_id, kind) limitava l'account a
-- 5 cartelle di cui UNA personalizzata. L'identità passa a folders.id;
-- kind resta come colonna ponte per i client vecchi (icona e chip) e si
-- rimuove con una migrazione futura, quando nessun binario la legge più.
--
-- Effetto collaterale voluto: cadono la rianimazione-da-cestino in
-- createFolder (esisteva solo per aggirare il 23505 del vincolo) e il
-- tetto client di 5 cartelle. Due cartelle omonime o dello stesso template
-- sono ora possibili e accettabili.

alter table public.folders
  drop constraint folders_user_id_kind_key;

alter table public.folders
  add column category text
    check (category is null or category in ('lingue','materie','lavoro','interessi','custom')),
  add column template_id text
    check (template_id is null or char_length(template_id) between 1 and 32),
  add column emoji text
    check (emoji is null or char_length(emoji) between 1 and 16);

comment on column public.folders.category is
  'Macrocategoria della tassonomia (lib/folder-taxonomy.ts): lingue/materie/lavoro/interessi, o custom per le cartelle libere. null solo su righe pre-migrazione mai backfillate.';
comment on column public.folders.template_id is
  'Sottocategoria scelta alla creazione (es. ja, medicina, vino). null = cartella personalizzata.';
comment on column public.folders.emoji is
  'Glifo mostrato in FolderTile. Sempre valorizzato dal client; il backfill copre le righe esistenti.';

-- Backfill dai 5 kind storici — specchio di LEGACY_KIND_TO_TEMPLATE in
-- lib/folder-taxonomy.ts. Copre anche le righe nel cestino: se vengono
-- ripristinate devono avere l'aspetto giusto.
update public.folders set
  category = case kind
    when 'jp' then 'lingue'
    when 'es' then 'lingue'
    when 'medicine' then 'materie'
    when 'law' then 'materie'
    else 'custom'
  end,
  template_id = case kind
    when 'jp' then 'ja'
    when 'es' then 'es'
    when 'medicine' then 'medicina'
    when 'law' then 'diritto'
    else null
  end,
  emoji = case kind
    when 'jp' then '🇯🇵'
    when 'es' then '🇪🇸'
    when 'medicine' then '🩺'
    when 'law' then '⚖️'
    else '📁'
  end;

-- Le liste si leggono per utente + priorità (l'ordine trascinabile).
create index if not exists folders_user_priority_idx
  on public.folders (user_id, priority)
  where deleted_at is null;
