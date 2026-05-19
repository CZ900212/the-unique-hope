DO $$ BEGIN
 CREATE TYPE "public"."unique_hope_notification_push_delivery_status" AS ENUM('queued', 'processing', 'sent', 'failed', 'dead');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "unique_hope_browser_push_subscription" ADD COLUMN IF NOT EXISTS "disabled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "unique_hope_browser_push_subscription" ADD COLUMN IF NOT EXISTS "failure_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "unique_hope_browser_push_subscription" ADD COLUMN IF NOT EXISTS "last_success_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "unique_hope_browser_push_subscription" ADD COLUMN IF NOT EXISTS "last_error_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "unique_hope_browser_push_subscription" ADD COLUMN IF NOT EXISTS "expiration_time" timestamp with time zone;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "unique_hope_notification_push_delivery" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_notification_id" uuid NOT NULL,
	"recipient_profile_id" uuid NOT NULL,
	"browser_push_subscription_id" uuid NOT NULL,
	"status" "unique_hope_notification_push_delivery_status" DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"last_status_code" integer,
	"last_error_code" varchar(64),
	"last_error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unique_hope_notification_push_delivery" ADD CONSTRAINT "unique_hope_notification_push_delivery_user_notification_id_fk" FOREIGN KEY ("user_notification_id") REFERENCES "public"."unique_hope_user_notification"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unique_hope_notification_push_delivery" ADD CONSTRAINT "unique_hope_notification_push_delivery_recipient_profile_id_fk" FOREIGN KEY ("recipient_profile_id") REFERENCES "public"."unique_hope_profile"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unique_hope_notification_push_delivery" ADD CONSTRAINT "unique_hope_notification_push_delivery_browser_push_subscription_id_fk" FOREIGN KEY ("browser_push_subscription_id") REFERENCES "public"."unique_hope_browser_push_subscription"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "notification_push_delivery_notification_subscription_idx" ON "unique_hope_notification_push_delivery" USING btree ("user_notification_id","browser_push_subscription_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_push_delivery_status_next_idx" ON "unique_hope_notification_push_delivery" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_push_delivery_recipient_idx" ON "unique_hope_notification_push_delivery" USING btree ("recipient_profile_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_push_delivery_subscription_idx" ON "unique_hope_notification_push_delivery" USING btree ("browser_push_subscription_id");
