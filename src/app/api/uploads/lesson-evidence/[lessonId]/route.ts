import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { auth } from "~/server/auth";
import { loadActiveUserSession } from "~/server/auth/active-session";
import { db } from "~/server/db";
import { lessons, profiles } from "~/server/db/schema";
import {
  getBlobReadWriteToken,
  resolveStoredLessonEvidenceUrl,
} from "~/server/lesson-evidence";

export async function GET(
  _request: Request,
  context: { params: Promise<{ lessonId: string }> },
) {
  const session = await loadActiveUserSession(await auth());
  if (!session?.user) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      },
      { status: 401 },
    );
  }

  if (!getBlobReadWriteToken()) {
    return NextResponse.json(
      {
        error: {
          code: "BLOB_NOT_CONFIGURED",
          message: "Upload storage is not configured",
        },
      },
      { status: 503 },
    );
  }

  const { lessonId } = await context.params;
  const lesson = await db.query.lessons.findFirst({
    where: eq(lessons.id, lessonId),
    with: {
      pairing: true,
    },
  });

  if (!lesson?.pairing || !lesson.evidenceKey) {
    return NextResponse.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "Lesson evidence not found",
        },
      },
      { status: 404 },
    );
  }

  let hasAccess = session.profile.role === "admin";
  if (!hasAccess) {
    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, session.user.id),
    });

    if (profile) {
      hasAccess =
        (session.profile.role === "teacher" &&
          lesson.pairing.teacherProfileId === profile.id) ||
        (session.profile.role === "student" &&
          lesson.pairing.studentProfileId === profile.id);
    }
  }

  if (!hasAccess) {
    return NextResponse.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "You do not have access to this lesson evidence",
        },
      },
      { status: 403 },
    );
  }

  const blobUrl = await resolveStoredLessonEvidenceUrl(lesson.evidenceKey);
  if (!blobUrl) {
    return NextResponse.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "Lesson evidence not found",
        },
      },
      { status: 404 },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  let upstream: Response;
  try {
    upstream = await fetch(blobUrl, {
      cache: "no-store",
      signal: controller.signal,
    });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "UPSTREAM_FETCH_FAILED",
          message: "Unable to fetch lesson evidence",
        },
      },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      {
        error: {
          code: "UPSTREAM_FETCH_FAILED",
          message: "Unable to fetch lesson evidence",
        },
      },
      { status: 502 },
    );
  }

  const headers = new Headers();
  headers.set(
    "content-type",
    upstream.headers.get("content-type") ??
      lesson.evidenceMime ??
      "application/octet-stream",
  );
  headers.set("cache-control", "private, no-store, max-age=0");

  const contentLength = upstream.headers.get("content-length");
  if (contentLength) {
    headers.set("content-length", contentLength);
  }

  const contentDisposition = upstream.headers.get("content-disposition");
  if (contentDisposition) {
    headers.set("content-disposition", contentDisposition);
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers,
  });
}
