/**
 * Maps Supabase Auth errors to clean, user-facing messages (Italian — the
 * whole user surface is Italian per the i18n sweep).
 *
 * Pattern borrowed from the TLC mobile project (authErrors.js). Keeps the
 * raw Supabase error strings out of the UI.
 *
 * IMPORTANT: never surface the raw Supabase message to a user — the strings
 * change between SDK versions, are English-only, and sometimes leak details
 * we don't want shown (e.g. "user already exists"). The matchers below run
 * against the RAW English SDK strings; only the returned copy is Italian.
 */
export function authErrorMessage(err: unknown): string {
  if (!err) return "Qualcosa è andato storto. Riprova.";

  const raw =
    typeof err === "string"
      ? err
      : err instanceof Error
        ? err.message
        : "";

  const msg = raw.toLowerCase();

  if (msg.includes("invalid login credentials") || msg.includes("invalid grant")) {
    return "Email o password non corretti.";
  }
  if (msg.includes("email not confirmed")) {
    return "Conferma la tua email prima di accedere. Controlla la posta in arrivo.";
  }
  if (msg.includes("rate limit") || msg.includes("too many requests")) {
    return "Troppi tentativi. Aspetta un minuto e riprova.";
  }
  if (msg.includes("network") || msg.includes("fetch")) {
    return "Nessuna connessione. Controlla la rete e riprova.";
  }
  if (msg.includes("password should be at least") || msg.includes("password too short")) {
    return "La password è troppo corta.";
  }
  if (msg.includes("user already registered") || msg.includes("already exists")) {
    return "Esiste già un account con questa email. Prova ad accedere.";
  }
  if (msg.includes("token") && (msg.includes("expired") || msg.includes("invalid"))) {
    return "La sessione è scaduta. Accedi di nuovo.";
  }
  // English sentinel thrown by lib/auth-store.ts in demo mode — keep the
  // matcher in sync with that throw site if you ever change it.
  if (msg.includes("only the two demo accounts")) {
    return "La demo accetta solo i due account di prova.";
  }

  // Default — keep it vague rather than leaking a raw SDK string.
  return "Accesso non riuscito. Riprova.";
}
