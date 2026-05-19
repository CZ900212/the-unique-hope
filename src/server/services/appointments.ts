import { and, eq, gt, inArray, ne } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import {
  type AppointmentRequestedBy,
  type AppointmentStatus,
} from "~/lib/domain";
import { getMessages, type Locale } from "~/lib/i18n";
import { db } from "~/server/db";
import { lessonAppointments, pairings } from "~/server/db/schema";
import {
  notifyAppointmentRequested,
  notifyAppointmentResponded,
} from "~/server/services/notifications";

type LessonAppointment = typeof lessonAppointments.$inferSelect;

const REUSABLE_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "pending",
  "declined",
  "cancelled",
];

export function serializeAppointment(appointment: LessonAppointment) {
  return {
    id: appointment.id,
    weekNumber: appointment.weekNumber,
    scheduledStart: appointment.scheduledStart,
    durationMinutes: appointment.durationMinutes,
    status: appointment.status,
    requestedBy: appointment.requestedBy,
    cancellationRequestedBy: appointment.cancellationRequestedBy,
    responseReason: appointment.responseReason,
    cancellationReason: appointment.cancellationReason,
    cancellationResponseReason: appointment.cancellationResponseReason,
    respondedAt: appointment.respondedAt,
    createdAt: appointment.createdAt,
    updatedAt: appointment.updatedAt,
  };
}

export function serializeAppointments(appointments: LessonAppointment[]) {
  return appointments.map(serializeAppointment);
}

export async function assertLessonRecordCanChange(_input: {
  locale: Locale;
  pairingId: string;
  week: number;
}) {
  // Appointments are now scheduled per lesson session rather than by course week.
  // Lesson evidence remains week-based, so there is no appointment gate here.
}

export async function requestLessonAppointment(input: {
  appointmentId?: string;
  durationMinutes: number;
  locale: Locale;
  pairingId: string;
  requestedBy: AppointmentRequestedBy;
  scheduledStart: Date;
}) {
  const messages = getMessages(input.locale);
  const now = new Date();

  if (input.scheduledStart.getTime() <= now.getTime()) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: messages.errors.appointmentTimeElapsed,
    });
  }

  const existing = input.appointmentId
    ? await db.query.lessonAppointments.findFirst({
        where: and(
          eq(lessonAppointments.id, input.appointmentId),
          eq(lessonAppointments.pairingId, input.pairingId),
        ),
      })
    : null;

  if (input.appointmentId && !existing) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: messages.errors.appointmentNotFound,
    });
  }

  if (existing && !REUSABLE_APPOINTMENT_STATUSES.includes(existing.status)) {
    throw new TRPCError({
      code: "CONFLICT",
      message: messages.errors.appointmentAlreadyResolved,
    });
  }

  const [appointment] = existing
    ? await db
        .update(lessonAppointments)
        .set({
          cancellationReason: null,
          cancellationRequestedBy: null,
          cancellationResponseReason: null,
          durationMinutes: input.durationMinutes,
          requestedBy: input.requestedBy,
          respondedAt: null,
          responseReason: null,
          scheduledStart: input.scheduledStart,
          status: "pending",
          updatedAt: now,
        })
        .where(
          and(
            eq(lessonAppointments.id, existing.id),
            eq(lessonAppointments.pairingId, input.pairingId),
            inArray(lessonAppointments.status, REUSABLE_APPOINTMENT_STATUSES),
          ),
        )
        .returning()
    : await db
        .insert(lessonAppointments)
        .values({
          durationMinutes: input.durationMinutes,
          pairingId: input.pairingId,
          requestedBy: input.requestedBy,
          scheduledStart: input.scheduledStart,
          status: "pending",
          updatedAt: now,
          weekNumber: null,
        })
        .returning();

  if (!appointment) {
    throw new TRPCError({
      code: "CONFLICT",
      message: messages.errors.appointmentAlreadyResolved,
    });
  }

  const pairing = await loadPairingForNotification(input.pairingId);
  if (pairing) {
    await notifyAppointmentRequested({
      actorRole: input.requestedBy,
      appointment,
      isTimeChange: Boolean(existing),
      pairing,
    });
  }

  return appointment;
}

export async function respondToLessonAppointment(input: {
  action: "confirm" | "decline" | "request_cancel";
  appointmentId: string;
  pairingId: string;
  reason?: string;
  responder: AppointmentRequestedBy;
  locale: Locale;
}) {
  const messages = getMessages(input.locale);
  const reason = input.reason?.trim() ?? "";
  if (
    (input.action === "decline" || input.action === "request_cancel") &&
    !reason
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: messages.errors.appointmentReasonRequired,
    });
  }

  const appointment = await db.query.lessonAppointments.findFirst({
    where: and(
      eq(lessonAppointments.id, input.appointmentId),
      eq(lessonAppointments.pairingId, input.pairingId),
    ),
  });

  if (!appointment) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: messages.errors.appointmentNotFound,
    });
  }

  if (input.action === "request_cancel") {
    if (appointment.status !== "confirmed") {
      throw new TRPCError({
        code: "CONFLICT",
        message: messages.errors.appointmentAlreadyResolved,
      });
    }

    const now = new Date();

    if (appointment.scheduledStart.getTime() <= now.getTime()) {
      throw new TRPCError({
        code: "CONFLICT",
        message: messages.errors.appointmentTimeElapsed,
      });
    }

    const [updated] = await db
      .update(lessonAppointments)
      .set({
        cancellationReason: reason,
        cancellationRequestedBy: input.responder,
        cancellationResponseReason: null,
        respondedAt: null,
        status: "cancellation_pending",
        updatedAt: now,
      })
      .where(
        and(
          eq(lessonAppointments.id, appointment.id),
          eq(lessonAppointments.pairingId, input.pairingId),
          eq(lessonAppointments.status, "confirmed"),
          gt(lessonAppointments.scheduledStart, now),
        ),
      )
      .returning();

    if (!updated) {
      throw new TRPCError({
        code: "CONFLICT",
        message: messages.errors.appointmentAlreadyResolved,
      });
    }

    await notifyResponse(input, appointment, reason);
    return updated;
  }

  if (appointment.status === "cancellation_pending") {
    if (appointment.cancellationRequestedBy === input.responder) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: messages.errors.appointmentResponderRequired,
      });
    }

    const now = new Date();

    if (appointment.scheduledStart.getTime() <= now.getTime()) {
      throw new TRPCError({
        code: "CONFLICT",
        message: messages.errors.appointmentTimeElapsed,
      });
    }

    const status: AppointmentStatus =
      input.action === "confirm" ? "cancelled" : "confirmed";
    const [updated] = await db
      .update(lessonAppointments)
      .set({
        cancellationRequestedBy: appointment.cancellationRequestedBy,
        cancellationResponseReason: input.action === "decline" ? reason : null,
        respondedAt: now,
        status,
        updatedAt: now,
      })
      .where(
        and(
          eq(lessonAppointments.id, appointment.id),
          eq(lessonAppointments.pairingId, input.pairingId),
          eq(lessonAppointments.status, "cancellation_pending"),
          ne(lessonAppointments.cancellationRequestedBy, input.responder),
          gt(lessonAppointments.scheduledStart, now),
        ),
      )
      .returning();

    if (!updated) {
      throw new TRPCError({
        code: "CONFLICT",
        message: messages.errors.appointmentAlreadyResolved,
      });
    }

    await notifyResponse(input, appointment, reason);
    return updated;
  }

  if (appointment.status !== "pending") {
    throw new TRPCError({
      code: "CONFLICT",
      message: messages.errors.appointmentAlreadyResolved,
    });
  }

  if (appointment.requestedBy === input.responder) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: messages.errors.appointmentResponderRequired,
    });
  }

  const now = new Date();

  if (appointment.scheduledStart.getTime() <= now.getTime()) {
    throw new TRPCError({
      code: "CONFLICT",
      message: messages.errors.appointmentTimeElapsed,
    });
  }

  const status: AppointmentStatus =
    input.action === "confirm" ? "confirmed" : "declined";
  const [updated] = await db
    .update(lessonAppointments)
    .set({
      cancellationRequestedBy: null,
      respondedAt: now,
      responseReason: input.action === "decline" ? reason : null,
      status,
      updatedAt: now,
    })
    .where(
      and(
        eq(lessonAppointments.id, appointment.id),
        eq(lessonAppointments.pairingId, input.pairingId),
        eq(lessonAppointments.status, "pending"),
        ne(lessonAppointments.requestedBy, input.responder),
      ),
    )
    .returning();

  if (!updated) {
    throw new TRPCError({
      code: "CONFLICT",
      message: messages.errors.appointmentAlreadyResolved,
    });
  }

  await notifyResponse(input, appointment, reason);
  return updated;
}

async function notifyResponse(
  input: {
    action: "confirm" | "decline" | "request_cancel";
    pairingId: string;
    reason?: string;
    responder: AppointmentRequestedBy;
  },
  appointment: LessonAppointment,
  reason: string,
) {
  const pairing = await loadPairingForNotification(input.pairingId);
  if (!pairing) return;

  await notifyAppointmentResponded({
    action: input.action,
    appointment,
    pairing,
    reason,
    responder: input.responder,
  });
}

async function loadPairingForNotification(pairingId: string) {
  return db.query.pairings.findFirst({
    where: eq(pairings.id, pairingId),
    with: {
      student: true,
      teacher: true,
    },
  });
}
