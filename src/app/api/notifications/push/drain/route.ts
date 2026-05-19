import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { env } from "~/env";
import { drainNotificationPushDeliveries } from "~/server/services/notification-push";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!env.WEB_PUSH_DRAIN_SECRET) {
    return NextResponse.json(
      { error: "web_push_drain_not_configured", ok: false },
      { status: 503 },
    );
  }

  if (!isAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json(
      { error: "unauthorized", ok: false },
      { status: 401 },
    );
  }

  const result = await drainNotificationPushDeliveries();
  return NextResponse.json({ ok: true, ...result });
}

function isAuthorized(header: string | null) {
  const expected = `Bearer ${env.WEB_PUSH_DRAIN_SECRET}`;
  if (header?.length !== expected.length) return false;

  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}
