import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  getBrowserPushPublicKey,
  UnsafeBrowserPushEndpointError,
} from "~/server/services/notification-push";
import {
  deleteBrowserPushSubscription,
  getUnreadNotificationCount,
  listUserNotifications,
  markAllUserNotificationsRead,
  markUserNotificationRead,
  saveBrowserPushSubscription,
} from "~/server/services/notifications";

const notificationIdSchema = z.object({
  id: z.string().uuid(),
});

const browserSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  expirationTime: z.number().nonnegative().nullable().optional(),
  keys: z.object({
    auth: z.string().min(1).max(512),
    p256dh: z.string().min(1).max(512),
  }),
});

export const notificationsRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const [notifications, unreadCount] = await Promise.all([
      listUserNotifications(ctx.activeProfile.id),
      getUnreadNotificationCount(ctx.activeProfile.id),
    ]);

    return {
      browserPushPublicKey: getBrowserPushPublicKey(),
      notifications,
      unreadCount,
    };
  }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => ({
    unreadCount: await getUnreadNotificationCount(ctx.activeProfile.id),
  })),

  markRead: protectedProcedure
    .input(notificationIdSchema)
    .mutation(async ({ ctx, input }) => {
      await markUserNotificationRead({
        notificationId: input.id,
        profileId: ctx.activeProfile.id,
      });
      return { ok: true };
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await markAllUserNotificationsRead(ctx.activeProfile.id);
    return { ok: true };
  }),

  saveBrowserSubscription: protectedProcedure
    .input(browserSubscriptionSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await saveBrowserPushSubscription({
          auth: input.keys.auth,
          endpoint: input.endpoint,
          expirationTime:
            typeof input.expirationTime === "number"
              ? new Date(input.expirationTime)
              : null,
          p256dh: input.keys.p256dh,
          profileId: ctx.activeProfile.id,
          userAgent: ctx.headers.get("user-agent"),
        });
      } catch (error) {
        if (error instanceof UnsafeBrowserPushEndpointError) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Browser push endpoint must use a public HTTPS push service.",
          });
        }

        throw error;
      }
      return { ok: true };
    }),

  deleteBrowserSubscription: protectedProcedure
    .input(z.object({ endpoint: z.string().url().max(2048) }))
    .mutation(async ({ ctx, input }) => {
      await deleteBrowserPushSubscription({
        endpoint: input.endpoint,
        profileId: ctx.activeProfile.id,
      });
      return { ok: true };
    }),
});
