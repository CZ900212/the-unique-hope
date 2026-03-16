import { init } from "@instantdb/admin";
import { and, eq } from "drizzle-orm";

import { env } from "~/env";
import { toCanonicalEmail } from "~/lib/domain";
import { db } from "~/server/db";
import {
  feedback,
  lessonNotes,
  lessons,
  pairings,
  profiles,
  studentSignups,
  userCredentials,
  users,
} from "~/server/db/schema";

type InstantProfile = {
  id: string;
  role: "admin" | "teacher" | "student";
  username: string;
  name: string;
  contact?: string;
  passwordHash?: string;
  createdAt?: number;
  user?: Array<{ email?: string }>;
};

type InstantPairing = {
  id: string;
  createdAt?: number;
  teacher?: InstantProfile[];
  student?: InstantProfile[];
  lessons?: Array<{
    id: string;
    weekNumber: number;
    status: "pending" | "taught" | "teacher_leave" | "student_leave" | "sick";
    evidencePath?: string;
    updatedAt?: number;
    notes?: Array<{
      text: string;
      visibility: "private" | "shared";
      updatedAt?: number;
    }>;
  }>;
  feedback?: Array<{
    id: string;
    weekNumber: number;
    text: string;
    rating?: number | null;
    visibility: "private" | "shared";
    updatedAt?: number;
    student?: InstantProfile[];
  }>;
};

type InstantSignup = {
  childName: string;
  age: number;
  phone: string;
  contact?: string;
  status: "pending" | "approved" | "rejected";
  rejectReason?: string;
  createdAt?: number;
  reviewedAt?: number | null;
};

async function main() {
  if (!env.INSTANT_APP_ID || !env.INSTANT_ADMIN_TOKEN) {
    throw new Error("INSTANT_APP_ID and INSTANT_ADMIN_TOKEN are required for migration.");
  }

  const instant = init({
    appId: env.INSTANT_APP_ID,
    adminToken: env.INSTANT_ADMIN_TOKEN,
  });

  const [profileResult, signupResult, pairingResult] = await Promise.all([
    instant.query({
      profiles: {
        user: {},
      },
    }),
    instant.query({
      studentSignups: {},
    }),
    instant.query({
      pairings: {
        teacher: { user: {} },
        student: { user: {} },
        lessons: { notes: {} },
        feedback: { student: {} },
      },
    }),
  ]);

  const legacyProfiles = (profileResult.profiles ?? []) as unknown as InstantProfile[];
  const legacySignups = (signupResult.studentSignups ?? []) as unknown as InstantSignup[];
  const legacyPairings = (pairingResult.pairings ?? []) as unknown as InstantPairing[];

  const profileIdMap = new Map<string, { profileId: string; userId: string }>();
  const pairingIdMap = new Map<string, string>();

  for (const legacyProfile of legacyProfiles) {
    const email =
      legacyProfile.user?.[0]?.email?.toLowerCase() ??
      toCanonicalEmail(undefined, legacyProfile.username, legacyProfile.role);

    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
      with: {
        profile: true,
      },
    });

    let userId = existingUser?.id;
    let profileId = existingUser?.profile?.id;

    if (!userId) {
      const [user] = await db
        .insert(users)
        .values({
          email,
          name: legacyProfile.name,
        })
        .returning();
      userId = user!.id;
    }

    if (!profileId) {
      const [profile] = await db
        .insert(profiles)
        .values({
          userId,
          role: legacyProfile.role,
          username: legacyProfile.username,
          name: legacyProfile.name,
          contact: legacyProfile.contact ?? "",
          createdAt: legacyProfile.createdAt ? new Date(legacyProfile.createdAt) : new Date(),
        })
        .returning();
      profileId = profile!.id;
    }

    if (legacyProfile.passwordHash) {
      const existingCredential = await db.query.userCredentials.findFirst({
        where: eq(userCredentials.userId, userId),
      });

      if (existingCredential) {
        await db
          .update(userCredentials)
          .set({ passwordHash: legacyProfile.passwordHash })
          .where(eq(userCredentials.userId, userId));
      } else {
        await db.insert(userCredentials).values({
          userId,
          passwordHash: legacyProfile.passwordHash,
        });
      }
    }

    profileIdMap.set(legacyProfile.id, { profileId, userId });
  }

  for (const signup of legacySignups) {
    const existing = await db.query.studentSignups.findFirst({
      where: and(
        eq(studentSignups.childName, signup.childName),
        eq(studentSignups.phone, signup.phone),
      ),
    });
    if (existing) continue;

    await db.insert(studentSignups).values({
      childName: signup.childName,
      age: signup.age,
      phone: signup.phone,
      contact: signup.contact ?? "",
      status: signup.status,
      rejectReason: signup.rejectReason ?? "",
      createdAt: signup.createdAt ? new Date(signup.createdAt) : new Date(),
      reviewedAt: signup.reviewedAt ? new Date(signup.reviewedAt) : null,
    });
  }

  for (const legacyPairing of legacyPairings) {
    const teacherLegacy = legacyPairing.teacher?.[0];
    const studentLegacy = legacyPairing.student?.[0];
    if (!teacherLegacy || !studentLegacy) continue;

    const teacherMapped = profileIdMap.get(teacherLegacy.id);
    const studentMapped = profileIdMap.get(studentLegacy.id);
    if (!teacherMapped || !studentMapped) continue;

    const existing = await db.query.pairings.findFirst({
      where: and(
        eq(pairings.teacherProfileId, teacherMapped.profileId),
        eq(pairings.studentProfileId, studentMapped.profileId),
      ),
    });

    let pairingId = existing?.id;
    if (!pairingId) {
      const [pairing] = await db
        .insert(pairings)
        .values({
          teacherProfileId: teacherMapped.profileId,
          studentProfileId: studentMapped.profileId,
          createdAt: legacyPairing.createdAt ? new Date(legacyPairing.createdAt) : new Date(),
        })
        .returning();
      pairingId = pairing!.id;
    }
    pairingIdMap.set(legacyPairing.id, pairingId);

    for (const lesson of legacyPairing.lessons ?? []) {
      const [savedLesson] = await db
        .insert(lessons)
        .values({
          pairingId,
          weekNumber: lesson.weekNumber,
          status: lesson.status,
          evidenceKey: lesson.evidencePath ?? null,
          evidenceUrl: lesson.evidencePath ?? null,
          updatedAt: lesson.updatedAt ? new Date(lesson.updatedAt) : new Date(),
        })
        .onConflictDoUpdate({
          target: [lessons.pairingId, lessons.weekNumber],
          set: {
            status: lesson.status,
            evidenceKey: lesson.evidencePath ?? null,
            evidenceUrl: lesson.evidencePath ?? null,
            updatedAt: lesson.updatedAt ? new Date(lesson.updatedAt) : new Date(),
          },
        })
        .returning();

      const note = lesson.notes?.[0];
      if (note) {
        await db
          .insert(lessonNotes)
          .values({
            lessonId: savedLesson!.id,
            text: note.text,
            visibility: note.visibility,
            updatedAt: note.updatedAt ? new Date(note.updatedAt) : new Date(),
          })
          .onConflictDoUpdate({
            target: lessonNotes.lessonId,
            set: {
              text: note.text,
              visibility: note.visibility,
              updatedAt: note.updatedAt ? new Date(note.updatedAt) : new Date(),
            },
          });
      }
    }

    for (const feedbackRow of legacyPairing.feedback ?? []) {
      const legacyStudent = feedbackRow.student?.[0];
      const mappedStudent = legacyStudent ? profileIdMap.get(legacyStudent.id) : studentMapped;
      if (!mappedStudent) continue;

      await db
        .insert(feedback)
        .values({
          pairingId,
          studentProfileId: mappedStudent.profileId,
          weekNumber: feedbackRow.weekNumber,
          text: feedbackRow.text,
          rating: feedbackRow.rating ?? null,
          visibility: feedbackRow.visibility,
          updatedAt: feedbackRow.updatedAt ? new Date(feedbackRow.updatedAt) : new Date(),
        })
        .onConflictDoUpdate({
          target: [feedback.pairingId, feedback.studentProfileId, feedback.weekNumber],
          set: {
            text: feedbackRow.text,
            rating: feedbackRow.rating ?? null,
            visibility: feedbackRow.visibility,
            updatedAt: feedbackRow.updatedAt ? new Date(feedbackRow.updatedAt) : new Date(),
          },
        });
    }
  }

  console.log(
    JSON.stringify(
      {
        imported: {
          pairings: pairingIdMap.size,
          profiles: profileIdMap.size,
          signups: legacySignups.length,
        },
      },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
