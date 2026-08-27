/**
 * Maps Supabase Auth errors to clean, user-facing messages (localised via
 * lib/i18n — resolved at call time so the Settings language switch applies).
 *
 * Pattern borrowed from the TLC mobile project (authErrors.js). Keeps the
 * raw Supabase error strings out of the UI.
 *
 * IMPORTANT: never surface the raw Supabase message to a user — the strings
 * change between SDK versions, are English-only, and sometimes leak details
 * we don't want shown (e.g. "user already exists"). The matchers below run
 * against the RAW English SDK strings; only the returned copy is translated.
 */
import { t } from "@/lib/i18n";

export function authErrorMessage(err: unknown): string {
  if (!err) return t("authErrors.somethingWentWrong");

  const raw =
    typeof err === "string"
      ? err
      : err instanceof Error
        ? err.message
        : "";

  const msg = raw.toLowerCase();

  if (msg.includes("invalid login credentials") || msg.includes("invalid grant")) {
    return t("authErrors.invalidCredentials");
  }
  if (msg.includes("email not confirmed")) {
    return t("authErrors.emailNotConfirmed");
  }
  if (msg.includes("rate limit") || msg.includes("too many requests")) {
    return t("authErrors.tooManyAttempts");
  }
  if (msg.includes("network") || msg.includes("fetch")) {
    return t("authErrors.noConnection");
  }
  if (msg.includes("password should be at least") || msg.includes("password too short")) {
    return t("authErrors.passwordTooShort");
  }
  if (msg.includes("same_password") || msg.includes("different from the old password")) {
    return t("authErrors.samePassword");
  }
  if (msg.includes("weak_password") || msg.includes("password is known to be weak")) {
    return t("authErrors.weakPassword");
  }
  if (msg.includes("auth session missing") || msg.includes("session_not_found")) {
    return t("authErrors.sessionMissing");
  }
  if (msg.includes("user already registered") || msg.includes("already exists")) {
    return t("authErrors.alreadyRegistered");
  }
  if (msg.includes("token") && (msg.includes("expired") || msg.includes("invalid"))) {
    return t("authErrors.sessionExpired");
  }
  // English sentinel thrown by lib/auth-store.ts in demo mode — keep the
  // matcher in sync with that throw site if you ever change it.
  if (msg.includes("only the two demo accounts")) {
    return t("authErrors.demoAccountsOnly");
  }

  // Default — keep it vague rather than leaking a raw SDK string.
  return t("authErrors.signInFailed");
}
