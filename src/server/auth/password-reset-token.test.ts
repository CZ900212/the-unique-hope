import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  and: vi.fn((...conditions: unknown[]) => ({ conditions, op: "and" })),
  eq: vi.fn((field: unknown, value: unknown) => ({ field, op: "eq", value })),
  gt: vi.fn((field: unknown, value: unknown) => ({ field, op: "gt", value })),
  hash: vi.fn(),
  isNull: vi.fn((field: unknown) => ({ field, op: "isNull" })),
  returning: vi.fn(),
  set: vi.fn(),
  transaction: vi.fn(),
  update: vi.fn(),
  where: vi.fn(),
}));

vi.mock("~/env", () => ({
  env: {
    NEXT_PUBLIC_APP_NAME: "The Unique Hope",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    PASSWORD_RESET_FROM_EMAIL: undefined,
    PASSWORD_RESET_TOKEN_TTL_MINUTES: 60,
    RESEND_API_KEY: undefined,
  },
}));

vi.mock("bcryptjs", () => ({
  hash: mocks.hash,
}));

vi.mock("drizzle-orm", () => ({
  and: mocks.and,
  eq: mocks.eq,
  gt: mocks.gt,
  isNull: mocks.isNull,
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
  })),
}));

vi.mock("~/server/db/schema", () => ({
  passwordResetTokens: {
    expiresAt: "passwordResetTokens.expiresAt",
    tokenHash: "passwordResetTokens.tokenHash",
    usedAt: "passwordResetTokens.usedAt",
    userId: "passwordResetTokens.userId",
  },
  profiles: {
    role: "profiles.role",
    username: "profiles.username",
  },
  sessions: {
    userId: "sessions.userId",
  },
  userCredentials: {
    userId: "userCredentials.userId",
  },
  users: {
    authVersion: "users.authVersion",
    email: "users.email",
    id: "users.id",
  },
}));

vi.mock("~/server/db", () => ({
  db: {
    query: {
      profiles: {
        findFirst: vi.fn(),
      },
      users: {
        findFirst: vi.fn(),
      },
    },
    transaction: mocks.transaction,
  },
}));

const { resetPasswordWithToken } = await import("./password-reset");

describe("resetPasswordWithToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hash.mockResolvedValue("new-password-hash");
    mocks.returning.mockResolvedValue([]);
    mocks.where.mockReturnValue({
      returning: mocks.returning,
    });
    mocks.set.mockReturnValue({
      where: mocks.where,
    });
    mocks.update.mockReturnValue({
      set: mocks.set,
    });
    mocks.transaction.mockImplementation(
      async (callback: (transaction: unknown) => Promise<unknown>) =>
        callback({
          delete: vi.fn(() => ({
            where: vi.fn().mockResolvedValue(undefined),
          })),
          update: mocks.update,
        }),
    );
  });

  it("does not hash a new password when the reset token is invalid", async () => {
    const result = await resetPasswordWithToken({
      confirmPassword: "secret123",
      password: "secret123",
      token: "12345678901234567890",
    });

    expect(result).toEqual({ status: "invalid_token" });
    expect(mocks.hash).not.toHaveBeenCalled();
  });
});
