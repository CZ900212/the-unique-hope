import { studentSignups } from "~/server/db/schema";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { studentSignupSchema } from "~/lib/domain";
import { enforcePublicSignupRateLimit } from "~/server/services/public-signups";

export const publicRouter = createTRPCRouter({
  createStudentSignup: publicProcedure
    .input(studentSignupSchema)
    .mutation(async ({ ctx, input }) => {
      await enforcePublicSignupRateLimit(ctx.headers, input.phone);

      const [signup] = await ctx.db
        .insert(studentSignups)
        .values({
          childName: input.childName,
          age: input.age,
          phone: input.phone,
          contact: input.contact || "",
        })
        .returning();

      return {
        signup: {
          id: signup!.id,
          status: signup!.status,
          createdAt: signup!.createdAt,
        },
      };
    }),
});
