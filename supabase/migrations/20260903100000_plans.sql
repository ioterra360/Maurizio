-- Piani Free / Pro / Premium (spec 2026-09-02 §B4).
--
-- Perche' server-side: oggi NESSUNO dei tre limiti e' applicato davvero.
-- FREE_FOLDER_LIMIT e' codice morto, il tetto giornaliero e' un avviso
-- testuale, e daily_input_cap e' persino nella grant di UPDATE dell'utente
-- (20260825121500_lock_profiles_columns.sql) — chiunque se lo porta a 200
-- con una PATCH. Un limite che vive solo nel client non e' un limite.
--
-- Le tre colonne NON entrano nella grant: la lista li' e' esplicita
-- (name, daily_input_cap, calm_mode, weekly_digest, morning_review_at,
-- evening_review_at) e resta quella. Dopo il revoke della stessa migrazione
-- una colonna nuova nasce NON aggiornabile da `authenticated`: e' esattamente
-- quello che vogliamo. L'unico scrittore e' la Edge Function
-- revenuecat-sync, che gira con il service_role.
--
-- GRANDFATHERING: i tre trigger sono BEFORE INSERT e non toccano le righe
-- esistenti. Chi ha 40 ricordi li tiene tutti e semplicemente non puo'
-- aggiungerne. E' la semantica scelta nella spec (:679-681).

alter table public.profiles
  add column plan text not null default 'free'
    check (plan in ('free','pro','premium')),
  add column plan_until timestamptz,
  add column rc_app_user_id text;

comment on column public.profiles.plan is
  'Piano acquistato: free/pro/premium. Scritto SOLO dalla edge function revenuecat-sync (service_role). Non e'' nella grant di UPDATE per authenticated: leggilo con current_plan(), non da solo.';
comment on column public.profiles.plan_until is
  'Scadenza dell''entitlement RevenueCat. null = non scade (a vita o promozionale). Nel passato = il piano vale free, senza bisogno di alcun job di downgrade.';
comment on column public.profiles.rc_app_user_id is
  'App User ID con cui RevenueCat conosce questo utente. Uguale a profiles.id per costruzione (Purchases.logIn(user.id)); serve a riconoscere una riga gia'' sincronizzata e come chiave di audit.';

-- ---------------------------------------------------------------------------
-- I due tester passano a premium PRIMA che i trigger esistano
-- ---------------------------------------------------------------------------
-- Deve stare QUI dentro, e sopra i `create trigger`, non in una query a mano
-- prima del push: la colonna `plan` nasce tre istruzioni fa, quindi un
-- `update public.profiles set plan = 'premium'` eseguito PRIMA del db push
-- fallirebbe con SQLSTATE 42703 (column "plan" does not exist). E farlo DOPO
-- il push aprirebbe una finestra in cui i tetti valgono anche per Maurizio,
-- che ha vc11 e quindi non ha ne' paywall ne' schermata dei piani: si
-- troverebbe bloccato a 10 ricordi senza alcun modo di uscirne.
--
-- La stessa istruzione, dentro la stessa transazione della migrazione, chiude
-- la finestra a zero. E' il punto 6 della lista "Prima di lanciare" del piano
-- 2026-09-03-build3-config-nativa.md, che lo verifica con
-- `grep -n "premium" supabase/migrations/20260903100000_plans.sql`.
--
-- plan_until null = non scade: e' un accesso di cortesia, non un abbonamento.
-- Idempotente e innocua sugli altri progetti: se quelle email non esistono,
-- aggiorna zero righe.
update public.profiles
   set plan = 'premium', plan_until = null
 where email in ('angelo.casula@gmail.com', 'memikaapp@gmail.com');

-- ---------------------------------------------------------------------------
-- Il piano efficace, valutato pigramente
-- ---------------------------------------------------------------------------
-- Niente cron di downgrade: sarebbe una dipendenza in piu' e una finestra
-- di un'ora in cui il trigger direbbe ancora "pro". Il confronto con now()
-- e' sempre corretto per costruzione — stessa scelta gia' fatta per la
-- finestra di ripasso (20260902100000_review_phases.sql:8-10).
--
-- security definer perche' i trigger la chiamano su righe di profiles a cui
-- la policy RLS del chiamante potrebbe non dare accesso; l'execute viene
-- revocato subito dopo, altrimenti le default privileges del progetto
-- ospitato la renderebbero chiamabile da anon/authenticated
-- (20260825153500_delete_own_account_revoke_anon.sql lo documenta) e
-- chiunque potrebbe leggere il piano altrui passando un uuid qualsiasi.
create or replace function public.current_plan(uid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p.plan_until is not null and p.plan_until < now() then 'free'
    else p.plan
  end
  from public.profiles p
  where p.id = uid;
$$;

revoke execute on function public.current_plan(uuid) from public, anon, authenticated;

comment on function public.current_plan(uuid) is
  'Piano che vale adesso: plan, degradato a free se plan_until e'' passato. Specchio esatto di effectivePlan() in lib/plan.ts.';

-- ---------------------------------------------------------------------------
-- Ricordi: 10 totali sul piano free
-- ---------------------------------------------------------------------------
-- Si contano TUTTE le righe dell'utente, cestino compreso: nessun filtro su
-- deleted_at.
--
-- Perche' non le sole righe vive: il ripristino dal cestino e' una UPDATE
-- (restoreFolder lib/api.ts:1042-1055, restoreMemory :1063-1095) e non passa
-- da un trigger BEFORE INSERT. Contando solo le righe vive, il ciclo
-- "cestina 5 → inserisci 5 → ripristina 5" e' ripetibile all'infinito e il
-- tetto smette di esistere; sulle cartelle basterebbe "cestina l'unica →
-- creane una nuova → ripristina la vecchia" per averne due, poi tre, poi
-- quante si vuole. L'alternativa (un trigger anche sulla transizione
-- deleted_at→NULL) impedirebbe a un utente grandfathered di ripristinare
-- cio' che ha cestinato: perdita di dati per difendere una quota.
--
-- Contando tutto, il totale puo' solo SCENDERE (purga a 24 ore): il
-- ripristino non puo' mai portare sopra il tetto, quindi non serve nessun
-- trigger su UPDATE e il grandfathering resta intatto. E' la stessa
-- semantica gia' scelta dal repo per il contatore giornaliero
-- (lib/api.ts:468-471: "eliminare e reinserire non deve liberare quota").
-- Costo accettato e dichiarato nella copy: una riga nel cestino occupa il
-- suo posto fino alla purga.
--
-- L'ordine delle istruzioni conta: si legge PRIMA il piano e si esce subito
-- per chi non ha tetto, poi si prende il lock. Cosi' un abbonato Pro o
-- Premium non serializza tutti i suoi inserimenti su un lock esclusivo
-- della propria riga di profiles per un limite che non lo riguarda. Per chi
-- il tetto ce l'ha la garanzia e' identica: il lock e' comunque preso PRIMA
-- del conteggio, e in READ COMMITTED chi aspetta il lock rilegge con uno
-- snapshot nuovo — due dispositivi che vedono entrambi 9 non arrivano a 11.
--
-- INSERT multi-riga (PostgREST accetta un corpo array e lo traduce in UN
-- solo comando): il conteggio vede anche le righe gia' inserite dallo stesso
-- comando. Ogni query di una funzione plpgsql passa da SPI, che per una
-- funzione VOLATILE fa CommandCounterIncrement() e prende uno snapshot
-- nuovo prima di eseguire — quindi la riga 1 e' visibile al trigger della
-- riga 2. Il test funzionale (_plans_local_test.sql, blocco 3-ter) lo
-- verifica esplicitamente con 25 righe in un solo INSERT.
--
-- La riga NUOVA non e' ancora nella tabella, quindi l'ordine alfabetico dei
-- trigger BEFORE INSERT su memories (…_enforce_plan_limit <
-- …_guard_deleted_at < …_subfolder_coherence) non influenza il conteggio —
-- e con il predicato "tutte le righe" non conta nemmeno che
-- guard_memory_deleted_at possa riscrivere deleted_at.
create or replace function public.enforce_memory_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  eff text;
  cap int;
  used int;
begin
  eff := coalesce(public.current_plan(new.user_id), 'free');
  cap := case eff when 'free' then 10 else null end;
  if cap is null then
    return new;
  end if;
  -- Lock DOPO il controllo del piano: serializza solo chi ha davvero un
  -- tetto, mai gli abbonati.
  perform 1 from public.profiles where id = new.user_id for update;
  select count(*) into used
    from public.memories
   where user_id = new.user_id;
  if used >= cap then
    raise exception 'memories limit reached (% on the free plan)', cap
      using errcode = 'P0004', hint = 'plan-limit:memories';
  end if;
  return new;
end;
$$;

create trigger memories_enforce_plan_limit
  before insert on public.memories
  for each row execute function public.enforce_memory_plan_limit();

-- ---------------------------------------------------------------------------
-- Cartelle: 1 free / 5 pro / illimitate premium
-- ---------------------------------------------------------------------------
-- Tutte le righe di public.folders sono di primo livello: le sezioni vivono
-- nella tabella separata public.subfolders (20260831010000_subfolders.sql)
-- e folders non ha alcuna colonna parent. Non serve nessun filtro.
--
-- Le cartelle in pausa CONTANO: `paused` e' una scelta di carico
-- (20260724235528_add_folders_paused.sql), non di proprieta', ed e'
-- scrivibile dall'utente — escluderle sarebbe un modo per aggirare il tetto.
--
-- E contano anche le cartelle NEL CESTINO, per la stessa ragione del tetto
-- ricordi qui sopra: restoreFolder e' una UPDATE, e senza questo predicato
-- "cestina l'unica cartella → creane una nuova → ripristina la vecchia"
-- darebbe due cartelle su un piano da una, ripetibile all'infinito.
-- Stesso ordine: piano prima, lock dopo, conteggio per ultimo.
create or replace function public.enforce_folder_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  eff text;
  cap int;
  used int;
begin
  eff := coalesce(public.current_plan(new.user_id), 'free');
  cap := case eff when 'free' then 1 when 'pro' then 5 else null end;
  if cap is null then
    return new;
  end if;
  perform 1 from public.profiles where id = new.user_id for update;
  select count(*) into used
    from public.folders
   where user_id = new.user_id;
  if used >= cap then
    raise exception 'folders limit reached (% on the % plan)', cap, eff
      using errcode = 'P0005', hint = 'plan-limit:folders';
  end if;
  return new;
end;
$$;

create trigger folders_enforce_plan_limit
  before insert on public.folders
  for each row execute function public.enforce_folder_plan_limit();

-- ---------------------------------------------------------------------------
-- Sezioni: 0 free / 3 pro / illimitate premium
-- ---------------------------------------------------------------------------
-- Sostituisce la versione di 20260831020000_subfolder_guards.sql: identica
-- nelle due guardie di integrita' (stesso P0001, stesso testo), diverso solo
-- il tetto, che ora dipende dal piano. subfolders non ha deleted_at — una
-- sezione muore col cascade della cartella — quindi si contano tutte le
-- righe della cartella madre, come prima.
--
-- Il messaggio contiene ancora la parola inglese "limit" di proposito: i
-- binari gia' in circolazione (Play vc12, iOS build 2) riconoscono il tetto
-- SOLO con msg.includes("limit") e senza quella parola mostrerebbero
-- l'errore generico. Il Task 8 toglie quel controllo dal client nuovo.
create or replace function public.enforce_subfolder_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent record;
  eff text;
  cap int;
begin
  -- Lock sulla cartella madre: serializza i creatori concorrenti e congela
  -- deleted_at rispetto a un deleteFolder parallelo.
  select user_id, deleted_at into parent
    from public.folders where id = new.folder_id for update;
  if parent is null or parent.user_id <> new.user_id then
    raise exception 'subfolder must belong to a folder of the same user'
      using errcode = 'P0001';
  end if;
  if parent.deleted_at is not null then
    raise exception 'cannot add a subfolder to a trashed folder'
      using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' or new.folder_id is distinct from old.folder_id then
    eff := coalesce(public.current_plan(new.user_id), 'free');
    cap := case eff when 'free' then 0 when 'pro' then 3 else null end;
    if cap is not null
       and (select count(*) from public.subfolders
             where folder_id = new.folder_id and id <> new.id) >= cap then
      raise exception 'section limit reached (% per folder on the % plan)', cap, eff
        using errcode = 'P0003', hint = 'plan-limit:sections';
    end if;
  end if;
  return new;
end;
$$;

-- Il trigger subfolders_enforce_rules (20260831010000_subfolders.sql:83)
-- punta gia' a questa funzione: sostituirne il corpo basta, non va ricreato.
