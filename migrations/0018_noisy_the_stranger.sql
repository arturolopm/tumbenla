CREATE TABLE "unit_lifecycle_operation" (
	"id" text PRIMARY KEY NOT NULL,
	"operation_key" text NOT NULL,
	"content_hash" text NOT NULL,
	"unit_id" text NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"actor_user_id" text,
	"detail" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unit_lifecycle_operation_kind_check" CHECK ("unit_lifecycle_operation"."kind" in ('redeem', 'expire', 'refund_reserve', 'refund_release', 'refund_confirm')),
	CONSTRAINT "unit_lifecycle_operation_status_check" CHECK ("unit_lifecycle_operation"."status" in ('completed', 'rejected'))
);
--> statement-breakpoint
ALTER TABLE "unit_lifecycle_operation" ADD CONSTRAINT "unit_lifecycle_operation_unit_id_commerce_order_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."commerce_order_unit"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_lifecycle_operation" ADD CONSTRAINT "unit_lifecycle_operation_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unit_lifecycle_operation_operation_key" ON "unit_lifecycle_operation" USING btree ("operation_key");--> statement-breakpoint
CREATE INDEX "unit_lifecycle_operation_unit_idx" ON "unit_lifecycle_operation" USING btree ("unit_id","created_at");