import { describe, expect, it } from "vitest";

import { decideAuthEvent } from "./auth-events";

describe("decideAuthEvent", () => {
  it("INITIAL_SESSION(null) leaves a queued recovery link untouched", () => {
    // Cold start from the recovery email: auth-js emits INITIAL_SESSION with
    // no session for the fresh subscription; it must not clear the link the
    // root layout just queued.
    expect(decideAuthEvent("INITIAL_SESSION", false)).toEqual({
      clearUser: false,
      clearRecovery: false,
      markRecovery: false,
      refreshProfile: false,
    });
  });

  it("INITIAL_SESSION with a session is a no-op too (hydrate() owns it)", () => {
    expect(decideAuthEvent("INITIAL_SESSION", true).refreshProfile).toBe(false);
    expect(decideAuthEvent("INITIAL_SESSION", true).clearUser).toBe(false);
  });

  it("only an explicit SIGNED_OUT ends a pending password reset", () => {
    expect(decideAuthEvent("SIGNED_OUT", false)).toEqual({
      clearUser: true,
      clearRecovery: true,
      markRecovery: false,
      refreshProfile: false,
    });
    expect(decideAuthEvent("SIGNED_OUT", true).clearRecovery).toBe(true);
  });

  it("any other session-less event clears the user but keeps the recovery state", () => {
    for (const event of ["USER_UPDATED", "TOKEN_REFRESHED", "SIGNED_IN"] as const) {
      const d = decideAuthEvent(event, false);
      expect(d.clearUser).toBe(true);
      expect(d.clearRecovery).toBe(false);
      expect(d.refreshProfile).toBe(false);
    }
  });

  it("PASSWORD_RECOVERY raises the flag and refreshes the profile", () => {
    expect(decideAuthEvent("PASSWORD_RECOVERY", true)).toEqual({
      clearUser: false,
      clearRecovery: false,
      markRecovery: true,
      refreshProfile: true,
    });
  });

  it("SIGNED_IN / TOKEN_REFRESHED / USER_UPDATED refresh the profile", () => {
    for (const event of ["SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED"] as const) {
      const d = decideAuthEvent(event, true);
      expect(d.refreshProfile).toBe(true);
      expect(d.clearUser).toBe(false);
      expect(d.markRecovery).toBe(false);
    }
  });

  it("unknown events are ignored", () => {
    expect(decideAuthEvent("MFA_CHALLENGE_VERIFIED", true).refreshProfile).toBe(false);
    expect(decideAuthEvent("SOMETHING_NEW", true).clearUser).toBe(false);
  });
});
