import { describe, expect, it } from "vitest";

import { mapProfile, type ProfileRow } from "./mappers";

const row = (over: Partial<ProfileRow> = {}): ProfileRow => ({
  id: "u1",
  email: "angelo@example.com",
  name: "Angelo",
  role: "user",
  daily_input_cap: 20,
  calm_mode: true,
  weekly_digest: false,
  morning_review_at: "08:00:00",
  evening_review_at: "21:30:00",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...over,
});

describe("mapProfile — le colonne di piano", () => {
  it("porta piano, scadenza e app user id sul modello camelCase", () => {
    const p = mapProfile(
      row({
        plan: "pro",
        plan_until: "2026-12-01T00:00:00.000Z",
        rc_app_user_id: "u1",
      }),
    );
    expect(p.plan).toBe("pro");
    expect(p.planUntil).toBe("2026-12-01T00:00:00.000Z");
    expect(p.rcAppUserId).toBe("u1");
  });

  it("una riga senza le colonne (client vecchio, demo) vale free", () => {
    const p = mapProfile(row());
    expect(p.plan).toBe("free");
    expect(p.planUntil).toBeNull();
    expect(p.rcAppUserId).toBeNull();
  });

  it("non si fida di un valore fuori dai tre piani", () => {
    const p = mapProfile(row({ plan: "platinum" as never }));
    expect(p.plan).toBe("free");
  });
});
