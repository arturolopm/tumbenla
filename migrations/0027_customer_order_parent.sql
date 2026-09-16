CREATE TABLE "customer_order" (
	"id" text PRIMARY KEY NOT NULL,
	"venue_id" text NOT NULL,
	"user_id" text,
	"buyer_name" text NOT NULL,
	"buyer_email" text NOT NULL,
	"total_units" integer NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'COP' NOT NULL,
	"public_token" text NOT NULL,
	"pay_method" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider" text,
	"provider_reference" text,
	"paid_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customer_order_total_units_check" CHECK ("customer_order"."total_units" between 1 and 20),
	CONSTRAINT "customer_order_total_amount_check" CHECK ("customer_order"."total_amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "allocation_run" ALTER COLUMN "order_snapshot_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_attempt" ALTER COLUMN "order_snapshot_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "product_order" ADD COLUMN "customer_order_id" text;--> statement-breakpoint
ALTER TABLE "product_order" ADD COLUMN "line_ordinal" integer;--> statement-breakpoint
ALTER TABLE "allocation_run" ADD COLUMN "customer_order_id" text;--> statement-breakpoint
ALTER TABLE "finance_transaction" ADD COLUMN "customer_order_id" text;--> statement-breakpoint
ALTER TABLE "payment_attempt" ADD COLUMN "customer_order_id" text;--> statement-breakpoint
ALTER TABLE "customer_order" ADD CONSTRAINT "customer_order_venue_id_venue_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venue"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_order" ADD CONSTRAINT "customer_order_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_order" ADD CONSTRAINT "product_order_customer_order_id_customer_order_id_fk" FOREIGN KEY ("customer_order_id") REFERENCES "public"."customer_order"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocation_run" ADD CONSTRAINT "allocation_run_customer_order_id_customer_order_id_fk" FOREIGN KEY ("customer_order_id") REFERENCES "public"."customer_order"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_transaction" ADD CONSTRAINT "finance_transaction_customer_order_id_customer_order_id_fk" FOREIGN KEY ("customer_order_id") REFERENCES "public"."customer_order"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempt" ADD CONSTRAINT "payment_attempt_customer_order_id_customer_order_id_fk" FOREIGN KEY ("customer_order_id") REFERENCES "public"."customer_order"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_order" ADD CONSTRAINT "product_order_customer_order_binding_check" CHECK (("product_order"."customer_order_id" is null and "product_order"."line_ordinal" is null) or ("product_order"."customer_order_id" is not null and "product_order"."line_ordinal" > 0));--> statement-breakpoint
ALTER TABLE "allocation_run" ADD CONSTRAINT "allocation_run_order_binding_check" CHECK ("allocation_run"."customer_order_id" is not null or "allocation_run"."order_snapshot_id" is not null);--> statement-breakpoint
ALTER TABLE "payment_attempt" ADD CONSTRAINT "payment_attempt_order_binding_check" CHECK ("payment_attempt"."customer_order_id" is not null or "payment_attempt"."order_snapshot_id" is not null);--> statement-breakpoint
CREATE INDEX "customer_order_venueId_idx" ON "customer_order" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "customer_order_userId_idx" ON "customer_order" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "customer_order_status_idx" ON "customer_order" USING btree ("status");--> statement-breakpoint
CREATE INDEX "customer_order_createdAt_idx" ON "customer_order" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_order_providerReference_key" ON "customer_order" USING btree ("provider_reference");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_order_publicToken_key" ON "customer_order" USING btree ("public_token");--> statement-breakpoint
CREATE UNIQUE INDEX "product_order_customerOrderId_lineOrdinal_key" ON "product_order" USING btree ("customer_order_id","line_ordinal");--> statement-breakpoint
CREATE INDEX "product_order_customerOrderId_idx" ON "product_order" USING btree ("customer_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "allocation_run_customer_order_revision_key" ON "allocation_run" USING btree ("customer_order_id","revision");--> statement-breakpoint
CREATE INDEX "allocation_run_customer_order_idx" ON "allocation_run" USING btree ("customer_order_id");--> statement-breakpoint
CREATE INDEX "finance_transaction_customer_order_idx" ON "finance_transaction" USING btree ("customer_order_id");--> statement-breakpoint
CREATE INDEX "payment_attempt_customer_order_idx" ON "payment_attempt" USING btree ("customer_order_id");--> statement-breakpoint
INSERT INTO "customer_order" (
	"id",
	"venue_id",
	"user_id",
	"buyer_name",
	"buyer_email",
	"total_units",
	"total_amount",
	"currency",
	"public_token",
	"pay_method",
	"status",
	"provider",
	"provider_reference",
	"paid_at",
	"expires_at",
	"created_at",
	"updated_at"
)
SELECT
	'cor_' || "id",
	"venue_id",
	"user_id",
	"buyer_name",
	"buyer_email",
	"quantity"::integer,
	"total_amount",
	"currency",
	"public_token",
	"pay_method",
	"status",
	"provider",
	"provider_reference",
	"paid_at",
	"expires_at",
	"created_at",
	"updated_at"
FROM "product_order";--> statement-breakpoint
UPDATE "product_order"
SET "customer_order_id" = 'cor_' || "id", "line_ordinal" = 1;--> statement-breakpoint
UPDATE "payment_attempt" AS "attempt"
SET "customer_order_id" = "line"."customer_order_id"
FROM "commerce_order_snapshot" AS "snapshot"
JOIN "product_order" AS "line" ON "line"."id" = "snapshot"."order_id"
WHERE "attempt"."order_snapshot_id" = "snapshot"."id";--> statement-breakpoint
UPDATE "allocation_run" AS "run"
SET "customer_order_id" = "line"."customer_order_id"
FROM "commerce_order_snapshot" AS "snapshot"
JOIN "product_order" AS "line" ON "line"."id" = "snapshot"."order_id"
WHERE "run"."order_snapshot_id" = "snapshot"."id";--> statement-breakpoint
ALTER TABLE "finance_transaction" DISABLE TRIGGER "finance_transaction_balance_after_status";--> statement-breakpoint
ALTER TABLE "finance_transaction" DISABLE TRIGGER "finance_transaction_immutable_after_posting";--> statement-breakpoint
UPDATE "finance_transaction" AS "transaction"
SET "customer_order_id" = "line"."customer_order_id"
FROM "commerce_order_snapshot" AS "snapshot"
JOIN "product_order" AS "line" ON "line"."id" = "snapshot"."order_id"
WHERE "transaction"."order_snapshot_id" = "snapshot"."id";--> statement-breakpoint
ALTER TABLE "finance_transaction" ENABLE TRIGGER "finance_transaction_immutable_after_posting";--> statement-breakpoint
ALTER TABLE "finance_transaction" ENABLE TRIGGER "finance_transaction_balance_after_status";--> statement-breakpoint
