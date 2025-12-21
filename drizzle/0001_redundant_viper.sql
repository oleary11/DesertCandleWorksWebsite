CREATE TABLE "email_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"subject" varchar(500) NOT NULL,
	"message" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_counters" (
	"type" varchar(20) PRIMARY KEY NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "unique_order_item_idx";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "sku" varchar(100);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "square_catalog_id" varchar(100);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "square_variant_mapping" jsonb;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "images" jsonb;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "alcohol_type" varchar(100);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "material_cost" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "visible_on_website" boolean DEFAULT true;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_purchase_item_idx" ON "purchase_items" USING btree ("purchase_id","name","quantity","unit_cost_cents","category","notes");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_order_item_idx" ON "order_items" USING btree ("order_id","product_slug","variant_id","price_cents","quantity");