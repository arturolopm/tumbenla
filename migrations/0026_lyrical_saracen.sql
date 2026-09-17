CREATE TABLE "charge_dispute" (
	"id" text PRIMARY KEY NOT NULL,
	"charge_id" text NOT NULL,
	"operation_key" text NOT NULL,
	"content_hash" text NOT NULL,
	"provider_case_reference" text NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"opening_evidence_id" text NOT NULL,
	"opened_by_user_id" text NOT NULL,
	"opened_at" timestamp with time zone NOT NULL,
	"resolution_operation_key" text,
	"resolution_content_hash" text,
	"resolution_evidence_id" text,
	"resolution_reference" text,
	"resolution_detail" text,
	"resolved_by_user_id" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "charge_dispute_status_check" CHECK ("charge_dispute"."status" in ('open', 'won', 'lost')),
	CONSTRAINT "charge_dispute_resolution_check" CHECK (("charge_dispute"."status" = 'open' and "charge_dispute"."resolution_operation_key" is null and "charge_dispute"."resolution_content_hash" is null and "charge_dispute"."resolution_evidence_id" is null and "charge_dispute"."resolution_reference" is null and "charge_dispute"."resolution_detail" is null and "charge_dispute"."resolved_by_user_id" is null and "charge_dispute"."resolved_at" is null) or ("charge_dispute"."status" in ('won', 'lost') and "charge_dispute"."resolution_operation_key" is not null and "charge_dispute"."resolution_content_hash" is not null and "charge_dispute"."resolution_evidence_id" is not null and "charge_dispute"."resolution_reference" is not null and "charge_dispute"."resolution_detail" is not null and "charge_dispute"."resolved_by_user_id" is not null and "charge_dispute"."resolved_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "charge_dispute" ADD CONSTRAINT "charge_dispute_charge_id_payment_charge_id_fk" FOREIGN KEY ("charge_id") REFERENCES "public"."payment_charge"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge_dispute" ADD CONSTRAINT "charge_dispute_opening_evidence_id_finance_evidence_id_fk" FOREIGN KEY ("opening_evidence_id") REFERENCES "public"."finance_evidence"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge_dispute" ADD CONSTRAINT "charge_dispute_opened_by_user_id_user_id_fk" FOREIGN KEY ("opened_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge_dispute" ADD CONSTRAINT "charge_dispute_resolution_evidence_id_finance_evidence_id_fk" FOREIGN KEY ("resolution_evidence_id") REFERENCES "public"."finance_evidence"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge_dispute" ADD CONSTRAINT "charge_dispute_resolved_by_user_id_user_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "charge_dispute_operation_key" ON "charge_dispute" USING btree ("operation_key");--> statement-breakpoint
CREATE UNIQUE INDEX "charge_dispute_resolution_operation_key" ON "charge_dispute" USING btree ("resolution_operation_key");--> statement-breakpoint
CREATE UNIQUE INDEX "charge_dispute_active_charge_key" ON "charge_dispute" USING btree ("charge_id") WHERE "charge_dispute"."status" = 'open';--> statement-breakpoint
CREATE INDEX "charge_dispute_charge_idx" ON "charge_dispute" USING btree ("charge_id","created_at");