import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  assertLessonRecordCanChange: vi.fn(),
  buildProtectedLessonEvidenceUrl: vi.fn(),
  deleteStoredLessonEvidence: vi.fn(),
  fileTypeFromBuffer: vi.fn(),
  findTeacherLesson: vi.fn(),
  getLessonEvidenceStorageMode: vi.fn(),
  loadActiveUserSession: vi.fn(),
  requireMatchedTeacherPairing: vi.fn(),
  storeLessonEvidenceFile: vi.fn(),
  upsertTeacherLessonRecord: vi.fn(),
}));

vi.mock("~/env", () => ({
  env: {
    MAX_UPLOAD_MB: 5,
  },
}));

vi.mock("~/server/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("~/server/auth/active-session", () => ({
  loadActiveUserSession: mocks.loadActiveUserSession,
}));

vi.mock("file-type", () => ({
  fileTypeFromBuffer: mocks.fileTypeFromBuffer,
}));

vi.mock("~/server/lesson-evidence", () => ({
  buildProtectedLessonEvidenceUrl: mocks.buildProtectedLessonEvidenceUrl,
  deleteStoredLessonEvidence: mocks.deleteStoredLessonEvidence,
  getLessonEvidenceStorageMode: mocks.getLessonEvidenceStorageMode,
  storeLessonEvidenceFile: mocks.storeLessonEvidenceFile,
}));

vi.mock("~/server/services/pairings", () => ({
  requireMatchedTeacherPairing: mocks.requireMatchedTeacherPairing,
}));

vi.mock("~/server/services/appointments", () => ({
  assertLessonRecordCanChange: mocks.assertLessonRecordCanChange,
}));

vi.mock("~/server/services/teacher-lessons", () => ({
  findTeacherLesson: mocks.findTeacherLesson,
  upsertTeacherLessonRecord: mocks.upsertTeacherLessonRecord,
}));

const { POST } = await import("./route");

describe("lesson evidence upload route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    });
    mocks.loadActiveUserSession.mockResolvedValue({
      user: {
        id: "user-1",
      },
      profile: {
        role: "teacher",
      },
    });
    mocks.requireMatchedTeacherPairing.mockResolvedValue({
      pairing: {
        id: "pairing-1",
      },
    });
    mocks.assertLessonRecordCanChange.mockResolvedValue(undefined);
    mocks.findTeacherLesson.mockResolvedValue({
      evidenceKey: "lessons/pairing-1/week-4/old.png",
    });
    mocks.getLessonEvidenceStorageMode.mockReturnValue("blob");
    mocks.buildProtectedLessonEvidenceUrl.mockImplementation(
      (lessonId: string, evidenceKey: string | null) => {
        if (!evidenceKey) {
          return null;
        }

        if (
          evidenceKey.startsWith("local:") ||
          mocks.getLessonEvidenceStorageMode() === "blob" ||
          mocks.getLessonEvidenceStorageMode() === "local"
        ) {
          return `/api/uploads/lesson-evidence/${lessonId}`;
        }

        return null;
      },
    );
    mocks.fileTypeFromBuffer.mockResolvedValue({
      ext: "png",
      mime: "image/png",
    });
    mocks.storeLessonEvidenceFile.mockResolvedValue({
      pathname: "lessons/pairing-1/week-4/new.png",
      url: "https://blob.example/lessons/pairing-1/week-4/new.png",
    });
    mocks.deleteStoredLessonEvidence.mockResolvedValue(undefined);
    mocks.upsertTeacherLessonRecord.mockResolvedValue({
      id: "lesson-1",
      weekNumber: 4,
      status: "taught",
      evidenceKey: "lessons/pairing-1/week-4/old.png",
      evidenceMime: "image/png",
      updatedAt: new Date("2026-03-11T00:00:00Z"),
      notes: {
        text: "Excellent focus.",
        visibility: "shared",
        updatedAt: new Date("2026-03-11T00:00:00Z"),
      },
    });
  });

  it("allows metadata-only saves without requiring blob storage", async () => {
    mocks.getLessonEvidenceStorageMode.mockReturnValue(null);

    const response = await POST(createRequest());
    const payload = (await response.json()) as {
      evidence: { mime: string | null; url: string | null };
      lesson: { status: string };
    };

    expect(response.status).toBe(200);
    expect(payload.lesson.status).toBe("taught");
    expect(payload.evidence).toEqual({
      mime: "image/png",
      url: null,
    });
    expect(mocks.storeLessonEvidenceFile).not.toHaveBeenCalled();
    expect(mocks.upsertTeacherLessonRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        uploadedEvidence: null,
      }),
    );
    expect(mocks.assertLessonRecordCanChange).toHaveBeenCalledWith({
      locale: "en",
      pairingId: "pairing-1",
      week: 4,
    });
  });

  it("returns a structured 503 when file uploads are attempted without blob storage", async () => {
    mocks.getLessonEvidenceStorageMode.mockReturnValue(null);

    const response = await POST(createRequest(withFile()));
    const payload = (await response.json()) as {
      error: { code: string; message: string };
    };

    expect(response.status).toBe(503);
    expect(payload.error.code).toBe("BLOB_NOT_CONFIGURED");
    expect(mocks.upsertTeacherLessonRecord).not.toHaveBeenCalled();
  });

  it("rejects oversized uploads before parsing the multipart body", async () => {
    const response = await POST(
      createRequest(undefined, {
        contentLength: 6 * 1024 * 1024,
      }),
    );
    const payload = (await response.json()) as {
      error: { code: string; message: string };
    };

    expect(response.status).toBe(413);
    expect(payload.error).toEqual({
      code: "FILE_TOO_LARGE",
      message: "File must be 5MB or smaller.",
    });
    expect(mocks.storeLessonEvidenceFile).not.toHaveBeenCalled();
    expect(mocks.upsertTeacherLessonRecord).not.toHaveBeenCalled();
  });

  it("rejects oversized uploads when content-length is absent", async () => {
    const response = await POST(
      createRequest(withFile("x".repeat(6 * 1024 * 1024))),
    );
    const payload = (await response.json()) as {
      error: { code: string; message: string };
    };

    expect(response.status).toBe(413);
    expect(payload.error).toEqual({
      code: "FILE_TOO_LARGE",
      message: "File must be 5MB or smaller.",
    });
    expect(mocks.storeLessonEvidenceFile).not.toHaveBeenCalled();
    expect(mocks.upsertTeacherLessonRecord).not.toHaveBeenCalled();
  });

  it("rejects non-multipart requests before attempting to parse them", async () => {
    const response = await POST(
      new Request("http://localhost/api/uploads/lesson-evidence", {
        method: "POST",
        headers: new Headers({
          "content-type": "application/json",
        }),
        body: JSON.stringify({
          notesText: "Excellent focus.",
          notesVisibility: "shared",
          status: "taught",
          week: 4,
        }),
      }),
    );
    const payload = (await response.json()) as {
      error: { code: string; message: string };
    };

    expect(response.status).toBe(415);
    expect(payload.error).toEqual({
      code: "BAD_CONTENT_TYPE",
      message: "Upload requests must use multipart form data.",
    });
    expect(mocks.storeLessonEvidenceFile).not.toHaveBeenCalled();
    expect(mocks.upsertTeacherLessonRecord).not.toHaveBeenCalled();
  });

  it("accepts uploads when local storage is configured", async () => {
    mocks.getLessonEvidenceStorageMode.mockReturnValue("local");
    mocks.storeLessonEvidenceFile.mockResolvedValue({
      pathname: "local:lessons/pairing-1/week-4/new.png",
      url: null,
    });
    mocks.upsertTeacherLessonRecord.mockResolvedValue({
      id: "lesson-1",
      weekNumber: 4,
      status: "taught",
      evidenceKey: "local:lessons/pairing-1/week-4/new.png",
      evidenceMime: "image/png",
      updatedAt: new Date("2026-03-11T00:00:00Z"),
      notes: {
        text: "Excellent focus.",
        visibility: "shared",
        updatedAt: new Date("2026-03-11T00:00:00Z"),
      },
    });

    const response = await POST(createRequest(withFile()));
    const payload = (await response.json()) as {
      evidence: { mime: string | null; url: string | null };
    };

    expect(response.status).toBe(200);
    expect(payload.evidence).toEqual({
      mime: "image/png",
      url: "/api/uploads/lesson-evidence/lesson-1",
    });
  });

  it("accepts Chinese notes that stay within the 2000-character limit", async () => {
    const notesText = "你".repeat(1000);

    const response = await POST(createRequest(undefined, { notesText }));
    const payload = (await response.json()) as {
      error?: { code: string; message: string };
      lesson?: { status: string };
    };

    expect(response.status).toBe(200);
    expect(payload.lesson?.status).toBe("taught");
    expect(mocks.upsertTeacherLessonRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        notesText,
      }),
    );
  });

  it("rejects truncated multi-byte notes instead of silently saving partial text", async () => {
    const response = await POST(
      createRequest(undefined, {
        notesText: "😀".repeat(2001),
      }),
    );
    const payload = (await response.json()) as {
      error: { code: string; message: string };
    };

    expect(response.status).toBe(400);
    expect(payload.error).toEqual({
      code: "BAD_LESSON_INPUT",
      message: "Lesson update payload is invalid.",
    });
    expect(mocks.upsertTeacherLessonRecord).not.toHaveBeenCalled();
  });

  it("cleans up the new blob when the database save fails", async () => {
    mocks.upsertTeacherLessonRecord.mockRejectedValue(
      new Error("database write failed"),
    );

    const response = await POST(createRequest(withFile()));
    const payload = (await response.json()) as {
      error: { code: string; message: string };
    };

    expect(response.status).toBe(500);
    expect(payload.error.code).toBe("LESSON_SAVE_FAILED");
    expect(payload.error.message).toBe(
      "Couldn't upload the lesson photo. Please try again.",
    );
    expect(mocks.deleteStoredLessonEvidence).toHaveBeenCalledWith(
      "lessons/pairing-1/week-4/new.png",
    );
    expect(console.error).toHaveBeenCalledWith(
      "[lesson-evidence]",
      expect.any(Error),
    );
  });

  it("blocks lesson saves when the booking for that week is not confirmed", async () => {
    mocks.assertLessonRecordCanChange.mockRejectedValue(
      new TRPCError({
        code: "CONFLICT",
        message:
          "This week's booking is not confirmed or has been cancelled, so the lesson record can't be saved.",
      }),
    );

    const response = await POST(createRequest(withFile()));
    const payload = (await response.json()) as {
      error: { code: string; message: string };
    };

    expect(response.status).toBe(409);
    expect(payload.error).toEqual({
      code: "LESSON_APPOINTMENT_NOT_CONFIRMED",
      message:
        "This week's booking is not confirmed or has been cancelled, so the lesson record can't be saved.",
    });
    expect(mocks.storeLessonEvidenceFile).not.toHaveBeenCalled();
    expect(mocks.upsertTeacherLessonRecord).not.toHaveBeenCalled();
  });

  it("deletes the old blob only after a successful replacement upload", async () => {
    mocks.upsertTeacherLessonRecord.mockResolvedValue({
      id: "lesson-1",
      weekNumber: 4,
      status: "taught",
      evidenceKey: "lessons/pairing-1/week-4/new.png",
      evidenceMime: "image/png",
      updatedAt: new Date("2026-03-11T00:00:00Z"),
      notes: {
        text: "Excellent focus.",
        visibility: "shared",
        updatedAt: new Date("2026-03-11T00:00:00Z"),
      },
    });

    const response = await POST(createRequest(withFile()));

    expect(response.status).toBe(200);
    expect(mocks.deleteStoredLessonEvidence).toHaveBeenCalledWith(
      "lessons/pairing-1/week-4/old.png",
    );
  });

  it("returns a structured 404 when the teacher has no assigned pairing", async () => {
    mocks.requireMatchedTeacherPairing.mockRejectedValue(
      new TRPCError({
        code: "NOT_FOUND",
        message: "Tutor has no assigned tutee",
      }),
    );

    const response = await POST(createRequest());
    const payload = (await response.json()) as {
      error: { code: string; message: string };
    };

    expect(response.status).toBe(404);
    expect(payload.error).toEqual({
      code: "PAIRING_NOT_FOUND",
      message: "Tutor has no assigned tutee",
    });
  });
});

function createRequest(
  file?: {
    contents: string;
    filename: string;
    type: string;
  },
  options?: {
    contentLength?: number;
    notesText?: string;
  },
) {
  const boundary = "----codex-upload-boundary";
  const body = buildMultipartBody(boundary, {
    file,
    notesText: options?.notesText,
  });
  const headers = new Headers({
    "content-type": `multipart/form-data; boundary=${boundary}`,
  });
  if (typeof options?.contentLength === "number") {
    headers.set("content-length", String(options.contentLength));
  }

  return new Request("http://localhost/api/uploads/lesson-evidence", {
    method: "POST",
    headers,
    body,
  });
}

function withFile(contents = "fake-png") {
  return {
    contents,
    filename: "lesson.png",
    type: "image/png",
  };
}

function buildMultipartBody(
  boundary: string,
  options: {
    file?: {
      contents: string;
      filename: string;
      type: string;
    };
    notesText?: string;
  },
) {
  const chunks = [
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="week"\r\n\r\n4\r\n`,
    ),
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="status"\r\n\r\ntaught\r\n`,
    ),
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="notesText"\r\n\r\n${options.notesText ?? "Excellent focus."}\r\n`,
    ),
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="notesVisibility"\r\n\r\nshared\r\n`,
    ),
  ];

  if (options.file) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${options.file.filename}"\r\nContent-Type: ${options.file.type}\r\n\r\n`,
      ),
      Buffer.from(options.file.contents),
      Buffer.from("\r\n"),
    );
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`));

  return Buffer.concat(chunks);
}
