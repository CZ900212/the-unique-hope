import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resetPasswordWithToken: vi.fn(),
}));

vi.mock("~/server/auth/password-reset", () => ({
  resetPasswordWithToken: mocks.resetPasswordWithToken,
}));

const { POST } = await import("./route");

describe("password reset confirm route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
          token: "12345678901234567890",
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
  });
});
