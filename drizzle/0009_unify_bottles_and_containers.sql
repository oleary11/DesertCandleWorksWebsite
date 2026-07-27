ALTER TABLE "bottle_inventory" ADD COLUMN IF NOT EXISTS "capacity_water_oz" double precision;
--> statement-breakpoint
ALTER TABLE "bottle_inventory" ADD COLUMN IF NOT EXISTS "container_shape" varchar(100);
--> statement-breakpoint
ALTER TABLE "bottle_inventory" ADD COLUMN IF NOT EXISTS "container_cost_per_unit_cents" integer;
--> statement-breakpoint
ALTER TABLE "bottle_inventory" ADD COLUMN IF NOT EXISTS "container_supplier" varchar(255);
--> statement-breakpoint
ALTER TABLE "bottle_inventory" ADD COLUMN IF NOT EXISTS "container_notes" text;
--> statement-breakpoint
ALTER TABLE "bottle_inventory" ADD COLUMN IF NOT EXISTS "legacy_container_id" varchar(100);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bottle_inventory_legacy_container_id_idx" ON "bottle_inventory" ("legacy_container_id");
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "container_id" varchar(100);
