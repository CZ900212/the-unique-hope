import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findLesson: vi.fn(),
  getLessonEvidenceStorageMode: vi.fn(),
  isLocalLessonEvidenceKey: vi.fn(),
  loadActiveUserSession: vi.fn(),
  resolveStoredLessonEvidence: vi.fn(),
}));

vi.mock("~/server/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("~/server/auth/active-session", () => ({
  loadActiveUserSession: mocks.loadActiveUserSession,
}));

vi.mock("~/server/db", () => ({
  db: {
    query: {
      lessons: {
        findFirst: mocks.findLesson,
      },
    },
  },
}));

vi.mock("~/server/lesson-evidence", () => ({
  getLessonEvidenceStorageMode: mocks.getLessonEvidenceStorageMode,
  isLocalLessonEvidenceKey: mocks.isLocalLessonEvidenceKey,
  resolveStoredLessonEvidence: mocks.resolveStoredLessonEvidence,
}));

const { GET } = await import("./route");

describe("lesson evidence download route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({
      user: {
        id: "teacher-user-1",
      },
    });
    mocks.loadActiveUserSession.mockResolvedValue({
      profile: {
        id: "teacher-profile-1",
        role: "teacher",
      },
      user: {
        id: "teacher-user-1",
      },
    });
    mocks.findLesson.mockResolvedValue({
      evidenceKey: "local:lessons/pairing-1/week-1/file.png",
      evidenceMime: "image/png",
      pairing: {
        studentProfileId: "student-profile-1",
        teacherProfileId: "teacher-profile-1",
      },
    });
    mocks.getLessonEvidenceStorageMode.mockReturnValue("local");
    mocks.isLocalLessonEvidenceKey.mockImplementation((value: string) =>
      value.startsWith("local:"),
    );
    mocks.resolveStoredLessonEvidence.mockResolvedValue({
      buffer: Buffer.from("image-data"),
      contentLength: 10,
      kind: "local",
      mime: "image/png",
    });
  });

  it("serves evidence to the matched teacher using the active profile", async () => {
    const response = await GET(
      new Request("http://localhost/api/uploads/lesson-evidence/lesson-1"),
      {
        params: Promise.resolve({ lessonId: "lesson-1" }),
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe(
      "private, no-store, max-age=0",
    );
    expect(await response.text()).toBe("image-data");
    expect(mocks.resolveStoredLessonEvidence).toHaveBeenCalledWith(
      "local:lessons/pairing-1/week-1/file.png",
      "image/png",
    );
  });

  it("rejects users outside the pairing", async () => {
    mocks.loadActiveUserSession.mockResolvedValue({
      profile: {
        id: "other-teacher-profile",
        role: "teacher",
      },
      user: {
        id: "teacher-user-2",
      },
    });

    const response = await GET(
      new Request("http://localhost/api/uploads/lesson-evidence/lesson-1"),
      {
        params: Promise.resolve({ lessonId: "lesson-1" }),
      },
    );
    const payload = (await response.json()) as {
      error?: { code?: string };
    };

    expect(response.status).toBe(403);
    expect(payload.error?.code).toBe("FORBIDDEN");
    expect(mocks.resolveStoredLessonEvidence).not.toHaveBeenCalled();
  });
});
