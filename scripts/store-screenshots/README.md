# Store screenshots (Google Play / App Store)

Real app UI, rendered by Expo **web** in demo mode, captured with Playwright, then
framed as 1080×1920 (9:16) boards with an Italian headline. Output:
`docs/store-assets/screenshots/phone/01..08-*.png` — upload as "Screenshot per cellulari".

## Recipe

```bash
# from memika-app/ — web deps are NOT in package.json on purpose (see gotcha below)
npm install --no-save --legacy-peer-deps react-native-web@~0.21.0 react-dom@19.1.0 @expo/metro-runtime@~6.1.2 playwright-core
EXPO_PUBLIC_DEMO_MODE=true CI=1 BROWSER=none npx expo start --web --port 8091   # demo data, no real Supabase
node scripts/store-screenshots/capture.cjs            # -> scripts/store-screenshots/raw/*.png (needs Chrome installed)
python scripts/store-screenshots/compose.py           # -> docs/store-assets/screenshots/phone/*.png (Pillow + Inter TTFs from node_modules)
npm prune --legacy-peer-deps                          # REMOVE the web deps again — mandatory before any `eas build`
```

Headlines/kickers/accents live in `specs.json` (one entry per board, `dark: true` = navy opener).
The captures use a fixed clock (09:41, 27 Aug 2026) so the greeting reads "Buongiorno" and the date
badge is stable; review screens are captured on a 412×680 viewport so the bottom-pinned action
buttons fit inside the visible part of the frame. Play accepts only 16:9 / 9:16, so raw phone
screenshots (20:9) are never uploaded as-is.

## Gotcha — `react-native-web` breaks the EAS fingerprint

With `react-native-web` present in `node_modules`, `expo config` reports `platforms: ["ios","android","web"]`.
That value is part of the `expoConfig` fingerprint source, so the runtime version computed by
`eas build` on the local machine differs from the one EAS computes (build fails in the
*Configure expo-updates* phase with "Runtime version mismatch"). `npm prune` restores the lockfile
state; verify with `npx expo-updates fingerprint:generate --platform android` before building.
Build d8525c8c (2026-08-27) died exactly this way.

## Web-only rendering quirks (do not "fix" in app code)

- `adjustsFontSizeToFit` is a no-op on react-native-web → very long terms truncate on web only.
  Demo decks use short first cards for this reason.
- `SafeAreaView` has no top inset on web → `compose.py` draws an Android-style status strip
  (time + glyphs) above the capture to restore the inset.

Other languages: `SHOT_LOCALE=en|fr|es node scripts/store-screenshots/capture.cjs` writes raw-<lang>/; compose with `specs.<lang>.json` into `docs/store-assets/screenshots/phone-<lang>/`. Button labels are looked up in the catalogs, nothing to edit.
