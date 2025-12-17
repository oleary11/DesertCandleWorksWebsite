# Square Integration - Quick Start

## ✅ What's Been Implemented

Your website now supports Square card reader integration! Here's what happens automatically:

1. **Make a sale with Square** → Payment processes normally
2. **Webhook fires** → Square notifies your website
3. **Stock decrements** → Inventory updates in real-time
4. **Order created** → Shows in admin panel with `SQ-` prefix
5. **Revenue tracked** → Includes Square fee calculation (2.6% + $0.10)

## 🚀 Quick Setup (3 Steps)

### 1. Get Square Credentials

Go to [Square Developer Dashboard](https://developer.squareup.com/apps):
- Create an app (or use existing)
- Copy **Access Token** from Credentials tab
- Add webhook at: `https://your-domain.com/api/square/webhook`
- Subscribe to: `payment.updated`
- Copy **Signature Key**

### 2. Add Environment Variables

Add to `.env.local` and Vercel:

```bash
SQUARE_ACCESS_TOKEN=your_access_token_here
SQUARE_ENVIRONMENT=sandbox  # Change to "production" when ready
SQUARE_WEBHOOK_SIGNATURE_KEY=your_signature_key_here
```

### 3. Map Your Products

Edit `src/lib/squareMapping.ts`:

```typescript
const SQUARE_TO_PRODUCT_MAP: Record<string, SquareProductMapping> = {
  "YOUR_SQUARE_CATALOG_ID": {
    slug: "your-product-slug",
    name: "Product Name",
  },
  // Add all your products...
};
```

**That's it!** Deploy and test with a small sale.

## 📊 How It Works

### Order IDs
- **Stripe online**: Regular session IDs
- **Manual sales**: `MS-xxxxxxxxx`
- **Square POS**: `SQ-xxxxxxxxx` ← NEW!

### Order Display
Square orders show in `/admin/orders` with:
- 🟣 Purple "Square POS" badge
- Payment method: "square"
- Notes with Square payment ID
- Net revenue after Square fees (2.6% + $0.10)

### Inventory Sync
When you sell a "Desert Sunset" candle at the farmers market:
1. Square processes $25 payment
2. Webhook fires to your website
3. Maps Square item → `desert-sunset` product
4. Decrements stock by 1
5. Creates order `SQ-ABC123XYZ`
6. Shows in admin: $25.00 total, -$0.75 fee, $24.25 net

## 🧪 Testing

**Sandbox Mode** (recommended first):
```bash
SQUARE_ENVIRONMENT=sandbox
SQUARE_ACCESS_TOKEN=sandbox_access_token
```

Use Square's test card: `4111 1111 1111 1111`

**Production Mode** (when ready):
```bash
SQUARE_ENVIRONMENT=production
SQUARE_ACCESS_TOKEN=production_access_token
```

## 📝 Finding Catalog IDs

### Method 1: Square Dashboard
1. Go to Items > Items Library
2. Click on a product
3. Look for Catalog Object ID

### Method 2: API Call
```bash
curl https://connect.squareup.com/v2/catalog/list \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## ⚠️ Important Notes

1. **Product Mapping is Required**
   - Unmapped products still create orders but don't decrement stock
   - They appear as "Square Item (Unmapped)" in orders

2. **Customer Email**
   - Square doesn't provide customer email in webhooks
   - Orders use placeholder: `square-pos@admin.local`
   - You can manually update in notes if needed

3. **Fees**
   - Square: 2.6% + $0.10 per transaction
   - Stripe: 2.9% + $0.30 per transaction
   - Manual: No fees

4. **Stock Management**
   - Square sales decrement website inventory
   - Website sales DON'T update Square (one-way sync)
   - Manually adjust Square inventory if needed

## 🔍 Troubleshooting

**Orders not appearing?**
- Check Square webhook event log in developer dashboard
- Verify `SQUARE_WEBHOOK_SIGNATURE_KEY` is correct
- Check server logs for errors

**Stock not decreasing?**
- Verify product mapping in `squareMapping.ts`
- Check catalog IDs match Square exactly
- Look for "unmapped" warnings in logs

**Webhook signature errors?**
- Regenerate signature key in Square dashboard
- Make sure no extra spaces in env variable
- Verify webhook URL matches exactly

## 📚 Full Documentation

See [SQUARE_SETUP.md](./SQUARE_SETUP.md) for detailed setup instructions.

## 🎉 Benefits

✅ **No manual entry** - Sales auto-sync from card reader
✅ **Real-time inventory** - Never oversell at markets
✅ **Unified dashboard** - All sales in one place
✅ **Automatic tracking** - No spreadsheets needed
✅ **Fee transparency** - See exact Square fees per order
