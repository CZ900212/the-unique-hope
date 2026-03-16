import { eq, inArray, sql } from "drizzle-orm";

import { db } from "~/server/db";
import { sessions, users } from "~/server/db/schema";

export async function invalidateUserAuthState(userId: string) {
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        authVersion: sql`${users.authVersion} + 1`,
      })
      .where(eq(users.id, userId));

    await tx.delete(sessions).where(eq(sessions.userId, userId));
  });
}

export async function deleteUserAuthState(userIds: string[]) {
  if (userIds.length === 0) {
    return;
  }

  await db.delete(sessions).where(inArray(sessions.userId, userIds));
}
