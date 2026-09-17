CREATE TABLE "ledger_account" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"venue_id" text,
	"currency" text DEFAULT 'COP' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"transaction_id" text NOT NULL,
	"account_id" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'COP' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_transaction" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"order_id" text,
	"settlement_id" text,
	"purchase_id" text,
	"idempotency_key" text NOT NULL,
	"note" text,
	"created_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_redemption" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"code_hash" text NOT NULL,
	"status" text DEFAULT 'issued' NOT NULL,
	"redeemed_at" timestamp,
	"redeemed_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_order" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"venue_id" text NOT NULL,
	"user_id" text,
	"buyer_name" text NOT NULL,
	"buyer_email" text NOT NULL,
	"quantity" numeric(6, 0) NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"donation_percentage" numeric(5, 2) NOT NULL,
	"unit_donation_amount" numeric(12, 2) NOT NULL,
	"unit_venue_amount" numeric(12, 2) NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'COP' NOT NULL,
	"pay_method" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider" text,
	"provider_reference" text,
	"paid_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_product" (
	"id" text PRIMARY KEY NOT NULL,
	"venue_id" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"description" text,
	"price" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'COP' NOT NULL,
	"donation_percentage" numeric(5, 2) NOT NULL,
	"image_url" text,
	"storage_key" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"reviewed_by_user_id" text,
	"reviewed_at" timestamp,
	"review_note" text,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_settlement" (
	"id" text PRIMARY KEY NOT NULL,
	"venue_id" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'COP' NOT NULL,
	"direction" text NOT NULL,
	"method" text,
	"reference" text,
	"evidence_url" text,
	"storage_key" text,
	"note" text,
	"settled_by_user_id" text,
	"period_start" timestamp,
	"period_end" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "venue_contribution" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "ledger_account" ADD CONSTRAINT "ledger_account_venue_id_venue_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venue"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_transaction_id_ledger_transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."ledger_transaction"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_account_id_ledger_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."ledger_account"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_transaction" ADD CONSTRAINT "ledger_transaction_order_id_product_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."product_order"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_transaction" ADD CONSTRAINT "ledger_transaction_purchase_id_material_purchase_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."material_purchase"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_transaction" ADD CONSTRAINT "ledger_transaction_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_redemption" ADD CONSTRAINT "order_redemption_order_id_product_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."product_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_redemption" ADD CONSTRAINT "order_redemption_redeemed_by_user_id_user_id_fk" FOREIGN KEY ("redeemed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_order" ADD CONSTRAINT "product_order_product_id_venue_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."venue_product"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_order" ADD CONSTRAINT "product_order_venue_id_venue_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venue"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_order" ADD CONSTRAINT "product_order_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_product" ADD CONSTRAINT "venue_product_venue_id_venue_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_product" ADD CONSTRAINT "venue_product_reviewed_by_user_id_user_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_settlement" ADD CONSTRAINT "venue_settlement_venue_id_venue_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venue"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_settlement" ADD CONSTRAINT "venue_settlement_settled_by_user_id_user_id_fk" FOREIGN KEY ("settled_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_account_kind_venueId_currency_key" ON "ledger_account" USING btree ("kind","venue_id","currency");--> statement-breakpoint
CREATE INDEX "ledger_account_venueId_idx" ON "ledger_account" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "ledger_entry_transactionId_idx" ON "ledger_entry" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "ledger_entry_accountId_idx" ON "ledger_entry" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_transaction_idempotencyKey_key" ON "ledger_transaction" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "ledger_transaction_orderId_idx" ON "ledger_transaction" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "ledger_transaction_settlementId_idx" ON "ledger_transaction" USING btree ("settlement_id");--> statement-breakpoint
CREATE INDEX "ledger_transaction_kind_idx" ON "ledger_transaction" USING btree ("kind");--> statement-breakpoint
CREATE UNIQUE INDEX "order_redemption_codeHash_key" ON "order_redemption" USING btree ("code_hash");--> statement-breakpoint
CREATE INDEX "order_redemption_orderId_idx" ON "order_redemption" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_redemption_status_idx" ON "order_redemption" USING btree ("status");--> statement-breakpoint
CREATE INDEX "product_order_venueId_idx" ON "product_order" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "product_order_productId_idx" ON "product_order" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_order_userId_idx" ON "product_order" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "product_order_status_idx" ON "product_order" USING btree ("status");--> statement-breakpoint
CREATE INDEX "product_order_createdAt_idx" ON "product_order" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "product_order_providerReference_key" ON "product_order" USING btree ("provider_reference");--> statement-breakpoint
CREATE INDEX "venue_product_venueId_idx" ON "venue_product" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_product_status_idx" ON "venue_product" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "venue_product_venueId_slug_key" ON "venue_product" USING btree ("venue_id","slug");--> statement-breakpoint
CREATE INDEX "venue_settlement_venueId_idx" ON "venue_settlement" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_settlement_createdAt_idx" ON "venue_settlement" USING btree ("created_at");--> statement-breakpoint
-- ---------------------------------------------------------------------------
-- Escrito a mano. drizzle-kit no genera triggers, y esta es la unica parte de
-- esta migracion que no salio de `bun run generate-migration`.
--
-- El libro es append-only y eso NO se deja a la disciplina de quien escriba la
-- proxima server action. Un asiento que se edita destruye el rastro y ya no se
-- puede reconstruir que cambio; las correcciones son asientos nuevos que
-- compensan, nunca un UPDATE sobre el viejo.
--
-- Se prohibe UPDATE y DELETE, no INSERT: agregar es justamente como funciona.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ledger_entry_es_inmutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'ledger_entry es append-only: % rechazado. Una correccion es un asiento nuevo que compensa, no una edicion.',
    TG_OP;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER ledger_entry_sin_update_ni_delete
BEFORE UPDATE OR DELETE ON "ledger_entry"
FOR EACH ROW EXECUTE FUNCTION ledger_entry_es_inmutable();
