ALTER TABLE "venue_credit_policy" ADD COLUMN "operation_key" text;--> statement-breakpoint
ALTER TABLE "venue_credit_policy" ADD COLUMN "content_hash" text;--> statement-breakpoint
CREATE UNIQUE INDEX "venue_credit_policy_operation_key" ON "venue_credit_policy" USING btree ("operation_key");