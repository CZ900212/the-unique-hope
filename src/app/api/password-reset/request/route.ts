import { NextResponse } from "next/server";

import {
  emailPasswordResetRequestSchema,
  manualPasswordResetRequestSchema,
} from "~/lib/domain";
import { getMessages } from "~/lib/i18n";
import { createManualRecoveryRequest } from "~/server/auth/manual-password-reset";
import {
  PasswordResetDeliveryError,
  requestPasswordReset,
} from "~/server/auth/password-reset";
import { getRequestLocale } from "~/server/locale";
import { consumeRateLimit, extractClientIp } from "~/server/rate-limit";

function getRecoveryMode(body: unknown) {
  if (!body || typeof body !== "object" || !("recoveryMode" in body)) {
    return "manual";
  }

  return (body as { recoveryMode?: unknown }).recoveryMode;
}

export async function POST(request: Request) {
  const locale = getRequestLocale(request.headers);
  const messages = getMessages(locale);
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

  const recoveryMode = getRecoveryMode(body);

  if (recoveryMode === "email") {
    return handleEmailPasswordResetRequest(request, body, messages);
  }

  if (recoveryMode !== "manual") {
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

  const parsed = manualPasswordResetRequestSchema.safeParse(body);
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

  try {
    const result = await createManualRecoveryRequest({
      applicantContact: parsed.data.applicantContact,
      applicantName: parsed.data.applicantName,
      applicantNote: parsed.data.applicantNote,
      applicantRole: parsed.data.applicantRole,
      request,
    });

    if (result.status === "rate_limited") {
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
            "Retry-After": String(result.retryAfterSeconds),
          },
        },
      );
    }

    return NextResponse.json({
      ok: true,
      message: messages.resetRequest.manualQueued,
    });
  } catch (error) {
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

async function handleEmailPasswordResetRequest(
  request: Request,
  body: unknown,
  messages: ReturnType<typeof getMessages>,
) {
  const parsed = emailPasswordResetRequestSchema.safeParse(body);
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

  const clientIp = extractClientIp(request);
  const identifier = `${parsed.data.role}:${parsed.data.identifier.trim().toLowerCase()}`;
  const [byIdentifier, byIp] = await Promise.all([
    consumeRateLimit({
      action: "password-reset-email:identifier",
      limit: 3,
      subject: identifier,
      windowMs: 60 * 60 * 1000,
    }),
    clientIp
      ? consumeRateLimit({
          action: "password-reset-email:ip",
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
    const result = await requestPasswordReset({
      identifier: parsed.data.identifier,
      role: parsed.data.role,
    });

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

    return NextResponse.json({
      ok: true,
      message: messages.resetRequest.emailQueued,
    });
  } catch (error) {
    if (error instanceof PasswordResetDeliveryError) {
      console.error("[password-reset:request] delivery failed", error.cause);
      return NextResponse.json({
        ok: true,
        message: messages.resetRequest.emailQueued,
      });
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
