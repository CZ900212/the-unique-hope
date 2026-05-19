import { NextResponse } from "next/server";

import { phonePasswordResetManualRequestSchema } from "~/lib/domain";
import { getMessages } from "~/lib/i18n";
import { createManualRecoveryRequest } from "~/server/auth/phone-password-reset";
import { getRequestLocale } from "~/server/locale";

export async function POST(request: Request) {
  const messages = getMessages(getRequestLocale(request.headers));
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "BAD_JSON", message: messages.errors.badJson } },
      { status: 400 },
    );
  }

  const parsed = phonePasswordResetManualRequestSchema.safeParse(body);
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

  try {
    const result = await createManualRecoveryRequest(parsed.data);
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
      ok: true,
      message: messages.resetRequest.manualQueued,
    });
  } catch (error) {
    console.error("[password-reset:manual]", error);
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
