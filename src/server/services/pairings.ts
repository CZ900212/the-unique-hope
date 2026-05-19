import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

import { DEFAULT_LOCALE, getMessages, type Locale } from "~/lib/i18n";
import { db } from "~/server/db";
import {
  pairings,
  profiles,
  studentSignups,
  teacherSignups,
} from "~/server/db/schema";

async function getProfileByUserId(userId: string, locale: Locale) {
  const messages = getMessages(locale);
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
  });

  if (!profile) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: messages.errors.profileNotFound,
    });
  }

  return profile;
}

export async function getStudentDashboardState(
  userId: string,
  locale: Locale = DEFAULT_LOCALE,
) {
  const messages = getMessages(locale);
  const profile = await getProfileByUserId(userId, locale);
  const signup = await db.query.studentSignups.findFirst({
    where: eq(studentSignups.profileId, profile.id),
  });

  if (signup?.status === "rejected") {
    return {
      matchingStatus: "rejected" as const,
      profile,
      rejectReason: signup.rejectReason ?? "",
    };
  }

  if (profile.matchStatus === "pending") {
    return {
      matchingStatus: "pending" as const,
      profile,
    };
  }

  const pairing = await db.query.pairings.findFirst({
    where: eq(pairings.studentProfileId, profile.id),
    with: {
      appointments: {
        orderBy: (appointment, { asc }) => [asc(appointment.scheduledStart)],
      },
      teacher: true,
      lessons: {
        with: {
          notes: true,
        },
      },
    },
  });

  if (!pairing) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: messages.errors.studentNoAssignedTeacher,
    });
  }

  return {
    matchingStatus: "matched" as const,
    pairing,
    profile,
  };
}

export async function getTeacherDashboardState(
  userId: string,
  locale: Locale = DEFAULT_LOCALE,
) {
  const messages = getMessages(locale);
  const profile = await getProfileByUserId(userId, locale);
  const signup = await db.query.teacherSignups.findFirst({
    where: eq(teacherSignups.profileId, profile.id),
  });

  if (signup?.status === "rejected") {
    return {
      matchingStatus: "rejected" as const,
      profile,
      rejectReason: signup.rejectReason ?? "",
    };
  }

  if (profile.matchStatus === "pending") {
    return {
      matchingStatus: "pending" as const,
      profile,
    };
  }

  const pairing = await db.query.pairings.findFirst({
    where: eq(pairings.teacherProfileId, profile.id),
    with: {
      appointments: {
        orderBy: (appointment, { asc }) => [asc(appointment.scheduledStart)],
      },
      feedback: {
        orderBy: (feedback, { desc }) => [desc(feedback.weekNumber)],
      },
      lessons: {
        with: {
          notes: true,
        },
        orderBy: (lesson, { asc }) => [asc(lesson.weekNumber)],
      },
      student: true,
    },
  });

  if (!pairing) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: messages.errors.teacherNoAssignedStudent,
    });
  }

  return {
    matchingStatus: "matched" as const,
    pairing,
    profile,
  };
}

export async function requireMatchedStudentPairing(
  userId: string,
  locale: Locale = DEFAULT_LOCALE,
) {
  const messages = getMessages(locale);
  const state = await getStudentDashboardState(userId, locale);

  if (state.matchingStatus !== "matched") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: messages.errors.studentPendingMatch,
    });
  }

  return state;
}

export async function requireMatchedTeacherPairing(
  userId: string,
  locale: Locale = DEFAULT_LOCALE,
) {
  const messages = getMessages(locale);
  const state = await getTeacherDashboardState(userId, locale);

  if (state.matchingStatus !== "matched") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: messages.errors.teacherPendingMatch,
    });
  }

  return state;
}
