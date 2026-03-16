import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CredentialsConfig, CredentialInput } from "@auth/core/providers/credentials";

const mocks = vi.hoisted(() => ({
  clearRateLimitBuckets: vi.fn(),
  compare: vi.fn(),
  consumeRateLimit: vi.fn(),
  extractClientIp: vi.fn(),
  findProfile: vi.fn(),
  findUser: vi.fn(),
}));

vi.mock("@auth/drizzle-adapter", () => ({
  DrizzleAdapter: vi.fn(() => ({})),
}));

vi.mock("next-auth", () => ({
  CredentialsSignin: class CredentialsSignin extends Error {},
}));

vi.mock("next-auth/providers/credentials", () => ({
  default: vi.fn(
    <T extends CredentialsConfig<Record<string, CredentialInput>>>(config: T) => config,
  ),
}));

vi.mock("next/server", () => ({}));

vi.mock("bcryptjs", () => ({
  compare: mocks.compare,
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn(() => "and-clause"),
  eq: vi.fn(() => "eq-clause"),
}));

vi.mock("~/server/db", () => ({
  db: {
    query: {
      profiles: {
        findFirst: mocks.findProfile,
      },
      users: {
        findFirst: mocks.findUser,
      },
    },
  },
}));

vi.mock("~/server/db/schema", () => ({
  accounts: {},
  profiles: {
    role: "role",
    username: "username",
  },
  sessions: {},
  users: {
    email: "email",
  },
  verificationTokens: {},
}));

vi.mock("~/server/rate-limit", () => ({
  clearRateLimitBuckets: mocks.clearRateLimitBuckets,
  consumeRateLimit: mocks.consumeRateLimit,
  extractClientIp: mocks.extractClientIp,
}));

const { authConfig } = await import("./config");

describe("authConfig credential throttling", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.extractClientIp.mockReturnValue("203.0.113.10");
    mocks.consumeRateLimit
      .mockResolvedValueOnce({
        allowed: true,
        remaining: 4,
        retryAfterSeconds: 60,
      })
      .mockResolvedValueOnce({
        allowed: true,
        remaining: 9,
        retryAfterSeconds: 60,
      });
    mocks.findUser.mockResolvedValue({
      authVersion: 3,
      credential: {
        passwordHash: "stored-hash",
      },
      email: "teacher@example.com",
      id: "user-1",
      name: "Teacher Example",
      profile: {
        contact: "wechat",
        name: "Teacher Example",
        role: "teacher",
        username: "teacher.example",
      },
    });
    mocks.compare.mockResolvedValue(true);
  });

  it("clears both login buckets after a successful sign-in", async () => {
    const provider = authConfig.providers[0] as CredentialsConfig<
      Record<string, CredentialInput>
    >;

    const result = await provider.authorize(
      {
        identifier: "teacher@example.com",
        password: "secret123",
        role: "teacher",
      },
      new Request("http://localhost/login", { headers: new Headers() }),
    );

    expect(result).toMatchObject({
      id: "user-1",
      role: "teacher",
    });
    expect(mocks.clearRateLimitBuckets).toHaveBeenCalledTimes(2);
    expect(mocks.clearRateLimitBuckets).toHaveBeenCalledWith({
      action: "login:identifier",
      subject: "teacher:teacher@example.com",
    });
    expect(mocks.clearRateLimitBuckets).toHaveBeenCalledWith({
      action: "login:ip",
      subject: "203.0.113.10",
    });
  });

  it("allows admin credentials without a separate entry cookie", async () => {
    mocks.consumeRateLimit.mockReset();
    mocks.consumeRateLimit
      .mockResolvedValueOnce({
        allowed: true,
        remaining: 2,
        retryAfterSeconds: 60,
      })
      .mockResolvedValueOnce({
        allowed: true,
        remaining: 4,
        retryAfterSeconds: 60,
      });
    mocks.findUser.mockResolvedValue({
      authVersion: 5,
      credential: {
        passwordHash: "stored-hash",
      },
      email: "admin@theuniquehope.org",
      id: "user-admin",
      name: "Admin Example",
      profile: {
        contact: "",
        name: "Admin Example",
        role: "admin",
        username: "admin",
      },
    });

    const provider = authConfig.providers[0] as CredentialsConfig<
      Record<string, CredentialInput>
    >;

    const result = await provider.authorize(
      {
        identifier: "admin@theuniquehope.org",
        password: "secret123",
        role: "admin",
      },
      new Request("http://localhost/admin/login", { headers: new Headers() }),
    );

    expect(result).toMatchObject({
      id: "user-admin",
      role: "admin",
      username: "admin",
    });
  });
});
