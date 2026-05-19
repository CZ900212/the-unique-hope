import { and, count, eq, isNull } from "drizzle-orm";

import { formatAppDateTime } from "~/lib/date-format";
import { type AppointmentRequestedBy, type Visibility } from "~/lib/domain";
import { db } from "~/server/db";
import {
  browserPushSubscriptions,
  type lessonAppointments,
  type pairings,
  type profiles,
  userNotifications,
} from "~/server/db/schema";
import {
  assertBrowserPushEndpointAllowed,
  enqueueNotificationPushDeliveries,
} from "~/server/services/notification-push";

const NOTIFICATION_LIMIT = 50;
const APP_TIME_ZONE = "Asia/Shanghai";

type Profile = Pick<
  typeof profiles.$inferSelect,
  "id" | "name" | "role" | "username"
>;
type Pairing = Pick<typeof pairings.$inferSelect, "id"> & {
  student?: Profile | null;
  teacher?: Profile | null;
};
type Appointment = Pick<
  typeof lessonAppointments.$inferSelect,
  | "id"
  | "cancellationReason"
  | "cancellationRequestedBy"
  | "cancellationResponseReason"
  | "durationMinutes"
  | "requestedBy"
  | "responseReason"
  | "scheduledStart"
  | "status"
>;

type NotificationType =
  | "appointment_cancel_confirmed"
  | "appointment_cancel_declined"
  | "appointment_cancellation_requested"
  | "appointment_confirmed"
  | "appointment_declined"
  | "appointment_requested"
  | "appointment_time_changed"
  | "feedback_visible"
  | "lesson_visible"
  | "meeting_link_updated"
  | "pairing_created";

type NotificationCopy = {
  bodyEn: string;
  bodyZh: string;
  titleEn: string;
  titleZh: string;
};

export function serializeNotification(
  notification: typeof userNotifications.$inferSelect,
) {
  return {
    id: notification.id,
    type: notification.type,
    titleEn: notification.titleEn,
    titleZh: notification.titleZh,
    bodyEn: notification.bodyEn,
    bodyZh: notification.bodyZh,
    href: notification.href,
    readAt: notification.readAt,
    createdAt: notification.createdAt,
  };
}

export async function createUserNotification(input: {
  actorProfileId?: string | null;
  appointmentId?: string | null;
  copy: NotificationCopy;
  href?: string | null;
  recipientProfileId: string;
  type: NotificationType;
}) {
  const [notification] = await db
    .insert(userNotifications)
    .values({
      actorProfileId: input.actorProfileId ?? null,
      appointmentId: input.appointmentId ?? null,
      bodyEn: input.copy.bodyEn,
      bodyZh: input.copy.bodyZh,
      href: input.href ?? null,
      recipientProfileId: input.recipientProfileId,
      titleEn: input.copy.titleEn,
      titleZh: input.copy.titleZh,
      type: input.type,
    })
    .returning();

  if (!notification) return null;

  await enqueueNotificationPushDeliveries(notification).catch((error) => {
    console.error("[notification-push enqueue]", error);
  });

  return serializeNotification(notification);
}

export async function listUserNotifications(profileId: string) {
  const rows = await db.query.userNotifications.findMany({
    where: eq(userNotifications.recipientProfileId, profileId),
    orderBy: (notification, { desc }) => [desc(notification.createdAt)],
    limit: NOTIFICATION_LIMIT,
  });

  return rows.map(serializeNotification);
}

export async function getUnreadNotificationCount(profileId: string) {
  const [row] = await db
    .select({ total: count() })
    .from(userNotifications)
    .where(
      and(
        eq(userNotifications.recipientProfileId, profileId),
        isNull(userNotifications.readAt),
      ),
    );

  return row?.total ?? 0;
}

export async function markUserNotificationRead(input: {
  notificationId: string;
  profileId: string;
}) {
  await db
    .update(userNotifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(userNotifications.id, input.notificationId),
        eq(userNotifications.recipientProfileId, input.profileId),
      ),
    );
}

export async function markAllUserNotificationsRead(profileId: string) {
  await db
    .update(userNotifications)
    .set({ readAt: new Date() })
    .where(eq(userNotifications.recipientProfileId, profileId));
}

export async function saveBrowserPushSubscription(input: {
  auth: string;
  endpoint: string;
  expirationTime?: Date | null;
  p256dh: string;
  profileId: string;
  userAgent?: string | null;
}) {
  await assertBrowserPushEndpointAllowed(input.endpoint);

  const now = new Date();

  await db
    .insert(browserPushSubscriptions)
    .values({
      auth: input.auth,
      disabledAt: null,
      endpoint: input.endpoint,
      expirationTime: input.expirationTime ?? null,
      failureCount: 0,
      lastErrorAt: null,
      p256dh: input.p256dh,
      profileId: input.profileId,
      userAgent: input.userAgent ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: browserPushSubscriptions.endpoint,
      set: {
        auth: input.auth,
        disabledAt: null,
        p256dh: input.p256dh,
        expirationTime: input.expirationTime ?? null,
        failureCount: 0,
        lastErrorAt: null,
        profileId: input.profileId,
        userAgent: input.userAgent ?? null,
        updatedAt: now,
      },
    });
}

export async function deleteBrowserPushSubscription(input: {
  endpoint: string;
  profileId: string;
}) {
  await db
    .delete(browserPushSubscriptions)
    .where(
      and(
        eq(browserPushSubscriptions.endpoint, input.endpoint),
        eq(browserPushSubscriptions.profileId, input.profileId),
      ),
    );
}

export async function notifyAppointmentRequested(input: {
  actorRole: AppointmentRequestedBy;
  appointment: Appointment;
  isTimeChange: boolean;
  pairing: Pairing;
}) {
  const actor = getParticipant(input.pairing, input.actorRole);
  const recipientRole = input.actorRole === "teacher" ? "student" : "teacher";
  const recipient = getParticipant(input.pairing, recipientRole);
  if (!actor || !recipient) return;

  await createUserNotification({
    actorProfileId: actor.id,
    appointmentId: input.appointment.id,
    copy: input.isTimeChange
      ? appointmentCopy({
          actorName: actor.name,
          appointment: input.appointment,
          titleEn: "New lesson time proposed",
          titleZh: "新的上课时间待确认",
          verbEn: "proposed a new lesson time",
          verbZh: "提出了新的上课时间",
        })
      : appointmentCopy({
          actorName: actor.name,
          appointment: input.appointment,
          titleEn: "Lesson time needs confirmation",
          titleZh: "有新的预约需要确认",
          verbEn: "requested a lesson time",
          verbZh: "申请了上课时间",
        }),
    href: participantHref(recipientRole, "booking"),
    recipientProfileId: recipient.id,
    type: input.isTimeChange
      ? "appointment_time_changed"
      : "appointment_requested",
  });
}

export async function notifyAppointmentResponded(input: {
  action: "confirm" | "decline" | "request_cancel";
  appointment: Appointment;
  pairing: Pairing;
  reason?: string;
  responder: AppointmentRequestedBy;
}) {
  const actor = getParticipant(input.pairing, input.responder);
  if (!actor) return;

  if (input.action === "request_cancel") {
    const recipientRole = input.responder === "teacher" ? "student" : "teacher";
    const recipient = getParticipant(input.pairing, recipientRole);
    if (!recipient) return;
    await createUserNotification({
      actorProfileId: actor.id,
      appointmentId: input.appointment.id,
      copy: appointmentCopy({
        actorName: actor.name,
        appointment: input.appointment,
        reason: input.reason,
        titleEn: "Cancellation needs confirmation",
        titleZh: "取消申请需要确认",
        verbEn: "requested to cancel the lesson",
        verbZh: "申请取消这次课程",
      }),
      href: participantHref(recipientRole, "booking"),
      recipientProfileId: recipient.id,
      type: "appointment_cancellation_requested",
    });
    return;
  }

  const requesterRole =
    input.appointment.status === "cancellation_pending" &&
    input.appointment.cancellationRequestedBy
      ? input.appointment.cancellationRequestedBy
      : input.appointment.requestedBy;
  const recipient = getParticipant(input.pairing, requesterRole);
  if (!recipient || recipient.id === actor.id) return;

  const cancellationResponse =
    input.appointment.status === "cancellation_pending";
  const copy = cancellationResponse
    ? input.action === "confirm"
      ? appointmentCopy({
          actorName: actor.name,
          appointment: input.appointment,
          titleEn: "Lesson cancellation confirmed",
          titleZh: "课程取消已确认",
          verbEn: "confirmed the cancellation",
          verbZh: "确认了取消申请",
        })
      : appointmentCopy({
          actorName: actor.name,
          appointment: input.appointment,
          reason: input.reason,
          titleEn: "Lesson will stay scheduled",
          titleZh: "课程将保留",
          verbEn: "declined the cancellation request",
          verbZh: "拒绝了取消申请",
        })
    : input.action === "confirm"
      ? appointmentCopy({
          actorName: actor.name,
          appointment: input.appointment,
          titleEn: "Lesson time confirmed",
          titleZh: "预约已确认",
          verbEn: "confirmed the lesson time",
          verbZh: "确认了上课时间",
        })
      : appointmentCopy({
          actorName: actor.name,
          appointment: input.appointment,
          reason: input.reason,
          titleEn: "Lesson time declined",
          titleZh: "预约被拒绝",
          verbEn: "declined the lesson time",
          verbZh: "拒绝了上课时间",
        });

  await createUserNotification({
    actorProfileId: actor.id,
    appointmentId: input.appointment.id,
    copy,
    href: participantHref(requesterRole, "booking"),
    recipientProfileId: recipient.id,
    type: cancellationResponse
      ? input.action === "confirm"
        ? "appointment_cancel_confirmed"
        : "appointment_cancel_declined"
      : input.action === "confirm"
        ? "appointment_confirmed"
        : "appointment_declined",
  });
}

export async function notifyPairingCreated(pairing: Pairing) {
  if (pairing.student && pairing.teacher) {
    await Promise.all([
      createUserNotification({
        actorProfileId: null,
        copy: {
          titleEn: "You have been matched",
          titleZh: "你已经完成配对",
          bodyEn: `You have been matched with ${pairing.teacher.name}.`,
          bodyZh: `你已经和 ${pairing.teacher.name} 完成配对。`,
        },
        href: "/student",
        recipientProfileId: pairing.student.id,
        type: "pairing_created",
      }),
      createUserNotification({
        actorProfileId: null,
        copy: {
          titleEn: "You have been matched",
          titleZh: "你已经完成配对",
          bodyEn: `You have been matched with ${pairing.student.name}.`,
          bodyZh: `你已经和 ${pairing.student.name} 完成配对。`,
        },
        href: "/teacher",
        recipientProfileId: pairing.teacher.id,
        type: "pairing_created",
      }),
    ]);
  }
}

export async function notifyTeacherLessonVisible(input: {
  pairing: Pairing;
  teacher: Profile;
  week: number;
}) {
  if (!input.pairing.student) return;

  await createUserNotification({
    actorProfileId: input.teacher.id,
    copy: {
      titleEn: "Lesson record updated",
      titleZh: "课程记录已更新",
      bodyEn: `${input.teacher.name} updated the record for week ${input.week}.`,
      bodyZh: `${input.teacher.name} 更新了第${input.week}周的课程记录。`,
    },
    href: "/student",
    recipientProfileId: input.pairing.student.id,
    type: "lesson_visible",
  });
}

export async function notifyStudentFeedbackVisible(input: {
  pairing: Pairing;
  student: Profile;
  visibility: Visibility;
  week: number;
}) {
  if (!input.pairing.teacher || input.visibility !== "shared") return;

  await createUserNotification({
    actorProfileId: input.student.id,
    copy: {
      titleEn: "New student feedback",
      titleZh: "新的学生反馈",
      bodyEn: `${input.student.name} shared feedback for week ${input.week}.`,
      bodyZh: `${input.student.name} 分享了第${input.week}周的反馈。`,
    },
    href: "/teacher",
    recipientProfileId: input.pairing.teacher.id,
    type: "feedback_visible",
  });
}

export async function notifyMeetingLinkUpdated(input: {
  pairing: Pairing;
  teacher: Profile;
}) {
  if (!input.pairing.student) return;

  await createUserNotification({
    actorProfileId: input.teacher.id,
    copy: {
      titleEn: "Meeting link updated",
      titleZh: "会议链接已更新",
      bodyEn: `${input.teacher.name} updated the lesson meeting link.`,
      bodyZh: `${input.teacher.name} 更新了上课会议链接。`,
    },
    href: "/student",
    recipientProfileId: input.pairing.student.id,
    type: "meeting_link_updated",
  });
}

function getParticipant(pairing: Pairing, role: AppointmentRequestedBy) {
  return role === "student" ? pairing.student : pairing.teacher;
}

function participantHref(role: AppointmentRequestedBy, view?: "booking") {
  return `/${role}${view ? `?view=${view}` : ""}`;
}

function appointmentCopy(input: {
  actorName: string;
  appointment: Appointment;
  reason?: string;
  titleEn: string;
  titleZh: string;
  verbEn: string;
  verbZh: string;
}) {
  const enDate = formatAppointmentDate("en", input.appointment.scheduledStart);
  const zhDate = formatAppointmentDate("zh", input.appointment.scheduledStart);
  const reason = input.reason?.trim();

  return {
    titleEn: input.titleEn,
    titleZh: input.titleZh,
    bodyEn: [
      `${input.actorName} ${input.verbEn} for ${enDate}.`,
      reason ? `Reason: ${reason}` : "",
    ]
      .filter(Boolean)
      .join(" "),
    bodyZh: [
      `${input.actorName} ${input.verbZh}：${zhDate}。`,
      reason ? `原因：${reason}` : "",
    ]
      .filter(Boolean)
      .join(" "),
  };
}

function formatAppointmentDate(locale: "en" | "zh", date: Date) {
  return formatAppDateTime(locale, date, "medium", {
    timeZone: APP_TIME_ZONE,
  });
}
