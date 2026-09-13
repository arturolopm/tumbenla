ALTER TABLE "foundation_purchase" ADD COLUMN "operation_key" text;--> statement-breakpoint
ALTER TABLE "foundation_purchase" ADD COLUMN "content_hash" text;--> statement-breakpoint
ALTER TABLE "foundation_purchase" ADD COLUMN "correction_of_id" text;--> statement-breakpoint
ALTER TABLE "foundation_purchase" ADD CONSTRAINT "foundation_purchase_correction_of_id_foundation_purchase_id_fk" FOREIGN KEY ("correction_of_id") REFERENCES "public"."foundation_purchase"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "foundation_purchase_operation_key" ON "foundation_purchase" USING btree ("operation_key");--> statement-breakpoint
CREATE UNIQUE INDEX "foundation_purchase_correction_target_key" ON "foundation_purchase" USING btree ("correction_of_id");