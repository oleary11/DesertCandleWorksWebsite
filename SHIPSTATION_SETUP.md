# ShipStation Integration Setup Guide

This guide will help you set up ShipStation integration with your Desert Candle Works website for automated order fulfillment and tracking.

## Overview

The ShipStation integration automates your shipping workflow:

1. **Order Placement**: When a customer completes checkout via Stripe, the order is automatically created in ShipStation with "Awaiting Shipment" status
2. **Label Creation**: You log into ShipStation, review orders, and create shipping labels (ShipStation auto-selects the cheapest carrier rate)
3. **Tracking Updates**: When you create a label, ShipStation automatically sends the tracking number back to your website
4. **Customer Notifications**: ShipStation sends shipping confirmation and delivery emails to customers (you can disable this and use your own emails instead)

## Prerequisites

- [x] ShipStation account (sign up at https://www.shipstation.com if you don't have one)
- [x] API credentials from ShipStation dashboard
- [x] Carrier accounts connected in ShipStation (USPS, UPS, FedEx, etc.)
- [x] Product weights measured and entered

## Step 1: Get ShipStation API Credentials

1. Log into your ShipStation account
2. Go to **Settings** (gear icon) → **API Settings**
3. Click **Generate New API Keys**
4. Copy the **API Key** and **API Secret**
5. Keep these safe - you'll need them in the next step

## Step 2: Configure Environment Variables

Add your ShipStation credentials to `.env.local`:

```bash
# ShipStation API Credentials
SHIPSTATION_API_KEY=your_api_key_here
SHIPSTATION_API_SECRET=your_api_secret_here
```

**Important**: Never commit these to git. They're already in `.gitignore`.

## Step 3: Run Database Migration

Add the new weight and tracking fields to your database:

```bash
# Connect to your Neon database
psql $DATABASE_URL -f drizzle/add_shipstation_fields.sql
```

Or run the SQL directly:

```sql
-- Add weight and dimensions to products
ALTER TABLE products
ADD COLUMN IF NOT EXISTS weight JSONB,
ADD COLUMN IF NOT EXISTS dimensions JSONB;

-- Add carrier and ShipStation fields to orders
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS carrier_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS service_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS shipstation_order_id VARCHAR(50);
```

## Step 4: Add Product Weights

Product weights are critical for accurate shipping rates. You need to weigh your products and add them to the database.

### Recommended Weights (including jar + wax + packaging)

| Product Size | Estimated Total Weight |
|--------------|------------------------|
| 8 oz candle  | 14 oz                  |
| 12 oz candle | 20 oz                  |
| 16 oz candle | 26 oz                  |

### How to Add Weights

**Option A: Via Admin Panel** (Recommended once weights are added to admin UI)

1. Go to Admin → Products
2. Edit each product
3. Add weight in the weight field
4. Click "Publish Changes"

**Option B: Via Database** (Quick bulk update)

```sql
-- Update a specific product
UPDATE products
SET weight = '{"value": 14, "units": "ounces"}'::jsonb
WHERE slug = 'lamarca-prosecco-candle';

-- Bulk update all products with default weights (adjust as needed)
-- This is just an example - you should weigh actual products!
UPDATE products
SET weight = '{"value": 14, "units": "ounces"}'::jsonb
WHERE weight IS NULL;
```

**Important**: These are estimates. For accurate shipping costs, weigh your actual products with packaging and update accordingly.

## Step 5: Deploy Your Code

Deploy the updated code to production:

```bash
# Commit changes
git add .
git commit -m "Add ShipStation integration"
git push

# Deploy (if using Vercel)
vercel --prod
```

Or if you have auto-deployment set up, just push to your main branch.

## Step 6: Subscribe to ShipStation Webhook

After deployment, run the webhook setup script:

```bash
npx tsx src/scripts/setup-shipstation-webhook.ts
```

This will:
- Register your webhook URL (`https://yoursite.com/api/shipstation/webhook`) with ShipStation
- Enable automatic tracking number updates when labels are created

**Expected Output:**
```
🚢 ShipStation Webhook Setup

Webhook URL: https://www.desertcandleworks.com/api/shipstation/webhook

📋 Checking existing webhooks...
No existing webhooks found.

📡 Subscribing to SHIP_NOTIFY webhook...

✅ SUCCESS! Webhook subscribed:
   Event: SHIP_NOTIFY
   URL: https://www.desertcandleworks.com/api/shipstation/webhook
   Webhook ID: 12345

🎉 ShipStation webhook setup complete!
```

## Step 7: Configure ShipStation Email Settings (Optional)

Decide whether you want ShipStation to send shipping emails or handle them yourself.

### Option A: Let ShipStation Send Emails (Recommended)

ShipStation automatically sends:
- Shipping confirmation with tracking
- Out for delivery notifications
- Delivery confirmations

**To enable:**
1. Log into ShipStation
2. Go to **Settings** → **Shipping Settings** → **Email**
3. Customize email templates with your branding
4. Enable automatic emails for shipped orders

**Benefits:**
- No additional code needed
- Automatic carrier tracking updates
- Professional branded tracking page
- Handles delivery notifications automatically

### Option B: Handle Emails Yourself

Keep your current email system for shipping notifications.

**Note**: You'll need to:
- Build tracking status checking
- Poll ShipStation or carrier APIs for updates
- Handle delivery confirmation logic

Most users prefer Option A to leverage ShipStation's tracking infrastructure.

## Step 8: Test the Integration

### Test Order Flow

1. **Place a Test Order**
   - Use Stripe test mode
   - Complete checkout with shipping address
   - Check your logs for: `[ShipStation] Order ST##### created in ShipStation`

2. **Verify in ShipStation**
   - Log into ShipStation dashboard
   - Check **Orders** → **Awaiting Shipment**
   - Your test order should appear there

3. **Create Test Label**
   - Select the test order in ShipStation
   - Click "Create Label"
   - ShipStation will show carrier options with rates
   - Create the label

4. **Verify Tracking Update**
   - Check your webhook logs: `[ShipStation Webhook] Updated order ST##### with tracking`
   - Check your database - order should have tracking number
   - Customer should receive tracking email (if enabled in ShipStation)

### Verify Database Updates

```sql
-- Check that order has tracking info
SELECT id, tracking_number, carrier_code, service_code, shipping_status
FROM orders
WHERE id = 'ST#####';
```

Should show:
```
id      | tracking_number        | carrier_code | service_code        | shipping_status
--------|------------------------|--------------|---------------------|----------------
ST00123 | 9405511899223197428490 | stamps_com   | usps_priority_mail  | shipped
```

## Daily Workflow

Once set up, your daily shipping workflow is:

1. **Morning**: Log into ShipStation dashboard
2. **Review Orders**: Check "Awaiting Shipment" tab
3. **Create Labels**:
   - ShipStation auto-selects cheapest carrier/rate
   - Bulk create labels for efficiency
   - Print labels
4. **Ship Packages**: Attach labels and hand to carrier
5. **Done**: Customers automatically get tracking emails, tracking numbers appear in your database

## Troubleshooting

### Orders Not Appearing in ShipStation

**Check:**
- Environment variables are set correctly
- Webhook logs show ShipStation order creation
- ShipStation API credentials are valid
- No API errors in your logs

**Debug:**
```bash
# Check recent orders in ShipStation
curl -X GET "https://ssapi.shipstation.com/orders?orderStatus=awaiting_shipment" \
  -H "Authorization: Basic $(echo -n 'API_KEY:API_SECRET' | base64)"
```

### Tracking Numbers Not Updating

**Check:**
- Webhook is subscribed (run setup script again)
- Webhook URL is accessible publicly
- Webhook logs show events being received
- Database has carrier_code and service_code columns

**Verify webhook:**
```bash
npx tsx src/scripts/setup-shipstation-webhook.ts
```

### Weight Issues / Incorrect Shipping Costs

**Fix:**
- Weigh actual products with packaging
- Update product weights in database
- ShipStation uses these weights for rate calculation

```sql
-- Update weights for specific products
UPDATE products SET weight = '{"value": 16, "units": "ounces"}'::jsonb WHERE slug = 'product-slug';
```

## Cost Savings Tips

1. **Enable Rate Shopping**: ShipStation automatically compares USPS, UPS, FedEx rates
2. **Use ShipStation Rates**: Up to 87% discount vs retail shipping
3. **Batch Process**: Create multiple labels at once for efficiency
4. **Right-Size Packages**: Accurate weights prevent carrier adjustments
5. **Compare Services**: Priority Mail vs First Class vs Ground

## Advanced Features (Future Enhancements)

Once you're comfortable with the basic workflow, consider:

- **Automation Rules**: Auto-assign carriers based on weight/destination
- **Branded Tracking Page**: Custom domain tracking page
- **Return Labels**: Automate return label creation
- **International Shipping**: Add customs forms automation
- **Inventory Sync**: Real-time inventory updates from ShipStation

## Support

- **ShipStation Support**: https://help.shipstation.com
- **API Documentation**: https://www.shipstation.com/docs/api/
- **Integration Issues**: Check webhook logs and database

## Quick Reference

### Important URLs

- ShipStation Dashboard: https://ship.shipstation.com
- ShipStation API Docs: https://www.shipstation.com/docs/api/
- Your Webhook URL: `https://www.desertcandleworks.com/api/shipstation/webhook`

### Common SQL Queries

```sql
-- Check orders pending shipment
SELECT id, email, shipping_name, created_at
FROM orders
WHERE shipping_status = 'pending'
ORDER BY created_at DESC;

-- Check recent shipped orders
SELECT id, tracking_number, carrier_code, shipped_at
FROM orders
WHERE shipping_status = 'shipped'
ORDER BY shipped_at DESC
LIMIT 10;

-- Find products missing weights
SELECT slug, name
FROM products
WHERE weight IS NULL
AND visible_on_website = true;
```

### Scripts

- **Setup webhook**: `npx tsx src/scripts/setup-shipstation-webhook.ts`
- **List webhooks**: Modify setup script to only list webhooks
- **Database migration**: `psql $DATABASE_URL -f drizzle/add_shipstation_fields.sql`

---

**That's it!** You're now set up for automated shipping with ShipStation. Orders will flow automatically from your website to ShipStation, and tracking numbers will come back automatically when you create labels.
