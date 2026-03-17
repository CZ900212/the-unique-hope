import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

import { db } from "~/server/db";
import { pairings, profiles } from "~/server/db/schema";
import { DEFAULT_LOCALE, getMessages, type Locale } from "~/lib/i18n";

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

export async function getPairingForTeacher(
  userId: string,
  locale: Locale = DEFAULT_LOCALE,
) {
  const messages = getMessages(locale);
  const profile = await getProfileByUserId(userId, locale);

  const pairing = await db.query.pairings.findFirst({
    where: eq(pairings.teacherProfileId, profile.id),
    with: {
      student: true,
      lessons: {
        with: {
          notes: true,
        },
        orderBy: (lesson, { asc }) => [asc(lesson.weekNumber)],
      },
      feedback: {
        orderBy: (feedback, { desc }) => [desc(feedback.weekNumber)],
      },
    },
  });

  if (!pairing) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: messages.errors.teacherNoAssignedStudent,
    });
  }

  return { pairing, profile };
}

export async function getPairingForStudent(
  userId: string,
  locale: Locale = DEFAULT_LOCALE,
) {
  const messages = getMessages(locale);
  const profile = await getProfileByUserId(userId, locale);

  const pairing = await db.query.pairings.findFirst({
    where: eq(pairings.studentProfileId, profile.id),
    with: {
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

  return { pairing, profile };
}
