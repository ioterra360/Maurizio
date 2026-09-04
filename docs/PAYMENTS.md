# Payments

> Tre piani — Free / Plus / Pro — venduti come **abbonamenti in-app via
> RevenueCat**. Decisione 2026-07-25, confermata 2026-08-25, parametri fissati
> 2026-09-02, costruiti 2026-09-03. Nessun checkout web: un binario che rimanda
> a un pagamento esterno viene rifiutato sotto Apple 3.1.1 e Google Play
> Payments.

## Stato (2026-09-04)

Implementato in codice, **non ancora attivo**: mancano il progetto RevenueCat,
i prodotti negli store e le chiavi. Fino ad allora
`EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `_ANDROID_KEY` sono stringhe vuote in
`eas.json`, `purchasesAvailable` è falso, nessuna riga tocca l'SDK e il paywall
mostra le tre schede con i bottoni spenti.

Quando la migrazione dei limiti va in produzione lo decide **una sola pagina**,
la "Sequenza" di `docs/DEPLOY.md` § "Build 3" (è quella che esegue il Task 6 del
piano `2026-09-03-build3-config-nativa.md`): dopo che le build sono `FINISHED`,
prima del submit. Il vincolo che conta non è "quando la build è sugli store" ma
il **bivio del punto 4** di quella stessa pagina: con le chiavi RevenueCat vuote
il paywall ha i bottoni spenti, e spingere i trigger senza allargare la cortesia
pro agli account esistenti chiuderebbe ogni tester in Free senza una via
d'uscita dal client. I due rami ammessi (tenere indietro `20260903100000_plans.sql`,
oppure spingere e concedere subito la cortesia) sono scritti lì.

## I piani

| | Free | Plus | Pro |
|---|---|---|---|
| Ricordi | **10 totali** sull'account | illimitati | illimitati |
| Cartelle | 1 | 5 | illimitate |
| Sezioni per cartella | 0 | 3 | illimitate |
| Foto sui ricordi | — | — | ✓ |

I 10 ricordi sono un tetto **totale**, non giornaliero. Il cursore in
Impostazioni (`profiles.daily_input_cap`) è un'altra cosa: autoregolazione del
carico, con gli avvisi della mascotte a 20/25/30.

La riga "Limite giornaliero" è visibile a tutti e **non va gatata sul piano**.
Nella build 3 il client legge `plan` da un profilo che può ancora non avere
quella colonna e in mancanza di risposta degrada a `free`
(`lib/auth-store.ts:177`): un `plan !== "free"` intorno a quella riga
nasconderebbe il cursore a tutti, tester pro compresi, e senza chiavi
RevenueCat non esiste una riparazione dal client. Per un utente free il cursore
semplicemente non morde mai — in Add il contatore giornaliero è sostituito da
quello totale (`app/add.tsx:898`) e l'opzione più bassa del selettore (10)
coincide già col tetto totale del piano.

Prezzi, durata e periodo di prova sono configurazione RevenueCat: non toccano
una riga di codice. Gli identificativi dei prodotti sì, e sono in
`lib/plan.ts` (`PRODUCT_IDS`): `memika_plus_monthly`, `memika_plus_yearly`,
`memika_pro_monthly`, `memika_pro_yearly`. Ogni id che viene creato
deve essere identico in App Store Connect, Play Console e RevenueCat.

**Rinomina delle fasce (2026-09-04).** Fino al 2026-09-03 la fascia intermedia
si chiamava `pro` e quella alta `premium`; il listino di Maurizio usa **Plus**
(intermedia) e **Pro** (alta), e la parola "pro" cambia quindi significato. La
rinomina e' stata fatta PRIMA di creare qualunque prodotto negli store o in
RevenueCat, perche' gli identificativi dei prodotti e degli entitlement sono
permanenti una volta creati. Nel codice non esiste piu' nessuna fascia
`premium`: `memika_pro_monthly` indica oggi la fascia ALTA (prima indicava
l'intermedia) e l'entitlement `pro` fa lo stesso. Nessun tetto e nessun prezzo
e' cambiato con la rinomina.

Entitlement RevenueCat: **`plus` e `pro`** (due, non uno). Offerta:
`default`, che **in questo ciclo contiene solo i due pacchetti mensili**. Il
paywall ha un bottone per scheda e nessun selettore di periodicità: un
pacchetto annuale accanto a un mensile sarebbe configurato, caricato e mai
vendibile. I due id annuali restano riservati e `planForProductId()` li
riconosce già, così aggiungere il piano annuale in futuro sarà lavoro di
interfaccia e di offerta, non di mappa.

## Grandfathering, e come contano i tetti

Chi ha già più di 10 ricordi, più di una cartella o delle sezioni li tiene
tutti e semplicemente non può aggiungerne. Cade fuori gratis dai tetti, che
sono `BEFORE INSERT` e non guardano le righe esistenti.

I due tetti contano il cestino in modo **opposto**, e la differenza è voluta.

- **Ricordi: cestino compreso.** Il ripristino è una UPDATE e non passa da un
  trigger `BEFORE INSERT`: contando le sole righe vive, il ciclo "cestina 5 →
  inserisci 5 → ripristina 5" sarebbe ripetibile all'infinito e il tetto
  smetterebbe di esistere. Contando tutto, il totale può solo scendere (purga a
  24 ore), quindi nessun ripristino di un ricordo può fallire. Il prezzo — un
  ricordo nel cestino occupa il suo posto fino alla purga — è detto nella copy
  della mascotte.
- **Cartelle: solo le vive.** Lì il tetto free vale UNO e l'app non ha alcuna
  "elimina definitivamente". Contando anche il cestino, chi sceglie "Spagnolo"
  a `/choose-topic`, cambia idea e lo cestina si troverebbe con ZERO cartelle,
  lo stato vuoto che invita a crearne una, e un rifiuto `P0005` per 24 ore: un
  tetto che blocca chi è sotto il tetto. È anche l'unico conteggio coerente con
  `countFolders()` (`lib/api.ts`), che filtra già `deleted_at is null`.
  Il buco del ciclo "cestina → crea → ripristina" si chiude dall'altro capo,
  sul **ripristino**: `folders_enforce_plan_limit_on_restore` rifiuta la
  transizione cestino → vivo quando le cartelle vive sono al tetto **e almeno
  una è nata dopo che questa è finita nel cestino** — cioè esattamente dentro
  quel ciclo. Chi è sopra il tetto per grandfathering (la creazione non è mai
  stata applicata prima di questa migrazione) ripristina liberamente: non può
  aver creato niente, glielo impedisce la BEFORE INSERT. Senza quella seconda
  condizione la promessa di `folderSettings` — "puoi ripristinarli entro 24
  ore" — sarebbe falsa proprio per i tester che hanno più cartelle di quante
  il piano free ne preveda, e `purge_trash()` cancellerebbe cartella e ricordi
  il giorno dopo. Costo accettato: chi è dentro il ciclo deve liberare uno
  slot prima di riprendersi la cartella — e cestinarne UNA basta sempre, che è
  quello che dice la copy. Il Cestino mostra quel rifiuto con la mascotte
  (`planLimit.foldersRestore*`), non con "Riprova".

## Dove vive la verità

**Nel database.** `supabase/migrations/20260903100000_plans.sql`:

```sql
alter table public.profiles
  add column plan text not null default 'free' check (plan in ('free','plus','pro')),
  add column plan_until timestamptz,
  add column rc_app_user_id text;
```

Nessuna delle tre entra nella grant di UPDATE per `authenticated`
(`20260825121500_lock_profiles_columns.sql` elenca esattamente sei colonne, e
resta così). È la lezione diretta di `daily_input_cap`, che è scrivibile
dall'utente e quindi inutile come limite.

`public.current_plan(uid)` degrada a `free` un piano con `plan_until` nel
passato — valutazione pigra, nessun cron di downgrade. `lib/plan.ts`
`effectivePlan()` ne è lo specchio esatto lato client.

Quattro trigger applicano i tetti e sollevano errcode dedicati:

| Errcode | Trigger | Quando | Limite |
|---|---|---|---|
| `P0004` | `memories_enforce_plan_limit` | BEFORE INSERT | 10 ricordi (free), cestino compreso |
| `P0005` | `folders_enforce_plan_limit` | BEFORE INSERT | 1 cartella (free), 5 (plus) — solo le vive |
| `P0005` | `folders_enforce_plan_limit_on_restore` | BEFORE UPDATE, cestino → vivo | ripristino con le vive già al tetto (hint `plan-limit:folders-restore`) |
| `P0003` | `subfolders_enforce_rules` | BEFORE INSERT OR UPDATE | 0 sezioni (free), 3 (plus) |

Il client li mappa **per codice**, mai per sottostringa del messaggio
(`planLimitFromCode()` in `lib/plan.ts`).

PostgREST serve `P0003`/`P0004`/`P0005` come **HTTP 500** (solo `P0001`
diventa 400): il corpo JSON con `code` arriva comunque al client e l'app si
comporta correttamente, ma nei log del progetto i rifiuti di piano — un esito
normale per un utente free — compaiono come 500. È noto e voluto: cambiare
classe di errcode romperebbe i binari già in circolazione che riconoscono
`P0003` per le sezioni.

## Sincronizzazione con RevenueCat

`supabase/functions/revenuecat-sync/index.ts` è l'unica cosa che scrive
`profiles.plan`. Due ingressi:

1. **L'app**, con il JWT dell'utente (`supabase.functions.invoke`): l'app user
   id è `auth.uid()`.
2. **Il webhook RevenueCat**, con l'header `Authorization` concordato nel
   cruscotto: l'app user id è `event.app_user_id`.

In entrambi i casi il piano **non** viene dal corpo della richiesta: si rilegge
da `GET https://api.revenuecat.com/v1/subscribers/{app_user_id}` con la chiave
segreta `sk_`. Il client non è una fonte attendibile per un permesso, e il
payload di un webhook nemmeno.

`verify_jwt = false` per quella funzione (`supabase/config.toml`) perché il
webhook non ha un JWT; la verifica del token utente la fa la funzione con
`auth.getUser(token)`.

**Concessioni di cortesia.** La funzione rilegge la riga prima di scriverla e
NON declassa a `free` un profilo la cui firma è quella di una concessione
manuale: `plan <> 'free'`, `plan_until is null`, `rc_app_user_id is null`. È il
caso dei due tester, portati a `pro` dal seed della migrazione: RevenueCat
non ha alcun entitlement per loro e risponderebbe "free", quindi senza questa
guardia la cortesia durerebbe fino alla prima apertura dell'app. Un abbonamento
vero ha sempre una scadenza o un `rc_app_user_id` — lo scrive questa stessa
funzione al primo passaggio — quindi scadenze, rimborsi e disdette passano come
prima, e un upgrade a plus/pro si scrive comunque. Per **togliere** una
cortesia serve una mano umana:
`update public.profiles set plan = 'free' where email = '…';`

Secrets (mai nel repo):

```bash
npx supabase secrets set \
  REVENUECAT_SECRET_KEY=sk_xxx \
  REVENUECAT_WEBHOOK_SECRET=<valore identico a quello nel cruscotto RevenueCat> \
  --project-ref taekvxxljtgzsjrlmumo
npx supabase functions deploy revenuecat-sync --project-ref taekvxxljtgzsjrlmumo
```

`SUPABASE_SERVICE_ROLE_KEY` la inietta la piattaforma: il `service_role` non
entra mai nel repo (AGENTS.md).

## Il client

- `lib/plan.ts` — puro: tabella dei limiti, piano efficace, `canAdd*`,
  `canUsePhotos` (consumato dalle foto), mappa errcode. Coperto da vitest, che
  vincola anche il **gemello Deno** delle tre funzioni RevenueCat dentro la
  Edge Function: se cambia una, deve cambiare l'altra.
- `lib/purchases.ts` — l'SDK dietro `purchasesAvailable`, falso in Expo Go, in
  modalità demo e con le chiavi vuote. Nessuna riga tocca l'SDK in quei casi.
- `lib/use-plan.ts` — `usePlan()` per le schermate; `startPlanSync()` lega
  l'identità RevenueCat all'utente Supabase (`Purchases.logIn(user.id)`),
  ascolta i cambi di abbonamento e chiama la edge function. Il primo `apply`
  aspetta l'**idratazione** dello store: prima di quella `user` è ancora il
  null iniziale, e un `logOut()` su quel null creerebbe un cliente anonimo
  nuovo a ogni avvio.
- `app/paywall.tsx` — stack ROOT (come `/add` e `/trash`, perché tre dei
  punti di ingresso sono schermate root e una rotta di `(app)` spinta da lì
  monterebbe un secondo navigatore a tab), tre schede, "Ripristina acquisti",
  piede legale con Termini e Privacy (Apple 3.1.2).
- `components/PlanLimitDialog.tsx` — la mascotte che spiega il limite e porta
  al paywall. Montata in Add, Conoscenza, `/choose-topic`, `/folder/[id]`,
  Impostazioni cartella e Cestino (dove usa `context="restore"`).
- Impostazioni → Abbonamento: piano attuale, "Passa a Plus", "Ripristina
  acquisti".

## Prerequisiti lato proprietario (Maurizio)

Nulla di tutto questo si fa da questo repo.

**Apple**: Paid Apps Agreement, W-8BEN, IBAN, gruppo di abbonamenti con i due
prodotti mensili (`memika_plus_monthly`, `memika_pro_monthly`), In-App
Purchase Key per RevenueCat, tester sandbox.

**Google Play**: profilo pagamenti, i due abbonamenti con il solo piano base
mensile, service account con permesso sui dati finanziari collegato a
RevenueCat, license tester.

**RevenueCat**: progetto "Memika", un'app per piattaforma
(`studio.tailor.memika`), entitlement `plus` e `pro`, offerta `default`
con i due pacchetti mensili, chiavi pubbliche in `eas.json`, chiave segreta e
header del webhook nei secrets Supabase, URL del webhook =
`https://taekvxxljtgzsjrlmumo.supabase.co/functions/v1/revenuecat-sync`.

## Ordine di attivazione

La sequenza completa e autorevole è in `docs/DEPLOY.md` § "Build 3 (vc13 /
iOS 3)". Per la parte piani, in breve:

1. Build 3 `FINISHED` su EAS (contiene `react-native-purchases`), **prima del
   submit**.
2. `npx supabase db push` dal worktree linkato `memika-app`, poi
   `supabase secrets set` + `functions deploy revenuecat-sync`. Solo dopo,
   `eas submit` / upload Play: le colonne devono esistere prima che un tester
   installi vc13, perché il client legge `profiles.plan` e la edge function la
   scrive.
   **Con le chiavi RevenueCat vuote questo passo non si fa così:** i trigger si
   accenderebbero per tutti mentre il paywall ha i bottoni spenti, e un tester
   non seed resterebbe Free e tappato senza rimedio dal client. Il bivio con i
   due rami ammessi — tenere indietro `20260903100000_plans.sql`, oppure
   spingere e concedere subito la cortesia pro agli account esistenti — è
   il punto 4 di `docs/DEPLOY.md` § "Prima di lanciare".
3. I due tester passano a `plan = 'pro'` **dentro la migrazione stessa**,
   sopra i `create trigger` — non con una query prima del push, che
   fallirebbe con `42703` perché la colonna non esiste ancora, né dopo, che
   lascerebbe una finestra in cui chi ha già più di 10 ricordi si trova
   bloccato su un binario senza paywall. Verifica dopo il push:
   `select email, plan from public.profiles where plan <> 'free';`
4. Prima del deploy della funzione, controllo **bloccante**:
   `grep -n "courtesyGrant" supabase/functions/revenuecat-sync/index.ts` deve
   trovare la guardia, **sopra** la riga `.update({ plan,`. Senza, il seed del
   punto 3 dura un solo avvio dell'app.
5. `eas submit -p ios` + upload manuale dell'AAB in Play Console.
6. Acquisto sandbox su entrambe le piattaforme, con verifica che
   `profiles.plan` cambi entro pochi secondi.

## Contesto fiscale (Italia)

Maurizio opera come ditta individuale in regime forfettario. Apple e Google
sono merchant of record: incassano l'IVA, trattengono la commissione e pagano
il netto. La quota del 40 % ad Angelo si calcola sul **netto incassato dallo
store**, non sul lordo: da confermare con Maurizio prima del primo pagamento,
perché il vecchio piano Wix la calcolava sul lordo. Sopra gli 85k€ annui il
regime forfettario decade e gli account store (Individual / Personal) vanno
migrati a un'organizzazione — procedura di store, non modifica di codice.
