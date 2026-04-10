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
ALTER TABLE "unique_hope_student_signup" ADD COLUMN "profile_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "unique_hope_teacher_signup" ADD CONSTRAINT "unique_hope_teacher_signup_profile_id_unique_hope_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."unique_hope_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "teacher_signup_profile_idx" ON "unique_hope_teacher_signup" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "teacher_signup_created_at_idx" ON "unique_hope_teacher_signup" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "teacher_signup_status_idx" ON "unique_hope_teacher_signup" USING btree ("status","created_at");--> statement-breakpoint
ALTER TABLE "unique_hope_student_signup" ADD CONSTRAINT "unique_hope_student_signup_profile_id_unique_hope_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."unique_hope_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "student_signup_profile_idx" ON "unique_hope_student_signup" USING btree ("profile_id");