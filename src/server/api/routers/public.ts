import { TRPCError } from "@trpc/server";
import { hash } from "bcryptjs";

import {
  studentSignupSchema,
  teacherSignupSchema,
  toCanonicalEmail,
} from "~/lib/domain";
import { getMessages, type Locale } from "~/lib/i18n";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  profiles,
  studentSignups,
  teacherSignups,
  userCredentials,
  users,
} from "~/server/db/schema";
import { enforcePublicSignupRateLimit } from "~/server/services/public-signups";

const BCRYPT_ROUNDS = 12;

function mapRegistrationError(error: unknown, locale: Locale) {
  const messages = getMessages(locale);
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  const message =
    typeof error === "object" && error && "message" in error ? String(error.message) : "";

  if (code === "23505" || message.includes("duplicate key")) {
    return new TRPCError({
      code: "CONFLICT",
      message: messages.errors.registrationAlreadyExists,
    });
  }

  return error instanceof TRPCError
    ? error
    : new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: messages.errors.unexpectedDatabase,
      });
}

async function createAccount(input: {
  contact?: string;
  name: string;
  password: string;
  role: "teacher" | "student";
  username: string;
}) {
  const email = toCanonicalEmail(undefined, input.username, input.role);
  const passwordHash = await hash(input.password, BCRYPT_ROUNDS);

  return {
    email,
    passwordHash,
    profileValues: {
      contact: input.contact?.trim() ?? "",
      matchStatus: "pending" as const,
      name: input.name,
      role: input.role,
      username: input.username,
    },
    userValues: {
      email,
      name: input.name,
    },
  };
}

export const publicRouter = createTRPCRouter({
  createStudentSignup: publicProcedure
    .input(studentSignupSchema)
    .mutation(async ({ ctx, input }) => {
      await enforcePublicSignupRateLimit(ctx.headers, input.phone, ctx.locale);

      try {
        const account = await createAccount({
          contact: input.contact,
          name: input.childName,
          password: input.password,
          role: "student",
          username: input.username,
        });

        const result = await ctx.db.transaction(async (tx) => {
          const [user] = await tx.insert(users).values(account.userValues).returning();
          const [profile] = await tx
            .insert(profiles)
            .values({
              ...account.profileValues,
              userId: user!.id,
            })
            .returning();

          await tx.insert(userCredentials).values({
            passwordHash: account.passwordHash,
            userId: user!.id,
          });

          const [signup] = await tx
            .insert(studentSignups)
            .values({
              age: input.age,
              childName: input.childName,
              contact: input.contact || "",
              phone: input.phone,
              profileId: profile!.id,
            })
            .returning();

          return { profile: profile!, signup: signup! };
        });

        return {
          signup: {
            createdAt: result.signup.createdAt,
            id: result.signup.id,
            matchingStatus: result.profile.matchStatus,
            username: result.profile.username,
          },
        };
      } catch (error) {
        throw mapRegistrationError(error, ctx.locale);
      }
    }),

  createTeacherSignup: publicProcedure
    .input(teacherSignupSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const account = await createAccount({
          contact: "",
          name: input.name,
          password: input.password,
          role: "teacher",
          username: input.username,
        });

        const result = await ctx.db.transaction(async (tx) => {
          const [user] = await tx.insert(users).values(account.userValues).returning();
          const [profile] = await tx
            .insert(profiles)
            .values({
              ...account.profileValues,
              userId: user!.id,
            })
            .returning();

          await tx.insert(userCredentials).values({
            passwordHash: account.passwordHash,
            userId: user!.id,
          });

          const [signup] = await tx
            .insert(teacherSignups)
            .values({
              englishScore: input.englishScore,
              gender: input.gender,
              grade: input.grade,
              profileId: profile!.id,
              school: input.school,
            })
            .returning();

          return { profile: profile!, signup: signup! };
        });

        return {
          signup: {
            createdAt: result.signup.createdAt,
            id: result.signup.id,
            matchingStatus: result.profile.matchStatus,
            username: result.profile.username,
          },
        };
      } catch (error) {
        throw mapRegistrationError(error, ctx.locale);
      }
    }),
});
