import { createHash, createHmac, randomBytes, randomInt } from "node:crypto";

import { TRPCError } from "@trpc/server";
import { hash } from "bcryptjs";
import { and, desc, eq, gt, isNotNull, isNull, sql } from "drizzle-orm";

import { env } from "~/env";
import {
  phonePasswordResetConfirmSchema,
  phonePasswordResetManualRequestSchema,
  phonePasswordResetRequestSchema,
  phonePasswordResetVerifySchema,
} from "~/lib/domain";
import { getMessages, type Locale } from "~/lib/i18n";
import { db } from "~/server/db";
import {
  adminRecoveryRequests,
  passwordResetSessions,
  profiles,
  sessions,
  smsVerificationCodes,
  studentRecoveryPhones,
  userCredentials,
  users,
} from "~/server/db/schema";
import { consumeRateLimit, extractClientIp } from "~/server/rate-limit";

const BCRYPT_ROUNDS = 12;
const CODE_TTL_MS = 10 * 60 * 1000;
const RESET_SESSION_TTL_MS = 15 * 60 * 1000;
const SMS_CODE_MAX_ATTEMPTS = 5;
const SMS_PROVIDER_LOCAL = "local_console";
const SMS_PROVIDER_TENCENT = "tencent_sms";
const COMMON_WEAK_PASSWORDS = new Set([
  "12345678",
  "123456789",
  "password",
  "password1",
  "qwerty123",
  "11111111",
  "88888888",
]);

export class SmsDeliveryError extends Error {
  constructor(cause: unknown) {
    super("Failed to deliver password reset SMS.", { cause });
    this.name = "SmsDeliveryError";
  }
}

export function normalizeRecoveryPhone(input: string) {
  const compact = input.trim().replaceAll(/[\s\-()]/g, "");
  const international = compact.startsWith("00")
    ? `+${compact.slice(2)}`
    : compact;

  if (/^1[3-9][0-9]{9}$/.test(international)) {
    return `+86${international}`;
  }

  if (/^86[1-9][0-9]{10}$/.test(international)) {
    return `+${international}`;
  }

  if (/^\+[1-9][0-9]{7,14}$/.test(international)) {
    return international;
  }

  if (/^[1-9][0-9]{7,14}$/.test(international)) {
    return `+${international}`;
  }

  throw new Error("Invalid phone number.");
}

export function maskRecoveryPhone(normalizedPhone: string) {
  const digits = normalizedPhone.replaceAll(/\D/g, "");
  const last4 = digits.slice(-4);
  if (normalizedPhone.startsWith("+86") && digits.length >= 11) {
    const national = digits.slice(-11);
    return `+86 ${national.slice(0, 3)}****${last4}`;
  }

  return `${normalizedPhone.slice(0, Math.min(4, normalizedPhone.length))}****${last4}`;
}

export function getRecoveryPhoneLast4(normalizedPhone: string) {
  return normalizedPhone.replaceAll(/\D/g, "").slice(-4);
}

export function hashRecoveryPhone(normalizedPhone: string) {
  return hmacHex(`phone:${normalizedPhone}`);
}

export function hashPasswordResetSessionToken(token: string) {
  return sha256Hex(token);
}

export function isPhonePasswordResetSmsConfigured() {
  return Boolean(
    env.TENCENTCLOUD_SECRET_ID &&
    env.TENCENTCLOUD_SECRET_KEY &&
    env.TENCENT_SMS_SDK_APP_ID &&
    env.TENCENT_SMS_SIGN_NAME &&
    env.TENCENT_SMS_TEMPLATE_ID_PASSWORD_RESET,
  );
}

export function isLocalSmsPreviewAllowed() {
  return process.env.NODE_ENV !== "production";
}

export async function requestPhonePasswordReset(input: {
  headers: Headers;
  locale: Locale;
  phone: string;
}) {
  const parsed = phonePasswordResetRequestSchema.parse({ phone: input.phone });
  const normalizedPhone = normalizeRecoveryPhone(parsed.phone);
  const phoneHash = hashRecoveryPhone(normalizedPhone);
  const phoneMasked = maskRecoveryPhone(normalizedPhone);
  const userAgent = input.headers.get("user-agent") ?? "";
  const smsConfigured = isPhonePasswordResetSmsConfigured();
  const localPreviewAllowed = isLocalSmsPreviewAllowed();

  if (!smsConfigured && !localPreviewAllowed) {
    return { status: "unavailable" as const };
  }

  const rateLimit = await enforcePhonePasswordResetSmsRateLimits({
    headers: input.headers,
    phoneHash,
  });
  if (!rateLimit.allowed) {
    return {
      status: "rate_limited" as const,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    };
  }

  const candidates = await findActiveStudentRecoveryCandidates(phoneHash);
  if (candidates.length === 0) {
    return { status: "queued" as const };
  }

  const code = createSmsCode();
  const now = new Date();
  const provider = smsConfigured ? SMS_PROVIDER_TENCENT : SMS_PROVIDER_LOCAL;
  const [verification] = await db
    .insert(smsVerificationCodes)
    .values({
      phoneHash,
      purpose: "password_reset",
      codeHash: hashSmsCode(phoneHash, code),
      expiresAt: new Date(now.getTime() + CODE_TTL_MS),
      maxAttempts: SMS_CODE_MAX_ATTEMPTS,
      sentAt: now,
      provider,
      requestIpHash: rateLimit.clientIp
        ? hashAuxiliaryValue(`ip:${rateLimit.clientIp}`)
        : null,
      requestUserAgentHash: userAgent
        ? hashAuxiliaryValue(`ua:${userAgent}`)
        : null,
    })
    .returning();

  if (!verification) {
    throw new Error("Failed to persist SMS verification code.");
  }

  try {
    const providerMessageId = smsConfigured
      ? await sendTencentPasswordResetSms({
          code,
          phone: normalizedPhone,
        })
      : logLocalSmsPreview({ code, phoneMasked });

    if (providerMessageId) {
      await db
        .update(smsVerificationCodes)
        .set({ providerMessageId })
        .where(eq(smsVerificationCodes.id, verification.id));
    }
  } catch (error) {
    throw new SmsDeliveryError(error);
  }

  return { status: "queued" as const };
}

export async function verifyPhonePasswordResetCode(input: {
  code: string;
  headers: Headers;
  phone: string;
}) {
  const parsed = phonePasswordResetVerifySchema.parse({
    code: input.code,
    phone: input.phone,
  });
  const normalizedPhone = normalizeRecoveryPhone(parsed.phone);
  const phoneHash = hashRecoveryPhone(normalizedPhone);
  const now = new Date();
  const [verification] = await db
    .select()
    .from(smsVerificationCodes)
    .where(
      and(
        eq(smsVerificationCodes.phoneHash, phoneHash),
        eq(smsVerificationCodes.purpose, "password_reset"),
        isNull(smsVerificationCodes.consumedAt),
        gt(smsVerificationCodes.expiresAt, now),
      ),
    )
    .orderBy(desc(smsVerificationCodes.createdAt))
    .limit(1);

  if (!verification || verification.attemptCount >= verification.maxAttempts) {
    return { status: "invalid_code" as const };
  }

  const expectedHash = hashSmsCode(phoneHash, parsed.code);
  if (verification.codeHash !== expectedHash) {
    const nextAttemptCount = verification.attemptCount + 1;
    const updateValues =
      nextAttemptCount >= verification.maxAttempts
        ? { attemptCount: nextAttemptCount, consumedAt: now }
        : { attemptCount: nextAttemptCount };
    await db
      .update(smsVerificationCodes)
      .set(updateValues)
      .where(eq(smsVerificationCodes.id, verification.id));
    return { status: "invalid_code" as const };
  }

  const candidates = await findActiveStudentRecoveryCandidates(phoneHash);
  if (candidates.length === 0) {
    await consumeSmsVerification(verification.id, now);
    return { status: "invalid_code" as const };
  }

  await db
    .update(studentRecoveryPhones)
    .set({
      updatedAt: now,
      verifiedAt: now,
    })
    .where(
      and(
        eq(studentRecoveryPhones.phoneHash, phoneHash),
        eq(studentRecoveryPhones.status, "active"),
        isNull(studentRecoveryPhones.verifiedAt),
      ),
    );
  await db
    .update(studentRecoveryPhones)
    .set({
      lastVerifiedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(studentRecoveryPhones.phoneHash, phoneHash),
        eq(studentRecoveryPhones.status, "active"),
      ),
    );

  const token = createResetSessionToken(
    candidates.length === 1 ? "rst" : "rman",
  );
  const clientIp = extractClientIp(input.headers);
  const userAgent = input.headers.get("user-agent") ?? "";
  const [resetSession] = await db
    .insert(passwordResetSessions)
    .values({
      tokenHash: hashPasswordResetSessionToken(token),
      userId: candidates.length === 1 ? candidates[0]!.userId : null,
      phoneHash,
      smsCodeId: verification.id,
      expiresAt: new Date(now.getTime() + RESET_SESSION_TTL_MS),
      createdIpHash: clientIp ? hashAuxiliaryValue(`ip:${clientIp}`) : null,
      createdUserAgentHash: userAgent
        ? hashAuxiliaryValue(`ua:${userAgent}`)
        : null,
    })
    .returning();

  if (!resetSession) {
    throw new Error("Failed to create password reset session.");
  }

  await consumeSmsVerification(verification.id, now);

  if (candidates.length === 1) {
    return { status: "ready" as const, token };
  }

  return { status: "manual_required" as const, token };
}

export async function createManualRecoveryRequest(input: {
  applicantNote: string;
  studentAge?: number | null;
  studentName: string;
  token: string;
}) {
  const parsed = phonePasswordResetManualRequestSchema.parse(input);
  const now = new Date();
  const tokenHash = hashPasswordResetSessionToken(parsed.token);
  const session = await db.query.passwordResetSessions.findFirst({
    where: and(
      eq(passwordResetSessions.tokenHash, tokenHash),
      isNull(passwordResetSessions.userId),
      isNull(passwordResetSessions.consumedAt),
      gt(passwordResetSessions.expiresAt, now),
    ),
  });

  if (!session) {
    return { status: "invalid_token" as const };
  }

  const pending = await db.query.adminRecoveryRequests.findFirst({
    where: and(
      eq(adminRecoveryRequests.phoneHash, session.phoneHash),
      eq(adminRecoveryRequests.status, "pending"),
    ),
  });
  if (pending) {
    await consumeResetSession(session.id, now);
    return { status: "queued" as const };
  }

  const candidates = await findActiveStudentRecoveryCandidates(
    session.phoneHash,
  );
  await db.insert(adminRecoveryRequests).values({
    phoneHash: session.phoneHash,
    phoneMasked: candidates[0]?.phoneMasked ?? "unknown",
    candidateCount: candidates.length,
    applicantStudentName: parsed.studentName,
    applicantStudentAge: parsed.studentAge ?? null,
    applicantNote: parsed.applicantNote,
  });
  await consumeResetSession(session.id, now);

  return { status: "queued" as const };
}

export async function resetPasswordWithPhoneSession(input: {
  confirmPassword: string;
  password: string;
  token: string;
}) {
  const parsed = phonePasswordResetConfirmSchema.parse(input);
  const tokenHash = hashPasswordResetSessionToken(parsed.token);
  const now = new Date();

  return db.transaction(async (tx) => {
    const session = await tx.query.passwordResetSessions.findFirst({
      where: and(
        eq(passwordResetSessions.tokenHash, tokenHash),
        isNotNull(passwordResetSessions.userId),
        isNull(passwordResetSessions.consumedAt),
        gt(passwordResetSessions.expiresAt, now),
      ),
    });

    if (!session?.userId) {
      return { status: "invalid_token" as const };
    }

    if (isWeakRecoveryPassword(parsed.password, session.phoneHash)) {
      return { status: "weak_password" as const };
    }

    const [claimedSession] = await tx
      .update(passwordResetSessions)
      .set({
        consumedAt: now,
        attemptCount: sql`${passwordResetSessions.attemptCount} + 1`,
      })
      .where(
        and(
          eq(passwordResetSessions.id, session.id),
          isNull(passwordResetSessions.consumedAt),
        ),
      )
      .returning();

    if (!claimedSession) {
      return { status: "invalid_token" as const };
    }

    const passwordHash = await hash(parsed.password, BCRYPT_ROUNDS);

    await tx
      .update(userCredentials)
      .set({
        passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(userCredentials.userId, session.userId));

    await tx
      .update(users)
      .set({
        authVersion: sql`${users.authVersion} + 1`,
      })
      .where(eq(users.id, session.userId));

    await tx.delete(sessions).where(eq(sessions.userId, session.userId));

    return { status: "success" as const };
  });
}

export async function listAdminRecoveryRequests() {
  const requests = await db
    .select()
    .from(adminRecoveryRequests)
    .orderBy(desc(adminRecoveryRequests.createdAt))
    .limit(100);

  return Promise.all(
    requests.map(async (request) => ({
      ...request,
      candidates: await findActiveStudentRecoveryCandidates(request.phoneHash),
    })),
  );
}

export async function markAdminRecoveryRequest(input: {
  adminUserId: string;
  requestId: string;
  status: "completed" | "rejected";
}) {
  const now = new Date();
  await db
    .update(adminRecoveryRequests)
    .set({
      reviewedByAdminId: input.adminUserId,
      reviewedAt: now,
      completedAt: input.status === "completed" ? now : null,
      status: input.status,
    })
    .where(eq(adminRecoveryRequests.id, input.requestId));
}

export async function createAdminRecoveryResetUrl(input: {
  requestId: string;
  userId: string;
}) {
  const request = await db.query.adminRecoveryRequests.findFirst({
    where: eq(adminRecoveryRequests.id, input.requestId),
  });
  if (!request) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }

  const candidates = await findActiveStudentRecoveryCandidates(
    request.phoneHash,
  );
  const selected = candidates.find(
    (candidate) => candidate.userId === input.userId,
  );
  if (!selected) {
    throw new TRPCError({ code: "BAD_REQUEST" });
  }

  const token = createResetSessionToken("rst");
  await db.insert(passwordResetSessions).values({
    tokenHash: hashPasswordResetSessionToken(token),
    userId: input.userId,
    phoneHash: request.phoneHash,
    smsCodeId: await createSyntheticAdminSmsCode(request.phoneHash),
    expiresAt: new Date(Date.now() + RESET_SESSION_TTL_MS),
  });

  return new URL(
    `/reset-password?token=${encodeURIComponent(token)}`,
    env.NEXT_PUBLIC_APP_URL,
  ).toString();
}

async function findActiveStudentRecoveryCandidates(phoneHash: string) {
  const rows = await db
    .select({
      name: profiles.name,
      phoneMasked: studentRecoveryPhones.phoneMasked,
      userId: studentRecoveryPhones.userId,
      username: profiles.username,
    })
    .from(studentRecoveryPhones)
    .innerJoin(users, eq(users.id, studentRecoveryPhones.userId))
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .innerJoin(userCredentials, eq(userCredentials.userId, users.id))
    .where(
      and(
        eq(studentRecoveryPhones.phoneHash, phoneHash),
        eq(studentRecoveryPhones.status, "active"),
        eq(profiles.role, "student"),
      ),
    );

  const byUserId = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    byUserId.set(row.userId, row);
  }

  return Array.from(byUserId.values());
}

export async function enforcePhonePasswordResetSmsRateLimits(input: {
  headers: Headers;
  phoneHash: string;
}) {
  const clientIp = extractClientIp(input.headers);
  const result = await enforceSmsRequestRateLimits({
    clientIp,
    phoneHash: input.phoneHash,
  });

  return {
    ...result,
    clientIp,
  };
}

async function enforceSmsRequestRateLimits(input: {
  clientIp: string | null;
  phoneHash: string;
}) {
  const checks = [
    consumeRateLimit({
      action: "password-reset-sms:phone-minute",
      limit: 1,
      subject: input.phoneHash,
      windowMs: 60 * 1000,
    }),
    consumeRateLimit({
      action: "password-reset-sms:phone-day",
      limit: 5,
      subject: input.phoneHash,
      windowMs: 24 * 60 * 60 * 1000,
    }),
  ];

  if (input.clientIp) {
    checks.push(
      consumeRateLimit({
        action: "password-reset-sms:ip-hour",
        limit: 20,
        subject: input.clientIp,
        windowMs: 60 * 60 * 1000,
      }),
      consumeRateLimit({
        action: "password-reset-sms:ip-phone-hour",
        limit: 5,
        subject: `${input.clientIp}:${input.phoneHash}`,
        windowMs: 60 * 60 * 1000,
      }),
    );
  }

  const results = await Promise.all(checks);
  const blocked = results.filter((result) => !result.allowed);
  if (blocked.length === 0) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  return {
    allowed: false,
    retryAfterSeconds: Math.max(
      ...blocked.map((result) => result.retryAfterSeconds),
    ),
  };
}

async function consumeSmsVerification(id: string, now: Date) {
  await db
    .update(smsVerificationCodes)
    .set({ consumedAt: now })
    .where(eq(smsVerificationCodes.id, id));
}

async function consumeResetSession(id: string, now: Date) {
  await db
    .update(passwordResetSessions)
    .set({ consumedAt: now })
    .where(eq(passwordResetSessions.id, id));
}

async function createSyntheticAdminSmsCode(phoneHash: string) {
  const [code] = await db
    .insert(smsVerificationCodes)
    .values({
      phoneHash,
      purpose: "password_reset",
      codeHash: hashAuxiliaryValue(`admin:${randomBytes(16).toString("hex")}`),
      expiresAt: new Date(Date.now() + RESET_SESSION_TTL_MS),
      consumedAt: new Date(),
      sentAt: new Date(),
      provider: "admin_manual",
    })
    .returning();

  if (!code) {
    throw new Error("Failed to create admin recovery reset code record.");
  }

  return code.id;
}

function createSmsCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function createResetSessionToken(prefix: "rman" | "rst") {
  return `${prefix}_${randomBytes(32).toString("base64url")}`;
}

function hashSmsCode(phoneHash: string, code: string) {
  return hmacHex(`sms:${phoneHash}:${code}`);
}

function hashAuxiliaryValue(value: string) {
  return hmacHex(`aux:${value}`);
}

function isWeakRecoveryPassword(password: string, phoneHash: string) {
  const normalizedPassword = password.trim().toLowerCase();
  if (COMMON_WEAK_PASSWORDS.has(normalizedPassword)) {
    return true;
  }

  try {
    return hashRecoveryPhone(normalizeRecoveryPhone(password)) === phoneHash;
  } catch {
    return false;
  }
}

function getRecoveryHashKey() {
  const configured =
    env.RECOVERY_PHONE_HASH_KEY ??
    env.RATE_LIMIT_HASH_KEY ??
    env.AUTH_SECRET ??
    process.env.AUTH_SECRET;
  if (!configured) {
    throw new Error(
      "RECOVERY_PHONE_HASH_KEY, RATE_LIMIT_HASH_KEY, or AUTH_SECRET must be configured",
    );
  }
  return configured;
}

function hmacHex(value: string) {
  return createHmac("sha256", getRecoveryHashKey()).update(value).digest("hex");
}

function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function logLocalSmsPreview(input: { code: string; phoneMasked: string }) {
  console.info(
    `[password-reset:sms-preview] ${input.phoneMasked} code: ${input.code}`,
  );
  return `local-${Date.now()}`;
}

async function sendTencentPasswordResetSms(input: {
  code: string;
  phone: string;
}) {
  const payload = JSON.stringify({
    PhoneNumberSet: [input.phone],
    SmsSdkAppId: env.TENCENT_SMS_SDK_APP_ID,
    SignName: env.TENCENT_SMS_SIGN_NAME,
    TemplateId: env.TENCENT_SMS_TEMPLATE_ID_PASSWORD_RESET,
    TemplateParamSet: [input.code],
  });
  const response = await callTencentSmsApi("SendSms", payload);
  const status = response.Response?.SendStatusSet?.[0];
  if (status?.Code !== "Ok") {
    throw new Error(status?.Message ?? "Tencent SMS failed.");
  }
  return status.SerialNo ?? null;
}

async function callTencentSmsApi(action: string, payload: string) {
  const host = "sms.tencentcloudapi.com";
  const service = "sms";
  const version = "2021-01-11";
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`;
  const signedHeaders = "content-type;host;x-tc-action";
  const hashedRequestPayload = sha256Hex(payload);
  const canonicalRequest = [
    "POST",
    "/",
    "",
    canonicalHeaders,
    signedHeaders,
    hashedRequestPayload,
  ].join("\n");
  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = [
    "TC3-HMAC-SHA256",
    String(timestamp),
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const secretId = env.TENCENTCLOUD_SECRET_ID ?? "";
  const secretKey = env.TENCENTCLOUD_SECRET_KEY ?? "";
  const secretDate = hmacBuffer(`TC3${secretKey}`, date);
  const secretService = hmacBuffer(secretDate, service);
  const secretSigning = hmacBuffer(secretService, "tc3_request");
  const signature = createHmac("sha256", secretSigning)
    .update(stringToSign)
    .digest("hex");
  const authorization = [
    `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(", ");

  const response = await fetch(`https://${host}`, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json; charset=utf-8",
      Host: host,
      "X-TC-Action": action,
      "X-TC-Region": env.TENCENT_SMS_REGION,
      "X-TC-Timestamp": String(timestamp),
      "X-TC-Version": version,
    },
    body: payload,
  });

  const data = (await response.json().catch(() => null)) as {
    Response?: {
      Error?: { Code?: string; Message?: string };
      SendStatusSet?: Array<{
        Code?: string;
        Message?: string;
        SerialNo?: string;
      }>;
    };
  } | null;

  if (!response.ok || data?.Response?.Error) {
    throw new Error(
      data?.Response?.Error?.Message ?? `Tencent SMS HTTP ${response.status}`,
    );
  }

  return data ?? {};
}

function hmacBuffer(key: string | Buffer, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

export function getPhoneRecoveryUserMessage(locale: Locale) {
  return getMessages(locale).resetRequest.sent;
}
