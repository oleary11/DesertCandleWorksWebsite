# Anti-Honey Browser Extension Protection

This document explains how Desert Candle Works protects promotional codes from browser extensions like Honey, Capital One Shopping, and other coupon scrapers.

## The Problem

Browser extensions like Honey:
1. **Auto-apply codes** at checkout by detecting promo code fields
2. **Scrape codes** from their crowdsourced database
3. **Share codes publicly** that were meant for specific audiences (e.g., Instagram followers)
4. **Test multiple codes** to find the best discount
5. **Undermine targeted marketing** by applying codes to random shoppers

This can hurt small businesses by:
- Applying codes meant for specific campaigns to unauthorized shoppers
- Exhausting limited-use promotional budgets
- Reducing profit margins unexpectedly
- Making targeted marketing ineffective

## Our Solution: The 90/10 Approach

We use a **simple, effective** strategy focused on what actually works:

### 1. **Disable Stripe's Promo Field** (90% of the solution)

The primary defense: **Remove the field Honey targets**.

```typescript
// src/app/api/checkout/route.ts
const sessionParams = {
  ...baseParams,
  allow_promotion_codes: false, // ← No promo field at Stripe = Honey can't auto-apply
};
```

**Why this works:**
- Honey primarily targets Stripe's hosted checkout page
- No promo field = nothing for Honey to detect or manipulate
- Users must enter codes on YOUR site where you have control
- This alone blocks 90% of the problem

### 2. **Server-Side Rate Limiting** (10% of the solution)

Prevent brute-force code testing on your site:

```typescript
// src/app/api/validate-promo/route.ts
// IP-based: Max 5 attempts per hour
// Session-based: Max 3 attempts per hour
// Rapid-fire detection: >3 attempts in 10 seconds = blocked for 1 hour
```

**Why this matters:**
- Prevents automated testing of hundreds of codes
- Limits legitimate abuse (someone manually trying many codes)
- Detects bot-like behavior patterns
- Enforces reasonable usage limits

### 3. **Simple Promo Field on Your Site**

A normal, straightforward input field - no tricks needed:

```typescript
// src/components/PromoCodeField.tsx
<input
  name="promo"           // ← Normal field name
  placeholder="Promo code"
  // Security is server-side, not in the HTML
/>
```

**No obfuscation needed** because:
- The real security is server-side rate limiting
- Stripe has no promo field (primary defense)
- Complexity doesn't add meaningful security

## How It Works: Step-by-Step

```
1. User adds items to cart
   ↓
2. User enters promo code in CartDrawer
   (Simple <input name="promo" /> field)
   ↓
3. POST /api/validate-promo
   • Rate limiting checks (5/hour per IP, 3/hour per session)
   • Rapid-fire detection (>3 in 10 sec = blocked)
   • Server-side validation (maxRedemptions, expiration, etc.)
   ↓
4. If valid: discount calculated and stored
   ↓
5. POST /api/checkout
   • Stripe session created with discount already applied
   • allow_promotion_codes: false ← KEY: No promo field at Stripe
   ↓
6. User sent to Stripe Checkout
   • Discount already applied
   • No promo code field visible
   • Honey finds nothing to target ✅
```

## What This Prevents

| Attack Vector | Our Protection | Result |
|--------------|----------------|---------|
| Honey auto-applying codes at Stripe checkout | `allow_promotion_codes: false` | ✅ **BLOCKED** - No field exists |
| Rapid automated code testing | Rate limiting (3-5/hour) | ✅ **BLOCKED** - Bot behavior detected |
| Brute-force guessing codes | Rate limiting + complex codes | ✅ **BLOCKED** - Limited attempts |
| Exceeding usage limits | Server-side `maxRedemptions` | ✅ **ENFORCED** - Hard limits |

## What This Doesn't Prevent (And That's OK)

| Scenario | Our Response | Why It's OK |
|----------|-------------|-------------|
| Users sharing codes with friends | No prevention | Normal commerce behavior |
| Honey scraping codes from your site | No prevention | Doesn't matter - they can't auto-apply |
| Codes appearing in Google search | No prevention | Public promotions are meant to be found |
| Someone manually trying 3 codes | No prevention | Reasonable user behavior |

**The key insight:** It doesn't matter if Honey **knows** the code. What matters is whether Honey can **auto-apply** it. Since there's no promo field at Stripe, Honey is useless.

## Implementation Details

### Files Created/Modified

1. **`src/components/PromoCodeField.tsx`** (NEW)
   - Simple promo code input with validation
   - Calls `/api/validate-promo` on submit
   - Shows applied discount or error messages

2. **`src/app/api/validate-promo/route.ts`** (NEW)
   - Server-side validation endpoint
   - IP/session rate limiting via Redis
   - Rapid-fire detection and blocking
   - Returns promotion details if valid

3. **`src/components/CartDrawer.tsx`** (MODIFIED)
   - Integrated `PromoCodeField` component
   - Displays discount when applied
   - Passes `promotionId` to checkout API

4. **`src/app/api/checkout/route.ts`** (MODIFIED)
   - Set `allow_promotion_codes: false`
   - Applies pre-validated discount to Stripe session
   - No promo field visible at Stripe checkout

5. **`src/lib/promotionsStore.ts`** (EXISTING)
   - Already had `getPromotionByCode()` function
   - No changes needed

6. **`src/lib/promotionValidator.ts`** (EXISTING)
   - Server-side validation logic
   - Checks expiration, limits, targeting, etc.
   - No changes needed

### Rate Limiting Configuration (Redis/Vercel KV)

```typescript
// IP-based limiting
Key: `promo:attempts:ip:{ip_address}`
Limit: 5 attempts per hour
TTL: 3600 seconds

// Session-based limiting
Key: `promo:attempts:session:{session_id}`
Limit: 3 attempts per hour
TTL: 3600 seconds

// Rapid-fire detection
Key: `promo:rapid:{session_id}`
Stores: Last 60 seconds of attempts
Limit: 3 attempts in 10 seconds
Action: Block session for 1 hour

// Blocked sessions
Key: `promo:blocked:{session_id}`
Duration: 3600 seconds (1 hour)
```

## Creating Effective Promotional Codes

### Best Practices for Instagram/Social Campaigns

1. **Use complex, random codes** (prevents guessing):
   ```
   ✅ INSTA-X7K9M2 (random, hard to guess)
   ❌ INSTAGRAM25 (predictable, easy to guess)
   ```

2. **Set reasonable usage limits**:
   ```typescript
   {
     maxRedemptions: 100,              // Total uses
     maxRedemptionsPerCustomer: 1,     // Per customer
   }
   ```

3. **Use time windows** (prevents long-term sharing):
   ```typescript
   {
     startsAt: "2026-01-10T00:00:00Z",
     expiresAt: "2026-01-17T23:59:59Z",  // 1 week campaign
   }
   ```

4. **Consider user targeting**:
   ```typescript
   {
     userTargeting: "first_time",      // New customers only
     // OR
     minOrderAmountCents: 5000,        // $50 minimum order
   }
   ```

### Example: Instagram Follower Campaign

```typescript
{
  code: "INSTA-K7X9M",
  type: "percentage",
  discountPercent: 25,
  maxRedemptions: 100,
  maxRedemptionsPerCustomer: 1,
  minOrderAmountCents: 3000,         // $30 minimum
  startsAt: "2026-01-15T00:00:00Z",
  expiresAt: "2026-01-22T23:59:59Z",
  active: true
}
```

**Result:**
- Only 100 total uses
- 1 use per customer
- Requires $30+ order
- Expires in 1 week
- Even if Honey scrapes it, they can't auto-apply at Stripe
- Random code prevents guessing

## Monitoring and Alerts

### Check for Suspicious Activity

Using Redis CLI or Vercel KV dashboard:

```bash
# List all blocked sessions
KEYS promo:blocked:*

# Check IP attempt count
GET promo:attempts:ip:192.168.1.1

# View rapid-fire attempt log
LRANGE promo:rapid:abc123-session-id 0 -1

# Clear a blocked session (if needed)
DEL promo:blocked:abc123-session-id
```

### Expected Behavior

**Normal user:**
- 1-2 attempts to enter code correctly
- 1-5 second delay between attempts (typing)
- IP and session match

**Suspicious/bot behavior:**
- 3+ attempts in <10 seconds
- Rapid-fire testing of multiple codes
- Same IP with many different sessions

## Testing the Protection

### Manual Test: Verify Stripe Has No Promo Field

1. Add items to cart
2. Enter a valid promo code in cart drawer
3. Click "Checkout"
4. **Expected:** Stripe checkout page has **no** "Add promotion code" link/field
5. **Expected:** Discount is already applied to the total

### Test Rate Limiting

1. Open cart drawer
2. Try entering 4 invalid codes rapidly
3. **Expected:** After 3 attempts, you get "Too many attempts" error
4. Wait 1 hour OR clear Redis key to reset

### Test with Honey Extension

1. Install Honey browser extension
2. Add items to cart
3. Proceed to Stripe checkout
4. **Expected:** Honey shows "No coupons found" (because there's no field to detect)

## Why This Approach Works

### The Core Principle

**Security in depth, focused on what matters:**

1. **Primary defense (90%)**: Remove Honey's target (`allow_promotion_codes: false`)
2. **Secondary defense (10%)**: Rate limiting prevents abuse on your site
3. **No security theater**: Simple code, maintainable, effective

### What We Don't Do (And Why)

❌ **Field name obfuscation** - Doesn't prevent scraping, adds complexity
❌ **Behavioral detection** - Can be bypassed, maintenance burden
❌ **Client-side validation** - Unreliable, not real security
❌ **DOM mutation observers** - Security theater, false sense of protection

✅ **Instead**: Simple server-side rate limiting + no Stripe promo field = effective protection

## Comparison: Before vs. After

### Before (Vulnerable to Honey)

```
User checks out
  ↓
Stripe shows promo field (allow_promotion_codes: true)
  ↓
Honey detects field
  ↓
Honey auto-applies scraped codes (INSTAGRAM25, WELCOME20, etc.)
  ↓
Random shopper gets discount meant for Instagram followers ❌
```

### After (Protected)

```
User checks out
  ↓
Must enter code on your site (CartDrawer)
  ↓
Rate limited: Max 3-5 attempts per hour
  ↓
If valid: discount applied, sent to Stripe
  ↓
Stripe shows NO promo field (allow_promotion_codes: false)
  ↓
Honey finds nothing to target ✅
Only intended users (who saw your code) get discount ✅
```

## Advanced: Optional Future Enhancements

These are **not implemented** but could add additional protection if needed:

### 1. Link-Based Discounts (Zero-Code Approach)

Instead of sharing codes, share unique URLs:

```typescript
// https://desertcandleworks.com/promo/abc123xyz
// Auto-applies discount via cookie/session
// No code to scrape or share
// Track exact source (Instagram, email, etc.)
```

**Pros:**
- No code for Honey to scrape
- Better attribution tracking
- Cleaner user experience

**Cons:**
- Different UX (users might expect codes)
- Requires additional implementation

### 2. CAPTCHA for Repeated Failures

```typescript
if (ipAttempts > 5) {
  return { requiresCaptcha: true };
  // Show reCAPTCHA before allowing more attempts
}
```

### 3. Device Fingerprinting

```typescript
import FingerprintJS from '@fingerprintjs/fingerprintjs';
// Track users across sessions/browsers
// More accurate than session/IP alone
```

### 4. Geographic Restrictions

```typescript
if (promotion.allowedCountries && !promotion.allowedCountries.includes(userCountry)) {
  return { error: "Not available in your region" };
}
```

**Note:** These are **overkill** for most use cases. The current implementation (Stripe field removal + rate limiting) is sufficient.

## Summary: What You Get

✅ **Honey can't auto-apply codes** at Stripe checkout
✅ **Rate limiting prevents brute-force** code testing
✅ **Simple, maintainable code** (no obfuscation complexity)
✅ **Targeted codes reach intended audiences** (Instagram followers manually enter)
✅ **Usage limits enforced** (`maxRedemptions`, per-customer limits)
✅ **Reasonable user experience** (legitimate users not blocked)

**Bottom line:** Honey knows your codes exist but can't do anything with them. Mission accomplished.

## Support and Troubleshooting

### Common Issues

**Issue:** "Rate limit hit too quickly"
**Solution:** Adjust limits in `/api/validate-promo/route.ts` (currently 5/hour IP, 3/hour session)

**Issue:** "Legitimate user blocked"
**Solution:** Clear their session in Redis: `DEL promo:blocked:{session_id}`

**Issue:** "Want to allow more attempts"
**Solution:** Increase rate limits or extend time windows in validation endpoint

**Issue:** "Code not working at checkout"
**Solution:** Check that promotion is active, not expired, and meets all validation criteria in `promotionValidator.ts`

### Getting Help

- Check Redis logs for rate limiting details
- Review server logs for validation errors
- Test with known-good promo codes first
- Verify Stripe session creation includes discount
