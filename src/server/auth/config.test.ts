import type {
  CredentialInput,
  CredentialsConfig,
} from "@auth/core/providers/credentials";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.AUTH_SECRET ??= "test-auth-secret";
process.env.DATABASE_URL ??=
  "postgres://postgres:postgres@localhost:5432/unique_hope_test";
process.env.AUTH_URL ??= "https://uniquehopeclub.com";
process.env.NEXT_PUBLIC_APP_NAME ??= "The Unique Hope";
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";
process.env.NEXT_PUBLIC_DEFAULT_LOCALE ??= "en";
process.env.RATE_LIMIT_HASH_KEY ??= "test-rate-limit-hash-key-0123456789";

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
    <T extends CredentialsConfig<Record<string, CredentialInput>>>(config: T) =>
      config,
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

async function loadAuthConfig() {
  vi.resetModules();
  return (await import("./config")).authConfig;
}

describe("authConfig credential throttling", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.stubEnv("AUTH_TRUST_HOST", "true");
    vi.stubEnv("NODE_ENV", "test");

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

  it("clears the identifier and IP login buckets after a successful sign-in", async () => {
    const authConfig = await loadAuthConfig();
    const provider = authConfig.providers[0]!;

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

  it("clears only the identifier bucket when no trusted client IP is available", async () => {
    mocks.extractClientIp.mockReturnValue(null);
    mocks.consumeRateLimit.mockReset();
    mocks.consumeRateLimit.mockResolvedValueOnce({
      allowed: true,
      remaining: 4,
      retryAfterSeconds: 60,
    });
    const authConfig = await loadAuthConfig();
    const provider = authConfig.providers[0]!;

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
    expect(mocks.clearRateLimitBuckets).toHaveBeenCalledTimes(1);
    expect(mocks.clearRateLimitBuckets).toHaveBeenCalledWith({
      action: "login:identifier",
      subject: "teacher:teacher@example.com",
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

    const authConfig = await loadAuthConfig();
    const provider = authConfig.providers[0]!;

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

describe("authConfig trustHost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("defaults to trusting the host outside production when the env flag is unset", async () => {
    delete process.env.AUTH_TRUST_HOST;
    vi.stubEnv("NODE_ENV", "test");

    const authConfig = await loadAuthConfig();

    expect(authConfig.trustHost).toBe(true);
  });

  it("defaults to not trusting the host in production when the env flag is unset", async () => {
    delete process.env.AUTH_TRUST_HOST;
    vi.stubEnv("NODE_ENV", "production");

    const authConfig = await loadAuthConfig();

    expect(authConfig.trustHost).toBe(false);
  });

  it("honors an explicit AUTH_TRUST_HOST=false override", async () => {
    vi.stubEnv("AUTH_TRUST_HOST", "false");
    vi.stubEnv("NODE_ENV", "production");

    const authConfig = await loadAuthConfig();

    expect(authConfig.trustHost).toBe(false);
  });
});

describe("authConfig redirect callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("AUTH_URL", "https://uniquehopeclub.com");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    vi.stubEnv("NODE_ENV", "production");
  });

  it("pins relative sign-out redirects to the configured site URL", async () => {
    const authConfig = await loadAuthConfig();

    const redirectUrl = authConfig.callbacks.redirect?.({
      url: "/",
      baseUrl: "http://localhost:3000",
    });

    expect(redirectUrl).toBe("https://uniquehopeclub.com/");
  });

  it("rejects localhost callback URLs and falls back to the production homepage", async () => {
    const authConfig = await loadAuthConfig();

    const redirectUrl = authConfig.callbacks.redirect?.({
      url: "https://localhost:3000",
      baseUrl: "http://localhost:3000",
    });

    expect(redirectUrl).toBe("https://uniquehopeclub.com/");
  });

  it("allows absolute redirects that stay on the configured site", async () => {
    const authConfig = await loadAuthConfig();

    const redirectUrl = authConfig.callbacks.redirect?.({
      url: "https://uniquehopeclub.com/teacher?tab=schedule",
      baseUrl: "http://localhost:3000",
    });

    expect(redirectUrl).toBe("https://uniquehopeclub.com/teacher?tab=schedule");
  });

  it("rejects off-site absolute redirects", async () => {
    const authConfig = await loadAuthConfig();

    const redirectUrl = authConfig.callbacks.redirect?.({
      url: "https://example.com/logout",
      baseUrl: "http://localhost:3000",
    });

    expect(redirectUrl).toBe("https://uniquehopeclub.com/");
  });

  it("rejects protocol-relative off-site redirects", async () => {
    const authConfig = await loadAuthConfig();

    const redirectUrl = authConfig.callbacks.redirect?.({
      url: "//example.com/logout",
      baseUrl: "http://localhost:3000",
    });

    expect(redirectUrl).toBe("https://uniquehopeclub.com/");
  });
});
