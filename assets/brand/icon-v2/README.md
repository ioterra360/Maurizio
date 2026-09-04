# Icona v2 — "il cervello è il quadrato" (approvata da Angelo 2026-08-31)

Generata in vettoriale (sorgente: scratchpad iconwork/brain-icon.mjs della
sessione del 2026-08-31; SVG ricostruibile). NON referenziata da app.json di
proposito: gli asset icona sono input del fingerprint e cambiarli ora
staccherebbe gli OTA dai runtime delle build in circolazione
(docs/TROUBLESHOOTING.md, sezione OTA e runtime).

Al momento della PROSSIMA BUILD NATIVA (build 3 / vc13):
1. copiare `icon.png` su `assets/icon.png`
2. copiare `adaptive-icon.png` su `assets/adaptive-icon.png`
3. in app.json: `android.adaptiveIcon.backgroundColor` da `#142450` a `#F8D2C4`
4. caricare `play-icon-512.png` come icona della scheda in Play Console

**Passi 1-3 eseguiti il 2026-09-03** (piano
`docs/superpowers/plans/2026-09-03-build3-config-nativa.md`, Task 2); le
copie per gli store sono in `docs/store-assets/`. Il passo 4 resta manuale
in Play Console al momento dell'upload di vc13.

## `adaptive-icon.png` non è `icon.png` (2026-09-04)

Su iOS l'icona è a tutto campo e nessuno la maschera: `icon.png` va bene così.
Su Android no. Il foreground di un adaptive icon è 108 dp ma il sistema ne mostra
solo i **72 dp centrali** (il 66,7 %, su 1024 px = da 171 a 853), e dentro quel
quadrato ogni produttore applica la sua maschera: cerchio sui Pixel, squircle
altrove. Tutto ciò che esce dal quadrato è tagliato su **ogni** launcher.

La prima versione insettava l'arte all'80 % (contenuto da 102 a 920): il 10,4 %
del contorno navy usciva dal quadrato e il 48 % del verde della cartella cadeva
fuori dalla maschera circolare — la cartella, cioè la seconda metà dell'idea
"cervello + cartella", veniva amputata sul bordo e il suo bordo verde spariva.

Ora l'arte sta esattamente in 171…852, su un campo pieno `#F8D2C4`. Non si vede
nessuna cucitura perché quel colore è la base del cervello stesso: la differenza
è solo che gyri, occhiali e cartella smettono un po' prima del bordo.

Per rigenerarla dopo qualunque modifica a `icon.png`:

```bash
node assets/brand/icon-v2/adaptive-inset.source.cjs
```

(nessuna dipendenza: decoder/encoder PNG a mano, gira col solo Node). Il
risultato è verificato da `lib/native-config.test.ts` — "il foreground adattivo
sta tutto nella zona sicura" e "l'icona iOS resta a tutto campo". **Non**
ricopiare `icon.png` su `adaptive-icon.png`: sono la stessa arte con due
inquadrature diverse, e sono input del fingerprint (sbagliarle dopo vc13 costa
una build in più).

`appstore-icon-1024.png` è `icon.png` **appiattita a RGB** (App Store Connect
rifiuta il canale alpha e quel file si carica a mano, non passa da prebuild).
Per rigenerarla:

```bash
npm install --no-save sharp
node -e "const sharp=require('sharp');sharp('assets/brand/icon-v2/icon.png').flatten({background:'#FFFFFF'}).png({palette:false}).toFile('assets/brand/icon-v2/appstore-icon-1024.png')"
npm prune --legacy-peer-deps
```

## Icona di notifica (2026-09-03)

`notification-icon.source.mjs` → `assets/notification-icon.png` (96×96, bianca
su trasparente: Android usa solo l'alpha). Referenziata in app.json dal plugin
`expo-notifications` con `color` = accent **scuro** `#3B6BF5`: la tinta finisce
in un unico `res/values/colors.xml` (nessuna variante `values-night`), quindi
un solo valore deve leggersi sia sulla tendina chiara sia su quella scura — il
navy `#1A2C4F` su tendina scura è invisibile. Per rigenerarla vedi
l'intestazione dello script (sharp con `--no-save`, poi `npm prune`).
