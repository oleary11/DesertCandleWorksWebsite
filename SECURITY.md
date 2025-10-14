# Security Assessment & Fixes

## Critical Vulnerabilities Fixed ✅

### 1. Admin Authentication Bypass (CRITICAL)
**Previous Issue:**
- Middleware checked for simple cookie `dcw_admin=1`
- Anyone could set this cookie in browser DevTools and gain admin access
- Session system existed but wasn't used by middleware

**Fix Applied:**
- Middleware now validates UUID session tokens stored in Redis
- Proper session verification on every admin request
- File: `src/middleware.ts`

### 2. No Rate Limiting (HIGH)
**Previous Issue:**
- Unlimited login attempts possible
- Vulnerable to brute force attacks

**Fix Applied:**
- 5 attempts per IP address
- 15-minute lockout after failed attempts
- Automatic reset on successful login
- File: `src/app/api/admin/login/route.ts`

### 3. Timing Attack Vulnerability (MEDIUM)
**Previous Issue:**
- Simple string comparison for passwords
- Could leak password length through timing analysis

**Fix Applied:**
- `timingSafeEqual()` with constant-time comparison
- Padded buffers to prevent length leaks
- 1-second delay on failed attempts
- File: `src/app/api/admin/login/route.ts`

## Current Security Features ✅

### Authentication & Sessions
- ✅ UUID-based session tokens (crypto.randomUUID)
- ✅ Sessions stored in Redis with TTL (7 days default)
- ✅ HttpOnly cookies (prevents XSS)
- ✅ Secure flag (HTTPS only)
- ✅ SameSite=lax (CSRF protection)
- ✅ Rate limiting on login endpoint
- ✅ **2FA with TOTP** (Time-based One-Time Passwords)
- ✅ **Backup codes** (10 per setup, single-use)
- ✅ **Admin activity logging** (all logins tracked)
- ✅ **Session rotation** (new token on each login)

### Data Protection
- ✅ Environment variables not committed (.env* in .gitignore)
- ✅ Stripe webhook signature verification
- ✅ Password stored only in environment (not code)
- ✅ Timing-safe password comparison

### API Security
- ✅ Middleware protects all /admin/* and /api/admin/* routes
- ✅ Proper session validation on every request
- ✅ Webhook signature verification prevents fake orders

## Emergency Access

### If You Get Locked Out

If you exceed the rate limit (5 failed login attempts), you have several options:

1. **Wait 15 minutes** - The lockout automatically expires
2. **Use the emergency reset endpoint** (recommended for production):
   ```bash
   curl -X POST https://your-domain.com/api/emergency-reset \
     -H "Content-Type: application/json" \
     -d '{"token":"YOUR_EMERGENCY_RESET_TOKEN"}'
   ```
   Set `EMERGENCY_RESET_TOKEN` in your environment variables (Vercel dashboard)

3. **Restart the server** (development only) - Clears in-memory fallback

### Setting Up Emergency Reset Token

Add to your `.env` or Vercel environment variables:
```
EMERGENCY_RESET_TOKEN=a-long-random-secure-token-here
```

Generate a secure token:
```bash
openssl rand -hex 32
```

## Remaining Recommendations

### HIGH Priority
1. **Use a Strong Admin Password**
   - Minimum 16 characters
   - Mix of uppercase, lowercase, numbers, symbols
   - Never reuse passwords from other services
   - Consider using a password manager

2. **Enable 2FA** ✅ FULLY IMPLEMENTED
   - TOTP (Time-based One-Time Password) with full UI
   - Access via Admin → Settings → Two-Factor Authentication
   - QR code scanning with authenticator apps
   - Manual entry option available
   - Verification step during setup
   - 10 backup codes generated per setup (copy/download)
   - Enable/disable via Settings page
   - See `2FA_SETUP_GUIDE.md` for step-by-step instructions

3. **Redis-based Rate Limiting** ✅ IMPLEMENTED
   - Uses Redis for persistent rate limiting across server restarts
   - Falls back to in-memory if Redis unavailable
   - 5 attempts per IP address
   - 15-minute lockout period
   - Automatic reset on successful login
   - Emergency reset endpoint: `/api/emergency-reset` (requires EMERGENCY_RESET_TOKEN)

### MEDIUM Priority
4. **Add Security Headers**
   - Content-Security-Policy
   - X-Frame-Options: DENY
   - X-Content-Type-Options: nosniff
   - Referrer-Policy: strict-origin-when-cross-origin
   - Add in `next.config.ts` headers

5. **Add Admin Activity Logging** ✅ IMPLEMENTED
   - All admin logins logged (successful and failed)
   - Timestamps, IP addresses, user agents tracked
   - Login attempt details (reason for failure)
   - 2FA usage tracked
   - Stored in Redis lists (last 1000 events)
   - View logs via `/api/admin/logs`

6. **Add CAPTCHA to Login**
   - Prevents automated attacks
   - Use hCaptcha or reCAPTCHA
   - Only show after 2-3 failed attempts

7. **Session Rotation** ✅ IMPLEMENTED
   - New session token generated after each successful login
   - Old session destroyed automatically
   - Prevents session fixation attacks
   - Implemented in `/api/admin/login`

### LOW Priority
8. **Add IP Whitelisting (Optional)**
   - Restrict admin access to known IPs
   - Good for home/office static IPs
   - Store allowed IPs in environment variables

9. **Add Email Alerts**
   - Send email on admin login
   - Alert on multiple failed attempts
   - Use services like SendGrid or Resend

10. **Security Audit Logging**
    - Log all sensitive operations
    - Track who changed what and when
    - Store in separate audit log table

## Security Best Practices

### DO's ✅
- Keep dependencies updated (`npm audit` regularly)
- Use environment variables for secrets
- Validate all user inputs
- Use HTTPS only (Vercel handles this)
- Review Vercel deployment logs
- Keep admin password secure

### DON'Ts ❌
- Never commit `.env` files
- Never share admin password in plain text
- Never disable HTTPS/secure cookies
- Never trust client-side validation alone
- Never log sensitive data (passwords, tokens)
- Never use admin password on other sites

## Monitoring & Maintenance

### Regular Checks
- [ ] Review Vercel logs weekly for suspicious activity
- [ ] Run `npm audit` monthly
- [ ] Update dependencies quarterly
- [ ] Test admin login flow after updates
- [ ] Verify Stripe webhook still works
- [ ] Check Redis TTL settings

### Incident Response
If you suspect a security breach:
1. Immediately change `ADMIN_PASSWORD` in Vercel env vars
2. Clear all Redis sessions: Delete all `admin:session:*` keys
3. Review Vercel logs for suspicious activity
4. Check Stripe dashboard for unauthorized transactions
5. Update this document with lessons learned

## Technical Details

### Session Flow
```
1. User submits password → /api/admin/login
2. Rate limit check (5 attempts per IP)
3. Timing-safe password comparison
4. Generate UUID token with crypto.randomUUID()
5. Store in Redis: admin:session:{token} = "1" (TTL: 7 days)
6. Set HttpOnly cookie: admin_session={token}
7. Middleware validates token on every admin request
8. Redis lookup: admin:session:{token} exists?
9. Allow access if valid, redirect to login if not
```

### Rate Limiting
```
IP Address → Map<IP, {count: number, resetAt: timestamp}>
- Max 5 attempts
- 15-minute lockout
- Resets on success
- In-memory (resets on server restart)
```

### Password Security
```
1. Convert to buffers
2. Pad to same length
3. timingSafeEqual() comparison
4. Check original lengths match
5. 1-second delay on failure
```

## Questions?

- Review Vercel security docs: https://vercel.com/docs/security
- Review Next.js security: https://nextjs.org/docs/app/building-your-application/configuring/security-headers
- Report security issues: Create private issue on GitHub
