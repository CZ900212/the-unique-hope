import { and, eq } from "drizzle-orm";

import { type LessonStatus, type Visibility } from "~/lib/domain";
import { db } from "~/server/db";
import { lessons, lessonNotes } from "~/server/db/schema";
import { createStoredLessonEvidenceFields } from "~/server/lesson-evidence";

type UploadedEvidence = {
  mime: string;
  pathname: string;
  url: string | null;
};

type UpsertTeacherLessonInput = {
  notesText: string;
  notesVisibility: Visibility;
  pairingId: string;
  status: LessonStatus;
  uploadedEvidence?: UploadedEvidence | null;
  week: number;
};

export async function findTeacherLesson(pairingId: string, week: number) {
  return db.query.lessons.findFirst({
    where: and(eq(lessons.pairingId, pairingId), eq(lessons.weekNumber, week)),
  });
}

export async function upsertTeacherLessonRecord(
  input: UpsertTeacherLessonInput,
) {
  const now = new Date();
  const storedEvidence = input.uploadedEvidence
    ? createStoredLessonEvidenceFields(
        input.uploadedEvidence,
        input.uploadedEvidence.mime,
      )
    : null;

  return db.transaction(async (tx) => {
    const [lesson] = await tx
      .insert(lessons)
      .values({
        pairingId: input.pairingId,
        weekNumber: input.week,
        status: input.status,
        ...(storedEvidence ?? {}),
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [lessons.pairingId, lessons.weekNumber],
        set: {
          status: input.status,
          ...(storedEvidence ?? {}),
          updatedAt: now,
        },
      })
      .returning();

    await tx
      .insert(lessonNotes)
      .values({
        lessonId: lesson!.id,
        text: input.notesText,
        visibility: input.notesVisibility,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: lessonNotes.lessonId,
        set: {
          text: input.notesText,
          visibility: input.notesVisibility,
          updatedAt: now,
        },
      });

    const savedLesson = await tx.query.lessons.findFirst({
      where: eq(lessons.id, lesson!.id),
      with: {
        notes: true,
      },
    });

    if (!savedLesson) {
      throw new Error("Unable to load saved lesson");
    }

    return savedLesson;
  });
}
