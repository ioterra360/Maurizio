/**
 * Single-shot flag that prevents Expo Router state-restoration from re-opening
 * the Add modal after an Expo Go "Reload" (shake → Reload).
 *
 * The bug it fixes:
 *   1. User opens the Add modal from Knowledge FAB or a Folder detail.
 *   2. User shakes the device and taps Reload (or saves a file in dev).
 *   3. Expo Go restores the last URL (`exp://.../--/add`) and Expo Router
 *      re-pushes the modal — user lands on Add without any tap.
 *
 * Mechanism:
 *   Callers about to navigate to `/add` flip `intentional = true` (sync,
 *   immediately before `router.push`). The Add screen reads & resets the
 *   flag on mount; if it was still `false`, we know the mount came from
 *   cold-start state restoration, not a user tap, and we bounce away.
 *
 * Module-scope state is intentional: it is wiped on every bundle reload,
 * which is exactly the lifetime we want.
 */

let intentional = false;

/** Call synchronously BEFORE `router.push("/add")`. */
export function markAddOpenedIntentionally(): void {
  intentional = true;
}

/** Call once on Add mount. Returns true if a user actually pushed; false on cold-start restore. */
export function consumeIntentionalAddOpen(): boolean {
  const was = intentional;
  intentional = false;
  return was;
}
