ALTER TABLE "finance_evidence" ADD COLUMN "retained_private_size" bigint;--> statement-breakpoint
ALTER TABLE "finance_evidence" ADD COLUMN "retained_private_content_type" text;--> statement-breakpoint
ALTER TABLE "finance_evidence" ADD COLUMN "public_redacted_sha256" text;--> statement-breakpoint
ALTER TABLE "finance_evidence" ADD COLUMN "public_redacted_size" bigint;--> statement-breakpoint
ALTER TABLE "finance_evidence" ADD COLUMN "public_redacted_content_type" text;