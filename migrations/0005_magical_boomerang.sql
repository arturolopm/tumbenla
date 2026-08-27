CREATE TABLE "venue_claim_request" (
	"id" text PRIMARY KEY NOT NULL,
	"venue_id" text NOT NULL,
	"user_id" text NOT NULL,
	"message" text,
	"evidence_url" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by_user_id" text,
	"reviewed_at" timestamp,
	"review_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "venue_claim_request" ADD CONSTRAINT "venue_claim_request_venue_id_venue_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_claim_request" ADD CONSTRAINT "venue_claim_request_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_claim_request" ADD CONSTRAINT "venue_claim_request_reviewed_by_user_id_user_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "venue_claim_request_venueId_userId_key" ON "venue_claim_request" USING btree ("venue_id","user_id");--> statement-breakpoint
CREATE INDEX "venue_claim_request_status_idx" ON "venue_claim_request" USING btree ("status");--> statement-breakpoint
CREATE INDEX "venue_claim_request_venueId_idx" ON "venue_claim_request" USING btree ("venue_id");