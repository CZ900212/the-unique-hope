CREATE TABLE IF NOT EXISTS "unique_hope_manual_recovery_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"applicant_role" "unique_hope_role" NOT NULL,
	"applicant_name" varchar(120) NOT NULL,
	"applicant_contact" varchar(255) NOT NULL,
	"applicant_note" text DEFAULT '' NOT NULL,
	"status" "unique_hope_recovery_request_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by_admin_id" varchar(255),
	"selected_user_id" varchar(255),
	"password_reset_token_id" uuid,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unique_hope_manual_recovery_request" ADD CONSTRAINT "unique_hope_manual_recovery_request_reviewed_by_admin_id_unique_hope_user_id_fk" FOREIGN KEY ("reviewed_by_admin_id") REFERENCES "public"."unique_hope_user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unique_hope_manual_recovery_request" ADD CONSTRAINT "unique_hope_manual_recovery_request_selected_user_id_unique_hope_user_id_fk" FOREIGN KEY ("selected_user_id") REFERENCES "public"."unique_hope_user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unique_hope_manual_recovery_request" ADD CONSTRAINT "unique_hope_manual_recovery_request_password_reset_token_id_unique_hope_password_reset_token_id_fk" FOREIGN KEY ("password_reset_token_id") REFERENCES "public"."unique_hope_password_reset_token"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "manual_recovery_request_status_created_idx" ON "unique_hope_manual_recovery_request" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "manual_recovery_request_applicant_lookup_idx" ON "unique_hope_manual_recovery_request" USING btree ("applicant_role","status","applicant_name","applicant_contact");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "manual_recovery_request_selected_user_idx" ON "unique_hope_manual_recovery_request" USING btree ("selected_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "manual_recovery_request_token_idx" ON "unique_hope_manual_recovery_request" USING btree ("password_reset_token_id");
