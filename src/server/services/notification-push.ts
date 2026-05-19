import { lookup as lookupDns } from "node:dns/promises";
import { isIP } from "node:net";

import { and, eq, isNull, sql } from "drizzle-orm";
import * as webPush from "web-push";
import type { PushSubscription } from "web-push";

import { env } from "~/env";
import { db } from "~/server/db";
import {
  browserPushSubscriptions,
  notificationPushDeliveries,
  type userNotifications,
} from "~/server/db/schema";

const DEFAULT_DRAIN_LIMIT = 25;
const MAX_DRAIN_LIMIT = 100;
const MAX_PUSH_ATTEMPTS = 5;
const PROCESSING_STALE_MINUTES = 10;
const MAX_ERROR_MESSAGE_LENGTH = 1_000;

type BrowserPushDnsLookup = (
  hostname: string,
  options: { all: true; verbatim: true },
) => Promise<Array<{ address: string; family: number }>>;

type BrowserPushEndpointValidationResult =
  | { allowed: true }
  | { allowed: false; reason: string };

type WebPushConfig = {
  privateKey: string;
  publicKey: string;
  subject: string;
};

type ClaimedPushDelivery = {
  attempts: number;
  auth: string;
  bodyEn: string;
  browserPushSubscriptionId: string;
  deliveryId: string;
  endpoint: string;
  href: string | null;
  p256dh: string;
  recipientProfileId: string;
  titleEn: string;
  userNotificationId: string;
};

type PushErrorDetails = {
  code: string;
  message: string;
  statusCode: number | null;
};

type PushPayload = {
  body: string;
  title: string;
  url: string;
};

export class UnsafeBrowserPushEndpointError extends Error {
  constructor(readonly reason: string) {
    super("Browser push endpoint must use a public HTTPS push service.");
    this.name = "UnsafeBrowserPushEndpointError";
  }
}

export function getWebPushConfig(): WebPushConfig | null {
  if (env.WEB_PUSH_ENABLED !== "true") return null;
  if (
    !env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY ||
    !env.WEB_PUSH_PRIVATE_KEY ||
    !env.WEB_PUSH_SUBJECT
  ) {
    return null;
  }

  return {
    privateKey: env.WEB_PUSH_PRIVATE_KEY,
    publicKey: env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY,
    subject: env.WEB_PUSH_SUBJECT,
  };
}

export function getBrowserPushPublicKey() {
  return getWebPushConfig()?.publicKey ?? null;
}

export async function assertBrowserPushEndpointAllowed(endpoint: string) {
  const validation = await validateBrowserPushEndpoint(endpoint);
  if (!validation.allowed) {
    throw new UnsafeBrowserPushEndpointError(validation.reason);
  }
}

export async function validateBrowserPushEndpoint(
  endpoint: string,
  lookupHost: BrowserPushDnsLookup = lookupDns,
): Promise<BrowserPushEndpointValidationResult> {
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    return { allowed: false, reason: "invalid_url" };
  }

  if (parsed.protocol !== "https:") {
    return { allowed: false, reason: "non_https" };
  }

  const hostname = normalizeEndpointHostname(parsed.hostname);
  if (!hostname) {
    return { allowed: false, reason: "missing_hostname" };
  }

  if (isLocalHostname(hostname)) {
    return { allowed: false, reason: "local_hostname" };
  }

  const literalIpVersion = isIP(hostname);
  if (literalIpVersion) {
    return isPublicIpAddress(hostname, normalizeIpFamily(literalIpVersion))
      ? { allowed: true }
      : { allowed: false, reason: "unsafe_ip" };
  }

  if (!hostname.includes(".")) {
    return { allowed: false, reason: "non_public_hostname" };
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await lookupHost(hostname, { all: true, verbatim: true });
  } catch {
    return { allowed: false, reason: "unresolvable_hostname" };
  }

  if (addresses.length === 0) {
    return { allowed: false, reason: "unresolvable_hostname" };
  }

  return addresses.every(({ address, family }) =>
    isPublicIpAddress(address, family === 4 || family === 6 ? family : 0),
  )
    ? { allowed: true }
    : { allowed: false, reason: "unsafe_resolved_ip" };
}

export function buildPushPayload(
  notification: Pick<
    typeof userNotifications.$inferSelect,
    "bodyEn" | "href" | "titleEn"
  >,
): PushPayload {
  return {
    body: notification.bodyEn,
    title: notification.titleEn,
    url: notification.href ?? "/",
  };
}

export function getNextPushAttemptAt(attempts: number, now = new Date()) {
  const minutes = Math.min(5 * 2 ** Math.max(attempts - 1, 0), 360);
  return new Date(now.getTime() + minutes * 60_000);
}

export function getPushErrorDetails(
  error: unknown,
  endpoint?: string,
): PushErrorDetails {
  const errorLike = error as {
    body?: unknown;
    code?: unknown;
    message?: unknown;
    name?: unknown;
    statusCode?: unknown;
  };
  const statusCode =
    typeof errorLike.statusCode === "number" ? errorLike.statusCode : null;
  const code =
    typeof errorLike.code === "string"
      ? errorLike.code
      : typeof errorLike.name === "string"
        ? errorLike.name
        : statusCode
          ? `HTTP_${statusCode}`
          : "WEB_PUSH_ERROR";
  const rawMessage =
    typeof errorLike.message === "string"
      ? errorLike.message
      : typeof errorLike.body === "string"
        ? errorLike.body
        : "Web Push send failed";

  return {
    code: code.slice(0, 64),
    message: truncateErrorMessage(redactEndpoint(rawMessage, endpoint)),
    statusCode,
  };
}

export function shouldDisableSubscription(statusCode: number | null) {
  return statusCode === 404 || statusCode === 410;
}

function normalizeEndpointHostname(hostname: string) {
  const trimmed = hostname.trim().toLowerCase();
  const withoutBrackets =
    trimmed.startsWith("[") && trimmed.endsWith("]")
      ? trimmed.slice(1, -1)
      : trimmed;
  return withoutBrackets.endsWith(".")
    ? withoutBrackets.slice(0, -1)
    : withoutBrackets;
}

function isLocalHostname(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  );
}

function normalizeIpFamily(family: number): 4 | 6 | 0 {
  if (family === 4 || family === 6) return family;
  return 0;
}

function isPublicIpAddress(
  address: string,
  family: 4 | 6 | 0 = normalizeIpFamily(isIP(address)),
) {
  const normalized = normalizeEndpointHostname(address);
  if (family === 4) return isPublicIpv4Address(normalized);
  if (family === 6) return isPublicIpv6Address(normalized);
  return false;
}

function isPublicIpv4Address(address: string) {
  const octets = address.split(".").map((part) => Number.parseInt(part, 10));
  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return false;
  }

  const [a, b, c] = octets as [number, number, number, number];

  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  if (a >= 224) return false;

  return true;
}

function isPublicIpv6Address(address: string) {
  const normalized = normalizeEndpointHostname(address);
  if (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("::ffff:")
  ) {
    return false;
  }

  const first = Number.parseInt(normalized.split(":")[0] ?? "", 16);
  if (!Number.isInteger(first)) return false;
  if (first === 0) return false;
  if ((first & 0xfe00) === 0xfc00) return false;
  if ((first & 0xffc0) === 0xfe80) return false;
  if ((first & 0xff00) === 0xff00) return false;
  if (first === 0x2002) return false;

  if (first === 0x2001) {
    const second = Number.parseInt(normalized.split(":")[1] ?? "", 16);
    if (
      second === 0x2 ||
      second === 0xdb8 ||
      (second >= 0x10 && second <= 0x1f)
    ) {
      return false;
    }
  }

  return true;
}

export async function enqueueNotificationPushDeliveries(
  notification: typeof userNotifications.$inferSelect,
) {
  if (!getWebPushConfig()) return { queued: 0, skipped: "disabled" as const };

  const subscriptions = await db.query.browserPushSubscriptions.findMany({
    where: and(
      eq(browserPushSubscriptions.profileId, notification.recipientProfileId),
      isNull(browserPushSubscriptions.disabledAt),
    ),
    columns: {
      id: true,
    },
  });

  if (subscriptions.length === 0) return { queued: 0, skipped: null };

  await db
    .insert(notificationPushDeliveries)
    .values(
      subscriptions.map((subscription) => ({
        browserPushSubscriptionId: subscription.id,
        recipientProfileId: notification.recipientProfileId,
        userNotificationId: notification.id,
      })),
    )
    .onConflictDoNothing({
      target: [
        notificationPushDeliveries.userNotificationId,
        notificationPushDeliveries.browserPushSubscriptionId,
      ],
    });

  return { queued: subscriptions.length, skipped: null };
}

export async function drainNotificationPushDeliveries(options?: {
  limit?: number;
}) {
  const config = getWebPushConfig();
  if (!config) {
    return {
      claimed: 0,
      dead: 0,
      disabledSubscriptions: 0,
      enabled: false,
      errors: 0,
      retried: 0,
      sent: 0,
    };
  }

  configureWebPush(config);

  const rows = await claimPushDeliveries(options?.limit ?? DEFAULT_DRAIN_LIMIT);
  const result = {
    claimed: rows.length,
    dead: 0,
    disabledSubscriptions: 0,
    enabled: true,
    errors: 0,
    retried: 0,
    sent: 0,
  };

  for (const row of rows) {
    const outcome = await processPushDelivery(row, config);
    if (outcome === "sent") result.sent += 1;
    if (outcome === "retry") result.retried += 1;
    if (outcome === "dead") result.dead += 1;
    if (outcome === "disabled") {
      result.dead += 1;
      result.disabledSubscriptions += 1;
    }
  }

  return result;
}

async function claimPushDeliveries(limit: number) {
  const safeLimit = Math.max(1, Math.min(limit, MAX_DRAIN_LIMIT));
  const rows = await db.execute(sql`
    WITH claimed AS (
      SELECT d.id
      FROM unique_hope_notification_push_delivery d
      JOIN unique_hope_browser_push_subscription s
        ON s.id = d.browser_push_subscription_id
      WHERE s.disabled_at IS NULL
        AND (
          (d.status IN ('queued', 'failed') AND d.next_attempt_at <= now())
          OR (
            d.status = 'processing'
            AND d.last_attempt_at < now() - (${PROCESSING_STALE_MINUTES} * interval '1 minute')
          )
        )
      ORDER BY d.next_attempt_at ASC, d.created_at ASC
      LIMIT ${safeLimit}
      FOR UPDATE OF d SKIP LOCKED
    ),
    updated AS (
      UPDATE unique_hope_notification_push_delivery d
      SET
        status = 'processing',
        last_attempt_at = now(),
        updated_at = now()
      FROM claimed
      WHERE d.id = claimed.id
      RETURNING d.*
    )
    SELECT
      updated.id AS "deliveryId",
      updated.user_notification_id AS "userNotificationId",
      updated.recipient_profile_id AS "recipientProfileId",
      updated.browser_push_subscription_id AS "browserPushSubscriptionId",
      updated.attempts AS "attempts",
      n.title_en AS "titleEn",
      n.body_en AS "bodyEn",
      n.href AS "href",
      s.endpoint AS "endpoint",
      s.p256dh AS "p256dh",
      s.auth AS "auth"
    FROM updated
    JOIN unique_hope_user_notification n
      ON n.id = updated.user_notification_id
    JOIN unique_hope_browser_push_subscription s
      ON s.id = updated.browser_push_subscription_id
      AND s.disabled_at IS NULL
    ORDER BY updated.next_attempt_at ASC, updated.created_at ASC
  `);

  return Array.from(rows as unknown as ClaimedPushDelivery[]);
}

async function processPushDelivery(
  delivery: ClaimedPushDelivery,
  config: WebPushConfig,
) {
  const payload = buildPushPayload({
    bodyEn: delivery.bodyEn,
    href: delivery.href,
    titleEn: delivery.titleEn,
  });

  const subscription: PushSubscription = {
    endpoint: delivery.endpoint,
    keys: {
      auth: delivery.auth,
      p256dh: delivery.p256dh,
    },
  };

  try {
    const sendResult = await webPush.sendNotification(
      subscription,
      JSON.stringify(payload),
      {
        TTL: 60 * 60 * 24,
        urgency: "normal",
        vapidDetails: {
          privateKey: config.privateKey,
          publicKey: config.publicKey,
          subject: config.subject,
        },
      },
    );
    await markDeliverySent(delivery, sendResult.statusCode);
    return "sent" as const;
  } catch (error) {
    const nextAttempts = delivery.attempts + 1;
    const details = getPushErrorDetails(error, delivery.endpoint);

    if (shouldDisableSubscription(details.statusCode)) {
      await disableSubscriptionAndDeadLetter(delivery, details, nextAttempts);
      return "disabled" as const;
    }

    if (nextAttempts >= MAX_PUSH_ATTEMPTS) {
      const now = new Date();
      await markSubscriptionFailure(delivery, now);
      await markDeliveryDead(delivery, details, nextAttempts, now);
      return "dead" as const;
    }

    await markDeliveryForRetry(delivery, details, nextAttempts);
    return "retry" as const;
  }
}

async function markDeliverySent(
  delivery: ClaimedPushDelivery,
  statusCode: number,
) {
  const now = new Date();
  await db
    .update(notificationPushDeliveries)
    .set({
      lastErrorCode: null,
      lastErrorMessage: null,
      lastStatusCode: statusCode,
      sentAt: now,
      status: "sent",
      updatedAt: now,
    })
    .where(eq(notificationPushDeliveries.id, delivery.deliveryId));

  await db
    .update(browserPushSubscriptions)
    .set({
      failureCount: 0,
      lastErrorAt: null,
      lastSuccessAt: now,
      updatedAt: now,
    })
    .where(eq(browserPushSubscriptions.id, delivery.browserPushSubscriptionId));
}

async function disableSubscriptionAndDeadLetter(
  delivery: ClaimedPushDelivery,
  details: PushErrorDetails,
  attempts: number,
) {
  const now = new Date();
  await markSubscriptionFailure(delivery, now, true);

  await markDeliveryDead(delivery, details, attempts, now);
}

async function markDeliveryDead(
  delivery: ClaimedPushDelivery,
  details: PushErrorDetails,
  attempts: number,
  now = new Date(),
) {
  await updateFailedDelivery(delivery, details, attempts, "dead", now);
}

async function markDeliveryForRetry(
  delivery: ClaimedPushDelivery,
  details: PushErrorDetails,
  attempts: number,
) {
  const now = new Date();
  await updateFailedDelivery(delivery, details, attempts, "failed", now);
  await markSubscriptionFailure(delivery, now);
}

async function markSubscriptionFailure(
  delivery: ClaimedPushDelivery,
  now: Date,
  disabled = false,
) {
  await db
    .update(browserPushSubscriptions)
    .set({
      ...(disabled ? { disabledAt: now } : {}),
      failureCount: sql`${browserPushSubscriptions.failureCount} + 1`,
      lastErrorAt: now,
      updatedAt: now,
    })
    .where(eq(browserPushSubscriptions.id, delivery.browserPushSubscriptionId));
}

async function updateFailedDelivery(
  delivery: ClaimedPushDelivery,
  details: PushErrorDetails,
  attempts: number,
  status: "dead" | "failed",
  now: Date,
) {
  await db
    .update(notificationPushDeliveries)
    .set({
      attempts,
      lastErrorCode: details.code,
      lastErrorMessage: details.message,
      lastStatusCode: details.statusCode,
      nextAttemptAt:
        status === "failed" ? getNextPushAttemptAt(attempts, now) : now,
      status,
      updatedAt: now,
    })
    .where(eq(notificationPushDeliveries.id, delivery.deliveryId));
}

function configureWebPush(config: WebPushConfig) {
  webPush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
}

function truncateErrorMessage(message: string) {
  return message.length > MAX_ERROR_MESSAGE_LENGTH
    ? `${message.slice(0, MAX_ERROR_MESSAGE_LENGTH - 3)}...`
    : message;
}

function redactEndpoint(message: string, endpoint?: string) {
  return endpoint ? message.replaceAll(endpoint, "[push-endpoint]") : message;
}
