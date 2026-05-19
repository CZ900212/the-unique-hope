import { NextResponse } from "next/server";

import { phonePasswordResetVerifySchema } from "~/lib/domain";
import { getMessages } from "~/lib/i18n";
import { verifyPhonePasswordResetCode } from "~/server/auth/phone-password-reset";
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

  const parsed = phonePasswordResetVerifySchema.safeParse(body);
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
    const result = await verifyPhonePasswordResetCode({
      code: parsed.data.code,
      headers: request.headers,
      phone: parsed.data.phone,
    });

    if (result.status === "invalid_code") {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_CODE",
            message: messages.errors.passwordResetInvalidCode,
          },
        },
        { status: 400 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[password-reset:verify]", error);
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
