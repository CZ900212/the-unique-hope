import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

import { db } from "~/server/db";
import { pairings, profiles } from "~/server/db/schema";

async function getProfileByUserId(userId: string) {
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
  });

  if (!profile) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Profile not found for current user",
    });
  }

  return profile;
}

export async function getPairingForTeacher(userId: string) {
  const profile = await getProfileByUserId(userId);

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
      message: "Teacher has no assigned student",
    });
  }

  return { pairing, profile };
}

export async function getPairingForStudent(userId: string) {
  const profile = await getProfileByUserId(userId);

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
      message: "Student has no assigned teacher",
    });
  }

  return { pairing, profile };
}
