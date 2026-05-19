CREATE TYPE "public"."unique_hope_appointment_requested_by" AS ENUM('student', 'teacher');--> statement-breakpoint
CREATE TYPE "public"."unique_hope_appointment_status" AS ENUM('pending', 'confirmed', 'declined');--> statement-breakpoint
CREATE TABLE "unique_hope_lesson_appointment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pairing_id" uuid NOT NULL,
	"week_number" integer NOT NULL,
	"scheduled_start" timestamp with time zone NOT NULL,
	"duration_minutes" integer DEFAULT 45 NOT NULL,
	"status" "unique_hope_appointment_status" DEFAULT 'pending' NOT NULL,
	"requested_by" "unique_hope_appointment_requested_by" NOT NULL,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "unique_hope_lesson_appointment" ADD CONSTRAINT "unique_hope_lesson_appointment_pairing_id_unique_hope_pairing_id_fk" FOREIGN KEY ("pairing_id") REFERENCES "public"."unique_hope_pairing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_appointment_pairing_week_idx" ON "unique_hope_lesson_appointment" USING btree ("pairing_id","week_number");--> statement-breakpoint
CREATE INDEX "lesson_appointment_pairing_idx" ON "unique_hope_lesson_appointment" USING btree ("pairing_id");--> statement-breakpoint
CREATE INDEX "lesson_appointment_status_idx" ON "unique_hope_lesson_appointment" USING btree ("status","updated_at");