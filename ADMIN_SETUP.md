# Admin User System Setup Guide

## Overview

The admin system now uses **email/password authentication** with **mandatory 2FA** (Two-Factor Authentication) for all admin users. Admin accounts are completely separate from customer accounts.

## Key Features

- ✅ Email/password authentication (no more single shared password)
- ✅ **Mandatory 2FA** for all admin users (not optional)
- ✅ Role-based access: `admin` and `super_admin`
- ✅ Super admins can create and manage other admin users
- ✅ Activity logging tracks which admin performed each action
- ✅ Secure password hashing with bcrypt
- ✅ Backup codes for 2FA recovery

## Creating the First Super Admin

### Method 1: Via API (Recommended)

1. Make a POST request to `/api/admin/users`:

```bash
curl -X POST http://localhost:3000/api/admin/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "your-secure-password-min-12-chars",
    "role": "super_admin"
  }'
```

2. The API will return:
   - User details
   - 2FA QR code (base64 data URL)
   - 2FA secret (for manual entry)
   - 10 backup codes

3. **IMPORTANT**: Save the backup codes in a secure password manager!

4. Scan the QR code with an authenticator app:
   - Google Authenticator
   - Authy
   - Microsoft Authenticator
   - 1Password
   - Any TOTP-compatible app

### Method 2: Via Admin UI

1. Navigate to `/admin/users`
2. Click "Create First Admin" (this button only appears when no super admin exists)
3. Fill in the email and password
4. Save the 2FA QR code and backup codes

## Admin Roles

### Super Admin (`super_admin`)
- Can create other admin users
- Can deactivate/reactivate admin users
- Can reset passwords for other admins
- Can regenerate 2FA for other admins
- Has access to all admin functions

### Admin (`admin`)
- Can access all admin tools (products, orders, analytics, etc.)
- Cannot manage other admin users
- Must use 2FA like all other admins

## Login Process

1. Go to `/admin/login`
2. Enter your **email** and **password**
3. Enter your **2FA code** from your authenticator app
4. If you lost your authenticator, use one of your backup codes

## Managing Admin Users (Super Admin Only)

Navigate to `/admin/users` to:
- View all admin users
- Create new admin users
- Deactivate users (soft delete)
- Regenerate 2FA codes (if user lost their device)
- Change passwords

## Security Features

### Password Requirements
- Minimum 12 characters
- Hashed with bcrypt (cost factor 12)
- Timing-safe comparison to prevent timing attacks

### 2FA Requirements
- **Mandatory** for all admin users
- TOTP-based (Time-based One-Time Password)
- 30-second validity window
- 10 backup codes provided (one-time use)

### Rate Limiting
- Login attempts are rate-limited per IP
- Failed login attempts trigger delays
- All login attempts are logged

### Session Security
- UUID-based session tokens
- Stored in Redis with configurable TTL
- HTTP-only cookies
- Secure flag enabled
- SameSite: Lax

## Activity Logging

All admin actions are logged with:
- Admin email (who performed the action)
- IP address
- User agent
- Timestamp
- Action details
- Success/failure status

View logs at `/admin/activity-logs`

## Migration from Old System

The old system used a single `ADMIN_PASSWORD` environment variable. This is **no longer used**.

### Steps to migrate:

1. Create your first super admin user (see above)
2. Remove `ADMIN_PASSWORD` from your environment variables (optional, it's ignored now)
3. All admin team members should log in with their individual accounts
4. Create separate accounts for each admin team member

## Environment Variables

### Required
- `KV_REST_API_URL` - Vercel KV (Redis) URL
- `KV_REST_API_TOKEN` - Vercel KV token
- `ADMIN_SESSION_TTL_SECONDS` - Session timeout (default: 604800 = 7 days)

### No Longer Used
- `ADMIN_PASSWORD` - Replaced by individual user accounts

## Troubleshooting

### I lost my 2FA device
1. Ask a super admin to regenerate your 2FA
2. They can do this at `/admin/users`
3. You'll receive a new QR code and backup codes

### I used all my backup codes
1. Ask a super admin to regenerate your 2FA
2. You'll receive 10 new backup codes

### I forgot my password
1. Ask a super admin to reset your password
2. They can set a temporary password for you
3. Change it after logging in

### No super admin exists
If all super admins are locked out, you can create a new one by making an unauthenticated POST request to `/api/admin/users`. The API allows first-time setup without authentication.

## Best Practices

1. **Use a password manager** for strong, unique passwords
2. **Save backup codes** in a secure location (encrypted password manager)
3. **Don't share accounts** - create separate accounts for each team member
4. **Review activity logs regularly** to detect unauthorized access
5. **Deactivate accounts** when team members leave
6. **Use super_admin sparingly** - only give this role to trusted administrators

## API Endpoints

### Public Endpoints (no auth required for first setup)
- `POST /api/admin/users` - Create first super admin (auto-detects if setup needed)

### Super Admin Only
- `GET /api/admin/users` - List all admin users
- `POST /api/admin/users` - Create new admin user
- `PATCH /api/admin/users/:userId` - Update admin user (deactivate, password reset, 2FA reset)
- `DELETE /api/admin/users/:userId` - Permanently delete admin user

### All Admins
- `POST /api/admin/login` - Login with email/password/2FA
- `POST /api/admin/logout` - Logout
- All other `/api/admin/*` endpoints
