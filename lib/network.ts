/**
 * Network helpers shared by the Supabase client.
 *
 * React Native 0.81 ships the `abort-controller` polyfill (see
 * react-native/Libraries/Core/setUpXHR.js) — it provides AbortController /
 * AbortSignal but NOT the static `AbortSignal.timeout()` helper, and Hermes
 * has no native implementation either. So the timeout is built by hand:
 * AbortController + setTimeout, cleared as soon as the request settles.
 *
 * Pure module (no React Native imports) so it can be unit-tested in vitest.
 */

/** Hard ceiling for any single Supabase request (auth, REST, RPC). */
export const SUPABASE_FETCH_TIMEOUT_MS = 15_000;

/** Thrown when OUR timer fired — never for a caller-supplied signal. */
export class RequestTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    // "Network … timed out" on purpose: the auth-errors / account-deletion
    // matchers key on "network" and "timeout" to show the Italian
    // connection message instead of a generic failure.
    super(`Network request timed out after ${timeoutMs} ms`);
    this.name = "RequestTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export function isRequestTimeoutError(err: unknown): err is RequestTimeoutError {
  return err instanceof RequestTimeoutError;
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * Wrap a fetch implementation so every call without its own `signal` is
 * aborted after `timeoutMs`. Calls that already carry a signal (supabase-js
 * passes one for realtime / manual aborts) are forwarded untouched — the
 * caller owns that signal's lifetime.
 */
export function withRequestTimeout(fetchImpl: FetchLike, timeoutMs: number): FetchLike {
  if (!(timeoutMs > 0) || !Number.isFinite(timeoutMs)) {
    throw new RangeError(`withRequestTimeout: timeoutMs must be a positive number, got ${timeoutMs}`);
  }
  return async (input, init) => {
    if (init?.signal) return fetchImpl(input, init);

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      return await fetchImpl(input, { ...init, signal: controller.signal });
    } catch (err) {
      // Only OUR abort becomes a timeout error; any other rejection
      // (DNS failure, TLS, "Network request failed") passes through so the
      // existing error matchers keep working.
      if (timedOut) throw new RequestTimeoutError(timeoutMs);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  };
}
