CREATE TABLE "treasury_policy" (
	"id" text PRIMARY KEY NOT NULL,
	"operation_key" text NOT NULL,
	"content_hash" text NOT NULL,
	"version" integer NOT NULL,
	"currency" text NOT NULL,
	"funding_classification" text NOT NULL,
	"minimum_operating_reserve_minor" bigint DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"approved_by_user_id" text NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"retired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "treasury_policy_version_check" CHECK ("treasury_policy"."version" > 0),
	CONSTRAINT "treasury_policy_reserve_check" CHECK ("treasury_policy"."minimum_operating_reserve_minor" >= 0),
	CONSTRAINT "treasury_policy_funding_check" CHECK ("treasury_policy"."funding_classification" in ('real', 'sandbox')),
	CONSTRAINT "treasury_policy_status_check" CHECK ("treasury_policy"."status" in ('active', 'retired'))
);
--> statement-breakpoint
ALTER TABLE "commerce_beneficiary" ADD COLUMN "venue_id" text;--> statement-breakpoint
ALTER TABLE "financial_operation" ADD COLUMN "destination_fingerprint" text;--> statement-breakpoint
ALTER TABLE "financial_operation" ADD COLUMN "status_detail" text;--> statement-breakpoint
ALTER TABLE "financial_operation" ADD COLUMN "reversal_of_operation_id" text;--> statement-breakpoint
ALTER TABLE "treasury_policy" ADD CONSTRAINT "treasury_policy_approved_by_user_id_user_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "treasury_policy_operation_key" ON "treasury_policy" USING btree ("operation_key");--> statement-breakpoint
CREATE UNIQUE INDEX "treasury_policy_version_key" ON "treasury_policy" USING btree ("currency","funding_classification","version");--> statement-breakpoint
CREATE UNIQUE INDEX "treasury_policy_active_key" ON "treasury_policy" USING btree ("currency","funding_classification") WHERE "treasury_policy"."status" = 'active' and "treasury_policy"."retired_at" is null;--> statement-breakpoint
ALTER TABLE "commerce_beneficiary" ADD CONSTRAINT "commerce_beneficiary_venue_id_venue_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venue"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "commerce_beneficiary_venue_key" ON "commerce_beneficiary" USING btree ("venue_id");--> statement-breakpoint
ALTER TABLE "commerce_beneficiary" ADD CONSTRAINT "commerce_beneficiary_venue_binding_check" CHECK (("commerce_beneficiary"."kind" = 'foundation' and "commerce_beneficiary"."venue_id" is null) or ("commerce_beneficiary"."kind" = 'venue' and "commerce_beneficiary"."venue_id" is not null));
