# Shipping Address Lock Implementation - Complete

## ✅ Implementation Complete

The full shipping address collection system has been implemented to prevent customers from changing their shipping address in Stripe Checkout, which would result in incorrect shipping costs.

## Changes Made

### 1. **Cart Page** (`src/app/cart/page.tsx`)
- **Before:** Only collected ZIP code
- **After:** Collects full address:
  - Full Name
  - Address Line 1
  - Address Line 2 (optional)
  - City
  - State (dropdown)
  - ZIP Code

**Changes:**
- Replaced `zipCode` state with `shippingAddress` object
- Updated `fetchShippingRates()` to validate all required fields
- Updated `handleCheckout()` to validate address and pass it to checkout API
- Now passes `shippingAddress` to `/api/checkout`

### 2. **Address Form Component** (`src/components/ShippingAddressForm.tsx`)
**New file** - Reusable address form component with:
- All address fields
- State dropdown with all 50 US states
- Automatic validation
- "Get Rates" button that's disabled until form is complete
- Loading state support

### 3. **US States List** (`src/lib/usStates.ts`)
**New file** - Contains array of all 50 US states with codes and names

### 4. **Checkout API** (`src/app/api/checkout/route.ts`)
- **Before:** Only collected address in Stripe Checkout
- **After:** Accepts locked shipping address from cart

**Changes:**
- Added `shippingAddress` parameter parsing
- Updated Stripe session creation to:
  - If `shippingAddress` provided: Lock it using `shipping_details`
  - If not provided: Let Stripe collect it (fallback for old behavior)

**Key Code:**
```typescript
...(shippingAddress ? {
  shipping_details: {
    name: shippingAddress.name,
    address: {
      line1: shippingAddress.line1,
      line2: shippingAddress.line2 || null,
      city: shippingAddress.city,
      state: shippingAddress.state,
      postal_code: shippingAddress.postalCode,
      country: shippingAddress.country,
    },
  },
} : {
  shipping_address_collection: { allowed_countries: ["US", "CA"] },
}),
```

## How It Works

### User Flow:
1. **Customer adds items to cart**
2. **Customer enters full shipping address** on cart page
3. **System calculates shipping rates** for exact address
4. **Customer selects shipping method** (e.g., USPS Ground Advantage)
5. **Customer proceeds to Stripe Checkout**
6. **Shipping address is locked** - customer cannot change it
7. **Payment processed** with correct shipping cost

### Protection:
- Shipping cost is calculated for the exact address
- Address is locked in Stripe - cannot be modified
- No risk of customer changing address to a more expensive zone
- You're protected from unexpected shipping costs

## Testing

### Test the Implementation:
1. **Add item to cart**
2. **Enter shipping address:**
   - Name: Test User
   - Address: 123 Main St
   - City: Phoenix
   - State: AZ
   - ZIP: 85001
3. **Click "Get Rates"**
   - Should show USPS shipping options
   - Should filter to only package types (no envelopes)
   - Should show Ground Advantage and Priority Mail
4. **Select a rate and checkout**
5. **In Stripe Checkout:**
   - Shipping address should be pre-filled
   - Customer should NOT be able to change it
   - Only billing address should be editable

### Expected Behavior:
- ✅ Address form validates all required fields
- ✅ "Get Rates" button disabled until form complete
- ✅ Loading indicator shown while fetching rates
- ✅ Only valid candle shipping options shown (boxes, no envelopes)
- ✅ Address locked in Stripe Checkout
- ✅ Checkout cannot proceed without complete address

## Files Modified

1. `src/app/cart/page.tsx` - Cart page with full address collection
2. `src/app/api/checkout/route.ts` - Checkout API with address locking
3. `src/components/ShippingAddressForm.tsx` - NEW: Reusable address form
4. `src/lib/usStates.ts` - NEW: US states list

## Documentation Files

- `SHIPPING_ADDRESS_LOCK.md` - Problem explanation and solution design
- `SHIPPING_ADDRESS_IMPLEMENTATION.md` - This file (implementation summary)

## Next Steps

### Required Before Going Live:
- [x] Implement full address collection on cart page
- [x] Update checkout API to lock shipping address
- [ ] **Test in Stripe test mode** (use test credit card)
- [ ] **Verify address cannot be changed** in Stripe Checkout UI
- [ ] **Test with different states** (AZ, CA, NY, etc.) to verify rates
- [ ] **Update CLAUDE.md** with new shipping address flow

### Future Enhancements (Optional):
- [ ] Add address autocomplete (Google Places API)
- [ ] Add address validation (USPS Address Validation API)
- [ ] Store customer addresses for faster checkout
- [ ] Pre-fill address for logged-in users

## Important Notes

### Stripe Test Mode:
Test this thoroughly in Stripe test mode before going live. Use test credit card:
- Number: `4242 4242 4242 4242`
- Expiry: Any future date
- CVC: Any 3 digits

### ShipStation V2 API:
The shipping rates are now calculated using ShipStation V2 API with:
- Real delivery_days data (not guessing from service names)
- Package type filtering (only boxes, no envelopes)
- Service filtering (excludes Media Mail, includes Ground/Priority/Express)
- Carrier filtering (only USPS, UPS, FedEx)

### Free Shipping:
Orders over $100 still get free shipping, but customers must still enter their address (for order fulfillment).

## Troubleshooting

### If rates aren't showing:
1. Check ShipStation V2 API key is set in `.env.local`
2. Check from/to addresses are valid
3. Check console logs for API errors
4. Verify carriers are configured in ShipStation account

### If address isn't locked in Stripe:
1. Verify `shippingAddress` is being passed to checkout API
2. Check `shipping_details` is being set in Stripe session
3. Verify you're not also setting `shipping_address_collection`

### If validation is too strict:
- Address Line 2 is optional
- All other fields are required
- ZIP must be exactly 5 digits
- State must be selected from dropdown
