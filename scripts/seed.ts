import { hash } from "bcryptjs";
import { and, eq, sql } from "drizzle-orm";

import { env } from "~/env";
import { toCanonicalEmail } from "~/lib/domain";
import { resolveSeedPolicy } from "~/lib/seed-policy";
import { conn, db } from "~/server/db";
import { pairings, profiles, sessions, userCredentials, users } from "~/server/db/schema";

const BCRYPT_ROUNDS = 12;

async function ensureUserWithProfile(input: {
  contact?: string;
  email?: string;
  name: string;
  password: string;
  resetExistingPassword: boolean;
  role: "admin" | "teacher" | "student";
  username: string;
}) {
  const canonicalEmail = input.email ?? toCanonicalEmail(undefined, input.username, input.role);
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, canonicalEmail),
    with: {
      profile: true,
      credential: true,
    },
  });

  const passwordHash = await hash(input.password, BCRYPT_ROUNDS);

  if (existingUser?.profile) {
    await db
      .update(users)
      .set({ email: canonicalEmail, name: input.name })
      .where(eq(users.id, existingUser.id));

    await db
      .update(profiles)
      .set({
        role: input.role,
        username: input.username,
        name: input.name,
        contact: input.contact ?? canonicalEmail,
      })
      .where(eq(profiles.userId, existingUser.id));

    let passwordUpdated = false;

    if (existingUser.credential && input.resetExistingPassword) {
      await db
        .update(userCredentials)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(userCredentials.userId, existingUser.id));
      passwordUpdated = true;
    } else if (!existingUser.credential) {
      await db.insert(userCredentials).values({
        userId: existingUser.id,
        passwordHash,
      });
      passwordUpdated = true;
    }

    if (passwordUpdated) {
      await db
        .update(users)
        .set({
          authVersion: sql`${users.authVersion} + 1`,
        })
        .where(eq(users.id, existingUser.id));
      await db.delete(sessions).where(eq(sessions.userId, existingUser.id));
    }

    const refreshedProfile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, existingUser.id),
    });

    return {
      created: false,
      passwordUpdated,
      profile: refreshedProfile!,
      user: existingUser,
    };
  }

  const [user] = await db
    .insert(users)
    .values({
      email: canonicalEmail,
      name: input.name,
    })
    .returning();

  const [profile] = await db
    .insert(profiles)
    .values({
      userId: user!.id,
      role: input.role,
      username: input.username,
      name: input.name,
      contact: input.contact ?? canonicalEmail,
    })
    .returning();

  await db.insert(userCredentials).values({
    userId: user!.id,
    passwordHash,
  });

  return {
    created: true,
    passwordUpdated: true,
    profile: profile!,
    user: user!,
  };
}

async function ensureDemoPairing(resetExistingPassword: boolean) {
  await ensureUserWithProfile({
    role: "admin",
    username: "demo_admin",
    name: "Demo Admin",
    email: "demo_admin@theuniquehope.local",
    password: "demo123456",
    contact: "demo_admin@uniquehope.local",
    resetExistingPassword,
  });

  const teacher = await ensureUserWithProfile({
    role: "teacher",
    username: "demo_teacher",
    name: "Demo Teacher",
    password: "demo123456",
    contact: "demo_teacher@uniquehope.local",
    resetExistingPassword,
  });
  const student = await ensureUserWithProfile({
    role: "student",
    username: "demo_student",
    name: "Demo Student",
    password: "demo123456",
    contact: "demo_student@uniquehope.local",
    resetExistingPassword,
  });

  const existing = await db.query.pairings.findFirst({
    where: and(
      eq(pairings.teacherProfileId, teacher.profile.id),
      eq(pairings.studentProfileId, student.profile.id),
    ),
  });

  if (!existing) {
    await db.insert(pairings).values({
      teacherProfileId: teacher.profile.id,
      studentProfileId: student.profile.id,
    });
  }
}

async function main() {
  const seedPolicy = resolveSeedPolicy({
    adminPassword: env.SEED_ADMIN_PASSWORD,
    nodeEnv: env.NODE_ENV,
    resetExistingPasswords: env.SEED_RESET_EXISTING_PASSWORDS,
    seedDemoData: env.SEED_DEMO_DATA,
  });

  const admin = await ensureUserWithProfile({
    role: "admin",
    username: env.SEED_ADMIN_USERNAME ?? "admin",
    name: env.SEED_ADMIN_NAME ?? "The Unique Hope Admin",
    email: env.SEED_ADMIN_EMAIL ?? "admin@theuniquehope.org",
    password: seedPolicy.adminPassword,
    contact: env.SEED_ADMIN_EMAIL ?? "admin@theuniquehope.org",
    resetExistingPassword: seedPolicy.resetExistingPasswords,
  });

  if (seedPolicy.seedDemoData) {
    await ensureDemoPairing(seedPolicy.resetExistingPasswords);
  }

  console.log(`Seed complete. Admin user id: ${admin.user.id}`);
  console.log(`Admin username: ${env.SEED_ADMIN_USERNAME ?? "admin"}`);
  if (admin.created) {
    console.log("Admin account created with the supplied SEED_ADMIN_PASSWORD.");
  } else if (admin.passwordUpdated) {
    console.log("Admin account already existed; password rotated from SEED_ADMIN_PASSWORD.");
  } else {
    console.log("Admin account already existed; password left unchanged.");
  }

  if (seedPolicy.seedDemoData) {
    console.log("Demo teacher/student accounts ensured for non-production use.");
    console.log("Demo admin: demo_admin / demo123456");
  }
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await conn.end({ timeout: 5 });
  });
