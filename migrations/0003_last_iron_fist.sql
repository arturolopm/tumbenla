CREATE TABLE "party_night" (
	"id" text PRIMARY KEY NOT NULL,
	"venue_id" text NOT NULL,
	"happened_at" timestamp NOT NULL,
	"title" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "party_photo" (
	"id" text PRIMARY KEY NOT NULL,
	"night_id" text NOT NULL,
	"url" text NOT NULL,
	"storage_key" text,
	"caption" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photo_claim" (
	"id" text PRIMARY KEY NOT NULL,
	"photo_id" text NOT NULL,
	"user_id" text NOT NULL,
	"show_publicly" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "venue" ADD COLUMN "estimated_per_person_night" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "party_night" ADD CONSTRAINT "party_night_venue_id_venue_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_photo" ADD CONSTRAINT "party_photo_night_id_party_night_id_fk" FOREIGN KEY ("night_id") REFERENCES "public"."party_night"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_claim" ADD CONSTRAINT "photo_claim_photo_id_party_photo_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."party_photo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_claim" ADD CONSTRAINT "photo_claim_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "party_night_venueId_idx" ON "party_night" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "party_night_happenedAt_idx" ON "party_night" USING btree ("happened_at");--> statement-breakpoint
CREATE INDEX "party_photo_nightId_idx" ON "party_photo" USING btree ("night_id");--> statement-breakpoint
CREATE INDEX "party_photo_nightId_status_idx" ON "party_photo" USING btree ("night_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "photo_claim_photoId_userId_key" ON "photo_claim" USING btree ("photo_id","user_id");--> statement-breakpoint
CREATE INDEX "photo_claim_userId_idx" ON "photo_claim" USING btree ("user_id");