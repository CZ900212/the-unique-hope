import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  consumeRateLimit: vi.fn(),
  extractClientIp: vi.fn(),
  hashPasswordResetToken: vi.fn((token: string) => `hashed-${token}`),
  resetPasswordWithToken: vi.fn(),
}));

vi.mock("~/server/auth/password-reset", () => ({
  hashPasswordResetToken: mocks.hashPasswordResetToken,
  resetPasswordWithToken: mocks.resetPasswordWithToken,
}));

vi.mock("~/server/rate-limit", () => ({
  consumeRateLimit: mocks.consumeRateLimit,
  extractClientIp: mocks.extractClientIp,
}));

const { POST } = await import("./route");

describe("password reset confirm route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.extractClientIp.mockReturnValue(null);
    mocks.consumeRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 4,
      retryAfterSeconds: 60,
    });
  });

  it("localizes invalid token errors from the locale cookie", async () => {
    mocks.resetPasswordWithToken.mockResolvedValue({
      status: "invalid_token",
    });

    const response = await POST(
      new Request("http://localhost/api/password-reset/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: "uh_locale=zh",
        },
        body: JSON.stringify({
          token: "rst_12345678901234567890",
          password: "secret123",
          confirmPassword: "secret123",
        }),
      }),
    );
    const payload = (await response.json()) as {
      error?: {
        code?: string;
        message?: string;
      };
    };

    expect(response.status).toBe(400);
    expect(payload.error).toEqual({
      code: "INVALID_TOKEN",
      message: "这个重置链接无效或已过期。",
    });
    expect(mocks.consumeRateLimit).toHaveBeenCalledWith({
      action: "password-reset-confirm:token",
      limit: 5,
      subject: "hashed-rst_12345678901234567890",
      windowMs: 15 * 60 * 1000,
    });
  });

  it("returns 429 when the reset token confirm bucket is exhausted", async () => {
    mocks.consumeRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 120,
    });

    const response = await POST(
      new Request("http://localhost/api/password-reset/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: "rst_12345678901234567890",
          password: "secret123",
          confirmPassword: "secret123",
        }),
      }),
    );
    const payload = (await response.json()) as {
      error?: {
        code?: string;
        message?: string;
      };
    };

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("120");
    expect(payload.error).toEqual({
      code: "TOO_MANY_REQUESTS",
      message: "Too many password reset requests. Try again later.",
    });
    expect(mocks.resetPasswordWithToken).not.toHaveBeenCalled();
  });
});
