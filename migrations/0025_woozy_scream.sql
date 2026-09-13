CREATE TABLE "commerce_rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"key_hash" text NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commerce_rate_limit_count_check" CHECK ("commerce_rate_limit"."count" > 0),
	CONSTRAINT "commerce_rate_limit_window_check" CHECK ("commerce_rate_limit"."expires_at" > "commerce_rate_limit"."window_started_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "commerce_rate_limit_window_key" ON "commerce_rate_limit" USING btree ("scope","key_hash","window_started_at");--> statement-breakpoint
CREATE INDEX "commerce_rate_limit_expires_idx" ON "commerce_rate_limit" USING btree ("expires_at");