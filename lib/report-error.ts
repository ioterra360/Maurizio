/**
 * Single funnel for "something failed but the app keeps running".
 *
 * Every `catch` that used to `if (__DEV__) console.warn(...)` now calls
 * `reportError(tag, err, extra)`:
 *
 *   - development: a console.warn with the same shape as before, so Metro /
 *     the Expo Go inspector still show the failure inline;
 *   - release: `Sentry.captureException` with `tags.where = tag` and the
 *     extras attached. Sentry.init in app/_layout.tsx keeps the client
 *     disabled when EXPO_PUBLIC_SENTRY_DSN is empty, so the call is a
 *     harmless no-op in builds without a DSN.
 *
 * Behaviour of the calling code is unchanged: this function never throws
 * and never awaits.
 */

import * as Sentry from "@sentry/react-native";

/** Supabase-style error shapes (PostgrestError / AuthError / plain objects). */
type ErrorLike = {
  message?: unknown;
  name?: unknown;
  code?: unknown;
  status?: unknown;
  details?: unknown;
  hint?: unknown;
};

function asErrorLike(err: unknown): ErrorLike | null {
  return typeof err === "object" && err !== null ? (err as ErrorLike) : null;
}

/**
 * Human-readable one-liner for any thrown value. Pure — unit-tested.
 *
 *   Error            → "TypeError: Network request failed"
 *   { message, code} → "PGRST301: JWT expired"   (Supabase objects)
 *   string           → the string itself
 *   null / undefined → "Unknown error"
 *   anything else    → String(value)
 */
export function describeError(err: unknown): string {
  if (err instanceof Error) {
    const name = err.name && err.name !== "Error" ? `${err.name}: ` : "";
    return `${name}${err.message || "(no message)"}`;
  }
  if (typeof err === "string") return err.trim() || "Unknown error";
  if (err === null || err === undefined) return "Unknown error";
  const like = asErrorLike(err);
  if (like && typeof like.message === "string") {
    const code =
      typeof like.code === "string" && like.code
        ? like.code
        : typeof like.status === "number"
          ? String(like.status)
          : typeof like.name === "string" && like.name !== "Error"
            ? like.name
            : "";
    return code ? `${code}: ${like.message}` : like.message;
  }
  try {
    const json = JSON.stringify(err);
    if (json && json !== "{}") return json;
  } catch {
    // circular structure — fall through to String()
  }
  return String(err);
}

/**
 * Ensure Sentry receives a real Error (with a stack) — a thrown string or a
 * Supabase error object would otherwise land as "Non-Error exception".
 * Real Error instances are passed through untouched.
 */
export function toError(err: unknown, tag?: string): Error {
  if (err instanceof Error) return err;
  const wrapped = new Error(tag ? `[${tag}] ${describeError(err)}` : describeError(err));
  const like = asErrorLike(err);
  if (like && typeof like.name === "string" && like.name) wrapped.name = like.name;
  return wrapped;
}

/**
 * Machine-readable code for grouping/tagging: `code` on Supabase errors,
 * numeric `status` on HTTP-ish errors, otherwise the Error `name`.
 * Returns null when nothing useful exists.
 */
export function errorCode(err: unknown): string | null {
  const like = asErrorLike(err);
  if (like) {
    if (typeof like.code === "string" && like.code) return like.code;
    if (typeof like.status === "number") return String(like.status);
  }
  if (err instanceof Error && err.name && err.name !== "Error") return err.name;
  return null;
}

/** Sentry `extra` payload: caller extras + Supabase details/hint + raw text for non-Errors. */
export function buildReportExtras(
  err: unknown,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  const like = asErrorLike(err);
  const out: Record<string, unknown> = { ...(extra ?? {}) };
  if (like) {
    if (like.details !== undefined) out.details = like.details;
    if (like.hint !== undefined) out.hint = like.hint;
  }
  if (!(err instanceof Error)) out.rawError = describeError(err);
  return out;
}

const isDev = (): boolean => typeof __DEV__ !== "undefined" && __DEV__;

/**
 * Report a caught, non-fatal error.
 *
 * @param tag   Short stable identifier of the call site, e.g. "review/deck-load".
 *              Becomes the Sentry tag `where` (searchable in Issues).
 * @param err   Whatever was thrown.
 * @param extra Extra context (ids, counts). NEVER put personal data here.
 */
export function reportError(tag: string, err: unknown, extra?: Record<string, unknown>): void {
  if (isDev()) {
    if (extra) console.warn(`[Memika:${tag}]`, describeError(err), extra);
    else console.warn(`[Memika:${tag}]`, describeError(err));
    return;
  }
  try {
    const code = errorCode(err);
    Sentry.captureException(toError(err, tag), {
      tags: code ? { where: tag, code } : { where: tag },
      extra: buildReportExtras(err, extra),
    });
  } catch {
    // Reporting must never take the app down.
  }
}
