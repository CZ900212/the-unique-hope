import { NextResponse } from "next/server";

import { resetPasswordSchema } from "~/lib/domain";
import { resetPasswordWithToken } from "~/server/auth/password-reset";

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

  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];

    return NextResponse.json(
      {
        error: {
          code: "BAD_REQUEST",
          message: firstIssue?.message ?? "Token and matching passwords are required.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const result = await resetPasswordWithToken(parsed.data);
    if (result.status === "invalid_token") {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_TOKEN",
            message: "This reset link is invalid or has expired.",
          },
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      message: "Password updated successfully.",
    });
  } catch (error) {
    console.error("[password-reset:confirm]", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Unable to reset password right now.",
        },
      },
      { status: 500 },
    );
  }
}
