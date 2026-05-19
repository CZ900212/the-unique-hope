CREATE TYPE "public"."unique_hope_profile_match_status" AS ENUM('pending', 'matched');--> statement-breakpoint
CREATE TABLE "unique_hope_teacher_signup" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"gender" varchar(16) NOT NULL,
	"school" varchar(255) NOT NULL,
	"grade" varchar(64) NOT NULL,
	"english_score" text NOT NULL,
	"status" "unique_hope_signup_status" DEFAULT 'pending' NOT NULL,
	"reject_reason" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "unique_hope_student_inquiry" ALTER COLUMN "source_serial" SET DATA TYPE varchar(128);--> statement-breakpoint
ALTER TABLE "unique_hope_student_inquiry" ALTER COLUMN "source_ip_hash" SET DATA TYPE varchar(80);--> statement-breakpoint
ALTER TABLE "unique_hope_profile" ADD COLUMN "match_status" "unique_hope_profile_match_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "unique_hope_student_signup" ADD COLUMN "profile_id" uuid;--> statement-breakpoint
WITH legacy_signups AS (
	SELECT
		"id" AS "signup_id",
		"child_name",
		"contact",
		('legacy_student_' || left(md5("id"::text), 17))::varchar(32) AS "username",
		('legacy-student-' || "id"::text)::varchar(255) AS "user_id",
		(('legacy_student_' || left(md5("id"::text), 17)) || '.student@theuniquehope.local')::varchar(255) AS "email"
	FROM "unique_hope_student_signup"
	WHERE "profile_id" IS NULL
)
INSERT INTO "unique_hope_user" ("id", "name", "email", "email_verified", "auth_version")
SELECT "user_id", "child_name", "email", now(), 1
FROM legacy_signups
ON CONFLICT ("email") DO NOTHING;--> statement-breakpoint
WITH legacy_signups AS (
	SELECT
		"id" AS "signup_id",
		"child_name",
		"contact",
		('legacy_student_' || left(md5("id"::text), 17))::varchar(32) AS "username",
		('legacy-student-' || "id"::text)::varchar(255) AS "user_id"
	FROM "unique_hope_student_signup"
	WHERE "profile_id" IS NULL
)
INSERT INTO "unique_hope_profile" ("user_id", "role", "username", "name", "contact", "match_status", "created_at")
SELECT
	"user_id",
	'student'::"unique_hope_role",
	"username",
	"child_name",
	coalesce("contact", ''),
	'pending'::"unique_hope_profile_match_status",
	now()
FROM legacy_signups
ON CONFLICT ("username") DO NOTHING;--> statement-breakpoint
WITH legacy_signups AS (
	SELECT
		"id" AS "signup_id",
		('legacy_student_' || left(md5("id"::text), 17))::varchar(32) AS "username"
	FROM "unique_hope_student_signup"
	WHERE "profile_id" IS NULL
)
UPDATE "unique_hope_student_signup" AS "signup"
SET "profile_id" = "profile"."id"
FROM legacy_signups
INNER JOIN "unique_hope_profile" AS "profile"
	ON "profile"."username" = legacy_signups."username"
WHERE "signup"."id" = legacy_signups."signup_id";--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "unique_hope_student_signup"
		WHERE "profile_id" IS NULL
	) THEN
		RAISE EXCEPTION 'Cannot make unique_hope_student_signup.profile_id required because some legacy rows could not be backfilled.';
	END IF;
END $$;--> statement-breakpoint
ALTER TABLE "unique_hope_student_signup" ALTER COLUMN "profile_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "unique_hope_teacher_signup" ADD CONSTRAINT "unique_hope_teacher_signup_profile_id_unique_hope_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."unique_hope_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "teacher_signup_profile_idx" ON "unique_hope_teacher_signup" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "teacher_signup_created_at_idx" ON "unique_hope_teacher_signup" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "teacher_signup_status_idx" ON "unique_hope_teacher_signup" USING btree ("status","created_at");--> statement-breakpoint
ALTER TABLE "unique_hope_student_signup" ADD CONSTRAINT "unique_hope_student_signup_profile_id_unique_hope_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."unique_hope_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "student_signup_profile_idx" ON "unique_hope_student_signup" USING btree ("profile_id");
