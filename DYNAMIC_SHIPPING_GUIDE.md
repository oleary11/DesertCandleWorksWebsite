# Dynamic Shipping Rates with ShipStation

This guide explains how to implement dynamic shipping rates in your checkout flow using ShipStation's real-time rate calculation API.

## Overview

The system now calculates **real-time shipping costs** based on:
- **Customer's shipping address** (city, state, zip code)
- **Cart weight** (total weight of all items)
- **Multiple carriers** (USPS, UPS, FedEx)
- **+$2 packing materials** fee automatically added

## How It Works

### 1. Customer Adds Items to Cart
- Each product has a candle weight (jar + wax only)
- System automatically adds 16oz packaging weight (box, packing peanuts, hexawrap)
- Cart calculates total weight

### 2. Customer Enters Shipping Address
- **Before checkout**, customer enters their shipping address
- Frontend calls `/api/shipping/rates` with cart items and address

### 3. ShipStation Calculates Rates
- API fetches rates from USPS, UPS, and FedEx
- Returns sorted list of options (cheapest first)
- Each rate includes $2 for packing materials

### 4. Customer Selects Shipping Method
- Shows options like:
  - **USPS Priority Mail: $9.50** (carrier: $7.50 + packing: $2.00)
  - **USPS First Class: $6.25** (carrier: $4.25 + packing: $2.00)
  - **Local Pickup: Free** (Scottsdale, AZ)

### 5. Checkout with Selected Rate
- Frontend passes selected rate to `/api/checkout`:
  ```json
  {
    "lineItems": [...],
    "shippingRateAmountCents": 950,
    "shippingRateDescription": "USPS Priority Mail",
    "isLocalPickup": false
  }
  ```

### 6. Stripe Checkout
- Stripe shows the exact shipping rate customer selected
- No surprises at checkout

### 7. Order Fulfillment
- **Shipped orders**: Automatically created in ShipStation
- **Local pickup**: Skipped in ShipStation (no label needed)

## Backend API Reference

### GET Shipping Rates

**Endpoint:** `POST /api/shipping/rates`

**Request:**
```json
{
  "lineItems": [
    {
      "price": "price_1234...",
      "quantity": 2,
      "metadata": {
        "sizeName": "12 oz"
      }
    }
  ],
  "shippingAddress": {
    "city": "Los Angeles",
    "state": "CA",
    "postalCode": "90001",
    "country": "US"
  }
}
```

**Response:**
```json
{
  "rates": [
    {
      "serviceName": "USPS Priority Mail",
      "serviceCode": "usps_priority_mail",
      "carrierCode": "stamps_com",
      "shipmentCost": 7.50,
      "totalCost": 9.50
    },
    {
      "serviceName": "USPS First Class Package",
      "serviceCode": "usps_first_class_mail",
      "carrierCode": "stamps_com",
      "shipmentCost": 4.25,
      "totalCost": 6.25
    }
  ],
  "totalWeightOz": 40,
  "packingCost": 2.00
}
```

### Create Checkout Session

**Endpoint:** `POST /api/checkout`

**Request with Shipping Rate:**
```json
{
  "lineItems": [...],
  "shippingRateAmountCents": 950,
  "shippingRateDescription": "USPS Priority Mail",
  "isLocalPickup": false
}
```

**Request with Local Pickup:**
```json
{
  "lineItems": [...],
  "isLocalPickup": true
}
```

## Frontend Integration Example

### 1. Add Address Form to Cart/Checkout Page

```tsx
const [shippingAddress, setShippingAddress] = useState({
  city: '',
  state: '',
  postalCode: '',
  country: 'US'
});

const [shippingRates, setShippingRates] = useState([]);
const [selectedRate, setSelectedRate] = useState(null);

// When address is complete, fetch rates
async function fetchShippingRates() {
  const response = await fetch('/api/shipping/rates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lineItems: cartItems.map(item => ({
        price: item.stripePriceId,
        quantity: item.quantity,
        metadata: { sizeName: item.size }
      })),
      shippingAddress
    })
  });

  const data = await response.json();
  setShippingRates(data.rates);
  setSelectedRate(data.rates[0]); // Auto-select cheapest
}
```

### 2. Show Shipping Options

```tsx
<div className="shipping-options">
  {shippingRates.map(rate => (
    <label key={rate.serviceCode}>
      <input
        type="radio"
        name="shipping"
        value={rate.serviceCode}
        checked={selectedRate?.serviceCode === rate.serviceCode}
        onChange={() => setSelectedRate(rate)}
      />
      <span>{rate.serviceName}</span>
      <span>${rate.totalCost.toFixed(2)}</span>
    </label>
  ))}

  <label>
    <input
      type="radio"
      name="shipping"
      value="local_pickup"
      checked={selectedRate === null}
      onChange={() => setSelectedRate(null)}
    />
    <span>Local Pickup (Scottsdale, AZ)</span>
    <span>Free</span>
  </label>
</div>
```

### 3. Proceed to Checkout

```tsx
async function proceedToCheckout() {
  const response = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lineItems: cartItems.map(item => ({
        price: item.stripePriceId,
        quantity: item.quantity,
        metadata: {
          productName: item.name,
          productImage: item.image,
          sizeName: item.size,
          wickType: item.wickType,
          scent: item.scent,
          variantId: item.variantId
        }
      })),
      shippingRateAmountCents: selectedRate ? Math.round(selectedRate.totalCost * 100) : undefined,
      shippingRateDescription: selectedRate?.serviceName,
      isLocalPickup: selectedRate === null
    })
  });

  const { url } = await response.json();
  window.location.href = url; // Redirect to Stripe Checkout
}
```

## Environment Variables

Add to `.env.local`:

```bash
# ShipStation API Credentials
SHIPSTATION_API_KEY=your_api_key_here
SHIPSTATION_API_SECRET=your_api_secret_here

# Your business/warehouse postal code (for rate calculation)
SHIPSTATION_FROM_POSTAL_CODE=85260
```

## Testing Shipping Rates

### Test Addresses

**Close (cheap shipping):**
```
City: Phoenix
State: AZ
Zip: 85001
Expected: ~$6-8 for USPS First Class
```

**Far (expensive shipping):**
```
City: New York
State: NY
Zip: 10001
Expected: ~$12-16 for USPS Priority
```

**Alaska/Hawaii (very expensive):**
```
City: Honolulu
State: HI
Zip: 96801
Expected: ~$20-30+ for USPS Priority
```

### Testing the API Directly

```bash
curl -X POST http://localhost:3000/api/shipping/rates \
  -H "Content-Type: application/json" \
  -d '{
    "lineItems": [
      {
        "price": "price_1234",
        "quantity": 2,
        "metadata": { "sizeName": "12 oz" }
      }
    ],
    "shippingAddress": {
      "city": "Los Angeles",
      "state": "CA",
      "postalCode": "90001",
      "country": "US"
    }
  }'
```

## Pricing Strategy

### Current Setup: +$2 Packing Materials

**Example:**
- Carrier charges: $7.50 (USPS Priority)
- Packing materials: $2.00
- **Customer pays: $9.50**

### Adjusting the Markup

Edit [src/app/api/shipping/rates/route.ts:95](src/app/api/shipping/rates/route.ts#L95):

```typescript
// Option 1: Fixed fee
const PACKING_COST = 2.00; // $2 flat fee

// Option 2: Percentage markup
const PACKING_COST = rate.shipmentCost * 0.15; // 15% markup

// Option 3: Combined
const PACKING_COST = Math.max(2.00, rate.shipmentCost * 0.10); // At least $2 or 10%
```

## Carrier Configuration

### Supported Carriers

The system queries these carriers (edit in [route.ts:89](src/app/api/shipping/rates/route.ts#L89)):

```typescript
const carriers = [
  "stamps_com",      // USPS (ShipStation's USPS integration)
  "ups_walleted",    // UPS
  "fedex"            // FedEx
];
```

### Carrier Codes Reference

- **stamps_com** - USPS (best for residential, most affordable)
- **ups_walleted** - UPS (faster, more expensive)
- **fedex** - FedEx (fastest, most expensive)
- **dhl_express** - DHL (international)

### Removing a Carrier

Don't have UPS account? Just remove it:

```typescript
const carriers = ["stamps_com"]; // USPS only
```

## Product Weights

Accurate weights are critical for rate calculation.

### Weight System

The system uses a two-part weight calculation:

1. **Candle Weight** (entered in admin): Jar + wax only
2. **Packaging Weight** (automatic): 16oz constant added to every shipment

**Packaging includes:**
- Shipping box
- Packing peanuts
- Hexawrap protective wrap (~3 layers)
- Tape and labels

### Default Candle Weights

See [src/lib/shipstation.ts](src/lib/shipstation.ts):

```typescript
const PACKAGING_WEIGHT_OZ = 16; // Added automatically

const defaultWeights: Record<string, number> = {
  "8 oz": 8,    // 8 oz candle (jar + wax) → 24oz shipped
  "12 oz": 14,  // 12 oz candle (jar + wax) → 30oz shipped
  "16 oz": 20,  // 16 oz candle (jar + wax) → 36oz shipped
};
```

### Updating Weights

**Option A: Via Admin UI:**
1. Go to Admin → Products
2. Edit a product
3. Enter candle weight (jar + wax only) in ounces
4. Save changes

**Option B: Via database:**

```sql
UPDATE products
SET weight = '{"value": 12, "units": "ounces"}'::jsonb
WHERE slug = 'your-product-slug';
```

**Note:** The weight you enter is the candle only. The system automatically adds 16oz for packaging when calculating shipping rates.

**Option C: Update defaults in code** for products without explicit weights (see [src/lib/shipstation.ts](src/lib/shipstation.ts))

## Troubleshooting

### "No shipping rates available"

**Causes:**
- ShipStation API credentials invalid
- Carrier accounts not connected in ShipStation
- Address is invalid/incomplete
- Product weights missing

**Fix:**
1. Check ShipStation dashboard → Settings → Carriers
2. Verify API credentials in `.env.local`
3. Check console logs for specific error
4. Test address with USPS website

### Rates seem too high/low

**Causes:**
- Incorrect product weights
- Wrong `FROM_POSTAL_CODE`
- Packing cost too high/low

**Fix:**
1. Weigh actual products with packaging
2. Update `SHIPSTATION_FROM_POSTAL_CODE` to your location
3. Adjust `PACKING_COST` in rate calculation

### Local pickup orders going to ShipStation

**Check:**
- Webhook logs show "Skipping ShipStation order creation for local pickup"
- If not, check `isLocalPickup` flag in checkout request

## Benefits Over Flat Rate

### Old System (Flat $14.99 shipping):
- ❌ Lose money on heavy/far orders
- ❌ Overcharge on light/close orders
- ❌ No carrier options
- ❌ Manual rate updates needed

### New System (Dynamic ShipStation rates):
- ✅ Always profitable (actual cost + $2)
- ✅ Fair pricing for customers
- ✅ Multiple carrier options
- ✅ Automatic rate updates
- ✅ Better customer experience

## Next Steps

1. **Deploy code** with ShipStation integration
2. **Update frontend** to collect address and show rates
3. **Weigh products** and update database
4. **Test** with various addresses
5. **Launch** dynamic shipping!

---

**Questions?** Check the main [SHIPSTATION_SETUP.md](SHIPSTATION_SETUP.md) guide or ShipStation API docs.
