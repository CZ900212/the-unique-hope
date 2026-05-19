import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  and: vi.fn((...conditions: unknown[]) => ({ conditions, op: "and" })),
  eq: vi.fn((field: unknown, value: unknown) => ({ field, op: "eq", value })),
  gt: vi.fn((field: unknown, value: unknown) => ({ field, op: "gt", value })),
  inArray: vi.fn((field: unknown, values: unknown[]) => ({
    field,
    op: "inArray",
    values,
  })),
  insert: vi.fn(),
  ne: vi.fn((field: unknown, value: unknown) => ({ field, op: "ne", value })),
  appointmentFindFirst: vi.fn(),
  pairingFindFirst: vi.fn(),
  returning: vi.fn(),
  set: vi.fn(),
  update: vi.fn(),
  values: vi.fn(),
  where: vi.fn(),
  notifyAppointmentRequested: vi.fn(),
  notifyAppointmentResponded: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
  and: mocks.and,
  eq: mocks.eq,
  gt: mocks.gt,
  inArray: mocks.inArray,
  ne: mocks.ne,
}));

vi.mock("~/server/db/schema", () => ({
  lessonAppointments: {
    cancellationReason: "appointment.cancellationReason",
    cancellationRequestedBy: "appointment.cancellationRequestedBy",
    cancellationResponseReason: "appointment.cancellationResponseReason",
    durationMinutes: "appointment.durationMinutes",
    id: "appointment.id",
    pairingId: "appointment.pairingId",
    requestedBy: "appointment.requestedBy",
    respondedAt: "appointment.respondedAt",
    responseReason: "appointment.responseReason",
    scheduledStart: "appointment.scheduledStart",
    status: "appointment.status",
    updatedAt: "appointment.updatedAt",
    weekNumber: "appointment.weekNumber",
  },
  pairings: {
    id: "pairing.id",
  },
}));

vi.mock("~/server/db", () => ({
  db: {
    query: {
      lessonAppointments: {
        findFirst: mocks.appointmentFindFirst,
      },
      pairings: {
        findFirst: mocks.pairingFindFirst,
      },
    },
    insert: mocks.insert,
    update: mocks.update,
  },
}));

vi.mock("~/server/services/notifications", () => ({
  notifyAppointmentRequested: mocks.notifyAppointmentRequested,
  notifyAppointmentResponded: mocks.notifyAppointmentResponded,
}));

const {
  assertLessonRecordCanChange,
  requestLessonAppointment,
  respondToLessonAppointment,
} = await import("./appointments");

describe("lesson record appointment gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not block week-based lesson records now that booking is per session", async () => {
    await expect(
      assertLessonRecordCanChange({
        locale: "en",
        pairingId: "pairing-1",
        week: 4,
      }),
    ).resolves.toBeUndefined();
    expect(mocks.appointmentFindFirst).not.toHaveBeenCalled();
  });
});

describe("appointment requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pairingFindFirst.mockResolvedValue({
      id: "pairing-1",
      student: { id: "student-profile", name: "Student", username: "student" },
      teacher: { id: "teacher-profile", name: "Teacher", username: "teacher" },
    });
    mocks.returning.mockResolvedValue([
      {
        id: "appointment-1",
        pairingId: "pairing-1",
        requestedBy: "teacher",
        scheduledStart: new Date("2099-05-01T10:30:00.000Z"),
        status: "pending",
      },
    ]);
    mocks.values.mockReturnValue({
      returning: mocks.returning,
    });
    mocks.where.mockReturnValue({
      returning: mocks.returning,
    });
    mocks.set.mockReturnValue({
      where: mocks.where,
    });
    mocks.insert.mockReturnValue({
      values: mocks.values,
    });
    mocks.update.mockReturnValue({
      set: mocks.set,
    });
  });

  it("creates a per-session appointment without a course week", async () => {
    const scheduledStart = new Date("2099-05-01T10:30:00.000Z");

    await requestLessonAppointment({
      durationMinutes: 60,
      locale: "en",
      pairingId: "pairing-1",
      requestedBy: "student",
      scheduledStart,
    });

    expect(mocks.values).toHaveBeenCalledWith(
      expect.objectContaining({
        durationMinutes: 60,
        pairingId: "pairing-1",
        requestedBy: "student",
        scheduledStart,
        status: "pending",
        weekNumber: null,
      }),
    );
    expect(mocks.notifyAppointmentRequested).toHaveBeenCalledWith(
      expect.objectContaining({
        actorRole: "student",
        isTimeChange: false,
      }),
    );
  });

  it("updates a reusable appointment as a new proposed time", async () => {
    const scheduledStart = new Date("2099-05-01T10:30:00.000Z");
    mocks.appointmentFindFirst.mockResolvedValue({
      id: "appointment-1",
      pairingId: "pairing-1",
      scheduledStart,
      status: "pending",
    });

    await requestLessonAppointment({
      appointmentId: "appointment-1",
      durationMinutes: 45,
      locale: "en",
      pairingId: "pairing-1",
      requestedBy: "teacher",
      scheduledStart,
    });

    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({
        cancellationReason: null,
        cancellationRequestedBy: null,
        cancellationResponseReason: null,
        requestedBy: "teacher",
        responseReason: null,
        status: "pending",
      }),
    );
    expect(mocks.notifyAppointmentRequested).toHaveBeenCalledWith(
      expect.objectContaining({
        actorRole: "teacher",
        isTimeChange: true,
      }),
    );
  });

  it("rejects changing appointments that are already locked", async () => {
    mocks.appointmentFindFirst.mockResolvedValue({
      id: "appointment-1",
      pairingId: "pairing-1",
      status: "confirmed",
    });

    await expect(
      requestLessonAppointment({
        appointmentId: "appointment-1",
        durationMinutes: 45,
        locale: "en",
        pairingId: "pairing-1",
        requestedBy: "teacher",
        scheduledStart: new Date("2099-05-01T10:30:00.000Z"),
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This booking request has already been handled.",
    });
  });
});

describe("appointment responses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pairingFindFirst.mockResolvedValue({
      id: "pairing-1",
      student: { id: "student-profile", name: "Student", username: "student" },
      teacher: { id: "teacher-profile", name: "Teacher", username: "teacher" },
    });
    mocks.appointmentFindFirst.mockResolvedValue({
      id: "appointment-1",
      pairingId: "pairing-1",
      requestedBy: "teacher",
      scheduledStart: new Date("2099-05-01T10:30:00.000Z"),
      status: "pending",
    });
    mocks.returning.mockResolvedValue([
      {
        id: "appointment-1",
        pairingId: "pairing-1",
        requestedBy: "teacher",
        status: "declined",
      },
    ]);
    mocks.where.mockReturnValue({
      returning: mocks.returning,
    });
    mocks.set.mockReturnValue({
      where: mocks.where,
    });
    mocks.update.mockReturnValue({
      set: mocks.set,
    });
  });

  it("requires a reason when declining or requesting cancellation", async () => {
    await expect(
      respondToLessonAppointment({
        action: "decline",
        appointmentId: "appointment-1",
        locale: "en",
        pairingId: "pairing-1",
        responder: "student",
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Please provide a reason.",
    });
  });

  it("stores the decline reason and notifies the requester", async () => {
    await respondToLessonAppointment({
      action: "decline",
      appointmentId: "appointment-1",
      locale: "en",
      pairingId: "pairing-1",
      reason: "That time is not possible.",
      responder: "student",
    });

    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({
        responseReason: "That time is not possible.",
        status: "declined",
      }),
    );
    expect(mocks.notifyAppointmentResponded).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "decline",
        reason: "That time is not possible.",
        responder: "student",
      }),
    );
  });

  it("stores cancellation request reasons", async () => {
    mocks.appointmentFindFirst.mockResolvedValue({
      id: "appointment-1",
      pairingId: "pairing-1",
      requestedBy: "teacher",
      scheduledStart: new Date("2099-05-01T10:30:00.000Z"),
      status: "confirmed",
    });

    await respondToLessonAppointment({
      action: "request_cancel",
      appointmentId: "appointment-1",
      locale: "en",
      pairingId: "pairing-1",
      reason: "Family emergency.",
      responder: "teacher",
    });

    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({
        cancellationReason: "Family emergency.",
        cancellationRequestedBy: "teacher",
        status: "cancellation_pending",
      }),
    );
  });

  it("stores a reason when a cancellation request is declined", async () => {
    mocks.appointmentFindFirst.mockResolvedValue({
      cancellationRequestedBy: "teacher",
      id: "appointment-1",
      pairingId: "pairing-1",
      requestedBy: "teacher",
      scheduledStart: new Date("2099-05-01T10:30:00.000Z"),
      status: "cancellation_pending",
    });

    await respondToLessonAppointment({
      action: "decline",
      appointmentId: "appointment-1",
      locale: "en",
      pairingId: "pairing-1",
      reason: "We can still attend.",
      responder: "student",
    });

    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({
        cancellationResponseReason: "We can still attend.",
        status: "confirmed",
      }),
    );
  });
});
