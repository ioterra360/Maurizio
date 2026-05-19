# Troubleshooting

> Things that have gone wrong (or are likely to). Updated as we hit them.

## Metro can't find a file you just created

Restart Metro. The file-based router cache occasionally misses fresh files.

```bash
# Stop the dev server (Ctrl+C), then:
npm start -- --clear
```

If that doesn't fix it, also delete `.expo/` and rerun.

## Metro 500 error: "Cannot find module 'babel-preset-expo'"

Seen on first run with Expo SDK 54. The `babel.config.js` references
`babel-preset-expo` but it isn't included as a direct dependency of the
generated project.

```bash
npx expo install babel-preset-expo
# verify SDK-compatible version (should be ~54.0.10 for SDK 54)
node -e "console.log(require('babel-preset-expo/package.json').version)"
# if it installed a newer major (e.g. 55.x), pin it:
npm install --save-dev babel-preset-expo@~54.0.10 --legacy-peer-deps
```

Then restart with cache cleared:
```bash
npx expo start --port <free-port> --clear
```

## NativeWind classes aren't applying

Three usual causes, in order of likelihood:

1. **Babel preset misconfigured.** Check `babel.config.js` has:
   ```js
   ["babel-preset-expo", { jsxImportSource: "nativewind" }],
   "nativewind/babel"
   ```
   The `jsxImportSource` is what tells Babel to pipe JSX through NativeWind.

2. **Metro not wrapping with `withNativeWind`.** Check `metro.config.js`:
   ```js
   module.exports = withNativeWind(config, { input: "./global.css" });
   ```

3. **`global.css` not imported at the entry.** `app/_layout.tsx` must have
   `import "../global.css";` as its first line. Without it, NativeWind has no
   stylesheet to inject.

## "Module not found: react-native-worklets"

Reanimated 4 requires `react-native-worklets` as a separate peer dep:

```bash
npx expo install react-native-worklets
```

`expo-doctor` will flag this if it's missing.

## `npm install` fails with ERESOLVE

Almost always `lucide-react-native` over-declaring `react-dom` as a peer.

```bash
npm install <pkg> --legacy-peer-deps
```

Codify by aliasing `npm install` if it gets annoying. For now, type the flag.

## Login screen says "Invalid credentials" for demo accounts

`.env` has `EXPO_PUBLIC_DEMO_MODE=true`? If yes and it still fails:

- Restart Metro after changing `.env` (env vars are read at bundle time).
- Confirm the email matches exactly: `angelo.casula@gmail.com` (lowercase) or
  `maurizio.cocco@memora.app` (lowercase). Trim leading/trailing whitespace.

If `.env` says `EXPO_PUBLIC_DEMO_MODE=false`: you're in real-Supabase mode and
those users don't exist in `auth.users` yet. Either:

- Switch back to `true` for visual testing
- Create the users in Supabase Auth dashboard (Authentication → Users → Add user)

## Supabase CLI says "no project linked"

Re-run:

```bash
SUPABASE_ACCESS_TOKEN=sbp_xxx npx supabase link --project-ref taekvxxljtgzsjrlmumo
```

The link is stored in `supabase/.temp/` which is gitignored, so it's local
to each clone. After cloning fresh, you have to re-link.

## `supabase db push` says "permission denied"

Two possible causes:

1. **PAT expired or revoked.** Generate a new one at
   `supabase.com/dashboard/account/tokens` and update `.env`.
2. **You're running an old CLI version.** `npx supabase --version` should be
   `2.100+`. Update with `npm install --save-dev supabase@latest`.

## Expo Go shows an old version after pushing changes

- Shake the device → "Reload" — usually enough.
- Still stale? Stop Metro, `npm start -- --clear`, scan QR again.
- Still stale? Uninstall Expo Go on the device and reinstall. (Rare.)

## TypeScript: `Cannot find module '@/lib/supabase'`

The path alias is configured in `tsconfig.json`. If your editor doesn't pick
it up:

- Restart the TS server in VS Code: Cmd/Ctrl-Shift-P → "TypeScript: Restart TS
  Server"
- Confirm `tsconfig.json` `compilerOptions.paths` contains `"@/*": ["./*"]`
- Confirm `include` array hasn't been narrowed too aggressively

## Reanimated animation runs only the first time

Two known causes for Reanimated 4:

1. **Worklets need a re-render to re-attach.** If you mount and unmount the
   animated component, make sure the `useSharedValue` is re-initialized
   inside, not at module scope.
2. **`reduceMotion` accessibility flag enabled.** On iOS, Settings →
   Accessibility → Motion → Reduce Motion. Reanimated honors it.

## Splash screen never hides

`app/_layout.tsx` calls `SplashScreen.hideAsync()` when `fontsLoaded && hydrated`.
If those never both become true:

- Check the network: fonts come from Google Fonts and need internet on first
  load.
- Check `console.log` in `auth-store.ts` — does `hydrate()` finish?
- As a debug fallback, you can add a timeout to force-hide after 5s, but the
  real fix is to find which await is hanging.

## Git push asks for credentials every time

You haven't cached GitHub creds. Easiest fix on Windows:

```bash
git config --global credential.helper manager
```

Next push will save creds in Windows Credential Manager.

## `gh auth login` opens browser but doesn't return

After auth in the browser, the terminal sometimes needs a manual nudge —
press Enter once in the terminal where you ran `gh auth login`. If that
doesn't work:

```bash
gh auth refresh -s repo,workflow,read:org
```

## Where to log when nothing works

- App console: shake device in Expo Go → "Show Inspector" → console tab
- Metro terminal: native errors print here
- Supabase logs: Dashboard → Logs Explorer → choose "Auth" or "Postgres"
- Sentry (Phase 4): structured app errors

## When to ask for help

If you've spent more than 30 minutes on a single error message:

1. Search the exact error in the Expo SDK 54 docs:
   https://docs.expo.dev/versions/v54.0.0/
2. Search the same in Reanimated 4 docs:
   https://docs.swmansion.com/react-native-reanimated/
3. Then ping in a new conversation with the full error + what you tried.
