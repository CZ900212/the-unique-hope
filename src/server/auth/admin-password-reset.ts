import { hash } from "bcryptjs";
import { and, eq, sql } from "drizzle-orm";

import {
  isEmailIdentifier,
  normalizeIdentifier,
  passwordSchema,
} from "~/lib/domain";
import { db } from "~/server/db";
import { profiles, sessions, userCredentials, users } from "~/server/db/schema";

const BCRYPT_ROUNDS = 12;

type ResetAdminPasswordInput = {
  identifier: string;
  password: string;
};

type AdminAccount = {
  email: string;
  hasCredential: boolean;
  userId: string;
  username: string;
};

export async function resetAdminPassword(input: ResetAdminPasswordInput) {
  const identifier = normalizeIdentifier(input.identifier);
  const password = passwordSchema.parse(input.password);
  const account = await findAdminAccount(identifier);

  if (!account) {
    throw new Error("Admin account not found.");
  }

  const passwordHash = await hash(password, BCRYPT_ROUNDS);

  await db.transaction(async (tx) => {
    if (account.hasCredential) {
      await tx
        .update(userCredentials)
        .set({
          passwordHash,
          updatedAt: new Date(),
        })
        .where(eq(userCredentials.userId, account.userId));
    } else {
      await tx.insert(userCredentials).values({
        userId: account.userId,
        passwordHash,
      });
    }

    await tx
      .update(users)
      .set({
        authVersion: sql`${users.authVersion} + 1`,
      })
      .where(eq(users.id, account.userId));

    await tx.delete(sessions).where(eq(sessions.userId, account.userId));
  });

  return account;
}

async function findAdminAccount(
  identifier: string,
): Promise<AdminAccount | null> {
  if (isEmailIdentifier(identifier)) {
    const user = await db.query.users.findFirst({
      where: eq(users.email, identifier),
      with: {
        credential: true,
        profile: true,
      },
    });

    if (user?.profile.role !== "admin") {
      return null;
    }

    return {
      email: user.email,
      hasCredential: Boolean(user.credential),
      userId: user.id,
      username: user.profile.username,
    };
  }

  const profile = await db.query.profiles.findFirst({
    where: and(eq(profiles.username, identifier), eq(profiles.role, "admin")),
    with: {
      user: {
        with: {
          credential: true,
        },
      },
    },
  });

  if (!profile?.user?.email) {
    return null;
  }

  return {
    email: profile.user.email,
    hasCredential: Boolean(profile.user.credential),
    userId: profile.user.id,
    username: profile.username,
  };
}
