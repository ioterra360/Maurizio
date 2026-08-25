/**
 * Pure decision table for Supabase `onAuthStateChange` events.
 *
 * Extracted from lib/auth-store.ts so the one subtle rule is unit-tested:
 * an `INITIAL_SESSION` with `session = null` — which auth-js emits for EVERY
 * new subscription when nothing is persisted — must NOT wipe a queued
 * password-recovery link. On a cold start from the recovery email the
 * subscription and the initial-URL handling start in the same commit and
 * race on storage; if INITIAL_SESSION lands after `receiveAuthLink` the
 * link would be gone before the reset screen mounts. Only an explicit
 * SIGNED_OUT ends a recovery.
 */

/** The auth-js event names the store reacts to (others fall through as no-ops). */
export type AuthChangeEventName =
  | "INITIAL_SESSION"
  | "SIGNED_IN"
  | "SIGNED_OUT"
  | "TOKEN_REFRESHED"
  | "USER_UPDATED"
  | "PASSWORD_RECOVERY"
  | "MFA_CHALLENGE_VERIFIED";

export type AuthEventDecision = {
  /** Set `user: null` (and bump the stale-completion epoch). */
  clearUser: boolean;
  /** Also drop `pendingPasswordReset` + the queued `authLink`. */
  clearRecovery: boolean;
  /** Raise `pendingPasswordReset` (PKCE / OTP recovery). */
  markRecovery: boolean;
  /** Re-read the profile for the session in the event (deferred, off-lock). */
  refreshProfile: boolean;
};

const NOOP: AuthEventDecision = {
  clearUser: false,
  clearRecovery: false,
  markRecovery: false,
  refreshProfile: false,
};

export function decideAuthEvent(
  event: AuthChangeEventName | (string & {}),
  hasSession: boolean,
): AuthEventDecision {
  if (event === "SIGNED_OUT") {
    // Token revoked, password reset elsewhere, manual sign-out on another
    // device: everything local is stale, including a half-done recovery.
    return { ...NOOP, clearUser: true, clearRecovery: true };
  }
  if (event === "INITIAL_SESSION") {
    // hydrate() already resolved the persisted session (or its absence);
    // acting on this event only adds a race with the deep-link handling.
    return NOOP;
  }
  if (!hasSession) {
    // Defensive: any other event without a session means "nobody is signed
    // in", but it says nothing about a recovery link still waiting to be
    // applied — keep it.
    return { ...NOOP, clearUser: true };
  }
  if (event === "PASSWORD_RECOVERY") {
    return { ...NOOP, markRecovery: true, refreshProfile: true };
  }
  if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
    return { ...NOOP, refreshProfile: true };
  }
  return NOOP;
}
