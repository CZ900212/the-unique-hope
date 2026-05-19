import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const env: { WEB_PUSH_DRAIN_SECRET?: string } = {
    WEB_PUSH_DRAIN_SECRET: "a-long-drain-secret-for-tests",
  };

  return {
    drainNotificationPushDeliveries: vi.fn(),
    env,
  };
});

vi.mock("~/env", () => ({
  env: mocks.env,
}));

vi.mock("~/server/services/notification-push", () => ({
  drainNotificationPushDeliveries: mocks.drainNotificationPushDeliveries,
}));

const { POST } = await import("./route");

describe("POST /api/notifications/push/drain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.env.WEB_PUSH_DRAIN_SECRET = "a-long-drain-secret-for-tests";
    mocks.drainNotificationPushDeliveries.mockResolvedValue({
      claimed: 1,
      enabled: true,
      sent: 1,
    });
  });

  it("rejects requests when the drain secret is not configured", async () => {
    mocks.env.WEB_PUSH_DRAIN_SECRET = undefined;

    const response = await POST(new Request("http://localhost/api"));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: "web_push_drain_not_configured",
      ok: false,
    });
    expect(mocks.drainNotificationPushDeliveries).not.toHaveBeenCalled();
  });

  it("rejects requests without the bearer secret", async () => {
    const response = await POST(new Request("http://localhost/api"));

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      error: "unauthorized",
      ok: false,
    });
    expect(mocks.drainNotificationPushDeliveries).not.toHaveBeenCalled();
  });

  it("drains deliveries when the bearer secret matches", async () => {
    const response = await POST(
      new Request("http://localhost/api", {
        headers: {
          authorization: "Bearer a-long-drain-secret-for-tests",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      claimed: 1,
      ok: true,
      sent: 1,
    });
    expect(mocks.drainNotificationPushDeliveries).toHaveBeenCalledTimes(1);
  });
});
