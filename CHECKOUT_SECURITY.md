# Checkout Security Documentation

This document outlines the security measures implemented in the checkout flow to prevent fraud, price manipulation, and other exploits.

## Security Features

### 1. Address Validation

**File**: `src/lib/shipstation.ts` - `validateAddress()`

**Protection**: Prevents shipping to invalid or fraudulent addresses.

**Implementation**:
- Validates address using ShipStation API before fetching shipping rates
- Returns normalized/corrected address if valid
- Throws descriptive errors for invalid addresses (postal code, city, state, etc.)
- Reduces failed deliveries and shipping fraud

**Usage**:
```typescript
const validatedAddress = await validateAddress({
  name: "John Doe",
  line1: "123 Main St",
  city: "Phoenix",
  state: "AZ",
  postalCode: "85001",
  country: "US"
});
```

**Error Handling**:
- Invalid postal code: "Invalid postal code. Please check your ZIP code and try again."
- Invalid city: "Invalid city. Please check your city name and try again."
- Invalid state: "Invalid state. Please check your state and try again."
- Generic: "Unable to validate address. Please check your shipping address and try again."

---

### 2. Price Manipulation Protection

**File**: `src/app/api/checkout/route.ts` (lines 210-238)

**Protection**: Prevents users from submitting arbitrary Stripe Price IDs.

**Implementation**:
- Server validates that submitted Price IDs match expected product prices
- Checks both base product prices AND size-specific variant prices
- Logs any manipulation attempts with detailed error messages
- Returns 400 error if price doesn't match

**Security Check**:
```typescript
// Check base product price ID
if (product.stripePriceId && item.price === product.stripePriceId) {
  validPriceId = true;
}

// Check size-specific price IDs
if (!validPriceId && product.variantConfig?.sizes) {
  for (const size of product.variantConfig.sizes) {
    if (size.stripePriceId && item.price === size.stripePriceId) {
      validPriceId = true;
      break;
    }
  }
}

if (!validPriceId) {
  console.error(`Price manipulation attempt detected`);
  return error;
}
```

---

### 3. Stock Validation

**File**: `src/app/api/checkout/route.ts` (lines 166-208)

**Protection**: Prevents overselling and race conditions.

**Implementation**:
- Real-time stock check before creating Stripe session
- Validates both base product stock and variant-specific stock
- Returns 409 Conflict if insufficient stock
- Prevents customers from checking out with more items than available

**Stock Check**:
```typescript
// Check variant stock if this is a variant product
let availableStock: number;
if (variantId && product.variantConfig) {
  const variantData = product.variantConfig.variantData[variantId];
  availableStock = variantData?.stock || 0;
} else {
  availableStock = product.stock || 0;
}

if (availableStock < requestedQty) {
  return NextResponse.json({
    error: `${product.name} is out of stock. Requested: ${requestedQty}, Available: ${availableStock}`
  }, { status: 409 });
}
```

---

### 4. Discount Validation

**File**: `src/app/api/checkout/route.ts` (lines 431-450)

**Protection**: Prevents users from gaming the system with excessive discounts.

**Implementation**:
- Server validates that combined discounts (points + promotions) don't exceed order total
- Caps points redemption based on remaining amount after promotion
- Prevents negative order totals

**Validation Logic**:
```typescript
const totalDiscountCents = discountAmountCents + promotionDiscountCents;
if (totalDiscountCents > subtotal) {
  // If promotion discount alone exceeds subtotal, it's invalid
  if (promotionDiscountCents >= subtotal) {
    return NextResponse.json(
      { error: "Promotion discount exceeds order total" },
      { status: 400 }
    );
  }

  // Cap points at remaining amount after promotion
  const maxPointsAllowed = Math.floor((subtotal - promotionDiscountCents) / 5);
  return NextResponse.json({
    error: `After applying the promotion, you can redeem a maximum of ${maxPointsAllowed} points`
  }, { status: 400 });
}
```

---

### 5. Rate Limiting

**File**: `src/app/api/checkout/route.ts` (lines 42-51)

**Protection**: Prevents checkout abuse and brute force attacks.

**Implementation**:
- IP-based rate limiting on checkout endpoint
- 15-minute cooldown after too many attempts
- Returns 429 Too Many Requests if limit exceeded

**Rate Limit Check**:
```typescript
const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
const rateLimitOk = await checkRateLimit(ip);

if (!rateLimitOk) {
  return NextResponse.json(
    { error: "Too many checkout attempts. Please try again in 15 minutes." },
    { status: 429 }
  );
}
```

---

### 6. Order Total Verification

**File**: `src/app/api/checkout/route.ts` (line 389) & `src/app/api/stripe/webhook/route.ts` (lines 78-107)

**Protection**: Prevents price manipulation if someone bypasses checkout API.

**Implementation**:
- Expected subtotal stored in Stripe session metadata during checkout
- Webhook verifies actual subtotal matches expected subtotal
- Logs discrepancies for manual review
- Proceeds with order (customer already paid) but flags for investigation

**Checkout - Store Expected Total**:
```typescript
// Store expected subtotal for verification in webhook
sessionMetadata.expectedSubtotalCents = subtotal.toString();
```

**Webhook - Verify Total**:
```typescript
const expectedSubtotalCents = session.metadata?.expectedSubtotalCents
  ? parseInt(session.metadata.expectedSubtotalCents)
  : null;

if (expectedSubtotalCents !== null) {
  const actualSubtotalCents = lineItems.data.reduce((sum, item) => {
    return sum + (item.amount_total || 0);
  }, 0);

  if (actualSubtotalCents !== expectedSubtotalCents) {
    console.error(`Order total mismatch detected! Expected: ${expectedSubtotalCents}, Got: ${actualSubtotalCents}`);
    console.warn(`Proceeding with order despite total mismatch - manual review recommended`);
  } else {
    console.log(`Order total verified: ${actualSubtotalCents} cents`);
  }
}
```

---

### 7. Webhook Replay Protection

**File**: `src/app/api/stripe/webhook/route.ts` (lines 47-73)

**Protection**: Prevents duplicate order processing from webhook replays.

**Implementation**:
- Tracks processed webhook event IDs in database
- Checks if event was already processed before handling
- Defense-in-depth: Also verifies order completion by comparing totals
- Prevents inventory double-deduction and duplicate points awards

**Replay Check**:
```typescript
// Check if this specific webhook event was already processed
if (await isWebhookProcessed(event.id)) {
  console.log(`Event ${event.id} already processed - skipping (replay protection)`);
  return NextResponse.json({ received: true, skipped: "event_already_processed" }, { status: 200 });
}

// ... process order ...

// Mark webhook event as processed to prevent replay attacks
await markWebhookProcessed(event.id);
```

---

### 8. Stripe Signature Verification

**File**: `src/app/api/stripe/webhook/route.ts` (lines 21-29)

**Protection**: Validates webhook authenticity to prevent spoofed requests.

**Implementation**:
- Verifies Stripe signature using webhook secret
- Rejects requests with invalid signatures
- Ensures webhooks genuinely come from Stripe

**Signature Verification**:
```typescript
const sig = req.headers.get("stripe-signature") as string;
const raw = await req.text();

try {
  event = stripe.webhooks.constructEvent(raw, sig, whSecret);
} catch (err) {
  return NextResponse.json(
    { error: `Webhook signature failed: ${err.message}` },
    { status: 400 }
  );
}
```

---

### 9. Locked Shipping Address

**File**: `src/app/api/checkout/route.ts` (lines 643-676)

**Protection**: Prevents bait-and-switch shipping cost manipulation.

**Implementation**:
- Address is locked before Stripe checkout session is created
- User cannot change address in Stripe checkout
- Prevents getting low shipping quote then changing to expensive destination
- Shipping rates are calculated for the locked address only

**Address Locking**:
```typescript
if (shippingAddress) {
  // Create a temporary customer with the shipping address locked
  const customer = await stripe.customers.create({
    name: shippingAddress.name,
    shipping: {
      name: shippingAddress.name,
      address: {
        line1: shippingAddress.line1,
        line2: shippingAddress.line2 || undefined,
        city: shippingAddress.city,
        state: shippingAddress.state,
        postal_code: shippingAddress.postalCode,
        country: shippingAddress.country,
      },
    },
  });

  baseParams.customer = customer.id;
}
```

---

### 10. Server-Side Shipping Calculation

**File**: `src/app/api/checkout/route.ts` (lines 455-583)

**Protection**: Prevents shipping cost manipulation.

**Implementation**:
- All shipping rates fetched server-side from ShipStation API
- User never sees or controls rate calculation logic
- Free shipping threshold ($100) enforced server-side
- $2 packing cost added server-side

**Shipping Rate Calculation**:
```typescript
// Calculate total weight server-side
let totalWeightOz = 0;
for (const item of extendedLineItems) {
  const productInfo = priceToProduct.get(item.price);
  if (productInfo) {
    const product = productsBySlug.get(productInfo.slug);
    const weightPerItem = getProductWeight(product, item.metadata?.sizeName);
    totalWeightOz += weightPerItem * item.quantity;
  }
}

// Fetch rates from ShipStation (server-side only)
const rates = await getShippingRates(
  fromPostalCode,
  shippingAddress.postalCode,
  totalWeightOz,
  true, // residential
  shippingAddress.city,
  shippingAddress.state
);

// Add $2 packing cost server-side
const PACKING_COST = 2.00;

// Apply free shipping if order over $100 (server-side check)
const FREE_SHIPPING_THRESHOLD = 10000; // $100 in cents
const qualifiesForFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD;
```

---

## Testing Checklist

Before deploying to production, verify:

- [ ] Address validation rejects invalid addresses (test with fake ZIP codes)
- [ ] Price manipulation is blocked (test with modified Stripe Price IDs)
- [ ] Stock validation prevents overselling (test with low-stock items)
- [ ] Discount validation caps excessive discounts (test with high points + promo)
- [ ] Rate limiting triggers after excessive attempts (test with multiple rapid checkouts)
- [ ] Order total verification logs discrepancies (test by manually creating Stripe session)
- [ ] Webhook replay protection prevents duplicates (test by resending webhook)
- [ ] Stripe signature verification rejects invalid webhooks (test with fake signature)
- [ ] Locked shipping address prevents changes (test by inspecting Stripe checkout)
- [ ] Server-side shipping is enforced (test by inspecting network requests)

---

## Environment Variables Required

```bash
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# ShipStation
SHIPSTATION_API_KEY=...
SHIPSTATION_API_SECRET=...
SHIPSTATION_V2_API_KEY=...
SHIPSTATION_FROM_POSTAL_CODE=85260
SHIPSTATION_FROM_NAME="Desert Candle Works"
SHIPSTATION_FROM_PHONE="0000000000"
SHIPSTATION_FROM_ADDRESS="123 Main St"
SHIPSTATION_FROM_CITY="Scottsdale"
SHIPSTATION_FROM_STATE="AZ"
```

---

## Security Best Practices

1. **Never trust client input** - Always validate on server
2. **Use Stripe's built-in security** - Leverage their signature verification
3. **Log security events** - Track manipulation attempts for analysis
4. **Monitor webhook logs** - Watch for total mismatches or replay attempts
5. **Keep secrets secure** - Never commit API keys to git
6. **Test thoroughly** - Use Stripe test mode to verify all protections
7. **Review logs regularly** - Check for unusual patterns or attacks

---

## Potential Future Enhancements

1. **USPS Address Validation API** - More robust address correction
2. **Fraud scoring** - Flag suspicious orders for manual review
3. **Velocity checks** - Block rapid successive orders from same IP/email
4. **CVV verification** - Additional card validation (Stripe handles this)
5. **3D Secure** - Strong customer authentication for high-value orders
6. **Geolocation blocking** - Block orders from high-risk countries
7. **Email verification** - Require email confirmation before fulfillment

---

## Emergency Procedures

### If Price Manipulation Detected:
1. Check logs for `[Checkout Security] Price manipulation attempt detected`
2. Review the attempted price ID vs. expected price ID
3. Verify product pricing in admin panel
4. Update Stripe Price IDs if needed

### If Order Total Mismatch Detected:
1. Check webhook logs for `[Webhook Security] Order total mismatch detected`
2. Manual review of the order in question
3. Verify customer was charged correct amount in Stripe Dashboard
4. Investigate how Stripe session was created (check logs)
5. Contact customer if refund/adjustment needed

### If Webhook Replay Detected:
1. Check logs for `event_already_processed` skip messages
2. Verify order was only fulfilled once
3. No action needed if order is correct (this is normal protection)

---

## Support

For security concerns, contact the development team immediately.

**Do not** disable any security features without consulting the team first.
