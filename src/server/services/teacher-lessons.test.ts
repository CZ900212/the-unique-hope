import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  type ConflictInput = {
    set: Record<string, unknown>;
    target: unknown;
  };
  type TxMock = {
    insert: ReturnType<typeof vi.fn>;
    query: {
      lessons: {
        findFirst: ReturnType<typeof vi.fn>;
      };
    };
  };

  const insert = vi.fn();
  const lessonValues = vi.fn<
    (input: Record<string, unknown>) => { onConflictDoUpdate: typeof lessonConflict }
  >();
  const lessonConflict = vi.fn<
    (input: ConflictInput) => { returning: typeof lessonReturning }
  >();
  const lessonReturning = vi.fn<() => Promise<Array<{ id: string }>>>();
  const noteValues = vi.fn<
    (input: Record<string, unknown>) => { onConflictDoUpdate: typeof noteConflict }
  >();
  const noteConflict = vi.fn<(input: ConflictInput) => Promise<void>>();
  const findSavedLesson = vi.fn();
  const tx: TxMock = {
    insert,
    query: {
      lessons: {
        findFirst: findSavedLesson,
      },
    },
  };
  const transaction = vi.fn<(callback: (tx: TxMock) => unknown) => Promise<unknown>>();

  return {
    db: {
      transaction,
    },
    findSavedLesson,
    insert,
    lessonConflict,
    lessonReturning,
    lessonValues,
    noteConflict,
    noteValues,
    transaction,
    tx,
  };
});

vi.mock("~/server/db", () => ({
  db: mocks.db,
}));

const { upsertTeacherLessonRecord } = await import("./teacher-lessons");

describe("upsertTeacherLessonRecord", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.transaction.mockImplementation(async (callback) => callback(mocks.tx));
    mocks.insert
      .mockReturnValueOnce({
        values: mocks.lessonValues,
      })
      .mockReturnValueOnce({
        values: mocks.noteValues,
      });
    mocks.lessonValues.mockReturnValue({
      onConflictDoUpdate: mocks.lessonConflict,
    });
    mocks.lessonConflict.mockReturnValue({
      returning: mocks.lessonReturning,
    });
    mocks.lessonReturning.mockResolvedValue([{ id: "lesson-1" }]);
    mocks.noteValues.mockReturnValue({
      onConflictDoUpdate: mocks.noteConflict,
    });
    mocks.noteConflict.mockResolvedValue(undefined);
    mocks.findSavedLesson.mockResolvedValue({
      id: "lesson-1",
      pairingId: "pairing-1",
      weekNumber: 4,
      status: "taught",
      evidenceKey: "lessons/pairing-1/week-4/existing.png",
      evidenceMime: "image/png",
      evidenceUrl: null,
      updatedAt: new Date("2026-03-11T00:00:00Z"),
      notes: {
        id: "note-1",
        lessonId: "lesson-1",
        text: "Excellent focus.",
        visibility: "shared",
        updatedAt: new Date("2026-03-11T00:00:00Z"),
      },
    });
  });

  it("updates metadata without overwriting existing evidence fields", async () => {
    await upsertTeacherLessonRecord({
      pairingId: "pairing-1",
      week: 4,
      status: "taught",
      notesText: "Excellent focus.",
      notesVisibility: "shared",
      uploadedEvidence: null,
    });

    expect(mocks.lessonValues.mock.calls[0]?.[0]).toMatchObject({
      pairingId: "pairing-1",
      status: "taught",
      weekNumber: 4,
    });
    expect(mocks.lessonValues.mock.calls[0]?.[0]).not.toHaveProperty("evidenceKey");

    const conflictInput = mocks.lessonConflict.mock.calls[0]?.[0] as {
      set: Record<string, unknown>;
    };
    expect(conflictInput.set).toMatchObject({
      status: "taught",
    });
    expect(conflictInput.set).not.toHaveProperty("evidenceKey");
    expect(mocks.noteValues.mock.calls[0]?.[0]).toMatchObject({
      lessonId: "lesson-1",
      text: "Excellent focus.",
      visibility: "shared",
    });
  });

  it("persists new evidence fields when an upload succeeds", async () => {
    await upsertTeacherLessonRecord({
      pairingId: "pairing-1",
      week: 4,
      status: "taught",
      notesText: "Updated after upload.",
      notesVisibility: "private",
      uploadedEvidence: {
        mime: "image/webp",
        pathname: "lessons/pairing-1/week-4/new.webp",
        url: "https://blob.example/lessons/pairing-1/week-4/new.webp",
      },
    });

    expect(mocks.lessonValues.mock.calls[0]?.[0]).toMatchObject({
      evidenceKey: "lessons/pairing-1/week-4/new.webp",
      evidenceMime: "image/webp",
      evidenceUrl: null,
      pairingId: "pairing-1",
      status: "taught",
      weekNumber: 4,
    });
    const conflictInput = mocks.lessonConflict.mock.calls[0]?.[0] as {
      set: Record<string, unknown>;
    };

    expect(conflictInput.set).toMatchObject({
      evidenceKey: "lessons/pairing-1/week-4/new.webp",
      evidenceMime: "image/webp",
      evidenceUrl: null,
      status: "taught",
    });
  });
});
