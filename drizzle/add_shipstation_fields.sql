-- Add ShipStation fields to products and orders tables
-- Run this migration to add weight, dimensions, and carrier tracking fields

-- Add weight and dimensions to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS weight JSONB,
ADD COLUMN IF NOT EXISTS dimensions JSONB;

-- Add carrier and ShipStation fields to orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS carrier_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS service_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS shipstation_order_id VARCHAR(50);

-- Add comments for documentation
COMMENT ON COLUMN products.weight IS 'Product weight for shipping: { value: number, units: "ounces" | "pounds" }';
COMMENT ON COLUMN products.dimensions IS 'Package dimensions for shipping: { length: number, width: number, height: number, units: "inches" }';
COMMENT ON COLUMN orders.carrier_code IS 'Shipping carrier code from ShipStation (e.g., stamps_com, ups, fedex)';
COMMENT ON COLUMN orders.service_code IS 'Shipping service code from ShipStation (e.g., usps_priority_mail)';
COMMENT ON COLUMN orders.shipstation_order_id IS 'ShipStation order ID for reference';
