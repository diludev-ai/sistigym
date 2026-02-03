ALTER TABLE "payments" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "cancelled_by" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "cancellation_reason" text;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_cancelled_by_staff_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."staff_users"("id") ON DELETE set null ON UPDATE no action;