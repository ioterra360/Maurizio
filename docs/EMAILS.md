# Email agli utenti

> Bozze scritte da Maurizio, versione del 2026-09-04
> (`materiale_maurizio/email_2026-09-04/`, PDF + testo estratto).
> Questo documento non ripete la copy: dice **quali di quelle email l'app sa
> mandare oggi, cosa serve per le altre, e cosa va deciso prima di scriverle.**

Le undici bozze usano già la scala **Free / Plus / Pro** fissata il 2026-09-04,
quindi non c'è niente da rinominare. Il tono è quello del prodotto — "tu pensa
a cosa ricordare, al resto pensiamo noi" — e regge in tutte e undici.

## Cosa possiamo mandare oggi

Il mittente attuale è quello integrato di Supabase
(`noreply@mail.app.supabase.io`), con un tetto di **due email all'ora per
l'intero progetto** (`rate_limit_email_sent = 2`, verificato sul progetto
2026-09-04). Non è un mittente da produzione: con dodici tester bastano tre
"password dimenticata" nella stessa ora perché il terzo non riceva niente.

| # | Email | Cosa la fa partire | Oggi |
|---|---|---|---|
| 1 | Benvenuto | registrazione | **manca il gancio** — Supabase non manda niente al signup |
| 2 | Recupero password | `resetPasswordForEmail` | **funziona** (`supabase/templates/recovery.html`) |
| 3 | Benvenuto in Plus | webhook RevenueCat | **manca**: la edge function riceve i webhook ma non manda email |
| 4 | Benvenuto in Pro | webhook RevenueCat | **manca**, come sopra |
| 5 | Verifica email | registrazione | **spenta di proposito** (`mailer_autoconfirm: true`) — vedi sotto |
| 6 | Password modificata | cambio password | **manca**: Supabase non ha un template per questo evento |
| 7 | Email modificata | cambio indirizzo | **funziona** (`supabase/templates/email_change.html`) |
| 8 | Pagamento non riuscito | webhook RevenueCat | **manca** |
| 9 | Piano cancellato | webhook RevenueCat | **manca** |
| 10 | Account eliminato | cancellazione | **manca** |
| 11 | Inattivo da 7 giorni | job schedulato | **manca**: serve pg_cron + una funzione |

**Due su undici partono davvero adesso.** Le altre nove non sono un problema di
copy: sono infrastruttura che non esiste.

## Quattro cose da sistemare nella copy, prima di scriverle in HTML

**`{{goal}}` non ha una fonte.** Le email di benvenuto a Plus e Pro dicono "Hai
scelto Memika per {{goal}}", ma quel dato **non esiste**: non c'è nessuna
colonna, nessuna domanda in onboarding, niente. O si toglie la frase, o si
chiede all'utente qualcosa in più — e chiedere costa un passaggio in più in un
onboarding che oggi è volutamente corto. La cosa più vicina che il database
sa già è la **cartella** che l'utente sceglie in `/choose-topic` (Spagnolo,
Medicina, Diritto…): "Hai scelto Memika per lo spagnolo" si può fare senza
chiedere niente a nessuno.

**`{{user}}` può essere vuoto.** Il nome è facoltativo alla registrazione
(scelta di minimizzazione dei dati): chi non lo mette ha un nome derivato
dall'email. Il template deve usare quel fallback, altrimenti l'email si apre
con "Ciao ,".

**Il link di recupero password funziona solo sul telefono.** Non è un dettaglio
teorico: è successo oggi. Il link porta a `memika://reset-password`, che il
browser di un computer non sa aprire — e il codice viene comunque consumato,
quindi il tentativo successivo fallisce. L'email **deve dirlo**, con una riga
tipo "apri questa email dal telefono dove hai installato Memika". Vale anche
per la verifica email (#5) se un giorno la accendiamo.

**La #11 non è un'email transazionale.** "Sei inattivo da sette giorni" è una
comunicazione di riattivazione, cioè marketing: serve una base giuridica
(l'informativa la mette sotto **consenso**), un modo per disiscriversi dentro
l'email, e l'identità del titolare nel piede. La buona notizia è che il
consenso esiste già a metà: `profiles.weekly_digest` è un interruttore che
l'utente può accendere in Impostazioni, e oggi **nessuno lo legge**. Se la #11
parte solo per chi ha quell'interruttore acceso, la base giuridica è a posto e
il toggle smette di essere un comando che non fa niente.

## Due decisioni

**La verifica email (#5) resta spenta fino a dopo la revisione degli store.**
`mailer_autoconfirm` è `true` per una ragione precisa: senza un mittente vero,
un revisore che si registra non riceverebbe mai il link e ci boccerebbe. Si
accende **dopo** aver messo Resend, non prima.

**Serve un mittente vero prima di tutto il resto.** Due email all'ora non
reggono nemmeno il test chiuso. Resend su un dominio di Memika risolve insieme
il tetto, la deliverabilità (oggi il mittente è un dominio di Supabase, che
finisce in spam) e il nome che l'utente vede come mittente. È il prerequisito
delle nove email che mancano, non un miglioramento.

## L'ordine che ha senso

1. **Resend + dominio + SPF/DKIM/DMARC**, e i due template esistenti che ci
   passano attraverso. Da qui in poi il tetto di due all'ora non c'è più.
2. **La copy di Maurizio nei due template che già partono** (#2 recupero, #7
   cambio email), con la riga sul telefono e il fallback del nome.
3. **Le email legate agli acquisti** (#3, #4, #8, #9): la edge function
   `revenuecat-sync` riceve già i webhook e conosce l'utente — è il posto
   naturale dove aggiungerle. Servono solo quando gli acquisti sono vivi.
4. **Le email di ciclo di vita** (#1 benvenuto, #6 password cambiata, #10
   account eliminato): ognuna vuole un gancio che oggi non c'è.
5. **La #11**, per ultima, e solo dietro `weekly_digest`.

I passi 3, 4 e 5 non hanno fretta: nessuno di essi blocca la build 3 né il test
chiuso.
