DROP INDEX IF EXISTS "lesson_appointment_pairing_week_idx";--> statement-breakpoint
ALTER TABLE "unique_hope_lesson_appointment" ALTER COLUMN "week_number" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "unique_hope_lesson_appointment" ADD COLUMN IF NOT EXISTS "response_reason" text;--> statement-breakpoint
ALTER TABLE "unique_hope_lesson_appointment" ADD COLUMN IF NOT EXISTS "cancellation_reason" text;--> statement-breakpoint
ALTER TABLE "unique_hope_lesson_appointment" ADD COLUMN IF NOT EXISTS "cancellation_response_reason" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lesson_appointment_schedule_idx" ON "unique_hope_lesson_appointment" USING btree ("pairing_id","scheduled_start");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "unique_hope_user_notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_profile_id" uuid NOT NULL,
	"actor_profile_id" uuid,
	"appointment_id" uuid,
	"type" varchar(64) NOT NULL,
	"title_en" varchar(255) NOT NULL,
	"title_zh" varchar(255) NOT NULL,
	"body_en" text NOT NULL,
	"body_zh" text NOT NULL,
	"href" varchar(500),
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "unique_hope_browser_push_subscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unique_hope_user_notification" ADD CONSTRAINT "unique_hope_user_notification_recipient_profile_id_fk" FOREIGN KEY ("recipient_profile_id") REFERENCES "public"."unique_hope_profile"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unique_hope_user_notification" ADD CONSTRAINT "unique_hope_user_notification_actor_profile_id_fk" FOREIGN KEY ("actor_profile_id") REFERENCES "public"."unique_hope_profile"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unique_hope_user_notification" ADD CONSTRAINT "unique_hope_user_notification_appointment_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."unique_hope_lesson_appointment"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unique_hope_browser_push_subscription" ADD CONSTRAINT "unique_hope_browser_push_subscription_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."unique_hope_profile"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_notification_recipient_idx" ON "unique_hope_user_notification" USING btree ("recipient_profile_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_notification_unread_idx" ON "unique_hope_user_notification" USING btree ("recipient_profile_id","read_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "browser_push_subscription_endpoint_idx" ON "unique_hope_browser_push_subscription" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "browser_push_subscription_profile_idx" ON "unique_hope_browser_push_subscription" USING btree ("profile_id");
