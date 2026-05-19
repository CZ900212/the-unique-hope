DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT "pairing_id", "week_number", COUNT(*) AS duplicate_count
      FROM "unique_hope_lesson_appointment"
      GROUP BY "pairing_id", "week_number"
      HAVING COUNT(*) > 1
    ) duplicate_appointments
  ) THEN
    RAISE EXCEPTION 'Cannot add lesson appointment unique index because duplicate appointments exist for the same pairing and week.';
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lesson_appointment_pairing_week_idx" ON "unique_hope_lesson_appointment" USING btree ("pairing_id","week_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lesson_appointment_pairing_idx" ON "unique_hope_lesson_appointment" USING btree ("pairing_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lesson_appointment_status_idx" ON "unique_hope_lesson_appointment" USING btree ("status","updated_at");--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "pg_constraint"
    WHERE "conname" = 'unique_hope_lesson_appointment_pairing_id_unique_hope_pairing_i'
      AND "conrelid" = 'unique_hope_lesson_appointment'::regclass
  ) THEN
    ALTER TABLE "unique_hope_lesson_appointment"
      ADD CONSTRAINT "unique_hope_lesson_appointment_pairing_id_unique_hope_pairing_i"
      FOREIGN KEY ("pairing_id")
      REFERENCES "public"."unique_hope_pairing"("id")
      ON DELETE cascade
      ON UPDATE no action;
  END IF;
END $$;
