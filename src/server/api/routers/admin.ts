import { TRPCError } from "@trpc/server";
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
} from "drizzle-orm";
import { z } from "zod";

import {
  createPairingSchema,
  deletePairingSchema,
  paginationSchema,
  reviewedSignupsFilterSchema,
  signupReviewSchema,
} from "~/lib/domain";
import { getMessages, type Locale } from "~/lib/i18n";
import {
  pairings,
  profiles,
  studentSignups,
  teacherSignups,
} from "~/server/db/schema";
import { createTRPCRouter, roleProtectedProcedure } from "~/server/api/trpc";
import {
  createManualRecoveryResetUrl,
  listManualRecoveryRequests,
  rejectManualRecoveryRequest,
} from "~/server/auth/manual-password-reset";
import { deleteStoredLessonEvidence } from "~/server/lesson-evidence";
import {
  buildAdminProgressReport,
  serializeAdminPairingDetails,
  serializeAdminPairingProgress,
} from "~/server/services/admin-progress";
import { notifyPairingCreated } from "~/server/services/notifications";

const adminProcedure = roleProtectedProcedure("admin");
const listPairingsSchema = paginationSchema.extend({
  search: z.string().trim().max(255).optional().default(""),
});
const markRecoveryRequestSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["rejected"]),
});
const createRecoveryResetLinkSchema = z.object({
  requestId: z.string().uuid(),
  userId: z.string().min(1),
});

function mapDatabaseError(error: unknown, locale: Locale) {
  const messages = getMessages(locale);
  const code =
    typeof error === "object" && error && "code" in error
      ? String(error.code)
      : "";
  const message =
    typeof error === "object" && error && "message" in error
      ? String(error.message)
      : "";

  if (code === "23505" || message.includes("duplicate key")) {
    return new TRPCError({
      code: "CONFLICT",
      message: messages.errors.duplicatePairing,
    });
  }

  return error instanceof TRPCError
    ? error
    : new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: messages.errors.unexpectedDatabase,
      });
}

export const adminRouter = createTRPCRouter({
  createPairing: adminProcedure
    .input(createPairingSchema)
    .mutation(async ({ ctx, input }) => {
      const messages = getMessages(ctx.locale);

      const [studentProfile, teacherProfile, studentSignup, teacherSignup] =
        await Promise.all([
          ctx.db.query.profiles.findFirst({
            where: eq(profiles.id, input.studentProfileId),
          }),
          ctx.db.query.profiles.findFirst({
            where: eq(profiles.id, input.teacherProfileId),
          }),
          ctx.db.query.studentSignups.findFirst({
            where: eq(studentSignups.profileId, input.studentProfileId),
          }),
          ctx.db.query.teacherSignups.findFirst({
            where: eq(teacherSignups.profileId, input.teacherProfileId),
          }),
        ]);

      if (studentProfile?.role !== "student") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: messages.errors.studentNotFound,
        });
      }

      if (teacherProfile?.role !== "teacher") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: messages.errors.teacherNotFound,
        });
      }

      if (!studentSignup || !teacherSignup) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: messages.errors.signupNotFound,
        });
      }

      if (
        studentSignup.status !== "approved" ||
        teacherSignup.status !== "approved"
      ) {
        throw new TRPCError({
          code: "CONFLICT",
          message: messages.errors.pairingRequiresApprovedSignups,
        });
      }

      if (
        !["pending", "approved"].includes(studentSignup.status) ||
        !["pending", "approved"].includes(teacherSignup.status)
      ) {
        throw new TRPCError({
          code: "CONFLICT",
          message: messages.errors.pairingSelectionUnavailable,
        });
      }

      if (
        studentProfile.matchStatus !== "pending" ||
        teacherProfile.matchStatus !== "pending"
      ) {
        throw new TRPCError({
          code: "CONFLICT",
          message: messages.errors.pairingSelectionUnavailable,
        });
      }

      try {
        const result = await ctx.db.transaction(async (tx) => {
          const [pairing] = await tx
            .insert(pairings)
            .values({
              studentProfileId: studentProfile.id,
              teacherProfileId: teacherProfile.id,
            })
            .returning();

          await tx
            .update(profiles)
            .set({
              matchStatus: "matched",
            })
            .where(
              inArray(profiles.id, [studentProfile.id, teacherProfile.id]),
            );

          return tx.query.pairings.findFirst({
            where: eq(pairings.id, pairing!.id),
            with: {
              student: true,
              teacher: true,
            },
          });
        });

        if (!result?.student || !result.teacher) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: messages.errors.unexpectedDatabase,
          });
        }

        await notifyPairingCreated(result);

        return {
          pairing: {
            createdAt: result.createdAt,
            id: result.id,
            student: {
              contact: result.student.contact ?? null,
              id: result.student.id,
              name: result.student.name,
              role: result.student.role,
              username: result.student.username,
            },
            teacher: {
              id: result.teacher.id,
              name: result.teacher.name,
              role: result.teacher.role,
              username: result.teacher.username,
            },
          },
        };
      } catch (error) {
        throw mapDatabaseError(error, ctx.locale);
      }
    }),

  waitingPool: adminProcedure.query(async ({ ctx }) => {
    const [students, teachers] = await Promise.all([
      ctx.db
        .select({
          age: studentSignups.age,
          childName: studentSignups.childName,
          contact: studentSignups.contact,
          createdAt: studentSignups.createdAt,
          phone: studentSignups.phone,
          profileId: profiles.id,
          signupId: studentSignups.id,
          status: studentSignups.status,
          username: profiles.username,
        })
        .from(studentSignups)
        .innerJoin(profiles, eq(studentSignups.profileId, profiles.id))
        .where(
          and(
            eq(profiles.role, "student"),
            eq(profiles.matchStatus, "pending"),
            inArray(studentSignups.status, ["pending", "approved"]),
          ),
        )
        .orderBy(asc(studentSignups.createdAt)),
      ctx.db
        .select({
          createdAt: teacherSignups.createdAt,
          englishScore: teacherSignups.englishScore,
          gender: teacherSignups.gender,
          grade: teacherSignups.grade,
          name: profiles.name,
          profileId: profiles.id,
          school: teacherSignups.school,
          signupId: teacherSignups.id,
          status: teacherSignups.status,
          username: profiles.username,
        })
        .from(teacherSignups)
        .innerJoin(profiles, eq(teacherSignups.profileId, profiles.id))
        .where(
          and(
            eq(profiles.role, "teacher"),
            eq(profiles.matchStatus, "pending"),
            inArray(teacherSignups.status, ["pending", "approved"]),
          ),
        )
        .orderBy(asc(teacherSignups.createdAt)),
    ]);

    return {
      students,
      teachers,
    };
  }),

  reviewStudentSignup: adminProcedure
    .input(signupReviewSchema)
    .mutation(async ({ ctx, input }) => {
      const messages = getMessages(ctx.locale);
      const [updated] = await ctx.db
        .update(studentSignups)
        .set({
          rejectReason: input.action === "reject" ? input.reason : "",
          reviewedAt: new Date(),
          status: input.action === "approve" ? "approved" : "rejected",
        })
        .where(
          and(
            eq(studentSignups.id, input.id),
            eq(studentSignups.status, "pending"),
          ),
        )
        .returning();

      if (!updated) {
        const signup = await ctx.db.query.studentSignups.findFirst({
          where: eq(studentSignups.id, input.id),
        });

        if (!signup) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: messages.errors.signupNotFound,
          });
        }

        throw new TRPCError({
          code: "CONFLICT",
          message: messages.errors.signupAlreadyReviewed,
        });
      }

      return { signup: updated };
    }),

  reviewTeacherSignup: adminProcedure
    .input(signupReviewSchema)
    .mutation(async ({ ctx, input }) => {
      const messages = getMessages(ctx.locale);
      const [updated] = await ctx.db
        .update(teacherSignups)
        .set({
          rejectReason: input.action === "reject" ? input.reason : "",
          reviewedAt: new Date(),
          status: input.action === "approve" ? "approved" : "rejected",
        })
        .where(
          and(
            eq(teacherSignups.id, input.id),
            eq(teacherSignups.status, "pending"),
          ),
        )
        .returning();

      if (!updated) {
        const signup = await ctx.db.query.teacherSignups.findFirst({
          where: eq(teacherSignups.id, input.id),
        });

        if (!signup) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: messages.errors.signupNotFound,
          });
        }

        throw new TRPCError({
          code: "CONFLICT",
          message: messages.errors.signupAlreadyReviewed,
        });
      }

      return { signup: updated };
    }),

  listReviewedSignups: adminProcedure
    .input(reviewedSignupsFilterSchema)
    .query(async ({ ctx, input }) => {
      const studentStatuses: Array<"approved" | "rejected"> =
        input.status === "all" ? ["approved", "rejected"] : [input.status];
      const teacherStatuses: Array<"approved" | "rejected"> =
        input.status === "all" ? ["approved", "rejected"] : [input.status];

      const [students, teachers] = await Promise.all([
        input.role === "teacher"
          ? Promise.resolve([])
          : ctx.db
              .select({
                createdAt: studentSignups.createdAt,
                matchStatus: profiles.matchStatus,
                name: studentSignups.childName,
                rejectReason: studentSignups.rejectReason,
                reviewedAt: studentSignups.reviewedAt,
                role: sql<"student">`'student'`,
                signupId: studentSignups.id,
                status: studentSignups.status,
                username: profiles.username,
              })
              .from(studentSignups)
              .innerJoin(profiles, eq(studentSignups.profileId, profiles.id))
              .where(inArray(studentSignups.status, studentStatuses))
              .orderBy(
                desc(studentSignups.reviewedAt),
                desc(studentSignups.createdAt),
              ),
        input.role === "student"
          ? Promise.resolve([])
          : ctx.db
              .select({
                createdAt: teacherSignups.createdAt,
                matchStatus: profiles.matchStatus,
                name: profiles.name,
                rejectReason: teacherSignups.rejectReason,
                reviewedAt: teacherSignups.reviewedAt,
                role: sql<"teacher">`'teacher'`,
                signupId: teacherSignups.id,
                status: teacherSignups.status,
                username: profiles.username,
              })
              .from(teacherSignups)
              .innerJoin(profiles, eq(teacherSignups.profileId, profiles.id))
              .where(inArray(teacherSignups.status, teacherStatuses))
              .orderBy(
                desc(teacherSignups.reviewedAt),
                desc(teacherSignups.createdAt),
              ),
      ]);

      return [...students, ...teachers].sort((left, right) => {
        const leftTime = left.reviewedAt?.getTime() ?? 0;
        const rightTime = right.reviewedAt?.getTime() ?? 0;
        return (
          rightTime - leftTime ||
          right.createdAt.getTime() - left.createdAt.getTime()
        );
      });
    }),

  listRecoveryRequests: adminProcedure.query(async () =>
    listManualRecoveryRequests(),
  ),

  markRecoveryRequest: adminProcedure
    .input(markRecoveryRequestSchema)
    .mutation(async ({ ctx, input }) => {
      await rejectManualRecoveryRequest({
        adminUserId: ctx.session.user.id,
        requestId: input.id,
      });
      return { ok: true };
    }),

  createRecoveryResetLink: adminProcedure
    .input(createRecoveryResetLinkSchema)
    .mutation(async ({ ctx, input }) => ({
      resetUrl: await createManualRecoveryResetUrl({
        adminUserId: ctx.session.user.id,
        requestId: input.requestId,
        userId: input.userId,
      }),
    })),

  listPairings: adminProcedure
    .input(listPairingsSchema.optional())
    .query(async ({ ctx, input }) => {
      const requestedPage = input?.page ?? 1;
      const pageSize = input?.pageSize ?? 20;
      const search = input?.search?.trim() ?? "";

      const [overallTotalRow] = await ctx.db
        .select({ total: count() })
        .from(pairings);
      const overallTotal = overallTotalRow?.total ?? 0;

      let whereClause: ReturnType<typeof or> | undefined;
      if (search) {
        const profilePattern = `%${search.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
        const matchingProfiles = await ctx.db
          .select({ id: profiles.id })
          .from(profiles)
          .where(
            or(
              ilike(profiles.name, profilePattern),
              ilike(profiles.username, profilePattern),
              ilike(profiles.contact, profilePattern),
            ),
          );
        const matchingProfileIds = matchingProfiles.map(
          (profile) => profile.id,
        );

        if (matchingProfileIds.length === 0) {
          return {
            pairings: [],
            pagination: {
              overallTotal,
              page: 1,
              pageSize,
              total: 0,
              totalPages: 1,
            },
          };
        }

        whereClause = or(
          inArray(pairings.teacherProfileId, matchingProfileIds),
          inArray(pairings.studentProfileId, matchingProfileIds),
        );
      }

      const filteredTotal = whereClause
        ? ((
            await ctx.db
              .select({ total: count() })
              .from(pairings)
              .where(whereClause)
          )[0]?.total ?? 0)
        : overallTotal;
      const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize));
      const page = Math.min(Math.max(requestedPage, 1), totalPages);
      const offset = (page - 1) * pageSize;
      const rows = await ctx.db.query.pairings.findMany({
        where: whereClause,
        orderBy: (pairing, { desc }) => [desc(pairing.createdAt)],
        limit: pageSize,
        offset,
        with: {
          appointments: {
            orderBy: (appointment, { asc }) => [
              asc(appointment.scheduledStart),
            ],
          },
          lessons: {
            orderBy: (lesson, { asc }) => [asc(lesson.weekNumber)],
          },
          student: true,
          teacher: true,
        },
      });

      return {
        pairings: rows.map(serializeAdminPairingProgress),
        pagination: {
          overallTotal,
          page,
          pageSize,
          total: filteredTotal,
          totalPages,
        },
      };
    }),

  progressReport: adminProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.query.pairings.findMany({
      orderBy: (pairing, { desc }) => [desc(pairing.createdAt)],
      with: {
        appointments: {
          orderBy: (appointment, { asc }) => [asc(appointment.scheduledStart)],
        },
        lessons: {
          orderBy: (lesson, { asc }) => [asc(lesson.weekNumber)],
        },
        student: true,
        teacher: true,
      },
    });

    return buildAdminProgressReport(rows);
  }),

  pairingDetails: adminProcedure
    .input(deletePairingSchema)
    .query(async ({ ctx, input }) => {
      const messages = getMessages(ctx.locale);
      const pairing = await ctx.db.query.pairings.findFirst({
        where: eq(pairings.id, input.id),
        with: {
          appointments: {
            orderBy: (appointment, { asc }) => [
              asc(appointment.scheduledStart),
            ],
          },
          feedback: {
            orderBy: (feedbackRow, { asc }) => [asc(feedbackRow.weekNumber)],
          },
          lessons: {
            orderBy: (lesson, { asc }) => [asc(lesson.weekNumber)],
            with: {
              notes: true,
            },
          },
          student: true,
          teacher: true,
        },
      });

      if (!pairing?.student || !pairing.teacher) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: messages.errors.pairingNotFound,
        });
      }

      return serializeAdminPairingDetails(pairing);
    }),

  deletePairing: adminProcedure
    .input(deletePairingSchema)
    .mutation(async ({ ctx, input }) => {
      const messages = getMessages(ctx.locale);
      const pairing = await ctx.db.query.pairings.findFirst({
        where: eq(pairings.id, input.id),
        with: {
          feedback: true,
          lessons: true,
          student: true,
          teacher: true,
        },
      });

      if (!pairing?.teacher || !pairing.student) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: messages.errors.pairingNotFound,
        });
      }

      if (pairing.lessons.length > 0 || pairing.feedback.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: messages.errors.pairingHasHistory,
        });
      }

      const evidenceKeys = pairing.lessons
        .map((lesson) => lesson.evidenceKey)
        .filter((value): value is string => Boolean(value));

      await ctx.db.transaction(async (tx) => {
        await tx.delete(pairings).where(eq(pairings.id, input.id));
        await tx
          .update(profiles)
          .set({
            matchStatus: "pending",
          })
          .where(
            inArray(profiles.id, [pairing.teacher.id, pairing.student.id]),
          );
      });

      if (evidenceKeys.length > 0) {
        const cleanupResults = await Promise.allSettled(
          evidenceKeys.map((evidenceKey) =>
            deleteStoredLessonEvidence(evidenceKey),
          ),
        );
        const failedBlobDeletes = cleanupResults.filter(
          (result): result is PromiseRejectedResult =>
            result.status === "rejected",
        );

        if (failedBlobDeletes.length > 0) {
          console.error(
            "[admin.deletePairing] failed to delete orphaned blobs",
            {
              blobCount: failedBlobDeletes.length,
              pairingId: input.id,
            },
          );
        }
      }

      return { ok: true };
    }),
});
