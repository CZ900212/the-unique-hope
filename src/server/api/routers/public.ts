import { TRPCError } from "@trpc/server";

import { studentSignups } from "~/server/db/schema";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { studentSignupSchema } from "~/lib/domain";
import { consumeRateLimit, extractClientIp } from "~/server/rate-limit";

export const publicRouter = createTRPCRouter({
  createStudentSignup: publicProcedure
    .input(studentSignupSchema)
    .mutation(async ({ ctx, input }) => {
      const clientIp = extractClientIp(ctx.headers);
      const limit = clientIp
        ? await consumeRateLimit({
            action: "signup:ip",
            limit: 5,
            subject: clientIp,
            windowMs: 60 * 60 * 1000,
          })
        : null;
      if (limit && !limit.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many signup submissions. Try again later.",
        });
      }

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
