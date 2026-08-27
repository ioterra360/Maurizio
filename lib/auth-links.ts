/**
 * Pure helpers for the Supabase auth deep links the app receives
 * (`memika://reset-password#access_token=…`, `memika://auth-callback#…`)
 * plus the DEV-only "sign out on open" query param.
 *
 * Everything here is string parsing — no React, no Supabase, no I/O — so it
 * runs under vitest. The runtime side (setSession, routing, store flags)
 * lives in lib/auth-store.ts and app/_layout.tsx.
 *
 * Why manual parsing instead of `new URL()` / `Linking.parse()`:
 *   - Supabase's implicit flow delivers the tokens in the URL FRAGMENT
 *     (`#access_token=…`), which `Linking.parse` drops entirely.
 *   - The same link arrives in three shapes depending on the build:
 *       memika://reset-password#…                    (release / dev client)
 *       exp://192.168.1.52:8083/--/reset-password#…  (Expo Go)
 *       https://memika.app/reset-password#…          (future universal link)
 *     and WHATWG URL parsing of non-special schemes (`memika://`) puts the
 *     path in `hostname`, so a hand-rolled splitter is both simpler and more
 *     predictable across the RN URL polyfill and Node.
 */
import { t } from "@/lib/i18n";

/** Route paths the app recognizes as auth-link targets. */
export const AUTH_LINK_PATHS = {
  /** Password recovery: `resetPasswordForEmail({ redirectTo })`. */
  resetPassword: "reset-password",
  /** Signup confirmation / magic link / email change: `emailRedirectTo`. */
  authCallback: "auth-callback",
} as const;

export type AuthLinkPath = (typeof AUTH_LINK_PATHS)[keyof typeof AUTH_LINK_PATHS];

/** The `type=` Supabase appends to implicit-flow redirect fragments. */
export type AuthLinkType =
  | "recovery"
  | "signup"
  | "magiclink"
  | "email_change"
  | "invite"
  | "email";

export type AuthLink = {
  /** Normalized route path without leading/trailing slashes, e.g. `reset-password`. */
  path: string;
  /** Supabase `type` param (fragment or query), null when absent. */
  type: AuthLinkType | null;
  accessToken: string | null;
  refreshToken: string | null;
  /** PKCE authorization code (`?code=`) — the shape Supabase sends since the client runs `flowType: "pkce"`. */
  code: string | null;
  /** `error_code` (preferred) or `error` from the fragment, e.g. `otp_expired`. */
  error: string | null;
  errorDescription: string | null;
};

const KNOWN_TYPES: ReadonlySet<string> = new Set<AuthLinkType>([
  "recovery",
  "signup",
  "magiclink",
  "email_change",
  "invite",
  "email",
]);

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

/** `a=1&b=2` → Map. Later keys override earlier ones. Tolerates empty input. */
function parseParams(raw: string, into: Map<string, string>): void {
  if (!raw) return;
  for (const pair of raw.split("&")) {
    if (!pair) continue;
    const eq = pair.indexOf("=");
    const key = safeDecode(eq === -1 ? pair : pair.slice(0, eq));
    const value = eq === -1 ? "" : safeDecode(pair.slice(eq + 1));
    if (key) into.set(key, value);
  }
}

/**
 * Extracts the route path from any of the URL shapes the app can be opened
 * with. Returns `""` for a bare scheme URL (`memika://`).
 */
export function authLinkPath(url: string): string {
  const stripped = url.split("#")[0]?.split("?")[0] ?? "";
  const schemeEnd = stripped.indexOf("://");
  if (schemeEnd === -1) return stripped.replace(/^\/+|\/+$/g, "");
  const scheme = stripped.slice(0, schemeEnd).toLowerCase();
  const rest = stripped.slice(schemeEnd + 3);

  // Expo Go / dev client: everything after `/--/` is the app path.
  const expoSep = rest.indexOf("/--/");
  if (expoSep !== -1) return rest.slice(expoSep + 4).replace(/^\/+|\/+$/g, "");

  // Host-bearing schemes: drop the host (and port) segment.
  if (scheme === "http" || scheme === "https" || scheme === "exp" || scheme === "exps") {
    const slash = rest.indexOf("/");
    return slash === -1 ? "" : rest.slice(slash + 1).replace(/^\/+|\/+$/g, "");
  }

  // Custom scheme (`memika://reset-password`, `exp+memika://reset-password`):
  // the "host" IS the path.
  return rest.replace(/^\/+|\/+$/g, "");
}

/**
 * Parses an incoming URL into its auth-relevant parts. Query params and
 * fragment params are merged (fragment wins — that is where Supabase puts
 * the tokens; the query only ever carries `?code=` or `?error=`).
 */
export function parseAuthLink(url: string): AuthLink {
  const hashIdx = url.indexOf("#");
  const fragment = hashIdx === -1 ? "" : url.slice(hashIdx + 1);
  const beforeHash = hashIdx === -1 ? url : url.slice(0, hashIdx);
  const qIdx = beforeHash.indexOf("?");
  const query = qIdx === -1 ? "" : beforeHash.slice(qIdx + 1);

  const params = new Map<string, string>();
  parseParams(query, params);
  parseParams(fragment, params);

  const rawType = params.get("type") ?? null;
  const type = rawType && KNOWN_TYPES.has(rawType) ? (rawType as AuthLinkType) : null;
  const get = (k: string) => {
    const v = params.get(k);
    return v ? v : null;
  };

  return {
    path: authLinkPath(url),
    type,
    accessToken: get("access_token"),
    refreshToken: get("refresh_token"),
    code: get("code"),
    error: get("error_code") ?? get("error"),
    errorDescription: get("error_description"),
  };
}

/**
 * True when the URL is one of OUR auth-link targets AND carries something
 * actionable (tokens, a PKCE code, or a Supabase error). A plain
 * `memika://reset-password` typed by hand is NOT an auth link — the screen
 * handles that as "open the link from your email".
 */
export function isAuthLink(link: AuthLink): boolean {
  const targeted = link.path === AUTH_LINK_PATHS.resetPassword || link.path === AUTH_LINK_PATHS.authCallback;
  if (!targeted) return false;
  return Boolean((link.accessToken && link.refreshToken) || link.code || link.error);
}

/**
 * Password recovery is identified by `type=recovery` OR by the path — an
 * expired-link error (`#error=access_denied&error_code=otp_expired`) has no
 * `type` at all, but still belongs to the reset screen.
 */
export function isRecoveryLink(link: AuthLink): boolean {
  return link.type === "recovery" || link.path === AUTH_LINK_PATHS.resetPassword;
}

export type AuthLinkAction =
  | { kind: "ignore" }
  | { kind: "error"; code: string; recovery: boolean }
  | { kind: "tokens"; accessToken: string; refreshToken: string; recovery: boolean }
  | { kind: "code"; code: string; recovery: boolean };

/** Decides what the runtime should do with a parsed link. */
export function classifyAuthLink(link: AuthLink): AuthLinkAction {
  if (!isAuthLink(link)) return { kind: "ignore" };
  const recovery = isRecoveryLink(link);
  if (link.error) return { kind: "error", code: link.error, recovery };
  if (link.accessToken && link.refreshToken) {
    return { kind: "tokens", accessToken: link.accessToken, refreshToken: link.refreshToken, recovery };
  }
  if (link.code) return { kind: "code", code: link.code, recovery };
  return { kind: "ignore" };
}

/**
 * User-facing copy (via lib/i18n, resolved at call time) for a Supabase error
 * code carried by the link. Kept vague on purpose — the codes are English
 * internals and sometimes leak details.
 */
export function authLinkErrorMessage(code: string | null | undefined): string {
  const c = (code ?? "").toLowerCase();
  // PKCE: the code_verifier lives on the device that requested the email.
  // Opening the link elsewhere (another phone, a reinstalled app) cannot
  // complete the exchange — say so instead of a generic failure.
  if (c.includes("code verifier") || c.includes("code_verifier")) {
    return t("authLinks.openOnSamePhone");
  }
  if (c.includes("otp_expired") || c.includes("expired")) {
    return t("authLinks.linkExpired");
  }
  if (c.includes("access_denied") || c.includes("invalid")) {
    return t("authLinks.linkInvalid");
  }
  return t("authLinks.linkOpenFailed");
}

/**
 * Non-cryptographic fingerprint (djb2) used to remember which link was
 * already consumed, so Expo Go bundle reloads — which re-deliver the same
 * initial URL — don't replay a used recovery link. We never persist the
 * URL itself: it contains bearer tokens.
 */
export function authLinkFingerprint(url: string): string {
  let hash = 5381;
  for (let i = 0; i < url.length; i += 1) {
    hash = ((hash << 5) + hash + url.charCodeAt(i)) | 0;
  }
  return `${url.length}:${(hash >>> 0).toString(36)}`;
}

/**
 * DEV-ONLY: the QR / bookmark testers open carries `?reset=<token>` (legacy
 * name) or `?dev-signout=<token>`; the app signs out once per distinct
 * token so every tester lands on the login screen. Looks only at the QUERY
 * part, never the fragment, so a Supabase recovery fragment can't trigger
 * it. Returns null when the param is absent.
 */
export function parseDevSignOutToken(url: string): string | null {
  const beforeHash = url.split("#")[0] ?? "";
  const m = beforeHash.match(/[?&](?:reset|dev-signout)=([^&]+)/);
  return m ? safeDecode(m[1] ?? "") : null;
}
