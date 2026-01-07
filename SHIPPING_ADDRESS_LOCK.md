# Shipping Address Lock - Preventing Address Changes in Stripe

## Problem

Currently, customers:
1. Enter ZIP code on cart page to get shipping rates
2. Select a rate and proceed to Stripe Checkout
3. **Can change their shipping address in Stripe**, resulting in incorrect shipping costs

For example:
- Customer enters Arizona ZIP (cheap shipping)
- Selects Ground Advantage for $8
- Changes address to Florida in Stripe (should be $15)
- **You pay the difference**

## Solution: Pre-Checkout Address Collection

### Option 1: Full Address on Cart Page (Recommended)

**Changes Needed:**

1. **Cart Page UI** (`src/app/cart/page.tsx`):
   - Add full address form fields (not just ZIP):
     - Name
     - Address Line 1
     - Address Line 2 (optional)
     - City
     - State (dropdown)
     - ZIP Code
   - Keep existing shipping rate logic
   - Validate all required fields before checkout

2. **Checkout API** (`src/app/api/checkout/route.ts`):
   - Accept `shippingAddress` parameter with full address
   - Pass address to Stripe as locked shipping address:

   ```typescript
   const session = await stripe.checkout.sessions.create({
     // ... existing config
     shipping_options: [{
       shipping_rate_data: {
         // ... existing rate config
       }
     }],
     // NEW: Pre-fill and lock shipping address
     shipping_address_collection: null, // Disable Stripe's address collection
     customer_details: {
       name: shippingAddress.name,
       address: {
         line1: shippingAddress.line1,
         line2: shippingAddress.line2,
         city: shippingAddress.city,
         state: shippingAddress.state,
         postal_code: shippingAddress.postalCode,
         country: shippingAddress.country,
       }
     },
     // Or use `shipping_details` if you want to lock it:
     shipping_details: {
       name: shippingAddress.name,
       address: {
         line1: shippingAddress.line1,
         line2: shippingAddress.line2,
         city: shippingAddress.city,
         state: shippingAddress.state,
         postal_code: shippingAddress.postalCode,
         country: shippingAddress.country,
       }
     }
   });
   ```

3. **Benefits:**
   - Accurate shipping rates guaranteed
   - Better UX (customer sees final price before Stripe)
   - Can validate address before checkout
   - Can offer address autocomplete

### Option 2: Stripe Address with Validation (Alternative)

Keep Stripe's address collection but add server-side validation:

1. **Webhook** (`src/app/api/stripe/webhook/route.ts`):
   - On `checkout.session.completed`, compare:
     - Original ZIP code used for rate calculation (stored in session metadata)
     - Final shipping address from Stripe
   - If addresses differ significantly:
     - Cancel order
     - Refund automatically
     - Send email explaining the issue
     - Ask customer to re-checkout with correct address

2. **Implementation:**
   ```typescript
   // In checkout API - store original ZIP in metadata
   metadata: {
     originalZipCode: zipCode,
     shippingRateCents: selectedRate.totalCost * 100,
   }

   // In webhook - validate after payment
   const { originalZipCode } = session.metadata;
   const finalZip = session.shipping_details.address.postal_code;

   if (originalZip !== finalZip) {
     // Recalculate shipping for final address
     const actualShippingCost = await calculateShipping(session.shipping_details.address);
     const paidShipping = session.metadata.shippingRateCents;

     if (actualShippingCost > paidShipping) {
       // Customer didn't pay enough - cancel and refund
       await stripe.refunds.create({ payment_intent: session.payment_intent });
       // Send email to customer
     }
   }
   ```

3. **Drawbacks:**
   - Customer already paid (must refund)
   - Poor UX (order cancelled after payment)
   - Email notification confusion
   - Manual intervention sometimes needed

## Recommendation

**Use Option 1** (Full Address on Cart Page) because:
- Prevents the problem entirely
- Better customer experience
- No risk of unexpected costs
- Cleaner implementation
- Matches standard e-commerce patterns

## Implementation Checklist

- [ ] Add address form fields to cart page
- [ ] Add state dropdown with all US states
- [ ] Update shipping rate API to use full address (already done)
- [ ] Update checkout API to accept and lock shipping address
- [ ] Test address locking in Stripe test mode
- [ ] Update CLAUDE.md documentation

## Code Example: Cart Page Address Form

```tsx
// Add state for full address
const [shippingAddress, setShippingAddress] = useState({
  name: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'US'
});

// In the shipping section:
<div className="space-y-3">
  <input
    type="text"
    placeholder="Full Name"
    value={shippingAddress.name}
    onChange={(e) => setShippingAddress({...shippingAddress, name: e.target.value})}
    className="input w-full"
  />
  <input
    type="text"
    placeholder="Address Line 1"
    value={shippingAddress.line1}
    onChange={(e) => setShippingAddress({...shippingAddress, line1: e.target.value})}
    className="input w-full"
  />
  <input
    type="text"
    placeholder="Address Line 2 (optional)"
    value={shippingAddress.line2}
    onChange={(e) => setShippingAddress({...shippingAddress, line2: e.target.value})}
    className="input w-full"
  />
  <div className="grid grid-cols-2 gap-2">
    <input
      type="text"
      placeholder="City"
      value={shippingAddress.city}
      onChange={(e) => setShippingAddress({...shippingAddress, city: e.target.value})}
      className="input"
    />
    <select
      value={shippingAddress.state}
      onChange={(e) => setShippingAddress({...shippingAddress, state: e.target.value})}
      className="input"
    >
      <option value="">State</option>
      <option value="AZ">Arizona</option>
      {/* ... all states */}
    </select>
  </div>
  <input
    type="text"
    placeholder="ZIP Code"
    value={shippingAddress.postalCode}
    onChange={(e) => setShippingAddress({...shippingAddress, postalCode: e.target.value.replace(/\D/g, '').slice(0, 5)})}
    className="input"
    maxLength={5}
  />
  <button onClick={fetchShippingRates}>Get Shipping Rates</button>
</div>

// In checkout:
body: JSON.stringify({
  lineItems,
  shippingAddress,
  selectedRate,
  // ...
})
```
