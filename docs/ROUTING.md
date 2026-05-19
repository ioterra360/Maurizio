# Routing

> Expo Router 6 with typed routes. File-based, three groups, auth-gated.

## File map

```
app/
├── _layout.tsx                  ROOT — fonts, splash, auth hydrate, Stack screenOptions
├── index.tsx                    Smart redirect (login / today / admin)
│
├── (auth)/
│   ├── _layout.tsx              Redirects out if user already signed in
│   └── login.tsx                The sole unauthenticated screen for now
│
├── (app)/
│   ├── _layout.tsx              Tabs nav. Redirects to login if no user; to admin if admin.
│   ├── today.tsx                Phase 1 stub
│   ├── knowledge.tsx            Phase 1 stub
│   ├── health.tsx               Phase 1 stub
│   └── settings.tsx             Phase 1 stub with working sign-out
│
└── (admin)/
    ├── _layout.tsx              Redirects to user shell if not admin
    └── home.tsx                 Phase 1 stub (full panel lands in Phase 4)
```

## Route table

| Path | File | Who can reach it |
|---|---|---|
| `/` | `app/index.tsx` | Anyone — redirects immediately based on auth |
| `/(auth)/login` | `app/(auth)/login.tsx` | Only when signed out |
| `/(app)/today` | `app/(app)/today.tsx` | Signed-in users |
| `/(app)/knowledge` | `app/(app)/knowledge.tsx` | Signed-in users |
| `/(app)/health` | `app/(app)/health.tsx` | Signed-in users |
| `/(app)/settings` | `app/(app)/settings.tsx` | Signed-in users |
| `/(admin)/home` | `app/(admin)/home.tsx` | Signed-in admins |

## Why three route groups

Groups (parentheses in the folder name) don't add a URL segment but DO add a
`_layout.tsx` boundary. Each layout gates auth at that boundary, so:

- A signed-out user hitting `/(app)/health` sees the redirect from
  `(app)/_layout.tsx` → `/(auth)/login`. They never render the protected tree.
- A regular user hitting `/(admin)/home` gets bounced to `/(app)/today`.
- A signed-in admin user hitting `/(auth)/login` gets bounced to
  `/(admin)/home`.

The redirects compose at the layout boundary instead of being scattered across
every screen. Don't replicate them in individual screen files.

## Typed routes

`app.json` has `experiments.typedRoutes: true`. That means every `router.push`
/ `router.replace` / `<Link href=...>` gets autocomplete and type-checking
against the actual file tree. You should not need to ever string-build a path.

If you see a typed-route error, the underlying cause is almost always:
1. A typo in a file name (group folder names included).
2. A new screen you forgot to save in the editor.
3. The dev-server cache. Restart Metro.

## Deep links

The Expo `scheme` is `memora` (in `app.json`). Once we have a real domain, we
add universal links / app links in Phase 4. For now, only `memora://` works,
and the only deep link we care about is:

- `memora://(app)/today` — entry after Wix Payments webhook confirms a
  subscription. (Phase 4 wires this.)

## Adding a new screen

1. Decide which group it belongs to. If it should be guarded by auth, it goes
   in `(app)` or `(admin)`.
2. Create the file: `app/(app)/folder.tsx`.
3. Add a `Tabs.Screen name="folder"` entry to `app/(app)/_layout.tsx` only if
   it's a top-level tab. Otherwise it's accessed via push/Link from another
   screen.
4. For typed-route autocomplete: save the file and let Metro re-emit.
5. Update this doc's route table.

## Adding a tab

The tab bar config lives in `app/(app)/_layout.tsx` as `<Tabs.Screen>` entries.
Order in the file = order on screen. Each entry needs:
- `name`: matches the route file's base name
- `title`: label under the icon
- `tabBarIcon`: Lucide icon, stroke 1.75, color from `({ color })`

The custom tab bar styling (height, background, border) is shared via
`screenOptions={{ tabBarStyle: ... }}` on the `<Tabs>` root.

## Modals / sheets

Phase 2 adds: Add to memory (full-screen modal), Delete account confirmation
(bottom sheet). Both will use Expo Router's `presentation: "modal"` /
`presentation: "transparentModal"` for the route, NOT a separate stack.

Pattern:

```tsx
<Stack.Screen
  name="add"
  options={{ presentation: "modal", headerShown: false }}
/>
```

## What we deliberately don't have

- **No `(public)` group** with a marketing landing inside the app. Marketing
  lives on Wix.
- **No nested tab navigators.** Memora is shallow — one tab bar, push from
  there. If you find yourself needing a sub-tab bar, refactor the screen instead.
- **No drawer.** The mockup uses a side panel for the screen-share demo only.
  Production app uses tabs + push.
