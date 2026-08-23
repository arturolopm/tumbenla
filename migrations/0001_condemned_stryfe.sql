CREATE TABLE "material_purchase" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"story" text,
	"municipality" text NOT NULL,
	"department" text NOT NULL,
	"beneficiary_label" text,
	"households_helped" numeric(6, 0),
	"total_amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'COP' NOT NULL,
	"purchased_at" timestamp NOT NULL,
	"supplier_name" text,
	"receipt_number" text,
	"cover_image_url" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "material_purchase_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "material_purchase_item" (
	"id" text PRIMARY KEY NOT NULL,
	"purchase_id" text NOT NULL,
	"name" text NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"unit" text NOT NULL,
	"unit_cost" numeric(12, 2),
	"subtotal" numeric(12, 2),
	"position" numeric(10, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_purchase_media" (
	"id" text PRIMARY KEY NOT NULL,
	"purchase_id" text NOT NULL,
	"kind" text NOT NULL,
	"url" text NOT NULL,
	"storage_key" text,
	"caption" text,
	"consent_given" boolean DEFAULT false NOT NULL,
	"position" numeric(10, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"tagline" text,
	"description" text,
	"address_line" text NOT NULL,
	"neighborhood" text,
	"city" text NOT NULL,
	"department" text NOT NULL,
	"country" text DEFAULT 'CO' NOT NULL,
	"latitude" numeric(9, 6) NOT NULL,
	"longitude" numeric(9, 6) NOT NULL,
	"phone" text,
	"whatsapp" text,
	"instagram" text,
	"website" text,
	"opening_hours" text,
	"cover_image_url" text,
	"logo_url" text,
	"pledge_type" text NOT NULL,
	"pledge_percentage" numeric(5, 2),
	"pledge_amount" numeric(10, 2),
	"pledge_unit" text,
	"pledge_currency" text DEFAULT 'COP' NOT NULL,
	"pledge_basis" text,
	"pledge_note" text,
	"pledge_starts_at" timestamp,
	"pledge_ends_at" timestamp,
	"status" text DEFAULT 'draft' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp,
	"verified_note" text,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "venue_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "material_purchase_item" ADD CONSTRAINT "material_purchase_item_purchase_id_material_purchase_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."material_purchase"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_purchase_media" ADD CONSTRAINT "material_purchase_media_purchase_id_material_purchase_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."material_purchase"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "material_purchase_status_idx" ON "material_purchase" USING btree ("status");--> statement-breakpoint
CREATE INDEX "material_purchase_purchasedAt_idx" ON "material_purchase" USING btree ("purchased_at");--> statement-breakpoint
CREATE INDEX "material_purchase_municipality_idx" ON "material_purchase" USING btree ("municipality");--> statement-breakpoint
CREATE INDEX "material_purchase_item_purchaseId_idx" ON "material_purchase_item" USING btree ("purchase_id");--> statement-breakpoint
CREATE INDEX "material_purchase_media_purchaseId_idx" ON "material_purchase_media" USING btree ("purchase_id");--> statement-breakpoint
CREATE INDEX "material_purchase_media_purchaseId_kind_idx" ON "material_purchase_media" USING btree ("purchase_id","kind");--> statement-breakpoint
CREATE INDEX "venue_status_idx" ON "venue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "venue_city_idx" ON "venue" USING btree ("city");--> statement-breakpoint
CREATE INDEX "venue_status_city_idx" ON "venue" USING btree ("status","city");--> statement-breakpoint
CREATE INDEX "venue_pledgeType_idx" ON "venue" USING btree ("pledge_type");--> statement-breakpoint
CREATE INDEX "venue_lat_lng_idx" ON "venue" USING btree ("latitude","longitude");