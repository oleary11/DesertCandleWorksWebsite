-- Orders never recorded which shipping option was selected at checkout, so
-- a real carrier rate and the "Local Pickup (Scottsdale, AZ)" option were
-- indistinguishable after the fact (both just showed up as a shipping cost).
-- This made it impossible to tell, from the order alone, whether an
-- out-of-state customer had somehow ended up on the pickup-only option.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_method" varchar(200);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "is_local_pickup" boolean NOT NULL DEFAULT false;
