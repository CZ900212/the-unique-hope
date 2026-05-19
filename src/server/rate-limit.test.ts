import { afterAll, beforeEach, describe, expect, it } from "vitest";

process.env.DATABASE_URL ??=
  "postgres://postgres:postgres@localhost:5432/unique_hope_test";
process.env.NEXT_PUBLIC_APP_NAME ??= "The Unique Hope";
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";
process.env.NEXT_PUBLIC_DEFAULT_LOCALE ??= "en";
process.env.RATE_LIMIT_HASH_KEY ??= "test-rate-limit-hash-key";

const originalRateLimitTrustForwardHeaders =
  process.env.RATE_LIMIT_TRUST_FORWARD_HEADERS;
const originalRateLimitHashKey = process.env.RATE_LIMIT_HASH_KEY;
const originalAuthSecret = process.env.AUTH_SECRET;

const { extractClientIp, hashRateLimitSubject } = await import("./rate-limit");

describe("extractClientIp", () => {
  beforeEach(() => {
    process.env.RATE_LIMIT_TRUST_FORWARD_HEADERS = "false";
  });

  afterAll(() => {
    process.env.RATE_LIMIT_TRUST_FORWARD_HEADERS =
      originalRateLimitTrustForwardHeaders;
    process.env.RATE_LIMIT_HASH_KEY = originalRateLimitHashKey;
    process.env.AUTH_SECRET = originalAuthSecret;
  });

  it("does not trust forwarded IP headers unless proxy trust is enabled", () => {
    const headers = new Headers({
      "x-vercel-forwarded-for": "203.0.113.10, 203.0.113.11",
      "x-forwarded-for": "198.51.100.9",
    });

    expect(extractClientIp(headers)).toBeNull();
  });

  it("returns null instead of using a shared fallback bucket", () => {
    const headers = new Headers({
      "x-forwarded-for": "198.51.100.9",
      "x-real-ip": "198.51.100.10",
    });

    expect(extractClientIp(headers)).toBeNull();
  });

  it("uses forwarded headers only when explicit proxy trust is enabled", async () => {
    process.env.RATE_LIMIT_TRUST_FORWARD_HEADERS = "true";
    const { extractClientIp: extractTrustedClientIp } =
      await import("./rate-limit");

    const headers = new Headers({
      "cf-connecting-ip": "203.0.113.44",
      "x-forwarded-for": "198.51.100.9, 198.51.100.10",
    });

    expect(extractTrustedClientIp(headers)).toBe("203.0.113.44");
    process.env.RATE_LIMIT_TRUST_FORWARD_HEADERS = "false";
  });

  it("produces a stable keyed hash for the same rate-limit subject", () => {
    process.env.RATE_LIMIT_HASH_KEY = "stable-test-key";

    expect(hashRateLimitSubject("signup:phone:+15551234567")).toBe(
      hashRateLimitSubject("signup:phone:+15551234567"),
    );
  });

  it("changes the digest when the hash key changes", () => {
    process.env.RATE_LIMIT_HASH_KEY = "rate-limit-key-one";
    const first = hashRateLimitSubject("signup:phone:+15551234567");

    process.env.RATE_LIMIT_HASH_KEY = "rate-limit-key-two";
    const second = hashRateLimitSubject("signup:phone:+15551234567");

    expect(second).not.toBe(first);
  });

  it("falls back to AUTH_SECRET when a dedicated rate-limit key is absent", () => {
    delete process.env.RATE_LIMIT_HASH_KEY;
    process.env.AUTH_SECRET = "auth-secret-fallback-key-0123456789";

    expect(hashRateLimitSubject("signup:phone:+15551234567")).toBe(
      hashRateLimitSubject("signup:phone:+15551234567"),
    );
  });
});
