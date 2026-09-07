# Screenshot del tutorial (app/tutorial.tsx)

Le sei schermate vere dell'app che il tutorial di benvenuto mostra dentro una
cornice di telefono, per ognuna delle quattro lingue e per tema chiaro e scuro:
48 WebP da 720 px in `assets/tutorial/` (~1,5 MB in tutto, viaggiano con l'OTA).
Stessa pipeline degli screenshot per gli store (`scripts/store-screenshots/README.md`:
leggilo per i pacchetti web e per la trappola del fingerprint).

## Ricetta (da `memika-app/`)

```bash
npm install --no-save --legacy-peer-deps react-native-web@~0.21.0 react-dom@19.1.0 @expo/metro-runtime@~6.1.2 playwright-core
EXPO_PUBLIC_DEMO_MODE=true CI=1 BROWSER=none npx expo start --web --port 8092
node scripts/tutorial-shots/capture.cjs          # -> raw/<lingua>-<tema>/*.png (serve Chrome)
python scripts/tutorial-shots/convert.py         # -> assets/tutorial/<schermata>-<lingua>-<tema>.webp
npm prune --legacy-peer-deps                     # OBBLIGATORIO prima di qualunque eas build / fingerprint
```

`SHOT_ONLY=it-light node scripts/tutorial-shots/capture.cjs` cattura un solo insieme.
Le schermate e i tocchi sono in `capture.cjs` (`SHOTS`); la lista dei file attesi e
la mappa delle `require` sono controllate da `lib/tutorial-shots.test.ts`. Se aggiungi
una schermata: `SHOTS` qui, `TUTORIAL_SHOTS` in `lib/tutorial-shots.ts`, rigenera la
mappa in `lib/tutorial-shot-sources.ts` (48 righe di `require`, una per file).

I dati sono quelli della demo (`lib/api.ts`, rami `isDemoMode`): la Home ha dieci
ricordi in coda ripartiti sulle quattro cartelle seme e qualche scadenza nei giorni
successivi, l'orologio e' fisso alle 09:41 dell'8 settembre 2026 (saluto del mattino).
