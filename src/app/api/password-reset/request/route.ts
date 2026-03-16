import { NextResponse } from "next/server";

import { forgotPasswordSchema } from "~/lib/domain";
import { requestPasswordReset } from "~/server/auth/password-reset";
import { consumeRateLimit, extractClientIp } from "~/server/rate-limit";

const ADMIN_RESET_MESSAGE =
  "Admin password resets are handled internally. Contact the system owner.";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "BAD_JSON",
          message: "Request body must be valid JSON.",
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
          message: "Identifier and role are required.",
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
          message: ADMIN_RESET_MESSAGE,
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
          message: "Too many password reset requests. Try again later.",
        },
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.max(byIp?.retryAfterSeconds ?? 0, byIdentifier.retryAfterSeconds),
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
            message: ADMIN_RESET_MESSAGE,
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
            message: "Password reset is not available for this account right now. Contact an admin.",
          },
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[password-reset:request]", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Unable to start password reset right now.",
        },
      },
      { status: 500 },
    );
  }
}
