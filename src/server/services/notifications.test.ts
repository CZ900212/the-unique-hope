import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  lookup: vi.fn(),
  onConflictDoUpdate: vi.fn(),
  values: vi.fn(),
}));

vi.mock("~/env", () => ({
  env: {
    NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY: "public-key",
    WEB_PUSH_ENABLED: "true",
    WEB_PUSH_PRIVATE_KEY: "private-key",
    WEB_PUSH_SUBJECT: "mailto:ops@example.com",
  },
}));

vi.mock("~/server/db", () => ({
  db: {
    insert: mocks.insert,
  },
}));

vi.mock("node:dns/promises", () => ({
  lookup: mocks.lookup,
}));

vi.mock("web-push", () => ({
  sendNotification: vi.fn(),
  setVapidDetails: vi.fn(),
}));

const { saveBrowserPushSubscription } = await import("./notifications");

describe("saveBrowserPushSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.insert.mockReturnValue({ values: mocks.values });
    mocks.values.mockReturnValue({
      onConflictDoUpdate: mocks.onConflictDoUpdate,
    });
    mocks.onConflictDoUpdate.mockResolvedValue(undefined);
    mocks.lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  });

  it("rejects unsafe endpoints before storing browser push subscriptions", async () => {
    await expect(
      saveBrowserPushSubscription({
        auth: "auth-key",
        endpoint: "https://127.0.0.1/internal",
        p256dh: "p256dh-key",
        profileId: "profile-1",
      }),
    ).rejects.toMatchObject({
      name: "UnsafeBrowserPushEndpointError",
      reason: "unsafe_ip",
    });

    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("stores subscriptions whose HTTPS endpoint resolves to public addresses", async () => {
    await saveBrowserPushSubscription({
      auth: "auth-key",
      endpoint: "https://push.example/subscription-1",
      expirationTime: null,
      p256dh: "p256dh-key",
      profileId: "profile-1",
      userAgent: "test-browser",
    });

    expect(mocks.lookup).toHaveBeenCalledWith("push.example", {
      all: true,
      verbatim: true,
    });
    expect(mocks.values).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: "auth-key",
        endpoint: "https://push.example/subscription-1",
        p256dh: "p256dh-key",
        profileId: "profile-1",
        userAgent: "test-browser",
      }),
    );
    expect(mocks.onConflictDoUpdate).toHaveBeenCalled();
  });
});
