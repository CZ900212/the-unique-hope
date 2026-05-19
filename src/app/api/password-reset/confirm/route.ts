import { NextResponse } from "next/server";

import { resetPasswordSchema } from "~/lib/domain";
import { getMessages } from "~/lib/i18n";
import {
  hashPasswordResetToken,
  resetPasswordWithToken,
} from "~/server/auth/password-reset";
import { getRequestLocale } from "~/server/locale";
import { consumeRateLimit, extractClientIp } from "~/server/rate-limit";

export async function POST(request: Request) {
  const messages = getMessages(getRequestLocale(request.headers));
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "BAD_JSON",
          message: messages.errors.badJson,
        },
      },
      { status: 400 },
    );
  }

  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "BAD_REQUEST",
          message: messages.errors.resetPasswordBadRequest,
        },
      },
      { status: 400 },
    );
  }

  const clientIp = extractClientIp(request);
  const tokenHash = hashPasswordResetToken(parsed.data.token);
  const [byToken, byIp] = await Promise.all([
    consumeRateLimit({
      action: "password-reset-confirm:token",
      limit: 5,
      subject: tokenHash,
      windowMs: 15 * 60 * 1000,
    }),
    clientIp
      ? consumeRateLimit({
          action: "password-reset-confirm:ip",
          limit: 20,
          subject: clientIp,
          windowMs: 15 * 60 * 1000,
        })
      : Promise.resolve(null),
  ]);
  if (!byToken.allowed || (byIp && !byIp.allowed)) {
    return NextResponse.json(
      {
        error: {
          code: "TOO_MANY_REQUESTS",
          message: messages.errors.passwordResetTooManyRequests,
        },
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.max(byIp?.retryAfterSeconds ?? 0, byToken.retryAfterSeconds),
          ),
        },
      },
    );
  }

  try {
    const result = await resetPasswordWithToken(parsed.data);
    if (result.status === "invalid_token") {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_TOKEN",
            message: messages.errors.passwordResetInvalidToken,
          },
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      message: messages.login.resetSuccess,
    });
  } catch (error) {
    console.error("[password-reset:confirm]", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: messages.resetConfirm.resetError,
        },
      },
      { status: 500 },
    );
  }
}
