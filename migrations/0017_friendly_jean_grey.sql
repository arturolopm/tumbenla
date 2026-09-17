ALTER TABLE "payment_event" DROP CONSTRAINT "payment_event_environment_check";--> statement-breakpoint
DROP INDEX "payment_attempt_order_submission_key";--> statement-breakpoint
CREATE UNIQUE INDEX "payment_attempt_submission_key" ON "payment_attempt" USING btree ("submission_key");--> statement-breakpoint
ALTER TABLE "payment_event" ADD CONSTRAINT "payment_event_environment_check" CHECK ("payment_event"."environment" in ('test', 'live', 'unknown'));