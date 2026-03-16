import { createHash } from "node:crypto";

import { and, eq, gt, lte, sql } from "drizzle-orm";

import { db } from "~/server/db";
import { requestRateLimits } from "~/server/db/schema";

type RateLimitInput = {
  action: string;
  limit: number;
  subject: string;
  windowMs: number;
};

type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
};

const TRUSTED_CLIENT_IP_HEADERS = [
  "x-vercel-forwarded-for",
  "cf-connecting-ip",
  "fly-client-ip",
  "fastly-client-ip",
  "true-client-ip",
] as const;
const FORWARDED_CLIENT_IP_HEADERS = ["x-forwarded-for", "x-real-ip"] as const;

function readClientIpCandidate(value: string | null) {
  const candidate = value?.split(",")[0]?.trim();
  return candidate && candidate.length > 0 ? candidate : null;
}

export function extractClientIp(input: Headers | Request | null | undefined) {
  const headers =
    input instanceof Request ? input.headers : input instanceof Headers ? input : null;
  if (!headers) {
    return null;
  }

  if (process.env.RATE_LIMIT_TRUST_FORWARD_HEADERS !== "true") {
    return null;
  }

  for (const headerName of TRUSTED_CLIENT_IP_HEADERS) {
    const candidate = readClientIpCandidate(headers.get(headerName));
    if (candidate) {
      return candidate;
    }
  }

  for (const headerName of FORWARDED_CLIENT_IP_HEADERS) {
    const candidate = readClientIpCandidate(headers.get(headerName));
    if (candidate) {
      return candidate;
    }
  }

  return null;
}

export function hashRateLimitSubject(subject: string) {
  return createHash("sha256").update(subject).digest("hex");
}

export async function consumeRateLimit(input: RateLimitInput): Promise<RateLimitResult> {
  const subjectHash = hashRateLimitSubject(input.subject);
  const now = Date.now();
  const nowDate = new Date(now);
  const bucketStartMs = Math.floor(now / input.windowMs) * input.windowMs;
  const bucketStart = new Date(bucketStartMs);
  const expiresAt = new Date(bucketStartMs + input.windowMs);
  const key = `${input.action}:${subjectHash}:${bucketStartMs}`;

  await db
    .delete(requestRateLimits)
    .where(lte(requestRateLimits.expiresAt, nowDate));

  const [row] = await db
    .insert(requestRateLimits)
    .values({
      key,
      action: input.action,
      subjectHash,
      bucketStart,
      expiresAt,
      count: 1,
    })
    .onConflictDoUpdate({
      target: requestRateLimits.key,
      set: {
        count: sql`${requestRateLimits.count} + 1`,
        updatedAt: new Date(),
      },
    })
    .returning();

  const count = row?.count ?? input.limit + 1;
  const retryAfterSeconds = Math.max(1, Math.ceil((expiresAt.getTime() - now) / 1000));

  return {
    allowed: count <= input.limit,
    retryAfterSeconds,
    remaining: Math.max(0, input.limit - count),
  };
}

export async function clearRateLimitBuckets(input: {
  action: string;
  subject: string;
}) {
  const now = new Date();
  await db
    .delete(requestRateLimits)
    .where(
      and(
        eq(requestRateLimits.action, input.action),
        eq(requestRateLimits.subjectHash, hashRateLimitSubject(input.subject)),
        gt(requestRateLimits.expiresAt, now),
      ),
    );
}
