# TikTok Shop Integration Setup Guide

This guide explains how to complete the TikTok Shop integration for automatic two-way inventory synchronization.

## Overview

The integration provides:
- **Manual Product Sync**: Push all products from your website to TikTok Shop
- **Website Sales → TikTok**: Automatically update TikTok Shop inventory when products sell on your website
- **TikTok Sales → Website**: Automatically update website inventory when products sell on TikTok Shop

## Prerequisites

✅ TikTok Shop seller account
✅ TikTok Shop App created (you have app key and secret)
⏳ App approval pending (1-3 business days)

## Step 1: Wait for App Approval

TikTok Shop is currently reviewing your app. You should receive an email when approved.

**What's being reviewed:**
- Company details
- Partner registration
- US data security questionnaire
- Data security and privacy questionnaire

## Step 2: Enable API Scopes

Once approved, you need to enable the required API permissions:

1. Go to [TikTok Shop Partner Center](https://partner.tiktokshop.com)
2. Navigate to **Apps & Services** → Your App
3. Find **API Management** or **Scopes** section
4. Enable these scopes:
   - ✅ `seller.base` - Basic seller info
   - ✅ `seller.product.write` - Create/update products
   - ✅ `seller.product.read` - Read products
   - ✅ `seller.stock.write` - Update inventory
   - ✅ `seller.stock.read` - Read inventory
   - ✅ `seller.order.read` - Read orders (for webhooks)

5. Click **Save** or **Submit for Review**

## Step 3: Configure Redirect URI

In your TikTok Shop app settings:

1. Find **OAuth Redirect URI** or **Callback URL** section
2. Add both URLs:
   - **Production**: `https://desertcandleworks.com/api/admin/tiktok/callback`
   - **Development** (optional): `http://localhost:3000/api/admin/tiktok/callback`
3. Save the settings

## Step 4: Set Up Webhook

To receive order notifications from TikTok Shop:

1. In your TikTok Shop Partner Center, go to **Webhooks** or **Event Subscriptions**
2. Add a new webhook endpoint:
   - **URL**: `https://desertcandleworks.com/api/tiktok/webhook`
   - **Events**: Subscribe to `order_status_change`
3. Save the webhook configuration

**Important**: The webhook endpoint will verify requests using your app secret, which is already configured in your `.env` file.

## Step 5: Environment Variables

Your environment variables are already configured:

```bash
TIKTOK_SHOP_APP_KEY="6ibrnri4o4itl"
TIKTOK_SHOP_APP_SECRET="95d8bc3f9f1ac4544fad126096e34d22130aee94"
```

Make sure these are also added to your **Vercel environment variables** for production:
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add both `TIKTOK_SHOP_APP_KEY` and `TIKTOK_SHOP_APP_SECRET`
3. Deploy to apply changes

## Step 6: Connect Your TikTok Shop

Once everything is approved and configured:

1. Go to `/admin/tiktok-shop` on your website
2. Click **"Connect TikTok Shop"**
3. You'll be redirected to TikTok to authorize
4. Approve the permissions
5. You'll be redirected back to your admin panel
6. You should see "Connected" status

## Step 7: Initial Product Sync

After connecting:

1. Click **"Sync All Products"** button
2. This will upload all your products to TikTok Shop
3. Review the results to see if any products failed to sync

## How It Works

### Website Sale → TikTok Shop Update

When someone buys a product on your website:

1. Stripe webhook receives `checkout.session.completed` event
2. Website stock is decremented via `incrStock()`
3. **Automatically**: TikTok Shop inventory is updated via `updateTikTokInventory()`
4. Both platforms now show correct stock level

### TikTok Shop Sale → Website Update

When someone buys a product on TikTok Shop:

1. TikTok Shop sends webhook to `/api/tiktok/webhook`
2. Webhook is verified using HMAC-SHA256 signature
3. Product is found by SKU (which you used as `product_id`)
4. Website stock is decremented via `incrStock()`
5. Both platforms now show correct stock level

## Troubleshooting

### "This service does not exist" Error

**Cause**: App scopes not enabled yet
**Solution**: Complete Step 2 to enable API scopes

### "Unauthorized" or "Invalid signature"

**Cause**: App secret mismatch
**Solution**: Verify `TIKTOK_SHOP_APP_SECRET` matches your TikTok Shop app secret

### Products not syncing

**Cause**: Missing required fields or API errors
**Solution**: Check admin panel sync results for specific errors. Common issues:
- Product images must be publicly accessible URLs
- Prices must be positive numbers
- SKUs must be unique

### Stock not updating after TikTok sales

**Cause**: Webhook not configured correctly
**Solution**:
1. Verify webhook URL is correct in TikTok Partner Center
2. Check Vercel logs for webhook errors
3. Ensure `order_status_change` event is subscribed

### Stock not updating after website sales

**Cause**: TikTok Shop not connected or API error
**Solution**:
1. Check `/admin/tiktok-shop` shows "Connected" status
2. Check Vercel logs for TikTok API errors
3. Verify access token hasn't expired (auto-refreshes every 24 hours)

## Testing

### Test Website → TikTok Sync

1. Make a test purchase on your website (use Stripe test mode)
2. Check product page - stock should decrease
3. Check same product on TikTok Shop - stock should match
4. Check Vercel logs for: `[TikTok Shop] Updated inventory for SKU-XXX to Y`

### Test TikTok → Website Sync

1. Make a test purchase on TikTok Shop
2. Check webhook received: Look for `[TikTok Webhook] Processing order` in logs
3. Check product page on website - stock should decrease
4. Check Vercel logs for: `[TikTok Webhook] Decremented stock for product-slug`

## Important Notes

### SKU as Product ID

The integration uses your product SKU as the `product_id` in TikTok Shop. This allows the webhook to match TikTok orders back to your website products.

**Do not change SKUs** after syncing to TikTok Shop, or the mapping will break.

### Package Dimensions

Currently hardcoded to:
- **Dimensions**: 5" × 5" × 8"
- **Weight**: 1.5 lbs

You may want to add these fields to your product schema later for accurate shipping costs.

### Categories

All products are synced to the `home_garden` category by default. You can customize this in:
`src/app/api/admin/tiktok/sync/route.ts` line 100

### Variant Products

Currently, only the total stock is synced to TikTok Shop. Variant-specific stock (different scents/wicks) is not separately tracked on TikTok.

## API Endpoints

- **OAuth Authorization**: `GET /api/admin/tiktok/auth`
- **OAuth Callback**: `GET /api/admin/tiktok/callback`
- **Check Connection**: `GET /api/admin/tiktok/sync`
- **Sync Products**: `POST /api/admin/tiktok/sync`
- **Disconnect**: `POST /api/admin/tiktok/disconnect`
- **Webhook Receiver**: `POST /api/tiktok/webhook`

## Security

### Webhook Verification

TikTok Shop webhooks are verified using HMAC-SHA256:
- **Signature**: `HMAC-SHA256(app_secret, timestamp + payload)`
- **Headers**: `x-tiktok-shop-signature` and `x-tiktok-shop-timestamp`
- Invalid signatures are rejected with 401 Unauthorized

### Token Storage

- Access tokens stored in Redis with key `tiktok:shop:token`
- Tokens auto-refresh when expired (every 24 hours)
- Refresh tokens valid for 1 year

## Files Modified

### New Files
- `src/lib/tiktokShop.ts` - OAuth & API client
- `src/app/api/admin/tiktok/auth/route.ts` - Start OAuth
- `src/app/api/admin/tiktok/callback/route.ts` - OAuth callback
- `src/app/api/admin/tiktok/sync/route.ts` - Product sync
- `src/app/api/admin/tiktok/disconnect/route.ts` - Disconnect
- `src/app/api/tiktok/webhook/route.ts` - Webhook handler
- `src/app/admin/tiktok-shop/page.tsx` - Admin UI

### Modified Files
- `src/app/api/stripe/webhook/route.ts` - Added TikTok inventory updates
- `src/app/admin/page.tsx` - Added TikTok Shop link
- `.env` - Added TikTok credentials

## Resources

- [TikTok Shop Partner Center](https://partner.tiktokshop.com)
- [TikTok Shop API Documentation](https://partner.tiktokshop.com/docv2/page/seller-api-overview)
- [OAuth 2.0 Documentation](https://developers.tiktok.com/doc/oauth-user-access-token-management)
