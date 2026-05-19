import { createHash, randomBytes } from "crypto";

import { hash } from "bcryptjs";
import { and, eq, gt, isNull, sql } from "drizzle-orm";

import {
  forgotPasswordSchema,
  isEmailIdentifier,
  isManagedLocalEmail,
  normalizeIdentifier,
  resetPasswordSchema,
  type Role,
} from "~/lib/domain";
import { env } from "~/env";
import { db } from "~/server/db";
import {
  manualRecoveryRequests,
  passwordResetTokens,
  profiles,
  sessions,
  userCredentials,
  users,
} from "~/server/db/schema";

const BCRYPT_ROUNDS = 12;
const TOKEN_BYTES = 32;
const LOCAL_PREVIEW_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
]);

type ResettableAccount = {
  email: string;
  name: string;
  userId: string;
};

type PasswordResetRequestInput = {
  identifier: string;
  role: Role;
};

type PasswordResetConfirmInput = {
  confirmPassword: string;
  password: string;
  token: string;
};

export class PasswordResetDeliveryError extends Error {
  constructor(cause: unknown) {
    super("Failed to deliver password reset email.", { cause });
    this.name = "PasswordResetDeliveryError";
  }
}

export function hashPasswordResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function isPasswordResetEmailConfigured() {
  return Boolean(env.RESEND_API_KEY && env.PASSWORD_RESET_FROM_EMAIL);
}

export function isLocalPasswordResetPreviewAllowed() {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    return false;
  }

  try {
    return LOCAL_PREVIEW_HOSTNAMES.has(new URL(appUrl).hostname);
  } catch {
    return false;
  }
}

function buildResetUrl(token: string) {
  const url = new URL("/reset-password", env.NEXT_PUBLIC_APP_URL);
  url.searchParams.set("token", token);
  return url.toString();
}

async function findResettableAccount(
  identifierRaw: string,
  role: Role,
): Promise<ResettableAccount | null> {
  const identifier = normalizeIdentifier(identifierRaw);

  if (isEmailIdentifier(identifier)) {
    const user = await db.query.users.findFirst({
      where: eq(users.email, identifier),
      with: {
        credential: true,
        profile: true,
      },
    });

    if (!user?.profile || !user.credential || user.profile.role !== role) {
      return null;
    }

    return {
      email: user.email,
      name: user.profile.name,
      userId: user.id,
    };
  }

  const profile = await db.query.profiles.findFirst({
    where: and(eq(profiles.username, identifier), eq(profiles.role, role)),
    with: {
      user: {
        with: {
          credential: true,
        },
      },
    },
  });

  if (!profile?.user?.credential) {
    return null;
  }

  return {
    email: profile.user.email,
    name: profile.name,
    userId: profile.userId,
  };
}

async function persistPasswordResetToken(userId: string, ttlMs: number) {
  const rawToken = randomBytes(TOKEN_BYTES).toString("base64url");
  const tokenHash = hashPasswordResetToken(rawToken);
  const expiresAt = new Date(Date.now() + ttlMs);
  let tokenId = "";

  await db.transaction(async (tx) => {
    await tx
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, userId));
    const [token] = await tx
      .insert(passwordResetTokens)
      .values({
        userId,
        tokenHash,
        expiresAt,
      })
      .returning({ id: passwordResetTokens.id });
    tokenId = token?.id ?? "";
  });

  return {
    rawToken,
    resetUrl: buildResetUrl(rawToken),
    tokenId,
  };
}

export async function createPasswordResetTokenForUser(input: {
  ttlMs?: number;
  userId: string;
}) {
  return persistPasswordResetToken(
    input.userId,
    input.ttlMs ?? env.PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000,
  );
}

export function createPasswordResetEmailContent(input: {
  email: string;
  name: string;
  resetUrl: string;
}) {
  const escapedAppName = escapeHtml(env.NEXT_PUBLIC_APP_NAME);
  const escapedName = escapeHtml(input.name);
  const escapedResetUrl = escapeHtml(input.resetUrl);

  return {
    from: env.PASSWORD_RESET_FROM_EMAIL,
    to: input.email,
    subject: `Reset your ${env.NEXT_PUBLIC_APP_NAME} password`,
    text: [
      `Hello ${input.name},`,
      "",
      `We received a request to reset your ${env.NEXT_PUBLIC_APP_NAME} password.`,
      "Click the link below to set a new one:",
      "",
      input.resetUrl,
      "",
      `This link expires in ${env.PASSWORD_RESET_TOKEN_TTL_MINUTES} minutes.`,
      "If you didn't request this, you can safely ignore this email.",
    ].join("\n"),
    html: [
      `<p>Hello ${escapedName},</p>`,
      `<p>We received a request to reset your ${escapedAppName} password.</p>`,
      "<p>Click the link below to set a new one:</p>",
      `<p><a href="${escapedResetUrl}">${escapedResetUrl}</a></p>`,
      `<p>This link expires in ${env.PASSWORD_RESET_TOKEN_TTL_MINUTES} minutes.</p>`,
      "<p>If you didn't request this, you can safely ignore this email.</p>",
    ].join(""),
  };
}

async function sendPasswordResetEmail(input: {
  email: string;
  name: string;
  resetUrl: string;
}) {
  const payload = createPasswordResetEmailContent(input);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send password reset email: ${errorText}`);
  }
}

export async function requestPasswordReset(input: PasswordResetRequestInput) {
  const parsed = forgotPasswordSchema.parse(input);
  if (parsed.role === "admin") {
    return { status: "managed_internally" as const };
  }

  const emailConfigured = isPasswordResetEmailConfigured();
  const previewAllowed = isLocalPasswordResetPreviewAllowed();

  if (!emailConfigured && !previewAllowed) {
    return { status: "unavailable" as const };
  }

  const account = await findResettableAccount(parsed.identifier, parsed.role);

  if (!account) {
    return { status: "queued" as const };
  }

  if (isManagedLocalEmail(account.email)) {
    return { status: "manual_required" as const };
  }

  if (!emailConfigured) {
    const preview = await createPasswordResetTokenForUser({
      userId: account.userId,
    });
    console.info(
      `[password-reset] preview link for ${account.email}: ${preview.resetUrl}`,
    );

    return {
      status: "preview" as const,
    };
  }

  const preview = await createPasswordResetTokenForUser({
    userId: account.userId,
  });
  try {
    await sendPasswordResetEmail({
      email: account.email,
      name: account.name,
      resetUrl: preview.resetUrl,
    });
  } catch (error) {
    throw new PasswordResetDeliveryError(error);
  }

  return { status: "queued" as const };
}

export async function resetPasswordWithToken(input: PasswordResetConfirmInput) {
  const parsed = resetPasswordSchema.parse(input);
  const tokenHash = hashPasswordResetToken(parsed.token);
  const now = new Date();

  return db.transaction(async (tx) => {
    const [claimedToken] = await tx
      .update(passwordResetTokens)
      .set({
        usedAt: now,
      })
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, now),
        ),
      )
      .returning();

    if (!claimedToken) {
      return { status: "invalid_token" as const };
    }

    const passwordHash = await hash(parsed.password, BCRYPT_ROUNDS);

    await tx
      .update(userCredentials)
      .set({
        passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(userCredentials.userId, claimedToken.userId));

    await tx
      .update(users)
      .set({
        authVersion: sql`${users.authVersion} + 1`,
      })
      .where(eq(users.id, claimedToken.userId));

    await tx.delete(sessions).where(eq(sessions.userId, claimedToken.userId));

    await tx
      .delete(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.userId, claimedToken.userId),
          isNull(passwordResetTokens.usedAt),
        ),
      );

    await tx
      .update(manualRecoveryRequests)
      .set({
        completedAt: now,
        status: "completed",
        updatedAt: now,
      })
      .where(
        and(
          eq(manualRecoveryRequests.passwordResetTokenId, claimedToken.id),
          eq(manualRecoveryRequests.status, "approved"),
        ),
      );
    return { status: "success" as const };
  });
}
