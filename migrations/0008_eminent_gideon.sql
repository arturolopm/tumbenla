CREATE TABLE "venue_application" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"venue_id" text,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"city" text NOT NULL,
	"address_line" text NOT NULL,
	"instagram" text NOT NULL,
	"contact_email" text NOT NULL,
	"tiktok" text,
	"whatsapp" text,
	"phone" text,
	"neighborhood" text,
	"website" text,
	"opening_hours" text,
	"description" text,
	"pledge_idea" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by_user_id" text,
	"reviewed_at" timestamp,
	"review_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "venue_claim_request" CASCADE;--> statement-breakpoint
ALTER TABLE "venue_application" ADD CONSTRAINT "venue_application_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_application" ADD CONSTRAINT "venue_application_venue_id_venue_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_application" ADD CONSTRAINT "venue_application_reviewed_by_user_id_user_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "venue_application_instagram_vivas_key" ON "venue_application" USING btree (lower("instagram")) WHERE "venue_application"."status" in ('pending', 'verifying');--> statement-breakpoint
CREATE INDEX "venue_application_status_idx" ON "venue_application" USING btree ("status");--> statement-breakpoint
CREATE INDEX "venue_application_userId_idx" ON "venue_application" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "venue_application_venueId_idx" ON "venue_application" USING btree ("venue_id");