import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL ??=
  "postgres://postgres:postgres@localhost:5432/unique_hope_test";
process.env.NEXT_PUBLIC_APP_NAME ??= "The Unique Hope";
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";
process.env.NEXT_PUBLIC_DEFAULT_LOCALE ??= "en";

const mocks = vi.hoisted(() => ({
  buildProtectedLessonEvidenceUrl: vi.fn(
    (lessonId: string) => `/api/uploads/lesson-evidence/${lessonId}`,
  ),
  deleteStoredLessonEvidence: vi.fn(),
  loadActiveUserSession: vi.fn(),
  notifyPairingCreated: vi.fn(),
}));

vi.mock("~/server/auth/active-session", () => ({
  loadActiveUserSession: mocks.loadActiveUserSession,
}));

vi.mock("~/server/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("~/server/lesson-evidence", () => ({
  buildProtectedLessonEvidenceUrl: mocks.buildProtectedLessonEvidenceUrl,
  deleteStoredLessonEvidence: mocks.deleteStoredLessonEvidence,
}));

vi.mock("~/server/services/notifications", () => ({
  notifyPairingCreated: mocks.notifyPairingCreated,
}));

const { adminRouter } = await import("./admin");
const { createCallerFactory } = await import("~/server/api/trpc");
const { pairings, profiles, studentSignups, teacherSignups } =
  await import("~/server/db/schema");

const createCaller = createCallerFactory(adminRouter);

function createTx() {
  const updateTables: unknown[] = [];
  const deleteTables: unknown[] = [];

  return {
    deleteTables,
    tx: {
      delete: vi.fn((table: unknown) => {
        deleteTables.push(table);
        return {
          where: vi.fn().mockResolvedValue(undefined),
        };
      }),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{ id: "pairing-1" }]),
        })),
      })),
      query: {
        pairings: {
          findFirst: vi.fn(),
        },
      },
      update: vi.fn((table: unknown) => {
        updateTables.push(table);
        return {
          set: vi.fn(() => ({
            where: vi.fn().mockResolvedValue(undefined),
          })),
        };
      }),
    },
    updateTables,
  };
}

function createDb() {
  return {
    query: {
      pairings: {
        findFirst: vi.fn(),
      },
      profiles: {
        findFirst: vi.fn(),
      },
      studentSignups: {
        findFirst: vi.fn(),
      },
      teacherSignups: {
        findFirst: vi.fn(),
      },
    },
    transaction: vi.fn(),
  };
}

describe("admin pairing rules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadActiveUserSession.mockResolvedValue({
      profile: {
        id: "admin-profile",
        role: "admin",
      },
      session: {
        user: {
          id: "admin-user",
        },
      },
      user: {
        id: "admin-user",
      },
    });
  });

  it("requires both signups to be approved before creating a pairing", async () => {
    const db = createDb();
    db.query.profiles.findFirst
      .mockResolvedValueOnce({
        id: "student-profile",
        matchStatus: "pending",
        role: "student",
      })
      .mockResolvedValueOnce({
        id: "teacher-profile",
        matchStatus: "pending",
        role: "teacher",
      });
    db.query.studentSignups.findFirst.mockResolvedValue({
      id: "student-signup",
      profileId: "student-profile",
      reviewedAt: null,
      status: "pending",
    });
    db.query.teacherSignups.findFirst.mockResolvedValue({
      id: "teacher-signup",
      profileId: "teacher-profile",
      reviewedAt: new Date("2026-04-13T00:00:00Z"),
      status: "approved",
    });

    const caller = createCaller({
      db: db as never,
      headers: new Headers(),
      locale: "en",
      session: null,
    });

    await expect(
      caller.createPairing({
        studentProfileId: "11111111-1111-1111-8111-111111111111",
        teacherProfileId: "22222222-2222-2222-8222-222222222222",
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Both accounts must be approved before they can be matched.",
    });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("preserves signup review metadata when creating an approved pairing", async () => {
    const db = createDb();
    const { tx, updateTables } = createTx();
    const reviewedAt = new Date("2026-04-10T10:00:00Z");
    db.query.profiles.findFirst
      .mockResolvedValueOnce({
        id: "student-profile",
        matchStatus: "pending",
        role: "student",
      })
      .mockResolvedValueOnce({
        id: "teacher-profile",
        matchStatus: "pending",
        role: "teacher",
      });
    db.query.studentSignups.findFirst.mockResolvedValue({
      id: "student-signup",
      profileId: "student-profile",
      reviewedAt,
      status: "approved",
    });
    db.query.teacherSignups.findFirst.mockResolvedValue({
      id: "teacher-signup",
      profileId: "teacher-profile",
      reviewedAt,
      status: "approved",
    });
    tx.query.pairings.findFirst.mockResolvedValue({
      createdAt: new Date("2026-04-13T00:00:00Z"),
      id: "pairing-1",
      student: {
        contact: "parent@example.com",
        id: "student-profile",
        name: "Approved Student",
        role: "student",
        username: "approved-student",
      },
      teacher: {
        id: "teacher-profile",
        name: "Approved Teacher",
        role: "teacher",
        username: "approved-teacher",
      },
    });
    db.transaction.mockImplementation(
      async (callback: (transaction: unknown) => Promise<unknown>) =>
        callback(tx),
    );

    const caller = createCaller({
      db: db as never,
      headers: new Headers(),
      locale: "en",
      session: null,
    });

    const result = await caller.createPairing({
      studentProfileId: "11111111-1111-1111-8111-111111111111",
      teacherProfileId: "22222222-2222-2222-8222-222222222222",
    });

    expect(result.pairing.id).toBe("pairing-1");
    expect(updateTables).toEqual([profiles]);
    expect(updateTables).not.toContain(studentSignups);
    expect(updateTables).not.toContain(teacherSignups);
  });

  it("blocks removing a pairing once any teaching history exists", async () => {
    const db = createDb();
    db.query.pairings.findFirst.mockResolvedValue({
      feedback: [],
      id: "pairing-1",
      lessons: [
        {
          evidenceKey: null,
          id: "lesson-1",
        },
      ],
      student: {
        id: "student-profile",
      },
      teacher: {
        id: "teacher-profile",
      },
    });

    const caller = createCaller({
      db: db as never,
      headers: new Headers(),
      locale: "en",
      session: null,
    });

    await expect(
      caller.deletePairing({ id: "11111111-1111-1111-8111-111111111111" }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message:
        "This pairing already has saved lessons or feedback and can't be removed.",
    });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("returns an empty pairing to the waiting pool without rewriting signup review state", async () => {
    const db = createDb();
    const { deleteTables, tx, updateTables } = createTx();
    db.query.pairings.findFirst.mockResolvedValue({
      feedback: [],
      id: "pairing-1",
      lessons: [],
      student: {
        id: "student-profile",
      },
      teacher: {
        id: "teacher-profile",
      },
    });
    db.transaction.mockImplementation(
      async (callback: (transaction: unknown) => Promise<unknown>) =>
        callback(tx),
    );

    const caller = createCaller({
      db: db as never,
      headers: new Headers(),
      locale: "en",
      session: null,
    });

    const result = await caller.deletePairing({
      id: "11111111-1111-1111-8111-111111111111",
    });

    expect(result).toEqual({ ok: true });
    expect(deleteTables).toEqual([pairings]);
    expect(updateTables).toEqual([profiles]);
    expect(updateTables).not.toContain(studentSignups);
    expect(updateTables).not.toContain(teacherSignups);
  });

  it("returns admin pairing details with private feedback included", async () => {
    const db = createDb();
    db.query.pairings.findFirst.mockResolvedValue({
      createdAt: new Date("2026-04-10T08:00:00Z"),
      feedback: [
        {
          rating: 4,
          text: "Private feedback from student",
          updatedAt: new Date("2026-04-15T08:00:00Z"),
          visibility: "private",
          weekNumber: 2,
        },
      ],
      id: "pairing-1",
      lessons: [
        {
          evidenceKey: "evidence-key-2",
          id: "lesson-2",
          notes: {
            text: "Private teacher note",
            updatedAt: new Date("2026-04-14T08:00:00Z"),
            visibility: "private",
          },
          status: "taught",
          updatedAt: new Date("2026-04-14T08:00:00Z"),
          weekNumber: 2,
        },
      ],
      meetingLink: "https://meeting.tencent.com/demo-room",
      student: {
        contact: "parent@example.com",
        id: "student-profile",
        name: "Demo Student",
        role: "student",
        userId: "student-user",
        username: "demo_student",
      },
      teacher: {
        contact: "teacher@example.com",
        id: "teacher-profile",
        name: "Demo Teacher",
        role: "teacher",
        userId: "teacher-user",
        username: "demo_teacher",
      },
    });

    const caller = createCaller({
      db: db as never,
      headers: new Headers(),
      locale: "en",
      session: null,
    });

    const result = await caller.pairingDetails({
      id: "11111111-1111-1111-8111-111111111111",
    });

    expect(result.pairing.meetingLink).toBe(
      "https://meeting.tencent.com/demo-room",
    );
    expect(result.summary.feedbackCount).toBe(1);
    expect(result.summary.latestFeedback).toMatchObject({
      visibility: "private",
      weekNumber: 2,
    });
    expect(result.weeks[1]).toMatchObject({
      feedbackVisibility: "private",
      hasEvidence: true,
      hasFeedback: true,
      hasTeacherNote: true,
      lessonStatus: "taught",
      teacherNoteVisibility: "private",
      weekNumber: 2,
    });
    expect(result.weekDetails[1]).toMatchObject({
      feedbackVisibility: "private",
      studentFeedback: {
        rating: 4,
        text: "Private feedback from student",
        visibility: "private",
      },
      teacherNote: {
        text: "Private teacher note",
        visibility: "private",
      },
      weekNumber: 2,
    });
    expect(result.weekDetails[2]).toMatchObject({
      evidenceUrl: null,
      hasEvidence: false,
      hasFeedback: false,
      hasTeacherNote: false,
      lessonStatus: "pending",
      studentFeedback: null,
      teacherNote: null,
      weekNumber: 3,
    });
  });

  it("rejects pairing details for non-admin sessions", async () => {
    mocks.loadActiveUserSession.mockResolvedValue({
      profile: {
        id: "student-profile",
        role: "student",
      },
      session: {
        user: {
          id: "student-user",
        },
      },
      user: {
        id: "student-user",
      },
    });

    const caller = createCaller({
      db: createDb() as never,
      headers: new Headers(),
      locale: "en",
      session: null,
    });

    await expect(
      caller.pairingDetails({
        id: "11111111-1111-1111-8111-111111111111",
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
