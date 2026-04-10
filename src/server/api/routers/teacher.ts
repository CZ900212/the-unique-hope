import { eq } from "drizzle-orm";

import { TOTAL_WEEKS, updateMeetingLinkSchema } from "~/lib/domain";
import { pairings } from "~/server/db/schema";
import { createTRPCRouter, roleProtectedProcedure } from "~/server/api/trpc";
import { buildProtectedLessonEvidenceUrl } from "~/server/lesson-evidence";
import { findLatestTeacherVisibleFeedback } from "~/server/services/lesson-feedback";
import {
  getTeacherDashboardState,
  requireMatchedTeacherPairing,
} from "~/server/services/pairings";

const teacherProcedure = roleProtectedProcedure("teacher");

export const teacherRouter = createTRPCRouter({
  dashboard: teacherProcedure.query(async ({ ctx }) => {
    const state = await getTeacherDashboardState(ctx.session.user.id, ctx.locale);

    if (state.matchingStatus !== "matched") {
      return {
        matchingStatus: state.matchingStatus,
        rejectReason: state.matchingStatus === "rejected" ? state.rejectReason : "",
        teacher: {
          id: state.profile.id,
          name: state.profile.name,
        },
      };
    }

    const { pairing, profile } = state;
    const latestSharedFeedback = findLatestTeacherVisibleFeedback(
      pairing.feedback,
      pairing.lessons,
    );
    const taughtCount = pairing.lessons.filter((lesson) => lesson.status === "taught").length;

    return {
      matchingStatus: state.matchingStatus,
      teacher: {
        id: profile.id,
        name: profile.name,
      },
      meetingLink: pairing.meetingLink,
      student: pairing.student,
      progress: {
        taughtCount,
        totalWeeks: TOTAL_WEEKS,
        lessons: pairing.lessons.map((lesson) => ({
          id: lesson.id,
          week_number: lesson.weekNumber,
          status: lesson.status,
          evidence_path: lesson.evidenceKey,
          updated_at: lesson.updatedAt,
          evidenceUrl: buildProtectedLessonEvidenceUrl(lesson.id, lesson.evidenceKey),
          notes: lesson.notes
            ? {
                text: lesson.notes.text,
                visibility: lesson.notes.visibility,
                updated_at: lesson.notes.updatedAt,
              }
            : null,
        })),
      },
      latestSharedFeedback: latestSharedFeedback
        ? {
            week_number: latestSharedFeedback.weekNumber,
            text: latestSharedFeedback.text,
            rating: latestSharedFeedback.rating,
            visibility: latestSharedFeedback.visibility,
            updated_at: latestSharedFeedback.updatedAt,
          }
        : null,
    };
  }),

  updateMeetingLink: teacherProcedure
    .input(updateMeetingLinkSchema)
    .mutation(async ({ ctx, input }) => {
      const { pairing } = await requireMatchedTeacherPairing(
        ctx.session.user.id,
        ctx.locale,
      );
      const [updatedPairing] = await ctx.db
        .update(pairings)
        .set({
          meetingLink: input.meetingLink,
        })
        .where(eq(pairings.id, pairing.id))
        .returning();

      return {
        meetingLink: updatedPairing?.meetingLink ?? null,
      };
    }),
});
