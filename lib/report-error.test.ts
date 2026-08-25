import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/react-native", () => ({ captureException }));

import { buildReportExtras, describeError, errorCode, reportError, toError } from "./report-error";

describe("describeError", () => {
  it("formats an Error with a non-default name", () => {
    expect(describeError(new TypeError("Network request failed"))).toBe(
      "TypeError: Network request failed",
    );
  });

  it("drops the default 'Error' name", () => {
    expect(describeError(new Error("boom"))).toBe("boom");
  });

  it("falls back when an Error has an empty message", () => {
    expect(describeError(new Error(""))).toBe("(no message)");
  });

  it("uses the Supabase code when present", () => {
    expect(describeError({ message: "JWT expired", code: "PGRST301" })).toBe(
      "PGRST301: JWT expired",
    );
  });

  it("uses a numeric status when there is no code", () => {
    expect(describeError({ message: "Forbidden", status: 403 })).toBe("403: Forbidden");
  });

  it("uses a custom name when there is neither code nor status", () => {
    expect(describeError({ message: "nope", name: "AuthApiError" })).toBe("AuthApiError: nope");
  });

  it("returns the message alone for a plain { message } object", () => {
    expect(describeError({ message: "plain" })).toBe("plain");
  });

  it("handles strings, blanks, null and undefined", () => {
    expect(describeError("  just text ")).toBe("just text");
    expect(describeError("   ")).toBe("Unknown error");
    expect(describeError(null)).toBe("Unknown error");
    expect(describeError(undefined)).toBe("Unknown error");
  });

  it("serialises other objects and primitives", () => {
    expect(describeError({ foo: 1 })).toBe('{"foo":1}');
    expect(describeError(42)).toBe("42");
    expect(describeError({})).toBe("[object Object]");
  });

  it("survives circular objects", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(describeError(circular)).toBe("[object Object]");
  });
});

describe("toError", () => {
  it("returns Error instances untouched", () => {
    const e = new RangeError("x");
    expect(toError(e, "tag")).toBe(e);
  });

  it("wraps non-Error values and keeps the tag + name", () => {
    const wrapped = toError(
      { message: "bad jwt", name: "AuthApiError", code: "401" },
      "auth/hydrate",
    );
    expect(wrapped).toBeInstanceOf(Error);
    expect(wrapped.message).toBe("[auth/hydrate] 401: bad jwt");
    expect(wrapped.name).toBe("AuthApiError");
  });

  it("wraps a string without a tag", () => {
    expect(toError("oops").message).toBe("oops");
  });
});

describe("errorCode", () => {
  it("prefers code, then status, then Error name", () => {
    expect(errorCode({ code: "42501", status: 403 })).toBe("42501");
    expect(errorCode({ status: 500 })).toBe("500");
    expect(errorCode(new TypeError("x"))).toBe("TypeError");
    expect(errorCode(new Error("x"))).toBeNull();
    expect(errorCode("str")).toBeNull();
    expect(errorCode(null)).toBeNull();
  });
});

describe("buildReportExtras", () => {
  it("keeps caller extras and adds Supabase details/hint", () => {
    expect(
      buildReportExtras({ message: "m", details: "d", hint: "h" }, { userId: "u1" }),
    ).toEqual({ userId: "u1", details: "d", hint: "h", rawError: "m" });
  });

  it("adds no rawError for real Error instances", () => {
    expect(buildReportExtras(new Error("m"))).toEqual({});
  });
});

describe("reportError", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

  beforeEach(() => {
    captureException.mockReset();
    warn.mockClear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("only warns in development", () => {
    vi.stubGlobal("__DEV__", true);
    reportError("review/deck-load", new Error("nope"), { layer: "scan" });
    expect(warn).toHaveBeenCalledWith("[Memika:review/deck-load]", "nope", { layer: "scan" });
    expect(captureException).not.toHaveBeenCalled();
  });

  it("captures to Sentry with tags and extras in release", () => {
    vi.stubGlobal("__DEV__", false);
    reportError("auth/hydrate", { message: "JWT expired", code: "PGRST301" }, { step: 2 });
    expect(warn).not.toHaveBeenCalled();
    expect(captureException).toHaveBeenCalledTimes(1);
    const [err, hint] = captureException.mock.calls[0] as [Error, Record<string, unknown>];
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("[auth/hydrate] PGRST301: JWT expired");
    expect(hint.tags).toEqual({ where: "auth/hydrate", code: "PGRST301" });
    expect(hint.extra).toEqual({ step: 2, rawError: "PGRST301: JWT expired" });
  });

  it("treats a missing __DEV__ global as release", () => {
    reportError("x", "boom");
    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it("never throws even if Sentry does", () => {
    vi.stubGlobal("__DEV__", false);
    captureException.mockImplementationOnce(() => {
      throw new Error("sentry down");
    });
    expect(() => reportError("x", new Error("y"))).not.toThrow();
  });
});
