import { describe, expect, it } from "vitest";

import {
  authLinkErrorMessage,
  authLinkFingerprint,
  authLinkPath,
  classifyAuthLink,
  isAuthLink,
  isRecoveryLink,
  parseAuthLink,
  parseDevSignOutToken,
} from "./auth-links";

const RECOVERY_FRAGMENT =
  "#access_token=eyJhbGciOiJIUzI1NiJ9.AAA.BBB&expires_in=3600&refresh_token=ref-123&token_type=bearer&type=recovery";

describe("authLinkPath", () => {
  it("treats the host of a custom scheme as the path", () => {
    expect(authLinkPath("memika://reset-password")).toBe("reset-password");
    expect(authLinkPath("memika://reset-password/")).toBe("reset-password");
    expect(authLinkPath("exp+memika://auth-callback#x=1")).toBe("auth-callback");
  });

  it("strips the Expo Go host and the /--/ separator", () => {
    expect(authLinkPath("exp://192.168.1.52:8083/--/reset-password#a=b")).toBe("reset-password");
    expect(authLinkPath("exp://192.168.1.52:8083/--/")).toBe("");
    expect(authLinkPath("exp://192.168.1.52:8083")).toBe("");
  });

  it("drops the host for https universal links", () => {
    expect(authLinkPath("https://memika.app/reset-password?x=1")).toBe("reset-password");
    expect(authLinkPath("https://memika.app")).toBe("");
  });

  it("returns an empty path for a bare scheme URL", () => {
    expect(authLinkPath("memika://")).toBe("");
  });
});

describe("parseAuthLink", () => {
  it("reads implicit-flow tokens out of the fragment", () => {
    const link = parseAuthLink(`memika://reset-password${RECOVERY_FRAGMENT}`);
    expect(link).toEqual({
      path: "reset-password",
      type: "recovery",
      accessToken: "eyJhbGciOiJIUzI1NiJ9.AAA.BBB",
      refreshToken: "ref-123",
      code: null,
      error: null,
      errorDescription: null,
    });
  });

  it("parses the same fragment on an Expo Go URL", () => {
    const link = parseAuthLink(`exp://192.168.1.52:8083/--/reset-password${RECOVERY_FRAGMENT}`);
    expect(link.path).toBe("reset-password");
    expect(link.type).toBe("recovery");
    expect(link.refreshToken).toBe("ref-123");
  });

  it("reads a PKCE code from the query string", () => {
    const link = parseAuthLink("memika://reset-password?code=abc-def");
    expect(link.code).toBe("abc-def");
    expect(link.accessToken).toBeNull();
  });

  it("prefers error_code over error and decodes the description", () => {
    const link = parseAuthLink(
      "memika://reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
    );
    expect(link.error).toBe("otp_expired");
    expect(link.errorDescription).toBe("Email link is invalid or has expired");
    expect(link.type).toBeNull();
  });

  it("lets the fragment override a query param of the same name", () => {
    const link = parseAuthLink("memika://auth-callback?type=signup#type=recovery");
    expect(link.type).toBe("recovery");
  });

  it("ignores unknown type values", () => {
    expect(parseAuthLink("memika://auth-callback#type=weird").type).toBeNull();
  });

  it("survives malformed percent-encoding", () => {
    expect(() => parseAuthLink("memika://auth-callback#error=%E0%A4%A")).not.toThrow();
  });
});

describe("isAuthLink / isRecoveryLink", () => {
  it("rejects our paths when nothing actionable is attached", () => {
    expect(isAuthLink(parseAuthLink("memika://reset-password"))).toBe(false);
    expect(isAuthLink(parseAuthLink("memika://auth-callback?foo=bar"))).toBe(false);
  });

  it("rejects tokens on a path we do not own", () => {
    expect(isAuthLink(parseAuthLink(`memika://today${RECOVERY_FRAGMENT}`))).toBe(false);
    expect(isAuthLink(parseAuthLink(`exp://192.168.1.52:8083${RECOVERY_FRAGMENT}`))).toBe(false);
  });

  it("requires BOTH tokens for the implicit flow", () => {
    expect(isAuthLink(parseAuthLink("memika://reset-password#access_token=x"))).toBe(false);
    expect(
      isAuthLink(parseAuthLink("memika://reset-password#access_token=x&refresh_token=y")),
    ).toBe(true);
  });

  it("accepts an error-only link so the screen can explain it", () => {
    expect(isAuthLink(parseAuthLink("memika://reset-password#error_code=otp_expired"))).toBe(true);
  });

  it("identifies recovery by type or by path", () => {
    expect(isRecoveryLink(parseAuthLink("memika://auth-callback#type=recovery"))).toBe(true);
    expect(isRecoveryLink(parseAuthLink("memika://reset-password#error_code=otp_expired"))).toBe(true);
    expect(isRecoveryLink(parseAuthLink("memika://auth-callback#type=signup"))).toBe(false);
  });
});

describe("classifyAuthLink", () => {
  it("ignores unrelated URLs", () => {
    expect(classifyAuthLink(parseAuthLink("exp://192.168.1.52:8083/--/?reset=1"))).toEqual({
      kind: "ignore",
    });
    expect(classifyAuthLink(parseAuthLink("memika://reset-password"))).toEqual({ kind: "ignore" });
  });

  it("returns tokens for a recovery link", () => {
    expect(classifyAuthLink(parseAuthLink(`memika://reset-password${RECOVERY_FRAGMENT}`))).toEqual({
      kind: "tokens",
      accessToken: "eyJhbGciOiJIUzI1NiJ9.AAA.BBB",
      refreshToken: "ref-123",
      recovery: true,
    });
  });

  it("returns tokens with recovery=false for a signup confirmation", () => {
    const action = classifyAuthLink(
      parseAuthLink("memika://auth-callback#access_token=a&refresh_token=b&type=signup"),
    );
    expect(action).toEqual({ kind: "tokens", accessToken: "a", refreshToken: "b", recovery: false });
  });

  it("surfaces errors before tokens", () => {
    const action = classifyAuthLink(
      parseAuthLink("memika://reset-password#error_code=otp_expired&access_token=a&refresh_token=b"),
    );
    expect(action).toEqual({ kind: "error", code: "otp_expired", recovery: true });
  });

  it("returns a PKCE code when present", () => {
    expect(classifyAuthLink(parseAuthLink("memika://reset-password?code=xyz"))).toEqual({
      kind: "code",
      code: "xyz",
      recovery: true,
    });
  });
});

describe("authLinkErrorMessage", () => {
  it("maps expiry, invalid and unknown codes to Italian copy without leaking the code", () => {
    expect(authLinkErrorMessage("otp_expired")).toMatch(/scaduto/);
    expect(authLinkErrorMessage("access_denied")).toMatch(/non è valido/);
    expect(authLinkErrorMessage("server_error")).toMatch(/nuovo link/);
    expect(authLinkErrorMessage(null)).not.toMatch(/null/);
    expect(authLinkErrorMessage("server_error")).not.toMatch(/server_error/);
  });
});

describe("authLinkFingerprint", () => {
  it("is stable, distinct per URL and does not contain the URL", () => {
    const a = `memika://reset-password${RECOVERY_FRAGMENT}`;
    const b = `memika://reset-password${RECOVERY_FRAGMENT}x`;
    expect(authLinkFingerprint(a)).toBe(authLinkFingerprint(a));
    expect(authLinkFingerprint(a)).not.toBe(authLinkFingerprint(b));
    expect(authLinkFingerprint(a)).not.toContain("ref-123");
    expect(authLinkFingerprint(a).length).toBeLessThan(24);
  });
});

describe("parseDevSignOutToken", () => {
  it("reads the legacy ?reset= and the new ?dev-signout= param", () => {
    expect(parseDevSignOutToken("exp://192.168.1.52:8083/--/?reset=1")).toBe("1");
    expect(parseDevSignOutToken("exp://192.168.1.52:8083/--/?foo=1&dev-signout=abc")).toBe("abc");
    expect(parseDevSignOutToken("exp://192.168.1.52:8083/--/?reset=a%20b")).toBe("a b");
  });

  it("never matches the reset-password route or fragment params", () => {
    expect(parseDevSignOutToken("memika://reset-password")).toBeNull();
    expect(parseDevSignOutToken(`memika://reset-password${RECOVERY_FRAGMENT}`)).toBeNull();
    expect(parseDevSignOutToken("memika://auth-callback#reset=1")).toBeNull();
  });
});
