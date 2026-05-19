import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const env: {
    NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY?: string;
    WEB_PUSH_ENABLED?: string;
    WEB_PUSH_PRIVATE_KEY?: string;
    WEB_PUSH_SUBJECT?: string;
  } = {
    NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY: "public-key",
    WEB_PUSH_ENABLED: "true",
    WEB_PUSH_PRIVATE_KEY: "private-key",
    WEB_PUSH_SUBJECT: "mailto:ops@example.com",
  };
  const findMany = vi.fn();
  const insert = vi.fn();
  const values = vi.fn();
  const onConflictDoNothing = vi.fn();
  const execute = vi.fn();
  const update = vi.fn();
  const lookup = vi.fn();
  const set = vi.fn();
  const where = vi.fn();
  const sendNotification = vi.fn();
  const setVapidDetails = vi.fn();

  return {
    env,
    execute,
    findMany,
    insert,
    lookup,
    onConflictDoNothing,
    sendNotification,
    set,
    setVapidDetails,
    update,
    values,
    where,
  };
});

vi.mock("~/env", () => ({
  env: mocks.env,
}));

vi.mock("~/server/db", () => ({
  db: {
    execute: mocks.execute,
    insert: mocks.insert,
    query: {
      browserPushSubscriptions: {
        findMany: mocks.findMany,
      },
    },
    update: mocks.update,
  },
}));

vi.mock("web-push", () => ({
  sendNotification: mocks.sendNotification,
  setVapidDetails: mocks.setVapidDetails,
}));

vi.mock("node:dns/promises", () => ({
  lookup: mocks.lookup,
}));

const {
  buildPushPayload,
  drainNotificationPushDeliveries,
  enqueueNotificationPushDeliveries,
  getNextPushAttemptAt,
  getPushErrorDetails,
  getWebPushConfig,
  shouldDisableSubscription,
  validateBrowserPushEndpoint,
} = await import("./notification-push");

const notification = {
  actorProfileId: null,
  appointmentId: "appointment-1",
  bodyEn: "A lesson was confirmed.",
  bodyZh: "Lesson confirmed zh.",
  createdAt: new Date("2026-05-01T00:00:00Z"),
  href: "/student?view=booking",
  id: "notification-1",
  readAt: null,
  recipientProfileId: "profile-1",
  titleEn: "Lesson confirmed",
  titleZh: "Lesson confirmed zh",
  type: "appointment_confirmed",
};

function claimedDelivery(overrides: Record<string, unknown> = {}) {
  return {
    attempts: 0,
    auth: "auth-key",
    bodyEn: "A lesson was confirmed.",
    browserPushSubscriptionId: "subscription-1",
    deliveryId: "delivery-1",
    endpoint: "https://push.example/subscription-1",
    href: "/student?view=booking",
    p256dh: "p256dh-key",
    recipientProfileId: "profile-1",
    titleEn: "Lesson confirmed",
    userNotificationId: "notification-1",
    ...overrides,
  };
}

function getSetInputs() {
  return mocks.set.mock.calls.map(
    ([input]) => input as Record<string, unknown>,
  );
}

describe("notification push delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mocks.env, {
      NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY: "public-key",
      WEB_PUSH_ENABLED: "true",
      WEB_PUSH_PRIVATE_KEY: "private-key",
      WEB_PUSH_SUBJECT: "mailto:ops@example.com",
    });
    mocks.insert.mockReturnValue({ values: mocks.values });
    mocks.values.mockReturnValue({
      onConflictDoNothing: mocks.onConflictDoNothing,
    });
    mocks.onConflictDoNothing.mockResolvedValue(undefined);
    mocks.update.mockReturnValue({ set: mocks.set });
    mocks.set.mockReturnValue({ where: mocks.where });
    mocks.where.mockResolvedValue(undefined);
    mocks.lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  });

  it("does not enqueue deliveries when Web Push is disabled", async () => {
    mocks.env.WEB_PUSH_ENABLED = "false";

    const result = await enqueueNotificationPushDeliveries(notification);

    expect(result).toEqual({ queued: 0, skipped: "disabled" });
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("creates one delivery per active browser subscription", async () => {
    mocks.findMany.mockResolvedValue([{ id: "sub-1" }, { id: "sub-2" }]);

    const result = await enqueueNotificationPushDeliveries(notification);

    expect(result).toEqual({ queued: 2, skipped: null });
    expect(mocks.values).toHaveBeenCalledWith([
      {
        browserPushSubscriptionId: "sub-1",
        recipientProfileId: "profile-1",
        userNotificationId: "notification-1",
      },
      {
        browserPushSubscriptionId: "sub-2",
        recipientProfileId: "profile-1",
        userNotificationId: "notification-1",
      },
    ]);
    expect(mocks.onConflictDoNothing).toHaveBeenCalled();
  });

  it("marks successful sends as sent", async () => {
    mocks.execute.mockResolvedValue([claimedDelivery()]);
    mocks.sendNotification.mockResolvedValue({ headers: {}, statusCode: 201 });

    const result = await drainNotificationPushDeliveries();

    expect(result).toMatchObject({ claimed: 1, sent: 1 });
    expect(mocks.setVapidDetails).toHaveBeenCalledWith(
      "mailto:ops@example.com",
      "public-key",
      "private-key",
    );
    expect(mocks.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "https://push.example/subscription-1",
      }),
      JSON.stringify({
        body: "A lesson was confirmed.",
        title: "Lesson confirmed",
        url: "/student?view=booking",
      }),
      expect.any(Object),
    );
    expect(
      getSetInputs().some(
        (input) => input.status === "sent" && input.sentAt instanceof Date,
      ),
    ).toBe(true);
  });

  it("disables expired subscriptions after 404 or 410 responses", async () => {
    mocks.execute.mockResolvedValue([claimedDelivery()]);
    mocks.sendNotification.mockRejectedValue({
      message: "gone https://push.example/subscription-1",
      statusCode: 410,
    });

    const result = await drainNotificationPushDeliveries();

    expect(result).toMatchObject({
      claimed: 1,
      dead: 1,
      disabledSubscriptions: 1,
    });
    expect(
      getSetInputs().some((input) => input.disabledAt instanceof Date),
    ).toBe(true);
    expect(
      getSetInputs().some(
        (input) =>
          input.lastErrorMessage === "gone [push-endpoint]" &&
          input.status === "dead",
      ),
    ).toBe(true);
  });

  it("retries temporary failures with backoff", async () => {
    mocks.execute.mockResolvedValue([claimedDelivery()]);
    mocks.sendNotification.mockRejectedValue({
      message: "service unavailable",
      statusCode: 503,
    });

    const result = await drainNotificationPushDeliveries();

    expect(result).toMatchObject({ claimed: 1, retried: 1 });
    expect(
      getSetInputs().some(
        (input) =>
          input.attempts === 1 &&
          input.nextAttemptAt instanceof Date &&
          input.status === "failed",
      ),
    ).toBe(true);
  });

  it("dead-letters a delivery after the maximum retry count", async () => {
    mocks.execute.mockResolvedValue([claimedDelivery({ attempts: 4 })]);
    mocks.sendNotification.mockRejectedValue({
      message: "still failing",
      statusCode: 503,
    });

    const result = await drainNotificationPushDeliveries();

    expect(result).toMatchObject({ claimed: 1, dead: 1 });
    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({ attempts: 5, status: "dead" }),
    );
  });
});

describe("notification push helpers", () => {
  it("requires enabled Web Push and all VAPID values", () => {
    expect(getWebPushConfig()).toMatchObject({
      privateKey: "private-key",
      publicKey: "public-key",
      subject: "mailto:ops@example.com",
    });

    mocks.env.WEB_PUSH_PRIVATE_KEY = undefined;
    expect(getWebPushConfig()).toBeNull();
  });

  it("builds the minimal push payload", () => {
    expect(buildPushPayload(notification)).toEqual({
      body: "A lesson was confirmed.",
      title: "Lesson confirmed",
      url: "/student?view=booking",
    });
  });

  it("classifies disabled subscription status codes", () => {
    expect(shouldDisableSubscription(404)).toBe(true);
    expect(shouldDisableSubscription(410)).toBe(true);
    expect(shouldDisableSubscription(503)).toBe(false);
    expect(shouldDisableSubscription(null)).toBe(false);
  });

  it("calculates exponential retry timing", () => {
    const now = new Date("2026-05-01T00:00:00Z");

    expect(getNextPushAttemptAt(1, now).toISOString()).toBe(
      "2026-05-01T00:05:00.000Z",
    );
    expect(getNextPushAttemptAt(3, now).toISOString()).toBe(
      "2026-05-01T00:20:00.000Z",
    );
  });

  it("redacts push endpoints from stored error messages", () => {
    expect(
      getPushErrorDetails(
        {
          message: "failed for https://push.example/secret-endpoint",
          statusCode: 503,
        },
        "https://push.example/secret-endpoint",
      ),
    ).toMatchObject({
      message: "failed for [push-endpoint]",
      statusCode: 503,
    });
  });

  it.each([
    "http://push.example/subscription-1",
    "https://127.0.0.1/internal",
    "https://localhost/internal",
    "https://10.0.0.10/internal",
    "https://169.254.169.254/latest/meta-data",
    "https://[::1]/internal",
  ])("rejects unsafe browser push endpoints: %s", async (endpoint) => {
    await expect(validateBrowserPushEndpoint(endpoint)).resolves.toMatchObject({
      allowed: false,
    });
  });

  it("accepts an HTTPS endpoint only when DNS resolves to public addresses", async () => {
    mocks.lookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "2606:4700:4700::1111", family: 6 },
    ]);

    await expect(
      validateBrowserPushEndpoint("https://push.example/subscription-1"),
    ).resolves.toEqual({ allowed: true });
    expect(mocks.lookup).toHaveBeenCalledWith("push.example", {
      all: true,
      verbatim: true,
    });
  });

  it("rejects hostnames that resolve to private or local addresses", async () => {
    mocks.lookup.mockResolvedValue([{ address: "192.168.1.10", family: 4 }]);

    await expect(
      validateBrowserPushEndpoint("https://push.example/subscription-1"),
    ).resolves.toEqual({
      allowed: false,
      reason: "unsafe_resolved_ip",
    });
  });

  it("rejects hostnames that cannot be resolved", async () => {
    mocks.lookup.mockRejectedValue(new Error("ENOTFOUND"));

    await expect(
      validateBrowserPushEndpoint("https://push.example/subscription-1"),
    ).resolves.toEqual({
      allowed: false,
      reason: "unresolvable_hostname",
    });
  });
});
