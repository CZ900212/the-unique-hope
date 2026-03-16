import { adminRouter } from "~/server/api/routers/admin";
import { authRouter } from "~/server/api/routers/auth";
import { publicRouter } from "~/server/api/routers/public";
import { studentRouter } from "~/server/api/routers/student";
import { teacherRouter } from "~/server/api/routers/teacher";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

export const appRouter = createTRPCRouter({
  admin: adminRouter,
  auth: authRouter,
  public: publicRouter,
  student: studentRouter,
  teacher: teacherRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
