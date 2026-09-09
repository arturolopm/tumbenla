-- Product review is retired. A product can be public only when its declared
-- reconstruction share is at least 40%. Existing lower-share public products
-- become drafts, preserving their declared terms until their owner updates and
-- explicitly publishes them again.

UPDATE "venue_product"
SET "status" = 'draft', "published_at" = NULL, "updated_at" = now()
WHERE "status" = 'published' AND "donation_percentage" < 40;--> statement-breakpoint

ALTER TABLE "venue_product"
ADD CONSTRAINT "venue_product_published_min_donation_percentage"
CHECK ("status" <> 'published' OR "donation_percentage" >= 40);
