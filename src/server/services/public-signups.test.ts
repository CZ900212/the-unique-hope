import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  consumeRateLimit: vi.fn(),
  extractClientIp: vi.fn(),
}));

vi.mock("~/server/rate-limit", () => ({
  consumeRateLimit: mocks.consumeRateLimit,
  extractClientIp: mocks.extractClientIp,
}));

const { enforcePublicSignupRateLimit } = await import("./public-signups");

describe("enforcePublicSignupRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.extractClientIp.mockReturnValue(null);
    mocks.consumeRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 1,
      retryAfterSeconds: 60,
    });
  });

  it("still rate-limits by normalized phone when no trusted client IP is available", async () => {
    await enforcePublicSignupRateLimit(new Headers(), " +1 (555) 123-4567 ", "en");

    expect(mocks.consumeRateLimit).toHaveBeenCalledTimes(1);
    expect(mocks.consumeRateLimit).toHaveBeenCalledWith({
      action: "signup:phone",
      limit: 2,
      subject: "+15551234567",
      windowMs: 60 * 60 * 1000,
    });
  });

  it("applies both phone and IP limits when a trusted client IP is present", async () => {
    mocks.extractClientIp.mockReturnValue("203.0.113.10");

    await enforcePublicSignupRateLimit(new Headers(), "555 123 4567", "en");

    expect(mocks.consumeRateLimit).toHaveBeenCalledTimes(2);
    expect(mocks.consumeRateLimit).toHaveBeenCalledWith({
      action: "signup:ip",
      limit: 5,
      subject: "203.0.113.10",
      windowMs: 60 * 60 * 1000,
    });
  });

  it("throws a throttling error when the phone bucket is exhausted", async () => {
    mocks.consumeRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 60,
    });

    await expect(
      enforcePublicSignupRateLimit(new Headers(), "5551234567", "en"),
    ).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
      message: "Too many signup submissions. Try again later.",
    });
  });

  it("localizes throttling errors when chinese is active", async () => {
    mocks.consumeRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 60,
    });

    await expect(
      enforcePublicSignupRateLimit(new Headers(), "5551234567", "zh"),
    ).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
      message: "报名提交次数过多，请稍后再试。",
    });
  });
});
