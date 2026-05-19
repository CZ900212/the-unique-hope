import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  join(process.cwd(), "drizzle/0001_futuristic_puma.sql"),
  "utf8",
);
const webPushMigrationSql = readFileSync(
  join(process.cwd(), "drizzle/0006_web_push_delivery_outbox.sql"),
  "utf8",
);
const phoneRecoveryMigrationSql = readFileSync(
  join(process.cwd(), "drizzle/0007_student_phone_recovery.sql"),
  "utf8",
);
const manualRecoveryMigrationSql = readFileSync(
  join(process.cwd(), "drizzle/0008_manual_recovery_requests.sql"),
  "utf8",
);

function positionOf(sql: string) {
  const index = migrationSql.indexOf(sql);
  expect(index).toBeGreaterThanOrEqual(0);
  return index;
}

describe("0001 student signup migration", () => {
  it("backfills legacy student signup profile ids before making them required", () => {
    const addNullableProfileId = positionOf(
      'ALTER TABLE "unique_hope_student_signup" ADD COLUMN "profile_id" uuid;',
    );
    const insertLegacyUsers = positionOf('INSERT INTO "unique_hope_user"');
    const insertLegacyProfiles = positionOf(
      'INSERT INTO "unique_hope_profile"',
    );
    const updateLegacySignups = positionOf(
      'UPDATE "unique_hope_student_signup" AS "signup"',
    );
    const nullGuard = positionOf(
      "Cannot make unique_hope_student_signup.profile_id required",
    );
    const setNotNull = positionOf(
      'ALTER TABLE "unique_hope_student_signup" ALTER COLUMN "profile_id" SET NOT NULL;',
    );
    const addForeignKey = positionOf(
      'ALTER TABLE "unique_hope_student_signup" ADD CONSTRAINT',
    );

    expect(addNullableProfileId).toBeLessThan(insertLegacyUsers);
    expect(insertLegacyUsers).toBeLessThan(insertLegacyProfiles);
    expect(insertLegacyProfiles).toBeLessThan(updateLegacySignups);
    expect(updateLegacySignups).toBeLessThan(nullGuard);
    expect(nullGuard).toBeLessThan(setNotNull);
    expect(setNotNull).toBeLessThan(addForeignKey);
  });
});

describe("0006 Web Push delivery migration", () => {
  it("adds subscription health fields before creating the delivery outbox", () => {
    const disabledAt = webPushMigrationSql.indexOf(
      'ADD COLUMN IF NOT EXISTS "disabled_at"',
    );
    const deliveryTable = webPushMigrationSql.indexOf(
      'CREATE TABLE IF NOT EXISTS "unique_hope_notification_push_delivery"',
    );
    const uniqueIndex = webPushMigrationSql.indexOf(
      'CREATE UNIQUE INDEX IF NOT EXISTS "notification_push_delivery_notification_subscription_idx"',
    );

    expect(disabledAt).toBeGreaterThanOrEqual(0);
    expect(deliveryTable).toBeGreaterThan(disabledAt);
    expect(uniqueIndex).toBeGreaterThan(deliveryTable);
  });
});

describe("0007 Student phone recovery migration", () => {
  it("stores hashed recovery phones without making historical phones verified", () => {
    expect(phoneRecoveryMigrationSql).toContain(
      'CREATE TABLE IF NOT EXISTS "unique_hope_student_recovery_phone"',
    );
    expect(phoneRecoveryMigrationSql).toContain(
      '"phone_hash" varchar(64) NOT NULL',
    );
    expect(phoneRecoveryMigrationSql).toContain(
      '"phone_masked" varchar(32) NOT NULL',
    );
    expect(phoneRecoveryMigrationSql).toContain('"verified_at" timestamp');
    expect(phoneRecoveryMigrationSql).not.toContain(
      '"verified_at" timestamp with time zone NOT NULL',
    );
    expect(phoneRecoveryMigrationSql).not.toContain('"phone_raw"');
    expect(phoneRecoveryMigrationSql).not.toContain('"phone" varchar');
  });
});

describe("0008 Manual recovery request migration", () => {
  it("creates a role-based manual recovery table without phone-specific columns", () => {
    expect(manualRecoveryMigrationSql).toContain(
      'CREATE TABLE IF NOT EXISTS "unique_hope_manual_recovery_request"',
    );
    expect(manualRecoveryMigrationSql).toContain(
      '"applicant_role" "unique_hope_role" NOT NULL',
    );
    expect(manualRecoveryMigrationSql).toContain(
      '"password_reset_token_id" uuid',
    );
    expect(manualRecoveryMigrationSql).not.toContain('"phone_hash"');
    expect(manualRecoveryMigrationSql).not.toContain('"phone_masked"');
  });
});
