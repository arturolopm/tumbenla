ALTER TABLE "credit_reservation" ADD COLUMN "shopper_key" text;--> statement-breakpoint
ALTER TABLE "venue_credit_policy" ADD COLUMN "max_active_reservations" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "venue_credit_policy" ADD COLUMN "max_active_per_shopper" integer DEFAULT 20 NOT NULL;--> statement-breakpoint
CREATE INDEX "credit_reservation_shopper_status_idx" ON "credit_reservation" USING btree ("shopper_key","status");--> statement-breakpoint
ALTER TABLE "venue_credit_policy" ADD CONSTRAINT "venue_credit_policy_reservation_limits_check" CHECK ("venue_credit_policy"."max_active_reservations" > 0 and "venue_credit_policy"."max_active_per_shopper" > 0 and "venue_credit_policy"."max_active_per_shopper" <= "venue_credit_policy"."max_active_reservations");