-- Piani Free / Plus / Pro (spec 2026-09-02 §B4).
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
-- GRANDFATHERING: i tre tetti sono BEFORE INSERT e non toccano le righe
-- esistenti. Chi ha 40 ricordi li tiene tutti e semplicemente non puo'
-- aggiungerne. E' la semantica scelta nella spec (:679-681).
--
-- L'unica guardia su UPDATE e' folders_enforce_plan_limit_on_restore, che
-- rifiuta il RIPRISTINO di una cartella dal cestino quando le vive sono gia'
-- al tetto: e' il prezzo per non contare il cestino fra le cartelle, cioe'
-- per non lasciare a bocca asciutta chi cestina la sua unica cartella e
-- vuole ricominciare. Tutto spiegato nella sezione "Cartelle" piu' sotto.

alter table public.profiles
  add column plan text not null default 'free'
    check (plan in ('free','plus','pro')),
  add column plan_until timestamptz,
  add column rc_app_user_id text;

comment on column public.profiles.plan is
  'Piano acquistato: free/plus/pro. Scritto SOLO dalla edge function revenuecat-sync (service_role). Non e'' nella grant di UPDATE per authenticated: leggilo con current_plan(), non da solo.';
comment on column public.profiles.plan_until is
  'Scadenza dell''entitlement RevenueCat. null = non scade (a vita o promozionale). Nel passato = il piano vale free, senza bisogno di alcun job di downgrade.';
comment on column public.profiles.rc_app_user_id is
  'App User ID con cui RevenueCat conosce questo utente. Uguale a profiles.id per costruzione (Purchases.logIn(user.id)); serve a riconoscere una riga gia'' sincronizzata e come chiave di audit.';

-- ---------------------------------------------------------------------------
-- I due tester passano a pro PRIMA che i trigger esistano
-- ---------------------------------------------------------------------------
-- Deve stare QUI dentro, e sopra i `create trigger`, non in una query a mano
-- prima del push: la colonna `plan` nasce tre istruzioni fa, quindi un
-- `update public.profiles set plan = 'pro'` eseguito PRIMA del db push
-- fallirebbe con SQLSTATE 42703 (column "plan" does not exist). E farlo DOPO
-- il push aprirebbe una finestra in cui i tetti valgono anche per Maurizio,
-- che ha vc11 e quindi non ha ne' paywall ne' schermata dei piani: si
-- troverebbe bloccato a 10 ricordi senza alcun modo di uscirne.
--
-- La stessa istruzione, dentro la stessa transazione della migrazione, chiude
-- la finestra a zero. E' il punto 6 della lista "Prima di lanciare" del piano
-- 2026-09-03-build3-config-nativa.md, che lo verifica con
-- `grep -n "set plan = 'pro'" supabase/migrations/20260903100000_plans.sql`.
--
-- plan_until null = non scade: e' un accesso di cortesia, non un abbonamento.
-- Idempotente e innocua sugli altri progetti: se quelle email non esistono,
-- aggiorna zero righe.
update public.profiles
   set plan = 'pro', plan_until = null
 where email in ('angelo.casula@gmail.com', 'memikaapp@gmail.com');

-- ---------------------------------------------------------------------------
-- Il piano efficace, valutato pigramente
-- ---------------------------------------------------------------------------
-- Niente cron di downgrade: sarebbe una dipendenza in piu' e una finestra
-- di un'ora in cui il trigger direbbe ancora "plus". Il confronto con now()
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
-- tetto smette di esistere.
--
-- Contando tutto, il totale puo' solo SCENDERE (purga a 24 ore): il
-- ripristino non puo' mai portare sopra il tetto, quindi qui non serve
-- nessun trigger su UPDATE e il grandfathering resta intatto — chi ha 40
-- ricordi puo' sempre ritirare fuori dal cestino cio' che ci ha messo. E' la
-- stessa semantica gia' scelta dal repo per il contatore giornaliero
-- (lib/api.ts:468-471: "eliminare e reinserire non deve liberare quota").
-- Costo accettato e dichiarato nella copy: un ricordo nel cestino occupa il
-- suo posto fino alla purga.
--
-- Le CARTELLE seguono la regola OPPOSTA (solo righe vive, piu' una guardia
-- sul ripristino); il perche' sta per esteso nella loro sezione. In breve:
-- li' il tetto vale 1 e non esiste alcuna "elimina definitivamente", quindi
-- il conteggio totale lascerebbe un utente nuovo con zero cartelle e senza
-- poterne creare una per 24 ore. Qui il tetto e' 10: chi cestina un ricordo
-- ha ancora nove righe di margine, vede quella nel cestino e la ripristina
-- quando vuole.
--
-- L'ordine delle istruzioni conta: si legge PRIMA il piano e si esce subito
-- per chi non ha tetto, poi si prende il lock. Cosi' un abbonato Plus o Pro
-- non serializza tutti i suoi inserimenti su un lock esclusivo della
-- propria riga di profiles per un limite che non lo riguarda. Per chi
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
-- Cartelle: 1 free / 5 plus / illimitate pro
-- ---------------------------------------------------------------------------
-- Tutte le righe di public.folders sono di primo livello: le sezioni vivono
-- nella tabella separata public.subfolders (20260831010000_subfolders.sql)
-- e folders non ha alcuna colonna parent. Nessun filtro di gerarchia.
--
-- Le cartelle in pausa CONTANO: `paused` e' una scelta di carico
-- (20260724235528_add_folders_paused.sql), non di proprieta', ed e'
-- scrivibile dall'utente — escluderle sarebbe un modo per aggirare il tetto.
--
-- Le cartelle NEL CESTINO invece NON contano (`deleted_at is null`), al
-- contrario del tetto ricordi qui sopra. La differenza e' voluta, e nasce da
-- un caso raggiungibile nei primi minuti di vita di un account con un tetto
-- che vale UNO:
--   1) l'utente sceglie "Spagnolo" a /choose-topic, si accorge di volere
--      "Inglese" e cestina la cartella;
--   2) Conoscenza mostra lo stato vuoto e invita a "crea cartella";
--   3) contando anche il cestino, quell'INSERT verrebbe rifiutato con P0005
--      "folders limit reached (1 on the free plan)".
-- Gli si direbbe che ha esaurito il piano mentre l'app gli mostra ZERO
-- cartelle, e non potrebbe crearne nessuna — quindi nemmeno un ricordo —
-- fino alla purga: fino a 24 ore, perche' l'app non ha alcuna "elimina
-- definitivamente" e il cestino si svuota solo col cron orario
-- (20260830120000_trash_soft_delete.sql:43, app/trash.tsx mostra solo il
-- conto alla rovescia). Un tetto non deve mai bloccare chi e' sotto il
-- tetto. Il conteggio delle sole righe vive e' anche l'unico coerente con
-- countFolders() (lib/api.ts), che filtra gia' `deleted_at is null`: client
-- e server dicono lo stesso numero.
--
-- Il buco che il conteggio totale difendeva — "cestina l'unica cartella →
-- creane una nuova → ripristina la vecchia" = due cartelle su un piano da
-- una, ripetibile all'infinito — si chiude dall'altro capo, sul RIPRISTINO:
-- folders_enforce_plan_limit_on_restore (qui sotto) rifiuta la transizione
-- deleted_at → null quando le cartelle vive sono gia' al tetto. Le vive non
-- superano mai il tetto e la creazione non e' mai bloccata a torto.
--
-- Costo accettato, ed e' il rovescio di quello di prima: un utente
-- grandfathered (piu' cartelle del tetto perche' le aveva gia') che ne
-- cestina una non puo' riprenderla finche' resta al tetto — deve prima
-- cestinarne un'altra. Il rifiuto e' immediato, spiegato e rimediabile
-- dall'utente, e la riga resta nel cestino le sue 24 ore; il blocco alla
-- creazione, invece, non aveva alcun rimedio se non pagare o aspettare.
-- Restano possibili molte righe nel cestino (cicla crea → cestina), ma sono
-- cartelle vuote e a termine: il tetto ricordi, che il cestino lo conta,
-- tiene comunque il contenuto a 10 righe.
--
-- Ordine delle istruzioni: piano prima, lock dopo, conteggio per ultimo —
-- stesse ragioni del tetto ricordi.
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
  cap := case eff when 'free' then 1 when 'plus' then 5 else null end;
  if cap is null then
    return new;
  end if;
  perform 1 from public.profiles where id = new.user_id for update;
  select count(*) into used
    from public.folders
   where user_id = new.user_id
     and deleted_at is null;
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

-- Il ripristino dal cestino e' l'altra meta' del tetto cartelle: e' una
-- UPDATE (restoreFolder, lib/api.ts; restoreMemory ripristina anche la
-- cartella madre) e senza guardia riporterebbe sopra il tetto una riga
-- creata quando lo slot era libero.
--
-- Si contano le altre righe VIVE dell'utente: la riga in ripristino, in un
-- BEFORE UPDATE, e' ancora nel cestino nella tabella, ma `id <> new.id` lo
-- rende esplicito invece che implicito. Il tetto e' lo stesso dell'INSERT e
-- l'errcode e' lo stesso (P0005): per il client e' "hai finito le cartelle
-- del piano", che e' esattamente cio' che e'. Cambia solo il messaggio (che
-- contiene comunque la parola "limit", per i binari vecchi che riconoscono
-- il tetto con msg.includes("limit")) e lo hint, cosi' nei log di PostgREST
-- i due rifiuti restano distinguibili.
--
-- MA il conto da solo non basta, e la differenza e' perdita di dati.
-- La creazione di cartelle non e' MAI stata applicata nei binari in
-- circolazione (FOLDER_LIMIT_ENFORCED era codice morto, tolto in questa
-- stessa build): un tester arriva qui con 3 cartelle vive su un piano che ne
-- prevede 1. Il grandfathering delle BEFORE INSERT gliele lascia tutte — ed
-- e' la semantica scelta nella spec — ma un guard che guardasse solo
-- `used >= cap` gli rifiuterebbe il ripristino di QUALUNQUE cartella
-- cestinata per sbaglio, mentre folderSettings gli ha appena promesso "puoi
-- ripristinarli entro 24 ore". Dopo 24 ore purge_trash() la cancella con
-- tutti i suoi ricordi. Cestinarne un'altra per liberare lo slot non
-- servirebbe (ne resterebbe comunque una = cap): l'unica uscita sarebbe
-- svuotare tutto, cioe' mettere nel cestino ANCHE le altre e perderle.
--
-- Il buco che la guardia esiste per chiudere e' un altro ed e' preciso:
-- "cestino l'unica cartella -> ne creo una nuova -> ripristino la vecchia",
-- che porterebbe a cap+1 partendo da cap. In quel giro c'e' sempre una
-- cartella viva NATA DOPO che questa e' finita nel cestino. Quindi si
-- rifiuta solo li': `used >= cap` E esiste una cartella viva con
-- `created_at > old.deleted_at`. Chi e' semplicemente sopra il tetto per
-- grandfathering non puo' averne creata una (la BEFORE INSERT glielo
-- impedisce) e ripristina liberamente.
--
-- Proprieta' utile: quando il rifiuto scatta, cestinare UNA cartella viva
-- basta sempre a farlo passare — chi e' nel giro sopra e' per costruzione
-- sceso sotto il tetto prima di creare. E' esattamente quello che dice la
-- copy di PlanLimitDialog (planLimit.foldersRestoreBody, "spostane un'altra
-- nel cestino"), che senza questa condizione sarebbe stata un consiglio
-- sbagliato per un utente grandfathered.
-- WHEN sulla sola transizione cestino → vivo: nessun costo sulle UPDATE
-- normali (rinomina, priorita', pausa, ingresso nel cestino). Il BEFORE
-- UPDATE che gira prima in ordine alfabetico, folders_clamp_deleted_at,
-- tocca new.deleted_at solo all'INGRESSO nel cestino, quindi non puo'
-- alterare la condizione.
create or replace function public.enforce_folder_restore_plan_limit()
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
  cap := case eff when 'free' then 1 when 'plus' then 5 else null end;
  if cap is null then
    return new;
  end if;
  perform 1 from public.profiles where id = new.user_id for update;
  select count(*) into used
    from public.folders
   where user_id = new.user_id
     and deleted_at is null
     and id <> new.id;
  -- old.deleted_at non e' mai null qui: lo garantisce il WHEN del trigger.
  if used >= cap and exists (
    select 1
      from public.folders
     where user_id = new.user_id
       and deleted_at is null
       and id <> new.id
       and created_at > old.deleted_at
  ) then
    raise exception 'folders limit reached (% on the % plan): free a live slot before restoring', cap, eff
      using errcode = 'P0005', hint = 'plan-limit:folders-restore';
  end if;
  return new;
end;
$$;

create trigger folders_enforce_plan_limit_on_restore
  before update on public.folders
  for each row
  when (old.deleted_at is not null and new.deleted_at is null)
  execute function public.enforce_folder_restore_plan_limit();

-- ---------------------------------------------------------------------------
-- Sezioni: 0 free / 3 plus / illimitate pro
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
    cap := case eff when 'free' then 0 when 'plus' then 3 else null end;
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
