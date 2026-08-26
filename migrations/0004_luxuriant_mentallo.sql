CREATE TABLE "venue_invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"venue_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'staff' NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by_user_id" text,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_member" (
	"id" text PRIMARY KEY NOT NULL,
	"venue_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'staff' NOT NULL,
	"invited_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "venue_invitation" ADD CONSTRAINT "venue_invitation_venue_id_venue_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_invitation" ADD CONSTRAINT "venue_invitation_invited_by_user_id_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_member" ADD CONSTRAINT "venue_member_venue_id_venue_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_member" ADD CONSTRAINT "venue_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_member" ADD CONSTRAINT "venue_member_invited_by_user_id_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "venue_invitation_tokenHash_key" ON "venue_invitation" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "venue_invitation_venueId_idx" ON "venue_invitation" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "venue_invitation_email_idx" ON "venue_invitation" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "venue_member_venueId_userId_key" ON "venue_member" USING btree ("venue_id","user_id");--> statement-breakpoint
CREATE INDEX "venue_member_userId_idx" ON "venue_member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "venue_member_venueId_idx" ON "venue_member" USING btree ("venue_id");