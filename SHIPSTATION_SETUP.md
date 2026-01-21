# ShipStation Integration Setup Guide

This guide will help you set up ShipStation integration with your Desert Candle Works website for automated order fulfillment and tracking.

## Overview

The ShipStation integration automates your shipping workflow:

1. **Order Placement**: When a customer completes checkout, the order is saved to your database
2. **Order Sync**: ShipStation pulls orders from your Custom Store endpoint automatically
3. **Label Creation**: You log into ShipStation, review orders, and create shipping labels
4. **Tracking Updates**: When you create a label, ShipStation sends tracking info back to your website
5. **Customer Notifications**: ShipStation automatically sends branded emails:
   - Shipping confirmation with tracking link
   - Out for delivery notification
   - Delivered confirmation

## Why Custom Store Integration?

The Custom Store integration (vs. just using the API) unlocks **automatic customer email notifications**. Without it, orders go to "Manual Orders" which don't support ShipStation's notification features.

## Prerequisites

- [x] ShipStation account (sign up at https://www.shipstation.com if you don't have one)
- [x] API credentials from ShipStation dashboard (for shipping rates)
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
# ShipStation API Credentials (for shipping rate calculations)
SHIPSTATION_API_KEY=your_api_key_here
SHIPSTATION_API_SECRET=your_api_secret_here

# Custom Store Credentials (choose your own - used for ShipStation to authenticate with your site)
SHIPSTATION_CUSTOM_STORE_USERNAME=desertcandleworks
SHIPSTATION_CUSTOM_STORE_PASSWORD=your_secure_password_here
```

**Important**:
- Never commit these to git. They're already in `.gitignore`.
- The Custom Store credentials are ones YOU create - ShipStation will use them to authenticate when pulling orders.

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
git commit -m "Add ShipStation Custom Store integration"
git push

# Deploy (if using Vercel)
vercel --prod
```

**IMPORTANT**: Make sure to add the environment variables to Vercel:
- `SHIPSTATION_CUSTOM_STORE_USERNAME`
- `SHIPSTATION_CUSTOM_STORE_PASSWORD`

## Step 6: Create Custom Store in ShipStation (REQUIRED)

This is the key step that enables automatic customer notifications.

### 6.1 Add a New Store

1. Log into ShipStation
2. Go to **Settings** (gear icon) → **Selling Channels** → **Store Setup**
3. Click **Connect a Store or Marketplace**
4. Scroll down and select **Custom Store**

### 6.2 Configure the Custom Store

Fill in the following fields:

| Field | Value |
|-------|-------|
| **Store Name** | `Desert Candle Works Website` |
| **Username** | The value you set for `SHIPSTATION_CUSTOM_STORE_USERNAME` |
| **Password** | The value you set for `SHIPSTATION_CUSTOM_STORE_PASSWORD` |
| **URL to Custom XML Page** | `https://www.desertcandleworks.com/api/shipstation/custom-store` |

### 6.3 Test the Connection

1. Click **Test Connection**
2. ShipStation should show "Connection Successful"
3. If it fails, check:
   - Your environment variables are deployed to Vercel
   - The URL is correct (with https://)
   - Username/password match exactly

### 6.4 Save and Refresh

1. Click **Save**
2. Click **Refresh Stores** or wait for automatic refresh
3. Your orders should start appearing under the new store

## Step 7: Configure Customer Notifications

Now that you have a Custom Store (not Manual Orders), you can enable automatic notifications.

### 7.1 Enable Shipment Notifications

1. In ShipStation, go to **Settings** → **Notifications** → **Customer Notifications**
2. Enable notifications for:
   - **Shipment Confirmation** - Sent when you create a label
   - **Out for Delivery** - Sent when carrier scans "out for delivery"
   - **Delivery Confirmation** - Sent when package is delivered

### 7.2 Customize Email Templates

1. Go to **Settings** → **Notifications** → **Email Templates**
2. Customize the templates with your branding:
   - Add your logo
   - Match your brand colors
   - Customize the message

### 7.3 Set Up Branded Tracking Page

1. Go to **Settings** → **Branding** → **Tracking Page**
2. Upload your logo
3. Set your brand colors
4. Customers will see this page when they click tracking links

## Step 8: Test the Integration

### Test Order Flow

1. **Place a Test Order**
   - Use Stripe test mode
   - Complete checkout with shipping address
   - Order is saved to your database

2. **Trigger ShipStation Refresh**
   - In ShipStation, go to your Custom Store
   - Click **Refresh** to pull new orders
   - Your test order should appear under "Awaiting Shipment"

3. **Create Test Label**
   - Select the test order in ShipStation
   - Click "Create Label"
   - ShipStation will show carrier options with rates
   - Create the label

4. **Verify Customer Notification**
   - Check the test email address for shipping confirmation
   - The email should include:
     - Tracking number
     - Link to branded tracking page
     - Estimated delivery date

5. **Verify Database Update**
   - Check your database - order should have tracking number
   ```sql
   SELECT id, tracking_number, carrier_code, shipping_status
   FROM orders WHERE id = 'ST#####';
   ```

   Should show:
   ```
   id      | tracking_number        | carrier_code | shipping_status
   --------|------------------------|--------------|----------------
   ST00123 | 9405511899223197428490 | stamps_com   | shipped
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
- Custom Store credentials match your environment variables exactly
- The Custom Store URL is correct: `https://www.desertcandleworks.com/api/shipstation/custom-store`
- Orders have shipping addresses (local pickup orders won't appear)
- Orders are marked as "completed" in your database

**Test the endpoint manually:**
```bash
# Test your Custom Store endpoint
curl -u "your_username:your_password" \
  "https://www.desertcandleworks.com/api/shipstation/custom-store?action=export&start_date=01/01/2026%2000:00"
```

### Customer Not Receiving Notifications

**Check:**
- Orders are coming from your Custom Store (not "Manual Orders" or "Api Shipments")
- Customer notifications are enabled in ShipStation Settings → Notifications
- The customer email is correct on the order
- Check ShipStation's notification logs for errors

### Tracking Numbers Not Updating in Database

**Check:**
- The Custom Store is configured correctly (ShipStation POSTs to your endpoint)
- Check Vercel logs for errors on `/api/shipstation/custom-store`
- Verify the order number matches between ShipStation and your database

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
- Custom Store Endpoint: `https://www.desertcandleworks.com/api/shipstation/custom-store`

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
