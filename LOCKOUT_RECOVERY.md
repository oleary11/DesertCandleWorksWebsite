# Rate Limit Lockout Recovery Guide

If you get locked out due to too many failed login attempts (5 attempts in 15 minutes), here are your options:

## Option 1: Wait it Out ⏰
**Easiest option**
- The lockout automatically expires after 15 minutes
- No action required, just come back later

## Option 2: Emergency Reset (Production) 🚨
**For production/Vercel deployments**

### Setup (one-time):
1. Generate a secure token:
   ```bash
   openssl rand -hex 32
   # or use: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. Add to Vercel environment variables:
   - Go to your project on Vercel Dashboard
   - Settings → Environment Variables
   - Add: `EMERGENCY_RESET_TOKEN` = `your-generated-token`
   - Redeploy your site

### Usage when locked out:
```bash
curl -X POST https://your-domain.com/api/emergency-reset \
  -H "Content-Type: application/json" \
  -d '{"token":"YOUR_EMERGENCY_RESET_TOKEN"}'
```

Response:
```json
{
  "success": true,
  "message": "Rate limit reset for IP: x.x.x.x",
  "note": "You can now try logging in again"
}
```

## Option 3: Restart Dev Server (Development Only) 🔄
**Only works in local development**

If Redis is not configured, rate limits fall back to in-memory storage:

```bash
# Stop the server (Ctrl+C)
npm run dev
```

The in-memory rate limit map will be cleared.

## Option 4: Admin Reset (If Already Logged In) 👤
**Only works if you have an active admin session**

If you're locked out on one device but still logged in on another:

```bash
curl -X POST https://your-domain.com/api/admin/reset-rate-limit \
  -H "Content-Type: application/json" \
  -H "Cookie: admin_session=YOUR_SESSION_TOKEN" \
  -d '{"ip":"the.locked.out.ip"}'
```

## How Rate Limiting Works

- **5 failed attempts** per IP address triggers lockout
- **15 minutes** lockout duration
- Stored in **Redis** (persists across server restarts)
- Falls back to **in-memory** if Redis unavailable
- **Automatic reset** on successful login

## Prevention Tips

1. **Enable 2FA** - Go to Admin → Settings → Two-Factor Authentication
2. **Save your backup codes** - Each code can be used once if you lose your phone
3. **Use a password manager** - Avoid typos
4. **Test in development first** - Try the login flow before deploying
5. **Bookmark this guide** - For quick reference if locked out

## Checking Your Current Status

The rate limit data is stored in Redis with the key pattern:
```
rate_limit:login:{your.ip.address}
```

If you have Redis CLI access:
```bash
# Check if you're rate limited
redis-cli GET "rate_limit:login:YOUR_IP"

# Check time until reset
redis-cli TTL "rate_limit:login:YOUR_IP"

# Manually reset (requires Redis access)
redis-cli DEL "rate_limit:login:YOUR_IP"
```

## Need More Help?

See also:
- `SECURITY.md` - Complete security documentation
- `2FA_SETUP_GUIDE.md` - Two-factor authentication setup
