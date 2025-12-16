# Instagram Basic Display API Setup Guide

This guide will help you set up the Instagram Basic Display API to display your latest Instagram posts on the homepage.

## Prerequisites
- An Instagram account (business or creator account recommended)
- A Facebook Developer account

## Step-by-Step Setup

### 1. Create a Facebook App

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Click "My Apps" → "Create App"
3. Select "Consumer" as the app type
4. Fill in your app details:
   - **App Name**: Desert Candle Works Website
   - **App Contact Email**: Your email
5. Click "Create App"

### 2. Add Instagram Basic Display Product

1. In your app dashboard, scroll to "Add Products"
2. Find "Instagram Basic Display" and click "Set Up"
3. Click "Create New App" in the Instagram Basic Display settings
4. Accept the terms and conditions

### 3. Configure Basic Display Settings

1. In the "Basic Display" tab, scroll to "User Token Generator"
2. Click "Add or Remove Instagram Testers"
3. Add your Instagram account as a tester
4. Go to your Instagram account and accept the tester invitation:
   - Settings → Apps and Websites → Tester Invites

### 4. Generate Access Token

1. Back in the Facebook Developer dashboard
2. Go to Instagram Basic Display → Basic Display
3. Scroll to "User Token Generator"
4. Click "Generate Token" next to your Instagram account
5. Log in to Instagram and authorize the app
6. Copy the generated **Access Token**

### 5. Add Token to Your Environment

Add the access token to your `.env` file:

```bash
INSTAGRAM_ACCESS_TOKEN="your_access_token_here"
```

**Important**: Also add this to your Vercel environment variables:
1. Go to your Vercel project dashboard
2. Settings → Environment Variables
3. Add `INSTAGRAM_ACCESS_TOKEN` with your token

### 6. Test the Integration

1. Restart your development server: `npm run dev`
2. Visit your homepage
3. Scroll down to the Instagram section
4. You should see your 4 most recent Instagram image posts

## Token Expiration

- **Short-lived tokens** expire after 1 hour
- **Long-lived tokens** expire after 60 days
- You'll need to refresh your token periodically

### Get a Long-Lived Token

To get a 60-day token, make this API call:

```bash
curl -i -X GET "https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=YOUR_SHORT_LIVED_TOKEN"
```

Or use this URL in your browser:
```
https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=YOUR_APP_SECRET&access_token=YOUR_SHORT_LIVED_TOKEN
```

Replace:
- `YOUR_APP_SECRET` with your Facebook App Secret (found in App Settings → Basic)
- `YOUR_SHORT_LIVED_TOKEN` with the token you generated

## Troubleshooting

### No posts showing up
- Check that your access token is valid
- Make sure you have at least 4 image posts (videos and carousels are filtered out)
- Check browser console for errors
- Verify the API endpoint is working: visit `/api/instagram` directly

### "Instagram access token not configured" error
- Ensure `INSTAGRAM_ACCESS_TOKEN` is in your `.env` file
- Restart your development server after adding the variable
- For production, ensure it's added to Vercel environment variables

### Posts not updating
- The API caches results for 1 hour
- To see new posts immediately, clear the cache or wait 1 hour
- In development, you can disable caching in `src/app/api/instagram/route.ts`

## API Details

- **Endpoint**: `/api/instagram`
- **Cache Duration**: 1 hour (3600 seconds)
- **Posts Fetched**: 4 most recent IMAGE posts
- **Fallback**: Shows placeholder squares if no posts are available

## Files Modified

- `src/app/api/instagram/route.ts` - API endpoint to fetch Instagram data
- `src/components/HomeContent.tsx` - Homepage component with Instagram section
- `.env` - Added `INSTAGRAM_ACCESS_TOKEN`

## Resources

- [Instagram Basic Display API Documentation](https://developers.facebook.com/docs/instagram-basic-display-api)
- [Access Token Management](https://developers.facebook.com/docs/instagram-basic-display-api/overview#instagram-user-access-tokens)
- [Refreshing Tokens](https://developers.facebook.com/docs/instagram-basic-display-api/guides/long-lived-access-tokens)
