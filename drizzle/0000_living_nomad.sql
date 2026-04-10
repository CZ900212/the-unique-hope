CREATE TYPE "public"."unique_hope_lesson_status" AS ENUM('pending', 'taught', 'teacher_leave', 'student_leave', 'sick');--> statement-breakpoint
CREATE TYPE "public"."unique_hope_role" AS ENUM('admin', 'teacher', 'student');--> statement-breakpoint
CREATE TYPE "public"."unique_hope_signup_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."unique_hope_visibility" AS ENUM('private', 'shared');--> statement-breakpoint
CREATE TABLE "unique_hope_account" (
	"user_id" varchar(255) NOT NULL,
	"type" varchar(255) NOT NULL,
	"provider" varchar(255) NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" varchar(255),
	"scope" varchar(255),
	"id_token" text,
	"session_state" varchar(255),
	CONSTRAINT "unique_hope_account_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "unique_hope_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pairing_id" uuid NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"week_number" integer NOT NULL,
	"text" text NOT NULL,
	"rating" integer,
	"visibility" "unique_hope_visibility" DEFAULT 'private' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unique_hope_lesson_note" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"visibility" "unique_hope_visibility" DEFAULT 'shared' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unique_hope_lesson" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pairing_id" uuid NOT NULL,
	"week_number" integer NOT NULL,
	"status" "unique_hope_lesson_status" DEFAULT 'pending' NOT NULL,
	"evidence_key" text,
	"evidence_url" text,
	"evidence_mime" varchar(100),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unique_hope_pairing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_profile_id" uuid NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"meeting_link" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unique_hope_password_reset_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unique_hope_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"role" "unique_hope_role" NOT NULL,
	"username" varchar(32) NOT NULL,
	"name" varchar(120) NOT NULL,
	"contact" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unique_hope_request_rate_limit" (
	"key" varchar(255) PRIMARY KEY NOT NULL,
	"action" varchar(64) NOT NULL,
	"subject_hash" varchar(64) NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"bucket_start" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unique_hope_session" (
	"session_token" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unique_hope_student_inquiry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_serial" integer NOT NULL,
	"source_submitted_at" timestamp with time zone NOT NULL,
	"source_ip_hash" varchar(64) NOT NULL,
	"source_region" varchar(120),
	"source_channel" varchar(64) NOT NULL,
	"student_name" varchar(255) NOT NULL,
	"gender" varchar(16) NOT NULL,
	"school" varchar(255) NOT NULL,
	"grade" varchar(64) NOT NULL,
	"english_score" text NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unique_hope_student_signup" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_name" varchar(120) NOT NULL,
	"age" integer NOT NULL,
	"phone" varchar(20) NOT NULL,
	"contact" varchar(255),
	"status" "unique_hope_signup_status" DEFAULT 'pending' NOT NULL,
	"reject_reason" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "unique_hope_user_credential" (
	"user_id" varchar(255) PRIMARY KEY NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unique_hope_user" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255),
	"email" varchar(255) NOT NULL,
	"email_verified" timestamp with time zone DEFAULT now(),
	"image" varchar(255),
	"auth_version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unique_hope_verification_token" (
	"identifier" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "unique_hope_verification_token_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "unique_hope_account" ADD CONSTRAINT "unique_hope_account_user_id_unique_hope_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."unique_hope_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unique_hope_feedback" ADD CONSTRAINT "unique_hope_feedback_pairing_id_unique_hope_pairing_id_fk" FOREIGN KEY ("pairing_id") REFERENCES "public"."unique_hope_pairing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unique_hope_feedback" ADD CONSTRAINT "unique_hope_feedback_student_profile_id_unique_hope_profile_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."unique_hope_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unique_hope_lesson_note" ADD CONSTRAINT "unique_hope_lesson_note_lesson_id_unique_hope_lesson_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."unique_hope_lesson"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unique_hope_lesson" ADD CONSTRAINT "unique_hope_lesson_pairing_id_unique_hope_pairing_id_fk" FOREIGN KEY ("pairing_id") REFERENCES "public"."unique_hope_pairing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unique_hope_pairing" ADD CONSTRAINT "unique_hope_pairing_teacher_profile_id_unique_hope_profile_id_fk" FOREIGN KEY ("teacher_profile_id") REFERENCES "public"."unique_hope_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unique_hope_pairing" ADD CONSTRAINT "unique_hope_pairing_student_profile_id_unique_hope_profile_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."unique_hope_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unique_hope_password_reset_token" ADD CONSTRAINT "unique_hope_password_reset_token_user_id_unique_hope_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."unique_hope_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unique_hope_profile" ADD CONSTRAINT "unique_hope_profile_user_id_unique_hope_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."unique_hope_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unique_hope_session" ADD CONSTRAINT "unique_hope_session_user_id_unique_hope_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."unique_hope_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unique_hope_user_credential" ADD CONSTRAINT "unique_hope_user_credential_user_id_unique_hope_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."unique_hope_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "unique_hope_account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "feedback_pairing_student_week_idx" ON "unique_hope_feedback" USING btree ("pairing_id","student_profile_id","week_number");--> statement-breakpoint
CREATE INDEX "feedback_pairing_idx" ON "unique_hope_feedback" USING btree ("pairing_id","week_number");--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_note_lesson_idx" ON "unique_hope_lesson_note" USING btree ("lesson_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_pairing_week_idx" ON "unique_hope_lesson" USING btree ("pairing_id","week_number");--> statement-breakpoint
CREATE INDEX "lesson_pairing_idx" ON "unique_hope_lesson" USING btree ("pairing_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pairing_teacher_idx" ON "unique_hope_pairing" USING btree ("teacher_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pairing_student_idx" ON "unique_hope_pairing" USING btree ("student_profile_id");--> statement-breakpoint
CREATE INDEX "pairing_created_at_idx" ON "unique_hope_pairing" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "password_reset_token_hash_idx" ON "unique_hope_password_reset_token" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "password_reset_user_id_idx" ON "unique_hope_password_reset_token" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "password_reset_expires_at_idx" ON "unique_hope_password_reset_token" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "profile_user_id_idx" ON "unique_hope_profile" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "profile_username_idx" ON "unique_hope_profile" USING btree ("username");--> statement-breakpoint
CREATE INDEX "profile_role_idx" ON "unique_hope_profile" USING btree ("role");--> statement-breakpoint
CREATE INDEX "request_rate_limit_action_idx" ON "unique_hope_request_rate_limit" USING btree ("action");--> statement-breakpoint
CREATE INDEX "request_rate_limit_subject_idx" ON "unique_hope_request_rate_limit" USING btree ("subject_hash");--> statement-breakpoint
CREATE INDEX "request_rate_limit_expires_idx" ON "unique_hope_request_rate_limit" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "unique_hope_session" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "student_inquiry_source_channel_serial_idx" ON "unique_hope_student_inquiry" USING btree ("source_channel","source_serial");--> statement-breakpoint
CREATE INDEX "student_inquiry_submitted_at_idx" ON "unique_hope_student_inquiry" USING btree ("source_submitted_at");--> statement-breakpoint
CREATE INDEX "student_inquiry_student_name_idx" ON "unique_hope_student_inquiry" USING btree ("student_name");--> statement-breakpoint
CREATE INDEX "signup_status_idx" ON "unique_hope_student_signup" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_idx" ON "unique_hope_user" USING btree ("email");