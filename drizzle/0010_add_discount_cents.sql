-- Orders had no way to record a discount applied at the point of sale (e.g.
-- a Square POS discount), so productSubtotal + tax never reconciled with
-- totalCents and the discount was invisible on the order.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "discount_cents" integer;
