DO $$ BEGIN
 CREATE TYPE "public"."unique_hope_recovery_phone_status" AS ENUM('active', 'disabled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."unique_hope_recovery_phone_source" AS ENUM('student_signup_backfill', 'admin', 'user_verified');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."unique_hope_sms_verification_purpose" AS ENUM('password_reset');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."unique_hope_recovery_request_status" AS ENUM('pending', 'approved', 'rejected', 'expired', 'completed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "unique_hope_student_recovery_phone" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"phone_hash" varchar(64) NOT NULL,
	"phone_masked" varchar(32) NOT NULL,
	"phone_last4" varchar(8) NOT NULL,
	"status" "unique_hope_recovery_phone_status" DEFAULT 'active' NOT NULL,
	"source" "unique_hope_recovery_phone_source" DEFAULT 'student_signup_backfill' NOT NULL,
	"verified_at" timestamp with time zone,
	"last_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "unique_hope_sms_verification_code" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_hash" varchar(64) NOT NULL,
	"purpose" "unique_hope_sms_verification_purpose" DEFAULT 'password_reset' NOT NULL,
	"code_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"consumed_at" timestamp with time zone,
	"sent_at" timestamp with time zone NOT NULL,
	"provider" varchar(64) NOT NULL,
	"provider_message_id" varchar(255),
	"request_ip_hash" varchar(64),
	"request_user_agent_hash" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "unique_hope_password_reset_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"user_id" varchar(255),
	"phone_hash" varchar(64) NOT NULL,
	"sms_code_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"created_ip_hash" varchar(64),
	"created_user_agent_hash" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "unique_hope_admin_recovery_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_hash" varchar(64) NOT NULL,
	"phone_masked" varchar(32) NOT NULL,
	"candidate_count" integer NOT NULL,
	"applicant_student_name" varchar(120) NOT NULL,
	"applicant_student_age" integer,
	"applicant_note" text DEFAULT '' NOT NULL,
	"status" "unique_hope_recovery_request_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by_admin_id" varchar(255),
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unique_hope_student_recovery_phone" ADD CONSTRAINT "unique_hope_student_recovery_phone_user_id_unique_hope_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."unique_hope_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unique_hope_password_reset_session" ADD CONSTRAINT "unique_hope_password_reset_session_user_id_unique_hope_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."unique_hope_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unique_hope_password_reset_session" ADD CONSTRAINT "unique_hope_password_reset_session_sms_code_id_unique_hope_sms_verification_code_id_fk" FOREIGN KEY ("sms_code_id") REFERENCES "public"."unique_hope_sms_verification_code"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unique_hope_admin_recovery_request" ADD CONSTRAINT "unique_hope_admin_recovery_request_reviewed_by_admin_id_unique_hope_user_id_fk" FOREIGN KEY ("reviewed_by_admin_id") REFERENCES "public"."unique_hope_user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_recovery_phone_hash_idx" ON "unique_hope_student_recovery_phone" USING btree ("phone_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_recovery_phone_user_idx" ON "unique_hope_student_recovery_phone" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_recovery_phone_status_idx" ON "unique_hope_student_recovery_phone" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sms_verification_phone_purpose_idx" ON "unique_hope_sms_verification_code" USING btree ("phone_hash","purpose","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sms_verification_expires_idx" ON "unique_hope_sms_verification_code" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_session_token_idx" ON "unique_hope_password_reset_session" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "password_reset_session_user_idx" ON "unique_hope_password_reset_session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "password_reset_session_phone_idx" ON "unique_hope_password_reset_session" USING btree ("phone_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "password_reset_session_expires_idx" ON "unique_hope_password_reset_session" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_recovery_request_phone_status_idx" ON "unique_hope_admin_recovery_request" USING btree ("phone_hash","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_recovery_request_status_created_idx" ON "unique_hope_admin_recovery_request" USING btree ("status","created_at");
