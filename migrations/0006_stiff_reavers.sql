CREATE TABLE "photo_report" (
	"id" text PRIMARY KEY NOT NULL,
	"photo_id" text NOT NULL,
	"reported_by_user_id" text,
	"reason" text,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_by_user_id" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "party_photo" ADD COLUMN "uploaded_by_user_id" text;--> statement-breakpoint
ALTER TABLE "party_photo" ADD COLUMN "source" text DEFAULT 'venue' NOT NULL;--> statement-breakpoint
ALTER TABLE "party_photo" ADD COLUMN "reviewed_by_user_id" text;--> statement-breakpoint
ALTER TABLE "party_photo" ADD COLUMN "reviewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "photo_report" ADD CONSTRAINT "photo_report_photo_id_party_photo_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."party_photo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_report" ADD CONSTRAINT "photo_report_reported_by_user_id_user_id_fk" FOREIGN KEY ("reported_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_report" ADD CONSTRAINT "photo_report_resolved_by_user_id_user_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "photo_report_photoId_idx" ON "photo_report" USING btree ("photo_id");--> statement-breakpoint
CREATE INDEX "photo_report_status_idx" ON "photo_report" USING btree ("status");--> statement-breakpoint
ALTER TABLE "party_photo" ADD CONSTRAINT "party_photo_uploaded_by_user_id_user_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_photo" ADD CONSTRAINT "party_photo_reviewed_by_user_id_user_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;