import {
  TOTAL_WEEKS,
  type AppointmentRequestedBy,
  type AppointmentStatus,
  type Visibility,
} from "~/lib/domain";
import { buildProtectedLessonEvidenceUrl } from "~/server/lesson-evidence";

type PairingLesson = {
  evidenceKey?: string | null;
  id?: string;
  notes?: {
    text: string;
    updatedAt: Date;
    visibility: Visibility;
  } | null;
  status: string;
  updatedAt?: Date;
  weekNumber: number;
};

type PairingProfile = {
  contact?: string | null;
  id: string;
  name: string;
  role: string;
  userId: string;
  username: string;
};

type PairingWithLessons = {
  appointments?: PairingAppointment[];
  createdAt: Date;
  feedback?: PairingFeedback[];
  id: string;
  lessons: PairingLesson[];
  meetingLink?: string | null;
  student: PairingProfile | null;
  teacher: PairingProfile | null;
};

type PairingAppointment = {
  cancellationReason?: string | null;
  cancellationRequestedBy?: AppointmentRequestedBy | null;
  cancellationResponseReason?: string | null;
  createdAt: Date;
  durationMinutes: number;
  id: string;
  pairingId: string;
  requestedBy: AppointmentRequestedBy;
  responseReason?: string | null;
  respondedAt: Date | null;
  scheduledStart: Date;
  status: AppointmentStatus;
  updatedAt: Date;
  weekNumber: number | null;
};

type PairingFeedback = {
  rating: number | null;
  text: string;
  updatedAt: Date;
  visibility: Visibility;
  weekNumber: number;
};

function serializeAdminAppointment(appointment: PairingAppointment) {
  return {
    id: appointment.id,
    weekNumber: appointment.weekNumber,
    scheduledStart: appointment.scheduledStart,
    durationMinutes: appointment.durationMinutes,
    status: appointment.status,
    requestedBy: appointment.requestedBy,
    cancellationRequestedBy: appointment.cancellationRequestedBy ?? null,
    responseReason: appointment.responseReason ?? null,
    cancellationReason: appointment.cancellationReason ?? null,
    cancellationResponseReason: appointment.cancellationResponseReason ?? null,
    respondedAt: appointment.respondedAt,
    createdAt: appointment.createdAt,
    updatedAt: appointment.updatedAt,
  };
}

function serializeAdminAppointments(appointments: PairingAppointment[]) {
  return appointments.map(serializeAdminAppointment);
}

export function serializeAdminPairingProgress(pairing: PairingWithLessons) {
  const taughtCount = pairing.lessons.filter(
    (lesson) => lesson.status === "taught",
  ).length;

  return {
    id: pairing.id,
    createdAt: pairing.createdAt,
    teacher: pairing.teacher,
    student: pairing.student,
    progress: {
      taughtCount,
      totalWeeks: TOTAL_WEEKS,
      lessons: pairing.lessons.map((lesson) => ({
        weekNumber: lesson.weekNumber,
        status: lesson.status,
      })),
    },
    appointments: serializeAdminAppointments(pairing.appointments ?? []),
  };
}

export function buildAdminProgressReport(rows: PairingWithLessons[]) {
  return {
    totalPairings: rows.length,
    pairings: rows.map(serializeAdminPairingProgress),
  };
}

export function serializeAdminPairingDetails(pairing: PairingWithLessons) {
  const lessonsByWeek = new Map(
    pairing.lessons.map((lesson) => [lesson.weekNumber, lesson]),
  );
  const feedbackByWeek = new Map(
    (pairing.feedback ?? []).map((feedback) => [feedback.weekNumber, feedback]),
  );
  const appointmentsByWeek = new Map(
    (pairing.appointments ?? [])
      .filter((appointment) => appointment.weekNumber !== null)
      .map((appointment) => [appointment.weekNumber, appointment]),
  );

  const weekDetails = Array.from({ length: TOTAL_WEEKS }, (_, index) => {
    const weekNumber = index + 1;
    const lesson = lessonsByWeek.get(weekNumber);
    const studentFeedback = feedbackByWeek.get(weekNumber) ?? null;
    const appointment = appointmentsByWeek.get(weekNumber) ?? null;

    return {
      weekNumber,
      appointment: appointment ? serializeAdminAppointment(appointment) : null,
      lessonStatus: lesson?.status ?? "pending",
      evidenceUrl: lesson?.id
        ? buildProtectedLessonEvidenceUrl(lesson.id, lesson.evidenceKey)
        : null,
      hasEvidence: Boolean(lesson?.evidenceKey),
      hasTeacherNote: Boolean(lesson?.notes?.text),
      teacherNoteVisibility: lesson?.notes?.visibility ?? null,
      teacherNote: lesson?.notes
        ? {
            text: lesson.notes.text,
            updatedAt: lesson.notes.updatedAt,
            visibility: lesson.notes.visibility,
          }
        : null,
      hasFeedback: Boolean(studentFeedback),
      feedbackVisibility: studentFeedback?.visibility ?? null,
      studentFeedback: studentFeedback
        ? {
            rating: studentFeedback.rating,
            text: studentFeedback.text,
            updatedAt: studentFeedback.updatedAt,
            visibility: studentFeedback.visibility,
          }
        : null,
      lessonUpdatedAt: lesson?.updatedAt ?? null,
    };
  });

  const latestFeedback =
    [...(pairing.feedback ?? [])].sort(
      (left, right) =>
        (right.updatedAt?.getTime() ?? 0) - (left.updatedAt?.getTime() ?? 0) ||
        right.weekNumber - left.weekNumber,
    )[0] ?? null;
  const latestLessonUpdate =
    [...pairing.lessons].sort(
      (left, right) =>
        (right.updatedAt?.getTime() ?? 0) - (left.updatedAt?.getTime() ?? 0) ||
        right.weekNumber - left.weekNumber,
    )[0] ?? null;

  return {
    pairing: {
      createdAt: pairing.createdAt,
      id: pairing.id,
      meetingLink: pairing.meetingLink ?? "",
      student: pairing.student,
      teacher: pairing.teacher,
    },
    appointments: serializeAdminAppointments(pairing.appointments ?? []),
    summary: {
      feedbackCount: weekDetails.filter((week) => week.hasFeedback).length,
      latestFeedback: latestFeedback
        ? {
            updatedAt: latestFeedback.updatedAt,
            visibility: latestFeedback.visibility,
            weekNumber: latestFeedback.weekNumber,
          }
        : null,
      latestLessonUpdate: latestLessonUpdate
        ? {
            lessonStatus: latestLessonUpdate.status,
            updatedAt: latestLessonUpdate.updatedAt ?? pairing.createdAt,
            weekNumber: latestLessonUpdate.weekNumber,
          }
        : null,
      taughtCount: weekDetails.filter((week) => week.lessonStatus === "taught")
        .length,
      totalWeeks: TOTAL_WEEKS,
    },
    weekDetails,
    weeks: weekDetails.map((week) => ({
      appointment: week.appointment,
      feedbackVisibility: week.feedbackVisibility,
      hasEvidence: week.hasEvidence,
      hasFeedback: week.hasFeedback,
      hasTeacherNote: week.hasTeacherNote,
      lessonStatus: week.lessonStatus,
      teacherNoteVisibility: week.teacherNoteVisibility,
      weekNumber: week.weekNumber,
    })),
  };
}
