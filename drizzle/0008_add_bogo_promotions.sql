ALTER TYPE "public"."discount_type" ADD VALUE IF NOT EXISTS 'bogo';
--> statement-breakpoint
ALTER TABLE "promotions" ADD COLUMN IF NOT EXISTS "min_quantity" integer;
--> statement-breakpoint
ALTER TABLE "promotions" ADD COLUMN IF NOT EXISTS "apply_to_quantity" integer;
