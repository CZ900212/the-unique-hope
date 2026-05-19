ALTER TYPE "public"."unique_hope_appointment_status" ADD VALUE 'cancellation_pending';--> statement-breakpoint
ALTER TYPE "public"."unique_hope_appointment_status" ADD VALUE 'cancelled';--> statement-breakpoint
ALTER TABLE "unique_hope_lesson_appointment" ADD COLUMN "cancellation_requested_by" "unique_hope_appointment_requested_by";