import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RequestTimeoutError, isRequestTimeoutError, withRequestTimeout } from "./network";

const okResponse = () => ({ ok: true }) as unknown as Response;

/** A fetch stub that resolves after `delayMs` unless the signal aborts first. */
function slowFetch(delayMs: number) {
  return vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
    return new Promise<Response>((resolve, reject) => {
      const t = setTimeout(() => resolve(okResponse()), delayMs);
      init?.signal?.addEventListener("abort", () => {
        clearTimeout(t);
        const e = new Error("Aborted");
        e.name = "AbortError";
        reject(e);
      });
    });
  });
}

describe("withRequestTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("passes a fast response through untouched", async () => {
    const impl = slowFetch(10);
    const f = withRequestTimeout(impl, 1000);
    const p = f("https://x.test/a");
    await vi.advanceTimersByTimeAsync(20);
    await expect(p).resolves.toEqual(okResponse());
  });

  it("injects an AbortSignal when the caller did not pass one", async () => {
    const impl = slowFetch(1);
    const f = withRequestTimeout(impl, 1000);
    const p = f("https://x.test/a", { method: "POST" });
    await vi.advanceTimersByTimeAsync(5);
    await p;
    const init = impl.mock.calls[0]?.[1];
    expect(init?.method).toBe("POST");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("rejects with RequestTimeoutError once the deadline passes", async () => {
    const impl = slowFetch(10_000);
    const f = withRequestTimeout(impl, 1000);
    const p = f("https://x.test/slow");
    const assertion = expect(p).rejects.toSatisfy((e: unknown) => {
      return (
        isRequestTimeoutError(e) &&
        e.timeoutMs === 1000 &&
        /network request timed out/i.test(e.message)
      );
    });
    await vi.advanceTimersByTimeAsync(1001);
    await assertion;
  });

  it("keeps the caller's own signal and never overrides it", async () => {
    const impl = slowFetch(10_000);
    const f = withRequestTimeout(impl, 1000);
    const own = new AbortController();
    const p = f("https://x.test/manual", { signal: own.signal });
    // Past our deadline — must NOT abort because the caller owns the signal.
    await vi.advanceTimersByTimeAsync(5000);
    expect(impl.mock.calls[0]?.[1]?.signal).toBe(own.signal);
    own.abort();
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
  });

  it("re-throws non-timeout failures unchanged", async () => {
    const boom = new TypeError("Network request failed");
    const impl = vi.fn(() => Promise.reject(boom));
    const f = withRequestTimeout(impl, 1000);
    await expect(f("https://x.test/down")).rejects.toBe(boom);
  });

  it("clears the timer after the request settles (no late abort)", async () => {
    const impl = slowFetch(10);
    const f = withRequestTimeout(impl, 1000);
    await (async () => {
      const p = f("https://x.test/a");
      await vi.advanceTimersByTimeAsync(20);
      await p;
    })();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects a non-positive timeout at construction time", () => {
    expect(() => withRequestTimeout(slowFetch(1), 0)).toThrow(RangeError);
    expect(() => withRequestTimeout(slowFetch(1), Number.NaN)).toThrow(RangeError);
  });

  it("RequestTimeoutError is a real Error with a stable name", () => {
    const e = new RequestTimeoutError(15_000);
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("RequestTimeoutError");
    expect(e.message).toContain("15000");
  });
});
