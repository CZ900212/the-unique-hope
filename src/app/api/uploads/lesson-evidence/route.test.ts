import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  buildProtectedLessonEvidenceUrl: vi.fn((lessonId: string, evidenceKey: string | null) =>
    evidenceKey ? `/api/uploads/lesson-evidence/${lessonId}` : null,
  ),
  del: vi.fn(),
  fileTypeFromBuffer: vi.fn(),
  findTeacherLesson: vi.fn(),
  getBlobReadWriteToken: vi.fn(),
  getPairingForTeacher: vi.fn(),
  loadActiveUserSession: vi.fn(),
  put: vi.fn(),
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

vi.mock("@vercel/blob", () => ({
  del: mocks.del,
  put: mocks.put,
}));

vi.mock("file-type", () => ({
  fileTypeFromBuffer: mocks.fileTypeFromBuffer,
}));

vi.mock("~/server/lesson-evidence", () => ({
  buildProtectedLessonEvidenceUrl: mocks.buildProtectedLessonEvidenceUrl,
  getBlobReadWriteToken: mocks.getBlobReadWriteToken,
}));

vi.mock("~/server/services/pairings", () => ({
  getPairingForTeacher: mocks.getPairingForTeacher,
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
    mocks.getPairingForTeacher.mockResolvedValue({
      pairing: {
        id: "pairing-1",
      },
    });
    mocks.findTeacherLesson.mockResolvedValue({
      evidenceKey: "lessons/pairing-1/week-4/old.png",
    });
    mocks.getBlobReadWriteToken.mockReturnValue("blob-token");
    mocks.fileTypeFromBuffer.mockResolvedValue({
      ext: "png",
      mime: "image/png",
    });
    mocks.put.mockResolvedValue({
      pathname: "lessons/pairing-1/week-4/new.png",
      url: "https://blob.example/lessons/pairing-1/week-4/new.png",
    });
    mocks.del.mockResolvedValue(undefined);
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
    mocks.getBlobReadWriteToken.mockReturnValue(null);

    const response = await POST(createRequest());
    const payload = (await response.json()) as {
      evidence: { mime: string | null; url: string | null };
      lesson: { status: string };
    };

    expect(response.status).toBe(200);
    expect(payload.lesson.status).toBe("taught");
    expect(payload.evidence).toEqual({
      mime: "image/png",
      url: "/api/uploads/lesson-evidence/lesson-1",
    });
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.upsertTeacherLessonRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        uploadedEvidence: null,
      }),
    );
  });

  it("returns a structured 503 when file uploads are attempted without blob storage", async () => {
    mocks.getBlobReadWriteToken.mockReturnValue(null);

    const response = await POST(createRequest(withFile()));
    const payload = (await response.json()) as { error: { code: string; message: string } };

    expect(response.status).toBe(503);
    expect(payload.error.code).toBe("BLOB_NOT_CONFIGURED");
    expect(mocks.upsertTeacherLessonRecord).not.toHaveBeenCalled();
  });

  it("cleans up the new blob when the database save fails", async () => {
    mocks.upsertTeacherLessonRecord.mockRejectedValue(new Error("database write failed"));

    const response = await POST(createRequest(withFile()));
    const payload = (await response.json()) as { error: { code: string; message: string } };

    expect(response.status).toBe(500);
    expect(payload.error.code).toBe("LESSON_SAVE_FAILED");
    expect(payload.error.message).toBe("Unable to upload lesson evidence right now.");
    expect(mocks.del).toHaveBeenCalledWith("lessons/pairing-1/week-4/new.png", {
      token: "blob-token",
    });
    expect(console.error).toHaveBeenCalledWith(
      "[lesson-evidence]",
      expect.any(Error),
    );
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
    expect(mocks.del).toHaveBeenCalledWith("lessons/pairing-1/week-4/old.png", {
      token: "blob-token",
    });
  });

  it("returns a structured 404 when the teacher has no assigned pairing", async () => {
    mocks.getPairingForTeacher.mockRejectedValue(
      new TRPCError({
        code: "NOT_FOUND",
        message: "Teacher has no assigned student",
      }),
    );

    const response = await POST(createRequest());
    const payload = (await response.json()) as { error: { code: string; message: string } };

    expect(response.status).toBe(404);
    expect(payload.error).toEqual({
      code: "PAIRING_NOT_FOUND",
      message: "Teacher has no assigned student",
    });
  });
});

function createRequest(file?: File) {
  const formData = new FormData();
  formData.set("week", "4");
  formData.set("status", "taught");
  formData.set("notesText", "Excellent focus.");
  formData.set("notesVisibility", "shared");

  if (file) {
    formData.set("file", file);
  }

  return new Request("http://localhost/api/uploads/lesson-evidence", {
    method: "POST",
    body: formData,
  });
}

function withFile() {
  return new File(["fake-png"], "lesson.png", {
    type: "image/png",
  });
}
