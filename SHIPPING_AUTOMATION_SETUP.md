# USPS Shipping Automation Setup Guide

## Overview

Your Desert Candle Works website now has **automatic delivery confirmation emails**! Here's how it works:

### Current Setup (No Configuration Needed)

1. **When you ship**: Enter tracking number → Click "Mark as Shipped" → Customer gets shipping email ✅
2. **Automatic delivery detection**: System checks USPS every 6 hours and auto-sends delivery emails when packages arrive ✅
3. **Manual check option**: Click "Check All Deliveries" button to check immediately ✅

## How It Works

### Automated Cron Job (Every 6 Hours)
- **URL**: `https://desertcandleworks.com/api/cron/check-deliveries`
- **Schedule**: Every 6 hours (configured in `vercel.json`)
- **What it does**:
  1. Gets all orders with status "shipped"
  2. Checks USPS tracking for each one
  3. If delivered, updates order status and sends delivery email
  4. Logs all activity

### Manual Trigger
- **Button**: "🔄 Check All Deliveries" in Admin Orders page
- **Use when**: You want to immediately check for deliveries instead of waiting for the cron job
- **Shows**: Detailed results of what was checked and delivered

## Files Created

1. **`/src/lib/uspsTracking.ts`** - USPS tracking check utility
2. **`/src/app/api/cron/check-deliveries/route.ts`** - Automated cron job
3. **`/src/app/api/admin/check-deliveries/route.ts`** - Manual admin trigger
4. **`vercel.json`** - Cron job configuration

## Limitations & Future Improvements

### Current Approach (Web Scraping)
- ✅ **Works immediately** - No API setup required
- ✅ **Free** - No additional costs
- ⚠️ **Rate limited** - Checks every 6 hours to avoid blocking
- ⚠️ **Not 100% reliable** - USPS may change their page format

### Recommended Upgrade: USPS Web Tools API

For better reliability, consider upgrading to the official USPS API:

#### Setup Steps:
1. **Register**: Go to https://www.usps.com/business/web-tools-apis/
2. **Get API Key**: Request a USPS User ID
3. **Add to Environment**:
   ```env
   USPS_USER_ID=your_user_id_here
   ```
4. **Enable**: Uncomment the `checkDeliveryStatusWithAPI()` function in `/src/lib/uspsTracking.ts`

#### Benefits:
- ✅ More reliable
- ✅ Structured XML responses
- ✅ Official USPS support
- ✅ Better rate limits

## Security

### Cron Secret (Optional)
To prevent unauthorized access to the cron endpoint, add a secret:

1. Add to `.env`:
   ```env
   CRON_SECRET=your_random_secret_here
   ```

2. Configure in Vercel:
   - Go to Vercel Dashboard → Settings → Environment Variables
   - Add `CRON_SECRET` with your secret value

3. Vercel will automatically send this in the `Authorization` header

## Testing

### Test the Cron Job Locally
```bash
# Start dev server
npm run dev

# In another terminal, trigger the cron job
curl http://localhost:3000/api/cron/check-deliveries
```

### Test the Manual Check
1. Go to Admin → Orders
2. Click "🔄 Check All Deliveries"
3. See results popup

## Monitoring

Check logs in Vercel Dashboard:
- **Vercel Dashboard** → Your Project → Functions
- Filter by `/api/cron/check-deliveries`
- See execution logs, errors, and results

## Workflow Summary

```
📦 You Ship Order
    ↓
Enter tracking # in admin
    ↓
Click "Mark as Shipped"
    ↓
✅ Customer gets shipping email (immediate)
    ↓
System checks USPS every 6 hours
    ↓
When delivered detected:
    ↓
✅ Customer gets delivery email (automatic)
    ↓
✅ Order status updated to "delivered"
```

## Common Questions

**Q: What if I want to check deliveries right now?**
A: Click "🔄 Check All Deliveries" button in Admin Orders page

**Q: Will this work for all carriers?**
A: Currently only USPS. For FedEx/UPS, you'd need their APIs

**Q: What if USPS tracking is delayed?**
A: The cron runs every 6 hours. Manual check button available anytime.

**Q: Can I change the check frequency?**
A: Yes! Edit `vercel.json` and change the schedule:
- Every 4 hours: `"schedule": "0 */4 * * *"`
- Every 12 hours: `"schedule": "0 */12 * * *"`
- Daily at noon: `"schedule": "0 12 * * *"`

## Support

If you have issues:
1. Check Vercel function logs
2. Try manual check button to see detailed errors
3. Verify tracking numbers are valid USPS format
