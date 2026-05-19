/**
 * Maps Supabase Auth errors to clean, user-facing messages.
 *
 * Pattern borrowed from the TLC mobile project (authErrors.js). Keeps the
 * raw Supabase error strings out of the UI and lets us localize later.
 *
 * IMPORTANT: never surface the raw Supabase message to a user — the strings
 * change between SDK versions, are English-only, and sometimes leak details
 * we don't want shown (e.g. "user already exists").
 */
export function authErrorMessage(err: unknown): string {
  if (!err) return "Something went wrong. Please try again.";

  const raw =
    typeof err === "string"
      ? err
      : err instanceof Error
        ? err.message
        : "";

  const msg = raw.toLowerCase();

  if (msg.includes("invalid login credentials") || msg.includes("invalid grant")) {
    return "Email or password is incorrect.";
  }
  if (msg.includes("email not confirmed")) {
    return "Please confirm your email before signing in. Check your inbox.";
  }
  if (msg.includes("rate limit") || msg.includes("too many requests")) {
    return "Too many attempts. Wait a minute and try again.";
  }
  if (msg.includes("network") || msg.includes("fetch")) {
    return "No internet connection. Check your network and try again.";
  }
  if (msg.includes("password should be at least") || msg.includes("password too short")) {
    return "Password is too short.";
  }
  if (msg.includes("user already registered") || msg.includes("already exists")) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (msg.includes("token") && (msg.includes("expired") || msg.includes("invalid"))) {
    return "Your session has expired. Please sign in again.";
  }
  if (msg.includes("only the two demo accounts")) {
    return "Demo mode accepts only the two seed accounts.";
  }

  // Default — keep it vague rather than leaking a raw SDK string.
  return "Sign-in failed. Please try again.";
}
