import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";

import { feedback, lessons } from "~/server/db/schema";
import {
  feedbackUpsertSchema,
  TOTAL_WEEKS,
  weekSchema,
} from "~/lib/domain";
import { getMessages } from "~/lib/i18n";
import { createTRPCRouter, roleProtectedProcedure } from "~/server/api/trpc";
import { buildProtectedLessonEvidenceUrl } from "~/server/lesson-evidence";
import { isStudentFeedbackAllowed } from "~/server/services/lesson-feedback";
import {
  getStudentDashboardState,
  requireMatchedStudentPairing,
} from "~/server/services/pairings";

const studentProcedure = roleProtectedProcedure("student");

export const studentRouter = createTRPCRouter({
  dashboard: studentProcedure.query(async ({ ctx }) => {
    const state = await getStudentDashboardState(ctx.session.user.id, ctx.locale);

    if (state.matchingStatus !== "matched") {
      return {
        matchingStatus: state.matchingStatus,
        rejectReason: state.matchingStatus === "rejected" ? state.rejectReason : "",
        student: {
          id: state.profile.id,
          name: state.profile.name,
        },
      };
    }

    const { pairing, profile } = state;
    const byWeek = new Map(pairing.lessons.map((lesson) => [lesson.weekNumber, lesson]));
    const weeks = Array.from({ length: TOTAL_WEEKS }, (_, index) => {
      const weekNumber = index + 1;
      const lesson = byWeek.get(weekNumber);

      return {
        weekNumber,
        status: lesson?.status ?? "pending",
        hasEvidence: Boolean(lesson?.evidenceKey),
      };
    });

    return {
      matchingStatus: state.matchingStatus,
      student: {
        id: profile.id,
        name: profile.name,
      },
      meetingLink: pairing.meetingLink,
      teacher: pairing.teacher,
      progress: {
        taughtCount: weeks.filter((week) => week.status === "taught").length,
        totalWeeks: TOTAL_WEEKS,
        weeks,
      },
    };
  }),

  lesson: studentProcedure
    .input(weekSchema)
    .query(async ({ ctx, input }) => {
      const { pairing, profile } = await requireMatchedStudentPairing(
        ctx.session.user.id,
        ctx.locale,
      );

      const lesson = await ctx.db.query.lessons.findFirst({
        where: and(eq(lessons.pairingId, pairing.id), eq(lessons.weekNumber, input)),
        with: {
          notes: true,
        },
      });

      const feedbackRow = await ctx.db.query.feedback.findFirst({
        where: and(
          eq(feedback.pairingId, pairing.id),
          eq(feedback.studentProfileId, profile.id),
          eq(feedback.weekNumber, input),
        ),
      });
      const feedbackAllowed = isStudentFeedbackAllowed(lesson?.status);

      return {
        lesson: {
          weekNumber: input,
          status: lesson?.status ?? "pending",
          feedbackAllowed,
          evidenceUrl: lesson
            ? buildProtectedLessonEvidenceUrl(lesson.id, lesson.evidenceKey)
            : null,
          notes:
            lesson?.notes?.visibility === "shared"
              ? {
                  text: lesson.notes.text,
                  visibility: lesson.notes.visibility,
                  updated_at: lesson.notes.updatedAt,
                }
              : null,
        },
        feedback: feedbackAllowed && feedbackRow
          ? {
              text: feedbackRow.text,
              rating: feedbackRow.rating,
              visibility: feedbackRow.visibility,
              updated_at: feedbackRow.updatedAt,
            }
          : null,
      };
    }),

  saveFeedback: studentProcedure
    .input(feedbackUpsertSchema)
    .mutation(async ({ ctx, input }) => {
      const messages = getMessages(ctx.locale);
      const { pairing, profile } = await requireMatchedStudentPairing(
        ctx.session.user.id,
        ctx.locale,
      );
      const lesson = await ctx.db.query.lessons.findFirst({
        where: and(eq(lessons.pairingId, pairing.id), eq(lessons.weekNumber, input.week)),
      });

      if (!isStudentFeedbackAllowed(lesson?.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: messages.errors.feedbackRequiresTaughtLesson,
        });
      }

      const [saved] = await ctx.db
        .insert(feedback)
        .values({
          pairingId: pairing.id,
          studentProfileId: profile.id,
          weekNumber: input.week,
          text: input.text,
          rating: input.rating,
          visibility: input.visibility,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [feedback.pairingId, feedback.studentProfileId, feedback.weekNumber],
          set: {
            text: input.text,
            rating: input.rating,
            visibility: input.visibility,
            updatedAt: new Date(),
          },
        })
        .returning();

      return {
        feedback: {
          id: saved!.id,
          week_number: saved!.weekNumber,
          text: saved!.text,
          rating: saved!.rating,
          visibility: saved!.visibility,
          updated_at: saved!.updatedAt,
        },
      };
    }),
});
