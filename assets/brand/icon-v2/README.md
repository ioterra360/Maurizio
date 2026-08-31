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
