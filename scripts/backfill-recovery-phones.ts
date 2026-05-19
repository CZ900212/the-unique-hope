import { and, eq } from "drizzle-orm";

import { conn, db } from "~/server/db";
import {
  hashRecoveryPhone,
  getRecoveryPhoneLast4,
  maskRecoveryPhone,
  normalizeRecoveryPhone,
} from "~/server/auth/phone-password-reset";
import {
  profiles,
  studentRecoveryPhones,
  studentSignups,
  userCredentials,
  users,
} from "~/server/db/schema";

function isTestLikeAccount(input: {
  email: string;
  name: string | null;
  username: string;
}) {
  const value =
    `${input.email} ${input.name ?? ""} ${input.username}`.toLowerCase();
  return /\b(test|demo|seed)\b/.test(value) || value.includes("测试");
}

async function main() {
  const rows = await db
    .select({
      email: users.email,
      name: profiles.name,
      phone: studentSignups.phone,
      userId: users.id,
      username: profiles.username,
    })
    .from(studentSignups)
    .innerJoin(profiles, eq(profiles.id, studentSignups.profileId))
    .innerJoin(users, eq(users.id, profiles.userId))
    .innerJoin(userCredentials, eq(userCredentials.userId, users.id))
    .where(eq(profiles.role, "student"));

  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    if (isTestLikeAccount(row)) {
      skipped += 1;
      continue;
    }

    try {
      const normalizedPhone = normalizeRecoveryPhone(row.phone);
      const phoneHash = hashRecoveryPhone(normalizedPhone);
      const existing = await db.query.studentRecoveryPhones.findFirst({
        where: and(
          eq(studentRecoveryPhones.userId, row.userId),
          eq(studentRecoveryPhones.phoneHash, phoneHash),
        ),
      });
      if (existing) {
        skipped += 1;
        continue;
      }

      await db.insert(studentRecoveryPhones).values({
        userId: row.userId,
        phoneHash,
        phoneMasked: maskRecoveryPhone(normalizedPhone),
        phoneLast4: getRecoveryPhoneLast4(normalizedPhone),
        status: "active",
        source: "student_signup_backfill",
      });
      inserted += 1;
    } catch {
      skipped += 1;
    }
  }

  console.log(
    `Recovery phone backfill complete. Inserted: ${inserted}. Skipped: ${skipped}.`,
  );
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await conn.end({ timeout: 5 });
  });
