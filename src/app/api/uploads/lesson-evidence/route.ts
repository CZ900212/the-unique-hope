import Busboy from "busboy";
import { Readable } from "node:stream";
import { TRPCError } from "@trpc/server";
import { fileTypeFromBuffer } from "file-type";
import { NextResponse } from "next/server";

import { env } from "~/env";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  inferFileExtension,
  lessonUpdateSchema,
  MAX_NOTE_LENGTH,
} from "~/lib/domain";
import {
  getMessages,
  getUploadFileTooLargeMessage,
  type Locale,
} from "~/lib/i18n";
import { auth } from "~/server/auth";
import { loadActiveUserSession } from "~/server/auth/active-session";
import {
  buildProtectedLessonEvidenceUrl,
  deleteStoredLessonEvidence,
  getLessonEvidenceStorageMode,
  storeLessonEvidenceFile,
} from "~/server/lesson-evidence";
import { getRequestLocale } from "~/server/locale";
import { assertLessonRecordCanChange } from "~/server/services/appointments";
import { requireMatchedTeacherPairing } from "~/server/services/pairings";
import {
  findTeacherLesson,
  upsertTeacherLessonRecord,
} from "~/server/services/teacher-lessons";
import { notifyTeacherLessonVisible } from "~/server/services/notifications";

const MULTIPART_BODY_OVERHEAD_BYTES = 64 * 1024;
const MAX_MULTIPART_FIELD_BYTES = MAX_NOTE_LENGTH * 4;
const UPLOAD_FIELD_NAMES = new Set([
  "notesText",
  "notesVisibility",
  "status",
  "week",
]);

export const runtime = "nodejs";

export async function POST(request: Request) {
  const locale = getRequestLocale(request.headers);
  const messages = getMessages(locale);
  const session = await loadActiveUserSession(await auth());
  const maxUploadBytes = env.MAX_UPLOAD_MB * 1024 * 1024;
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

  let multipartData: ParsedMultipartUpload;
  try {
    multipartData = await parseMultipartUpload(request, maxUploadBytes, locale);
  } catch (error) {
    return buildUploadErrorResponse(
      error,
      messages.errors.uploadBadMultipartBody,
    );
  }

  const parsedLesson = lessonUpdateSchema.safeParse({
    week: Number(multipartData.fields.week),
    status: multipartData.fields.status,
    notesText: multipartData.fields.notesText,
    notesVisibility: multipartData.fields.notesVisibility,
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
    url: string | null;
  } | null = null;

  try {
    const { pairing } = await requireMatchedTeacherPairing(
      session.user.id,
      locale,
    );
    await assertLessonRecordCanChange({
      locale,
      pairingId: pairing.id,
      week: parsedLesson.data.week,
    });
    const existing = await findTeacherLesson(
      pairing.id,
      parsedLesson.data.week,
    );
    uploadResult = multipartData.file
      ? await uploadEvidenceFile(
          multipartData.file,
          pairing.id,
          parsedLesson.data.week,
          locale,
        )
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

    if (
      uploadResult &&
      existing?.evidenceKey &&
      existing.evidenceKey !== uploadResult.pathname
    ) {
      await deleteStoredLessonEvidence(existing.evidenceKey);
    }

    if (
      uploadResult ||
      parsedLesson.data.status !== existing?.status ||
      (parsedLesson.data.notesVisibility === "shared" &&
        parsedLesson.data.notesText.trim())
    ) {
      await notifyTeacherLessonVisible({
        pairing,
        teacher: session.profile,
        week: parsedLesson.data.week,
      });
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
      error instanceof TRPCError || error instanceof LessonUploadError;

    if (!isKnownError) {
      console.error("[lesson-evidence]", error);
    }

    if (uploadResult) {
      await deleteStoredLessonEvidence(uploadResult.pathname);
    }

    return NextResponse.json(
      {
        error: {
          code:
            error instanceof TRPCError && error.code === "NOT_FOUND"
              ? "PAIRING_NOT_FOUND"
              : error instanceof TRPCError && error.code === "CONFLICT"
                ? "LESSON_APPOINTMENT_NOT_CONFIRMED"
                : error instanceof LessonUploadError
                  ? error.code
                  : "LESSON_SAVE_FAILED",
          message:
            error instanceof TRPCError
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
            : error instanceof TRPCError && error.code === "CONFLICT"
              ? 409
              : error instanceof LessonUploadError
                ? error.status
                : 500,
      },
    );
  }
}

async function uploadEvidenceFile(
  file: ParsedMultipartFile,
  pairingId: string,
  week: number,
  locale: Locale,
) {
  const messages = getMessages(locale);
  if (!getLessonEvidenceStorageMode()) {
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
      getUploadFileTooLargeMessage(locale, env.MAX_UPLOAD_MB),
      413,
    );
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
    throw new LessonUploadError(
      "BAD_FILE_TYPE",
      messages.errors.uploadBadFileType,
      400,
    );
  }

  const detected = await fileTypeFromBuffer(file.buffer);
  if (
    !detected ||
    !ALLOWED_IMAGE_MIME_TYPES.has(detected.mime) ||
    detected.mime !== file.type
  ) {
    throw new LessonUploadError(
      "BAD_FILE_SIGNATURE",
      messages.errors.uploadBadFileSignature,
      400,
    );
  }

  const extension = inferFileExtension(detected.mime);
  if (!extension) {
    throw new LessonUploadError(
      "BAD_FILE_TYPE",
      messages.errors.uploadBadFileType,
      400,
    );
  }

  const pathname = `lessons/${pairingId}/week-${week}/${crypto.randomUUID()}.${extension}`;
  const uploaded = await storeLessonEvidenceFile(
    pathname,
    file.buffer,
    detected.mime,
  );
  if (!uploaded) {
    throw new LessonUploadError(
      "BLOB_NOT_CONFIGURED",
      messages.errors.uploadStorageNotConfigured,
      503,
    );
  }

  return {
    mime: detected.mime,
    pathname: uploaded.pathname,
    url: uploaded.url,
  };
}

function readContentLength(headers: Headers) {
  const rawValue = headers.get("content-length");
  if (!rawValue) {
    return null;
  }

  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

async function parseMultipartUpload(
  request: Request,
  maxUploadBytes: number,
  locale: Locale,
): Promise<ParsedMultipartUpload> {
  const messages = getMessages(locale);
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    throw new LessonUploadError(
      "BAD_CONTENT_TYPE",
      messages.errors.uploadBadContentType,
      415,
    );
  }

  if (!request.body) {
    throw new LessonUploadError(
      "BAD_MULTIPART_BODY",
      messages.errors.uploadBadMultipartBody,
      400,
    );
  }

  const maxRequestBytes = maxUploadBytes + MULTIPART_BODY_OVERHEAD_BYTES;
  const requestContentLength = readContentLength(request.headers);
  if (requestContentLength !== null && requestContentLength > maxRequestBytes) {
    throw new LessonUploadError(
      "FILE_TOO_LARGE",
      getUploadFileTooLargeMessage(locale, env.MAX_UPLOAD_MB),
      413,
    );
  }

  const fields: ParsedMultipartUpload["fields"] = {};
  let uploadFile: ParsedMultipartFile | null = null;

  const busboy = createBusboyParser(request.headers, maxUploadBytes, locale);
  const nodeStream = Readable.fromWeb(
    request.body as Parameters<typeof Readable.fromWeb>[0],
  );
  let requestBytesRead = 0;

  return await new Promise<ParsedMultipartUpload>((resolve, reject) => {
    let settled = false;

    const fail = (error: unknown) => {
      if (settled) {
        return;
      }

      settled = true;
      nodeStream.unpipe(busboy);
      nodeStream.destroy(
        error instanceof Error
          ? error
          : new Error("Failed to read multipart upload."),
      );
      busboy.removeAllListeners();
      reject(
        error instanceof Error
          ? error
          : new Error("Failed to read multipart upload."),
      );
    };

    nodeStream.on("data", (chunk: Buffer) => {
      requestBytesRead += chunk.length;
      if (requestBytesRead > maxRequestBytes) {
        fail(
          new LessonUploadError(
            "FILE_TOO_LARGE",
            getUploadFileTooLargeMessage(locale, env.MAX_UPLOAD_MB),
            413,
          ),
        );
      }
    });

    nodeStream.on("error", fail);

    busboy.on("field", (fieldName, value, info) => {
      if (!UPLOAD_FIELD_NAMES.has(fieldName)) {
        fail(
          new LessonUploadError(
            "BAD_MULTIPART_BODY",
            messages.errors.uploadBadMultipartBody,
            400,
          ),
        );
        return;
      }

      if (info.nameTruncated || info.valueTruncated) {
        fail(
          new LessonUploadError(
            "BAD_LESSON_INPUT",
            messages.errors.lessonUpdateInvalid,
            400,
          ),
        );
        return;
      }

      fields[fieldName as keyof ParsedMultipartUpload["fields"]] = value;
    });

    busboy.on("file", (fieldName, fileStream, fileInfo) => {
      if (fieldName !== "file" || uploadFile) {
        fileStream.resume();
        fail(
          new LessonUploadError(
            "BAD_MULTIPART_BODY",
            messages.errors.uploadBadMultipartBody,
            400,
          ),
        );
        return;
      }

      const chunks: Buffer[] = [];
      let truncated = false;

      fileStream.on("limit", () => {
        truncated = true;
        fail(
          new LessonUploadError(
            "FILE_TOO_LARGE",
            getUploadFileTooLargeMessage(locale, env.MAX_UPLOAD_MB),
            413,
          ),
        );
      });

      fileStream.on("data", (chunk: Buffer) => {
        if (!truncated) {
          chunks.push(chunk);
        }
      });

      fileStream.on("end", () => {
        if (truncated || settled) {
          return;
        }

        uploadFile = {
          buffer: Buffer.concat(chunks),
          size: chunks.reduce((total, chunk) => total + chunk.length, 0),
          type: fileInfo.mimeType,
        };
      });

      fileStream.on("error", fail);
    });

    busboy.on("filesLimit", () => {
      fail(
        new LessonUploadError(
          "BAD_MULTIPART_BODY",
          messages.errors.uploadBadMultipartBody,
          400,
        ),
      );
    });

    busboy.on("fieldsLimit", () => {
      fail(
        new LessonUploadError(
          "BAD_MULTIPART_BODY",
          messages.errors.uploadBadMultipartBody,
          400,
        ),
      );
    });

    busboy.on("partsLimit", () => {
      fail(
        new LessonUploadError(
          "BAD_MULTIPART_BODY",
          messages.errors.uploadBadMultipartBody,
          400,
        ),
      );
    });

    busboy.on("error", () => {
      fail(
        new LessonUploadError(
          "BAD_MULTIPART_BODY",
          messages.errors.uploadBadMultipartBody,
          400,
        ),
      );
    });

    busboy.on("finish", () => {
      if (settled) {
        return;
      }

      settled = true;
      resolve({
        fields,
        file: uploadFile,
      });
    });

    nodeStream.pipe(busboy);
  });
}

function createBusboyParser(
  headers: Headers,
  maxUploadBytes: number,
  locale: Locale,
) {
  try {
    return Busboy({
      headers: Object.fromEntries(headers.entries()),
      limits: {
        fieldNameSize: 32,
        fields: 4,
        // Busboy counts bytes here, while notes are validated by characters later.
        fieldSize: MAX_MULTIPART_FIELD_BYTES,
        files: 1,
        fileSize: maxUploadBytes,
        parts: 8,
      },
    });
  } catch {
    throw new LessonUploadError(
      "BAD_MULTIPART_BODY",
      getMessages(locale).errors.uploadBadMultipartBody,
      400,
    );
  }
}

function buildUploadErrorResponse(error: unknown, fallbackMessage: string) {
  if (error instanceof LessonUploadError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
        },
      },
      { status: error.status },
    );
  }

  console.error("[lesson-evidence:parse]", error);
  return NextResponse.json(
    {
      error: {
        code: "BAD_MULTIPART_BODY",
        message: fallbackMessage,
      },
    },
    { status: 400 },
  );
}

type ParsedMultipartFile = {
  buffer: Buffer;
  size: number;
  type: string;
};

type ParsedMultipartUpload = {
  fields: {
    notesText?: string;
    notesVisibility?: string;
    status?: string;
    week?: string;
  };
  file: ParsedMultipartFile | null;
};

class LessonUploadError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
