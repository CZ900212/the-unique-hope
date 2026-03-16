import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const authRouter = createTRPCRouter({
  me: protectedProcedure.query(({ ctx }) => ({
    id: ctx.activeUser.id,
    email: ctx.activeUser.email,
    role: ctx.activeProfile.role,
    name: ctx.activeProfile.name,
    username: ctx.activeProfile.username,
    contact: ctx.activeProfile.contact ?? "",
  })),
});
