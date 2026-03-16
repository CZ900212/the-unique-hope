import { describe, expect, it } from "vitest";
import { getLoginRateLimitPolicy } from "./admin-login-policy";

describe("admin login policy", () => {
  it("uses tighter limits for admin sign-ins", () => {
    expect(getLoginRateLimitPolicy("admin")).toEqual({
      identifierLimit: 3,
      ipLimit: 5,
    });
    expect(getLoginRateLimitPolicy("teacher")).toEqual({
      identifierLimit: 5,
      ipLimit: 10,
    });
  });
});
