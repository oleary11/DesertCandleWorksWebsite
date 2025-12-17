# Square POS Integration Setup Guide

This guide walks you through integrating your Square card reader with your Desert Candle Works website to automatically sync inventory and create orders.

## Overview

When you make a sale using your Square card reader at the farmers market:
1. ✅ Payment is processed through Square
2. ✅ Square sends a webhook to your website
3. ✅ Website automatically decrements inventory
4. ✅ Order is created with ID starting with `SQ-` (e.g., `SQ-ABC123XYZ`)
5. ✅ Order appears in `/admin/orders` with "Square" payment method

## Step 1: Create Square Developer Account

1. Go to [Square Developer Dashboard](https://developer.squareup.com/apps)
2. Sign in with your Square account
3. Click **"Create App"** or select your existing app
4. Give it a name like "Desert Candle Works Website Integration"

## Step 2: Get API Credentials

### Access Token
1. In the Square Developer Dashboard, go to your app
2. Go to **"Credentials"** tab
3. Choose your environment:
   - **Sandbox** (for testing) - Use this first!
   - **Production** (for live sales) - Use after testing
4. Copy the **Access Token**
5. Add to your `.env.local` file:
   ```
   SQUARE_ACCESS_TOKEN=your_access_token_here
   SQUARE_ENVIRONMENT=sandbox  # or "production" when ready
   ```

### Webhook Signature Key
1. Still in your app, go to **"Webhooks"** tab
2. Click **"Add Endpoint"**
3. Enter your webhook URL:
   ```
   https://your-domain.com/api/square/webhook
   ```
   For local testing with ngrok:
   ```
   https://your-ngrok-url.ngrok.io/api/square/webhook
   ```
4. Subscribe to this event:
   - ✅ `payment.updated`
5. Save the endpoint
6. Copy the **Signature Key**
7. Add to your `.env.local`:
   ```
   SQUARE_WEBHOOK_SIGNATURE_KEY=your_signature_key_here
   ```

## Step 3: Map Your Products

You need to map your Square catalog items to your website products so inventory syncs correctly.

### Find Your Square Catalog IDs

**Option A: Via Square Dashboard**
1. Go to [Square Dashboard](https://squareup.com/dashboard)
2. Navigate to **Items > Items Library**
3. Click on each product
4. Note the **Catalog Object ID** (in the URL or details)

**Option B: Via API (requires curl or Postman)**
```bash
curl https://connect.squareup.com/v2/catalog/list \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Update Product Mappings

Edit `src/lib/squareMapping.ts` and add your mappings:

```typescript
const SQUARE_TO_PRODUCT_MAP: Record<string, SquareProductMapping> = {
  // Basic product mapping (no variants)
  "ABC123XYZ": {
    slug: "desert-sunset",
    name: "Desert Sunset",
  },

  // Product with variant
  "DEF456UVW": {
    slug: "young-dumb",
    name: "Young Dumb (Wood Wick)",
    variantId: "wood-wick",
  },

  // Add all your products...
};
```

**How to find your product slugs:**
- Go to your website `/admin/products`
- The slug is in the product URL (e.g., `/shop/desert-sunset` → slug is `desert-sunset`)

## Step 4: Set Up Products in Square

Create items in your Square catalog that match your website products:

1. Go to [Square Dashboard](https://squareup.com/dashboard)
2. Go to **Items > Items Library**
3. Click **"Create an Item"**
4. For each product:
   - **Name**: Match your website product name (e.g., "Desert Sunset")
   - **Price**: Set the price
   - **SKU**: Optional, but helpful (e.g., "DCW-0001")
   - **Category**: Optional organization
5. Save each item

**For products with variants** (e.g., wood wick vs cotton wick):
- Create separate Square items for each variant, OR
- Use Square's variation feature and map each variation ID separately

## Step 5: Test the Integration

### Test in Sandbox Mode (Recommended First)

1. Make sure `SQUARE_ENVIRONMENT=sandbox` in your `.env.local`
2. Use Square's test payment methods:
   - Test card: `4111 1111 1111 1111`
   - Any future expiration date
   - Any CVV
3. Make a test sale in Square POS (use Square's sandbox app)
4. Check your website:
   - Go to `/admin/orders`
   - You should see a new order with ID starting with `SQ-`
   - Payment method should show "square"
   - Inventory should be decremented

### Test Locally with ngrok (Optional)

If you want to test before deploying:

1. Install ngrok: `npm install -g ngrok`
2. Start your dev server: `npm run dev`
3. In another terminal: `ngrok http 3000`
4. Copy the ngrok URL (e.g., `https://abc123.ngrok.io`)
5. Update your Square webhook URL to:
   ```
   https://abc123.ngrok.io/api/square/webhook
   ```
6. Make test sales and check logs

## Step 6: Go Live

Once testing works:

1. Change environment to production:
   ```
   SQUARE_ENVIRONMENT=production
   SQUARE_ACCESS_TOKEN=your_production_access_token
   ```
2. Update webhook URL to your production domain:
   ```
   https://desertcandleworks.com/api/square/webhook
   ```
3. Deploy your website
4. Make a small real sale to verify everything works
5. Check `/admin/orders` to confirm the order was created

## Troubleshooting

### Orders Not Appearing

**Check webhook delivery:**
1. Go to Square Developer Dashboard
2. Go to Webhooks tab
3. Check "Event Log" to see if webhooks are being sent
4. Look for errors in delivery

**Check server logs:**
```bash
# Vercel logs (if deployed)
vercel logs

# Or local dev server output
npm run dev
```

### Inventory Not Decrementing

**Check product mapping:**
1. Make sure the Square catalog ID matches the ID in `squareMapping.ts`
2. Make sure the website product slug is correct
3. Check that the product exists and has stock

**Check webhook logs:**
- Look for `[Square Webhook]` messages in your server logs
- Should see "Decrementing stock" messages

### Webhook Signature Errors

**Fix:**
1. Verify `SQUARE_WEBHOOK_SIGNATURE_KEY` is correct
2. Make sure there are no extra spaces in the env variable
3. Regenerate the signature key in Square if needed

## Environment Variables Reference

Add these to your `.env.local` (development) and Vercel environment variables (production):

```bash
# Square API Configuration
SQUARE_ACCESS_TOKEN=your_access_token_here
SQUARE_ENVIRONMENT=sandbox  # or "production"
SQUARE_WEBHOOK_SIGNATURE_KEY=your_signature_key_here

# Existing variables...
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

## What Happens During a Square Sale

1. **Customer makes purchase** at farmers market using your Square card reader
2. **Square processes payment** and marks it as COMPLETED
3. **Square sends webhook** to `https://your-domain.com/api/square/webhook`
4. **Webhook validates** signature for security
5. **Order is created** in your database:
   - Order ID: `SQ-` + first 16 chars of Square payment ID
   - Payment method: "square"
   - Customer email: "square-pos@admin.local" (placeholder)
   - Notes: Square payment ID and receipt URL
6. **Inventory is decremented** based on product mapping
7. **Order appears** in `/admin/orders` page
8. **You can view order details** including notes with Square payment ID

## Benefits of This Integration

✅ **Real-time inventory sync** - Stock updates immediately after each sale
✅ **Unified order management** - All orders (Stripe online + Square POS) in one place
✅ **Prevent overselling** - Website shows accurate stock levels
✅ **Easy reconciliation** - Square order IDs clearly marked with `SQ-` prefix
✅ **Automatic tracking** - No manual entry needed after each farmers market sale

## Advanced: Bidirectional Sync (Future Enhancement)

Currently: Square → Website (one-way)
- Square sales update website inventory ✅

Future Enhancement: Website → Square (two-way)
- Website sales could also update Square inventory
- Requires additional implementation with Square Inventory API
- Let me know if you want this feature!

## Need Help?

Common issues:
- **"Webhook not configured"**: Missing `SQUARE_WEBHOOK_SIGNATURE_KEY` env variable
- **"Invalid signature"**: Wrong signature key or webhook URL mismatch
- **"SQUARE_ACCESS_TOKEN not configured"**: Missing access token env variable
- **Products not mapping**: Check catalog IDs in `squareMapping.ts`

For more help, check:
- [Square Webhooks Documentation](https://developer.squareup.com/docs/webhooks/overview)
- [Square Payments API](https://developer.squareup.com/docs/payments-api/overview)
