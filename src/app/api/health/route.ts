import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "~/server/db";
import { getLessonEvidenceStorageMode } from "~/server/lesson-evidence";

export async function GET() {
  const timestamp = new Date().toISOString();
  const uploadStorageConfigured = Boolean(getLessonEvidenceStorageMode());

  try {
    await db.execute(sql`select 1 from "unique_hope_user" limit 1`);

    return NextResponse.json({
      ok: true,
      service: "the-unique-hope",
      timestamp,
      checks: {
        blob: uploadStorageConfigured ? "configured" : "not_configured",
        database: "ok",
      },
    });
  } catch (error) {
    console.error("[health]", error);

    return NextResponse.json(
      {
        ok: false,
        service: "the-unique-hope",
        timestamp,
        checks: {
          blob: uploadStorageConfigured ? "configured" : "not_configured",
          database: "error",
        },
      },
      { status: 503 },
    );
  }
}
