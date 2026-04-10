import { NextResponse } from "next/server";

import { forgotPasswordSchema } from "~/lib/domain";
import { getMessages } from "~/lib/i18n";
import {
  PasswordResetDeliveryError,
  requestPasswordReset,
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

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "BAD_REQUEST",
          message: messages.errors.passwordResetBadRequest,
        },
      },
      { status: 400 },
    );
  }

  if (parsed.data.role === "admin") {
    return NextResponse.json(
      {
        error: {
          code: "PASSWORD_RESET_DISABLED",
          message: messages.errors.adminPasswordResetDisabled,
        },
      },
      { status: 403 },
    );
  }

  const clientIp = extractClientIp(request);
  const identifier = `${parsed.data.role}:${parsed.data.identifier.trim().toLowerCase()}`;
  const [byIdentifier, byIp] = await Promise.all([
    consumeRateLimit({
      action: "password-reset:identifier",
      limit: 3,
      subject: identifier,
      windowMs: 60 * 60 * 1000,
    }),
    clientIp
      ? consumeRateLimit({
          action: "password-reset:ip",
          limit: 5,
          subject: clientIp,
          windowMs: 60 * 60 * 1000,
        })
      : Promise.resolve(null),
  ]);
  if (!byIdentifier.allowed || (byIp && !byIp.allowed)) {
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
            Math.max(
              byIp?.retryAfterSeconds ?? 0,
              byIdentifier.retryAfterSeconds,
            ),
          ),
        },
      },
    );
  }

  try {
    const result = await requestPasswordReset(parsed.data);
    if (result.status === "managed_internally") {
      return NextResponse.json(
        {
          error: {
            code: "PASSWORD_RESET_DISABLED",
            message: messages.errors.adminPasswordResetDisabled,
          },
        },
        { status: 403 },
      );
    }

    if (result.status === "unavailable") {
      return NextResponse.json(
        {
          error: {
            code: "PASSWORD_RESET_UNAVAILABLE",
            message: messages.errors.passwordResetUnavailable,
          },
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof PasswordResetDeliveryError) {
      console.error("[password-reset:request] delivery failed", error.cause);
      return NextResponse.json({ ok: true });
    }

    console.error("[password-reset:request]", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: messages.resetRequest.requestError,
        },
      },
      { status: 500 },
    );
  }
}
