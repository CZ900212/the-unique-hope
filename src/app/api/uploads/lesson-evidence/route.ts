import { del, put } from "@vercel/blob";
import { TRPCError } from "@trpc/server";
import { fileTypeFromBuffer } from "file-type";
import { NextResponse } from "next/server";

import { env } from "~/env";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  inferFileExtension,
  lessonUpdateSchema,
} from "~/lib/domain";
import { getMessages, type Locale } from "~/lib/i18n";
import { auth } from "~/server/auth";
import { loadActiveUserSession } from "~/server/auth/active-session";
import {
  buildProtectedLessonEvidenceUrl,
  getBlobReadWriteToken,
} from "~/server/lesson-evidence";
import { getRequestLocale } from "~/server/locale";
import { getPairingForTeacher } from "~/server/services/pairings";
import {
  findTeacherLesson,
  upsertTeacherLessonRecord,
} from "~/server/services/teacher-lessons";

export async function POST(request: Request) {
  const locale = getRequestLocale(request.headers);
  const messages = getMessages(locale);
  const session = await loadActiveUserSession(await auth());
  if (!session?.user || session.profile.role !== "teacher") {
    return NextResponse.json(
      {
        error: {
          code: "FORBIDDEN",
          message: messages.errors.teacherAuthRequired,
        },
      },
      { status: 403 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const parsedLesson = lessonUpdateSchema.safeParse({
    week: Number(readFormValue(formData.get("week"))),
    status: readFormValue(formData.get("status")),
    notesText: readFormValue(formData.get("notesText")),
    notesVisibility: readFormValue(formData.get("notesVisibility")),
  });
  if (!parsedLesson.success) {
    return NextResponse.json(
      {
        error: {
          code: "BAD_LESSON_INPUT",
          message: messages.errors.lessonUpdateInvalid,
        },
      },
      { status: 400 },
    );
  }

  let uploadResult: {
    mime: string;
    pathname: string;
    url: string;
  } | null = null;

  try {
    const { pairing } = await getPairingForTeacher(session.user.id, locale);
    const existing = await findTeacherLesson(pairing.id, parsedLesson.data.week);
    uploadResult =
      file instanceof File
        ? await uploadEvidenceFile(file, pairing.id, parsedLesson.data.week, locale)
        : null;
    const lesson = await upsertTeacherLessonRecord({
      pairingId: pairing.id,
      week: parsedLesson.data.week,
      status: parsedLesson.data.status,
      notesText: parsedLesson.data.notesText,
      notesVisibility: parsedLesson.data.notesVisibility,
      uploadedEvidence: uploadResult
        ? {
            mime: uploadResult.mime,
            pathname: uploadResult.pathname,
            url: uploadResult.url,
          }
        : null,
    });

    const blobToken = getBlobReadWriteToken();
    if (
      blobToken &&
      uploadResult &&
      existing?.evidenceKey &&
      existing.evidenceKey !== uploadResult.pathname
    ) {
      await del(existing.evidenceKey, {
        token: blobToken,
      }).catch(() => null);
    }

    return NextResponse.json({
      lesson: {
        id: lesson.id,
        week_number: lesson.weekNumber,
        status: lesson.status,
        evidence_path: lesson.evidenceKey,
        updated_at: lesson.updatedAt,
        notes: lesson.notes
          ? {
              text: lesson.notes.text,
              visibility: lesson.notes.visibility,
              updated_at: lesson.notes.updatedAt,
            }
          : null,
      },
      evidence: {
        url: buildProtectedLessonEvidenceUrl(lesson.id, lesson.evidenceKey),
        mime: uploadResult?.mime ?? lesson.evidenceMime ?? null,
      },
    });
  } catch (error) {
    const isKnownError =
      (error instanceof TRPCError && error.code === "NOT_FOUND") ||
      error instanceof LessonUploadError;

    if (!isKnownError) {
      console.error("[lesson-evidence]", error);
    }

    const blobToken = getBlobReadWriteToken();
    if (blobToken && uploadResult) {
      await del(uploadResult.pathname, {
        token: blobToken,
      }).catch(() => null);
    }

    return NextResponse.json(
      {
        error: {
          code:
            error instanceof TRPCError && error.code === "NOT_FOUND"
              ? "PAIRING_NOT_FOUND"
              : error instanceof LessonUploadError
                ? error.code
                : "LESSON_SAVE_FAILED",
          message:
            error instanceof TRPCError && error.code === "NOT_FOUND"
              ? error.message
              : error instanceof LessonUploadError
                ? error.message
                : messages.errors.uploadFailed,
        },
      },
      {
        status:
          error instanceof TRPCError && error.code === "NOT_FOUND"
            ? 404
            : error instanceof LessonUploadError
              ? error.status
              : 500,
      },
    );
  }
}

async function uploadEvidenceFile(
  file: File,
  pairingId: string,
  week: number,
  locale: Locale,
) {
  const messages = getMessages(locale);
  const blobToken = getBlobReadWriteToken();
  if (!blobToken) {
    throw new LessonUploadError(
      "BLOB_NOT_CONFIGURED",
      messages.errors.uploadStorageNotConfigured,
      503,
    );
  }

  const maxUploadBytes = env.MAX_UPLOAD_MB * 1024 * 1024;
  if (file.size > maxUploadBytes) {
    throw new LessonUploadError(
      "FILE_TOO_LARGE",
      messages.errors.uploadFileTooLarge(env.MAX_UPLOAD_MB),
      400,
    );
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
    throw new LessonUploadError("BAD_FILE_TYPE", messages.errors.uploadBadFileType, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || !ALLOWED_IMAGE_MIME_TYPES.has(detected.mime) || detected.mime !== file.type) {
    throw new LessonUploadError(
      "BAD_FILE_SIGNATURE",
      messages.errors.uploadBadFileSignature,
      400,
    );
  }

  const extension = inferFileExtension(detected.mime);
  if (!extension) {
    throw new LessonUploadError("BAD_FILE_TYPE", messages.errors.uploadBadFileType, 400);
  }

  const pathname = `lessons/${pairingId}/week-${week}/${crypto.randomUUID()}.${extension}`;
  const uploaded = await put(pathname, buffer, {
    access: "private",
    addRandomSuffix: false,
    contentType: detected.mime,
    token: blobToken,
  });

  return {
    mime: detected.mime,
    pathname: uploaded.pathname,
    url: uploaded.url,
  };
}

function readFormValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : undefined;
}

class LessonUploadError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
