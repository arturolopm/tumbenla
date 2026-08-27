CREATE TABLE "venue_contribution" (
	"id" text PRIMARY KEY NOT NULL,
	"venue_id" text NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'COP' NOT NULL,
	"note" text,
	"submitted_by_user_id" text,
	"status" text DEFAULT 'submitted' NOT NULL,
	"verified_by_user_id" text,
	"verified_at" timestamp,
	"verified_note" text,
	"purchase_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_contribution_media" (
	"id" text PRIMARY KEY NOT NULL,
	"contribution_id" text NOT NULL,
	"kind" text DEFAULT 'receipt' NOT NULL,
	"url" text NOT NULL,
	"storage_key" text,
	"caption" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "venue_contribution" ADD CONSTRAINT "venue_contribution_venue_id_venue_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_contribution" ADD CONSTRAINT "venue_contribution_submitted_by_user_id_user_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_contribution" ADD CONSTRAINT "venue_contribution_verified_by_user_id_user_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_contribution" ADD CONSTRAINT "venue_contribution_purchase_id_material_purchase_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."material_purchase"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_contribution_media" ADD CONSTRAINT "venue_contribution_media_contribution_id_venue_contribution_id_fk" FOREIGN KEY ("contribution_id") REFERENCES "public"."venue_contribution"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "venue_contribution_venueId_idx" ON "venue_contribution" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_contribution_status_idx" ON "venue_contribution" USING btree ("status");--> statement-breakpoint
CREATE INDEX "venue_contribution_purchaseId_idx" ON "venue_contribution" USING btree ("purchase_id");--> statement-breakpoint
CREATE INDEX "venue_contribution_media_contributionId_idx" ON "venue_contribution_media" USING btree ("contribution_id");