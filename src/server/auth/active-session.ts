import { redirect } from "next/navigation";
import { type Session } from "next-auth";
import { eq } from "drizzle-orm";

import { type Role } from "~/lib/domain";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { profiles, users } from "~/server/db/schema";

type ActiveUserSession = {
  profile: typeof profiles.$inferSelect;
  session: Session;
  user: typeof users.$inferSelect;
};

export async function loadActiveUserSession(session: Session | null) {
  if (!session?.user?.id) {
    return null;
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });
  if (!user) {
    return null;
  }

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, user.id),
  });
  if (!profile) {
    return null;
  }

  const sessionAuthVersion = session.user.authVersion ?? 0;
  if (user.authVersion !== sessionAuthVersion) {
    return null;
  }

  if (session.user.role !== profile.role) {
    return null;
  }

  return {
    profile,
    session: {
      ...session,
      user: {
        ...session.user,
        authVersion: user.authVersion,
        contact: profile.contact ?? null,
        name: profile.name,
        role: profile.role,
        username: profile.username,
      },
    },
    user,
  } satisfies ActiveUserSession;
}

export async function getActiveUserSession() {
  return loadActiveUserSession(await auth());
}

export async function requirePageUser(role?: Role) {
  const active = await getActiveUserSession();
  if (!active) {
    redirect("/login");
  }

  if (role && active.profile.role !== role) {
    redirect(`/${active.profile.role}`);
  }

  return active;
}
