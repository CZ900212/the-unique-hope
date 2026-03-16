import { del } from "@vercel/blob";
import { TRPCError } from "@trpc/server";
import { hash } from "bcryptjs";
import { and, count, eq, inArray } from "drizzle-orm";

import {
  createPairingSchema,
  deletePairingSchema,
  listStudentSignupsSchema,
  paginationSchema,
  signupReviewSchema,
  toCanonicalEmail,
} from "~/lib/domain";
import {
  pairings,
  profiles,
  studentSignups,
  userCredentials,
  users,
} from "~/server/db/schema";
import { createTRPCRouter, roleProtectedProcedure } from "~/server/api/trpc";
import { getBlobReadWriteToken } from "~/server/lesson-evidence";
import {
  buildAdminProgressReport,
  serializeAdminPairingProgress,
} from "~/server/services/admin-progress";

const adminProcedure = roleProtectedProcedure("admin");
const BCRYPT_ROUNDS = 12;

function mapDatabaseError(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  const message =
    typeof error === "object" && error && "message" in error ? String(error.message) : "";

  if (code === "23505" || message.includes("duplicate key")) {
    return new TRPCError({
      code: "CONFLICT",
      message: "A username or email already exists for this pairing",
    });
  }

  return error instanceof TRPCError
    ? error
    : new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Unexpected database error",
      });
}

export const adminRouter = createTRPCRouter({
  createPairing: adminProcedure
    .input(createPairingSchema)
    .mutation(async ({ ctx, input }) => {
      const teacherEmail = toCanonicalEmail(
        input.teacher.email,
        input.teacher.username,
        "teacher",
      );
      const studentEmail = toCanonicalEmail(
        input.student.email,
        input.student.username,
        "student",
      );

      try {
        const [teacherHash, studentHash] = await Promise.all([
          hash(input.teacher.password, BCRYPT_ROUNDS),
          hash(input.student.password, BCRYPT_ROUNDS),
        ]);

        const result = await ctx.db.transaction(async (tx) => {
          const [teacherUser] = await tx
            .insert(users)
            .values({
              email: teacherEmail,
              name: input.teacher.name,
            })
            .returning();

          const [studentUser] = await tx
            .insert(users)
            .values({
              email: studentEmail,
              name: input.student.name,
            })
            .returning();

          const [teacherProfile] = await tx
            .insert(profiles)
            .values({
              userId: teacherUser!.id,
              role: "teacher",
              username: input.teacher.username,
              name: input.teacher.name,
              contact: input.teacher.contact || "",
            })
            .returning();

          const [studentProfile] = await tx
            .insert(profiles)
            .values({
              userId: studentUser!.id,
              role: "student",
              username: input.student.username,
              name: input.student.name,
              contact: input.student.contact || "",
            })
            .returning();

          await tx.insert(userCredentials).values([
            {
              userId: teacherUser!.id,
              passwordHash: teacherHash,
            },
            {
              userId: studentUser!.id,
              passwordHash: studentHash,
            },
          ]);

          const [pairing] = await tx
            .insert(pairings)
            .values({
              teacherProfileId: teacherProfile!.id,
              studentProfileId: studentProfile!.id,
            })
            .returning();

          return {
            pairing: pairing!,
            teacherProfile: teacherProfile!,
            studentProfile: studentProfile!,
          };
        });

        return {
          pairing: {
            id: result.pairing.id,
            createdAt: result.pairing.createdAt,
            teacher: {
              id: result.teacherProfile.id,
              name: result.teacherProfile.name,
              role: result.teacherProfile.role,
              username: result.teacherProfile.username,
            },
            student: {
              id: result.studentProfile.id,
              name: result.studentProfile.name,
              role: result.studentProfile.role,
              username: result.studentProfile.username,
              contact: result.studentProfile.contact ?? null,
            },
          },
        };
      } catch (error) {
        throw mapDatabaseError(error);
      }
    }),

  listPairings: adminProcedure
    .input(paginationSchema.optional())
    .query(async ({ ctx, input }) => {
      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? 20;
      const offset = (page - 1) * pageSize;

      const [totalRow] = await ctx.db.select({ total: count() }).from(pairings);
      const rows = await ctx.db.query.pairings.findMany({
        orderBy: (pairing, { desc }) => [desc(pairing.createdAt)],
        limit: pageSize,
        offset,
        with: {
          teacher: true,
          student: true,
          lessons: {
            orderBy: (lesson, { asc }) => [asc(lesson.weekNumber)],
          },
        },
      });

      return {
        pairings: rows.map(serializeAdminPairingProgress),
        pagination: {
          page,
          pageSize,
          total: totalRow?.total ?? 0,
          totalPages: Math.max(1, Math.ceil((totalRow?.total ?? 0) / pageSize)),
        },
      };
    }),

  progressReport: adminProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.query.pairings.findMany({
      orderBy: (pairing, { desc }) => [desc(pairing.createdAt)],
      with: {
        teacher: true,
        student: true,
        lessons: {
          orderBy: (lesson, { asc }) => [asc(lesson.weekNumber)],
        },
      },
    });

    return buildAdminProgressReport(rows);
  }),

  deletePairing: adminProcedure
    .input(deletePairingSchema)
    .mutation(async ({ ctx, input }) => {
      const pairing = await ctx.db.query.pairings.findFirst({
        where: eq(pairings.id, input.id),
        with: {
          teacher: true,
          student: true,
          lessons: true,
        },
      });

      if (!pairing?.teacher || !pairing.student) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pairing not found",
        });
      }

      const blobKeys = pairing.lessons
        .map((lesson) => lesson.evidenceKey)
        .filter((value): value is string => Boolean(value));
      const userIds = [pairing.teacher.userId, pairing.student.userId];
      const blobToken = getBlobReadWriteToken();

      await ctx.db.transaction(async (tx) => {
        await tx.delete(pairings).where(eq(pairings.id, input.id));
        await tx.delete(users).where(inArray(users.id, userIds));
      });

      if (blobToken && blobKeys.length > 0) {
        const cleanupResults = await Promise.allSettled(
          blobKeys.map((blobKey) => del(blobKey, { token: blobToken })),
        );
        const failedBlobDeletes = cleanupResults.filter(
          (result): result is PromiseRejectedResult => result.status === "rejected",
        );

        if (failedBlobDeletes.length > 0) {
          console.error("[admin.deletePairing] failed to delete orphaned blobs", {
            blobCount: failedBlobDeletes.length,
            pairingId: input.id,
          });
        }
      }

      return { ok: true };
    }),

  listStudentSignups: adminProcedure
    .input(listStudentSignupsSchema.optional())
    .query(async ({ ctx, input }) => {
      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? 20;
      const status = input?.status ?? "all";
      const offset = (page - 1) * pageSize;

      const whereClause = status === "all" ? undefined : eq(studentSignups.status, status);
      const [totalRow] = await ctx.db
        .select({ total: count() })
        .from(studentSignups)
        .where(whereClause);

      const rows = await ctx.db.query.studentSignups.findMany({
        where: whereClause,
        orderBy: (signup, { desc }) => [desc(signup.createdAt)],
        limit: pageSize,
        offset,
      });

      return {
        signups: rows,
        pagination: {
          page,
          pageSize,
          total: totalRow?.total ?? 0,
          totalPages: Math.max(1, Math.ceil((totalRow?.total ?? 0) / pageSize)),
        },
      };
    }),

  reviewStudentSignup: adminProcedure
    .input(signupReviewSchema)
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(studentSignups)
        .set({
          status: input.action === "approve" ? "approved" : "rejected",
          reviewedAt: new Date(),
          rejectReason: input.action === "reject" ? input.reason : "",
        })
        .where(and(eq(studentSignups.id, input.id), eq(studentSignups.status, "pending")))
        .returning();

      if (!updated) {
        const signup = await ctx.db.query.studentSignups.findFirst({
          where: eq(studentSignups.id, input.id),
        });

        if (!signup) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Signup not found",
          });
        }

        throw new TRPCError({
          code: "CONFLICT",
          message: "Signup already reviewed",
        });
      }

      return { signup: updated };
    }),
});
