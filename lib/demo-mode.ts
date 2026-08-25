/**
 * Decides whether the app runs against the offline demo backend (seed
 * accounts, mock data) or real Supabase auth.
 *
 * Pure so it can be unit-tested; `lib/supabase.ts` feeds it the real inputs.
 *
 * Rules, in priority order:
 *  1. Release builds NEVER run in demo mode. Missing credentials in a release
 *     build is a build-configuration bug (`eas.json` → `build.<profile>.env`),
 *     not a reason to silently ship the seed accounts — the caller must fail
 *     fast instead.
 *  2. In dev, `EXPO_PUBLIC_DEMO_MODE=true` bypasses real auth even when
 *     credentials are present.
 *  3. In dev, missing credentials fall back to demo so `npm start` works
 *     without a `.env`.
 */
export interface DemoModeInput {
  hasCreds: boolean;
  forceFlag: boolean;
  isDev: boolean;
}

export type DemoModeDecision =
  | { demo: true; reason: "forced" | "no-creds" }
  | { demo: false; reason: "real" | "release-missing-creds" };

export function resolveDemoMode({ hasCreds, forceFlag, isDev }: DemoModeInput): DemoModeDecision {
  if (!isDev) {
    return hasCreds
      ? { demo: false, reason: "real" }
      : { demo: false, reason: "release-missing-creds" };
  }
  if (forceFlag) return { demo: true, reason: "forced" };
  if (!hasCreds) return { demo: true, reason: "no-creds" };
  return { demo: false, reason: "real" };
}
