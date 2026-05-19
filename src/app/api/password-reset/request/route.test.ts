import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class PasswordResetDeliveryError extends Error {
    constructor(cause: unknown) {
      super("Failed to deliver password reset email.", { cause });
      this.name = "PasswordResetDeliveryError";
    }
  }

  return {
    PasswordResetDeliveryError,
    consumeRateLimit: vi.fn(),
    createManualRecoveryRequest: vi.fn(),
    extractClientIp: vi.fn(),
    requestPasswordReset: vi.fn(),
  };
});

vi.mock("~/server/auth/manual-password-reset", () => ({
  createManualRecoveryRequest: mocks.createManualRecoveryRequest,
}));

vi.mock("~/server/auth/password-reset", () => ({
  PasswordResetDeliveryError: mocks.PasswordResetDeliveryError,
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
    mocks.createManualRecoveryRequest.mockResolvedValue({ status: "queued" });
    mocks.extractClientIp.mockReturnValue("203.0.113.10");
    mocks.consumeRateLimit.mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 30,
      remaining: 2,
    });
    mocks.requestPasswordReset.mockResolvedValue({ status: "queued" });
  });

  it("routes email recovery requests through the email reset flow", async () => {
    const response = await POST(
      new Request("http://localhost/api/password-reset/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recoveryMode: "email",
          identifier: "teacher@example.com",
          role: "teacher",
        }),
      }),
    );
    const payload = (await response.json()) as {
      ok?: boolean;
      message?: string;
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.message).toBe(
      "If this account can use email recovery, a reset link will be sent. If not, use manual recovery.",
    );
    expect(mocks.requestPasswordReset).toHaveBeenCalledWith({
      identifier: "teacher@example.com",
      role: "teacher",
    });
    expect(mocks.createManualRecoveryRequest).not.toHaveBeenCalled();
  });

  it("does not expose whether an email account needs manual recovery", async () => {
    mocks.requestPasswordReset.mockResolvedValue({
      status: "manual_required",
    });

    const response = await POST(
      new Request("http://localhost/api/password-reset/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recoveryMode: "email",
          identifier: "student.local",
          role: "student",
        }),
      }),
    );
    const payload = (await response.json()) as {
      ok?: boolean;
      message?: string;
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.message).toBe(
      "If this account can use email recovery, a reset link will be sent. If not, use manual recovery.",
    );
  });

  it("returns 503 when email recovery is not configured", async () => {
    mocks.requestPasswordReset.mockResolvedValue({ status: "unavailable" });

    const response = await POST(
      new Request("http://localhost/api/password-reset/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recoveryMode: "email",
          identifier: "teacher@example.com",
          role: "teacher",
        }),
      }),
    );
    const payload = (await response.json()) as {
      error?: { code?: string; message?: string };
    };

    expect(response.status).toBe(503);
    expect(payload.error).toEqual({
      code: "PASSWORD_RESET_UNAVAILABLE",
      message:
        "Email recovery is not available right now. Please use manual recovery.",
    });
  });

  it("collapses email delivery failures into the generic email response", async () => {
    mocks.requestPasswordReset.mockRejectedValue(
      new mocks.PasswordResetDeliveryError(
        new Error("mail provider unavailable"),
      ),
    );

    const response = await POST(
      new Request("http://localhost/api/password-reset/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recoveryMode: "email",
          identifier: "teacher@example.com",
          role: "teacher",
        }),
      }),
    );
    const payload = (await response.json()) as {
      ok?: boolean;
      message?: string;
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.message).toBe(
      "If this account can use email recovery, a reset link will be sent. If not, use manual recovery.",
    );
  });

  it("returns 429 when email recovery limits are exhausted", async () => {
    mocks.consumeRateLimit
      .mockResolvedValueOnce({
        allowed: false,
        retryAfterSeconds: 90,
      })
      .mockResolvedValueOnce({
        allowed: true,
        retryAfterSeconds: 30,
      });

    const response = await POST(
      new Request("http://localhost/api/password-reset/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recoveryMode: "email",
          identifier: "teacher@example.com",
          role: "teacher",
        }),
      }),
    );
    const payload = (await response.json()) as {
      error?: { code?: string; message?: string };
    };

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("90");
    expect(payload.error).toEqual({
      code: "TOO_MANY_REQUESTS",
      message: "Too many password reset requests. Try again later.",
    });
    expect(mocks.requestPasswordReset).not.toHaveBeenCalled();
  });

  it("returns the same generic success message for manual recovery requests", async () => {
    const response = await POST(
      new Request("http://localhost/api/password-reset/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recoveryMode: "manual",
          applicantRole: "student",
          applicantName: "Iris",
          applicantContact: "WeChat iris",
          applicantNote: "Needs help",
        }),
      }),
    );
    const payload = (await response.json()) as {
      ok?: boolean;
      message?: string;
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.message).toBe(
      "Your request has been sent to the admin team for confirmation.",
    );
    expect(mocks.createManualRecoveryRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        applicantContact: "WeChat iris",
        applicantName: "Iris",
        applicantNote: "Needs help",
        applicantRole: "student",
      }),
    );
  });

  it("still accepts the legacy manual recovery request shape", async () => {
    const response = await POST(
      new Request("http://localhost/api/password-reset/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          applicantRole: "teacher",
          applicantName: "Teacher",
          applicantContact: "teacher@example.com",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.createManualRecoveryRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        applicantContact: "teacher@example.com",
        applicantName: "Teacher",
        applicantRole: "teacher",
      }),
    );
  });

  it("returns 429 when manual recovery request limits are exhausted", async () => {
    mocks.createManualRecoveryRequest.mockResolvedValue({
      retryAfterSeconds: 120,
      status: "rate_limited",
    });

    const response = await POST(
      new Request("http://localhost/api/password-reset/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recoveryMode: "manual",
          applicantRole: "teacher",
          applicantName: "Teacher",
          applicantContact: "teacher@example.com",
        }),
      }),
    );
    const payload = (await response.json()) as {
      error?: { code?: string; message?: string };
    };

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("120");
    expect(payload.error).toEqual({
      code: "TOO_MANY_REQUESTS",
      message: "Too many password reset requests. Try again later.",
    });
  });

  it("rejects the old phone request shape", async () => {
    const response = await POST(
      new Request("http://localhost/api/password-reset/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: "13800138000",
        }),
      }),
    );
    const payload = (await response.json()) as {
      error?: { code?: string; message?: string };
    };

    expect(response.status).toBe(400);
    expect(payload.error).toEqual({
      code: "BAD_REQUEST",
      message: "Valid recovery information is required.",
    });
    expect(mocks.createManualRecoveryRequest).not.toHaveBeenCalled();
  });

  it("localizes validation errors from the locale cookie", async () => {
    const response = await POST(
      new Request("http://localhost/api/password-reset/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: "uh_locale=zh",
        },
        body: JSON.stringify({
          recoveryMode: "manual",
          applicantRole: "student",
          applicantName: "",
          applicantContact: "",
        }),
      }),
    );
    const payload = (await response.json()) as {
      error?: { code?: string; message?: string };
    };

    expect(response.status).toBe(400);
    expect(payload.error).toEqual({
      code: "BAD_REQUEST",
      message: "请填写有效的找回信息。",
    });
  });
});
