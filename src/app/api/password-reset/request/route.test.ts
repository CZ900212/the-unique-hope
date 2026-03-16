import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  consumeRateLimit: vi.fn(),
  extractClientIp: vi.fn(),
  requestPasswordReset: vi.fn(),
}));

vi.mock("~/server/auth/password-reset", () => ({
  requestPasswordReset: mocks.requestPasswordReset,
}));

vi.mock("~/server/rate-limit", () => ({
  consumeRateLimit: mocks.consumeRateLimit,
  extractClientIp: mocks.extractClientIp,
}));

const { POST } = await import("./route");

describe("password reset request route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.extractClientIp.mockReturnValue("203.0.113.10");
    mocks.consumeRateLimit.mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 30,
      remaining: 2,
    });
  });

  it("does not expose preview reset URLs in the HTTP response", async () => {
    mocks.requestPasswordReset.mockResolvedValue({
      status: "preview",
    });

    const response = await POST(
      new Request("http://localhost/api/password-reset/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier: "teacher@example.com",
          role: "teacher",
        }),
      }),
    );
    const payload = (await response.json()) as {
      ok: boolean;
      message?: string;
      status?: string;
      previewUrl?: string | null;
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.message).toBeUndefined();
    expect(payload.status).toBeUndefined();
    expect(payload.previewUrl).toBeUndefined();
  });

  it("rejects admin password reset attempts with a fixed manual-reset message", async () => {
    const response = await POST(
      new Request("http://localhost/api/password-reset/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier: "admin@example.com",
          role: "admin",
        }),
      }),
    );
    const payload = (await response.json()) as {
      error?: {
        code?: string;
        message?: string;
      };
    };

    expect(response.status).toBe(403);
    expect(payload.error).toEqual({
      code: "PASSWORD_RESET_DISABLED",
      message: "Admin password resets are handled internally. Contact the system owner.",
    });
    expect(mocks.requestPasswordReset).not.toHaveBeenCalled();
  });
});
