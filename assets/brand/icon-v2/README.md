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

## Icona di notifica (2026-09-03)

`notification-icon.source.mjs` → `assets/notification-icon.png` (96×96, bianca
su trasparente: Android usa solo l'alpha). Referenziata in app.json dal plugin
`expo-notifications` con `color` = accent **scuro** `#3B6BF5`: la tinta finisce
in un unico `res/values/colors.xml` (nessuna variante `values-night`), quindi
un solo valore deve leggersi sia sulla tendina chiara sia su quella scura — il
navy `#1A2C4F` su tendina scura è invisibile. Per rigenerarla vedi
l'intestazione dello script (sharp con `--no-save`, poi `npm prune`).
