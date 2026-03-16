import { describe, expect, it } from "vitest";

import { isUnsafeSeedPassword, resolveSeedPolicy } from "./seed-policy";

describe("seed policy", () => {
  it("rejects placeholder and known demo passwords", () => {
    expect(isUnsafeSeedPassword("change-me-now")).toBe(true);
    expect(isUnsafeSeedPassword(" demo123456 ")).toBe(true);
    expect(isUnsafeSeedPassword("replace-with-a-unique-admin-password")).toBe(true);
    expect(isUnsafeSeedPassword("actual-unique-password-2026")).toBe(false);
  });

  it("requires a non-placeholder admin password", () => {
    expect(() =>
      resolveSeedPolicy({
        adminPassword: "change-me-now",
        nodeEnv: "development",
        seedDemoData: "false",
      }),
    ).toThrow(/SEED_ADMIN_PASSWORD/);
  });

  it("blocks demo account seeding in production", () => {
    expect(() =>
      resolveSeedPolicy({
        adminPassword: "actual-unique-password-2026",
        nodeEnv: "production",
        seedDemoData: "true",
      }),
    ).toThrow(/SEED_DEMO_DATA/);
  });

  it("returns safe seed settings for non-production flows", () => {
    expect(
      resolveSeedPolicy({
        adminPassword: " actual-unique-password-2026 ",
        nodeEnv: "development",
        resetExistingPasswords: "true",
        seedDemoData: "true",
      }),
    ).toEqual({
      adminPassword: "actual-unique-password-2026",
      resetExistingPasswords: true,
      seedDemoData: true,
    });
  });
});
