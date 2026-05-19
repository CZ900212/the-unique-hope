import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.AUTH_SECRET ??= "test-auth-secret";
process.env.DATABASE_URL ??=
  "postgres://postgres:postgres@localhost:5432/unique_hope_test";
process.env.NEXT_PUBLIC_APP_NAME ??= "The Unique Hope";
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";
process.env.NEXT_PUBLIC_DEFAULT_LOCALE ??= "en";
process.env.RATE_LIMIT_HASH_KEY ??= "test-rate-limit-hash-key-0123456789";
process.env.RECOVERY_PHONE_HASH_KEY ??=
  "test-recovery-phone-hash-key-0123456789";

const mocks = vi.hoisted(() => ({
  consumeRateLimit: vi.fn(),
  extractClientIp: vi.fn(),
}));

vi.mock("~/server/rate-limit", () => ({
  consumeRateLimit: mocks.consumeRateLimit,
  extractClientIp: mocks.extractClientIp,
}));

const {
  enforcePhonePasswordResetSmsRateLimits,
  getRecoveryPhoneLast4,
  hashRecoveryPhone,
  maskRecoveryPhone,
  normalizeRecoveryPhone,
} = await import("./phone-password-reset");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.extractClientIp.mockReturnValue(null);
  mocks.consumeRateLimit.mockResolvedValue({
    allowed: true,
    remaining: 1,
    retryAfterSeconds: 0,
  });
});

describe("phone password reset helpers", () => {
  it("normalizes common China mobile phone formats to the same value", () => {
    const expected = "+8613800138000";

    expect(normalizeRecoveryPhone("13800138000")).toBe(expected);
    expect(normalizeRecoveryPhone("138 0013 8000")).toBe(expected);
    expect(normalizeRecoveryPhone("138-0013-8000")).toBe(expected);
    expect(normalizeRecoveryPhone("+86 13800138000")).toBe(expected);
  });

  it("hashes phones with a keyed digest instead of returning the raw number", () => {
    const normalized = normalizeRecoveryPhone("13800138000");
    const hash = hashRecoveryPhone(normalized);

    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
    expect(hash).not.toContain("13800138000");
    expect(hashRecoveryPhone(normalized)).toBe(hash);
  });

  it("keeps only masked display data and the last four digits", () => {
    const normalized = normalizeRecoveryPhone("13800138000");

    expect(maskRecoveryPhone(normalized)).toBe("+86 138****8000");
    expect(getRecoveryPhoneLast4(normalized)).toBe("8000");
  });
});

describe("phone password reset SMS rate limits", () => {
  const phoneHash = "phone-hash";

  it("ignores spoofed forwarded headers when no trusted client IP is available", async () => {
    const headers = new Headers({
      "x-forwarded-for": "198.51.100.9",
      "x-real-ip": "198.51.100.10",
    });

    await expect(
      enforcePhonePasswordResetSmsRateLimits({ headers, phoneHash }),
    ).resolves.toMatchObject({ allowed: true, clientIp: null });

    expect(mocks.extractClientIp).toHaveBeenCalledWith(headers);
    expect(mocks.consumeRateLimit).toHaveBeenCalledTimes(2);
    expect(
      mocks.consumeRateLimit.mock.calls.map(
        ([input]) => (input as { subject: string }).subject,
      ),
    ).toEqual([phoneHash, phoneHash]);
  });

  it("applies IP buckets only when the shared extractor returns a trusted client IP", async () => {
    const headers = new Headers({
      "cf-connecting-ip": "203.0.113.10",
      "x-forwarded-for": "198.51.100.9",
    });
    mocks.extractClientIp.mockReturnValue("203.0.113.10");

    await expect(
      enforcePhonePasswordResetSmsRateLimits({ headers, phoneHash }),
    ).resolves.toMatchObject({ allowed: true, clientIp: "203.0.113.10" });

    expect(mocks.extractClientIp).toHaveBeenCalledWith(headers);
    expect(mocks.consumeRateLimit).toHaveBeenCalledTimes(4);
    expect(mocks.consumeRateLimit).toHaveBeenCalledWith({
      action: "password-reset-sms:ip-hour",
      limit: 20,
      subject: "203.0.113.10",
      windowMs: 60 * 60 * 1000,
    });
    expect(mocks.consumeRateLimit).toHaveBeenCalledWith({
      action: "password-reset-sms:ip-phone-hour",
      limit: 5,
      subject: `203.0.113.10:${phoneHash}`,
      windowMs: 60 * 60 * 1000,
    });
  });

  it("keeps phone buckets active when no trusted client IP is available", async () => {
    await enforcePhonePasswordResetSmsRateLimits({
      headers: new Headers(),
      phoneHash,
    });

    expect(mocks.consumeRateLimit).toHaveBeenCalledWith({
      action: "password-reset-sms:phone-minute",
      limit: 1,
      subject: phoneHash,
      windowMs: 60 * 1000,
    });
    expect(mocks.consumeRateLimit).toHaveBeenCalledWith({
      action: "password-reset-sms:phone-day",
      limit: 5,
      subject: phoneHash,
      windowMs: 24 * 60 * 60 * 1000,
    });
  });
});
