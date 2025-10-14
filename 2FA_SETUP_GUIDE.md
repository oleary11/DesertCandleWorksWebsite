# 2FA Setup Guide

## How to Enable Two-Factor Authentication

### Step 1: Log into Admin Panel
1. Navigate to `/admin` and log in with your password
2. You'll see your admin dashboard

### Step 2: Navigate to Settings
1. Click the "Settings" button in the top navigation
2. Or navigate directly to `/admin/settings`

### Step 3: Enable 2FA
1. Click the "Enable 2FA" button in the Two-Factor Authentication section
2. A QR code will be displayed

### Step 4: Scan QR Code
1. Open your authenticator app (Google Authenticator, Authy, 1Password, etc.)
2. Scan the QR code displayed on the screen
3. Or click "Can't scan? Enter manually" to view the secret key

### Step 5: Verify Setup
1. Enter the 6-digit code from your authenticator app
2. Click "Verify & Enable"
3. If successful, your backup codes will be displayed

### Step 6: Save Backup Codes
**IMPORTANT:** Save the backup codes in a secure location!
- Each code can only be used once
- Use them if you lose access to your authenticator app
- Store them in a password manager or encrypted file

### Step 5: Test Login
1. Log out of the admin panel
2. Log in again - you'll now need to enter:
   - Your password (step 1)
   - Your 6-digit 2FA code (step 2)

## Login Flow with 2FA

### Without 2FA:
```
Password → Logged In
```

### With 2FA Enabled:
```
Password → 2FA Code → Logged In
```

## Using Backup Codes

If you lose your phone or authenticator app:
1. Enter your password as normal
2. When prompted for 2FA code, enter one of your backup codes
3. The backup code will be consumed and can't be used again

## Disabling 2FA

To disable 2FA:

1. Log into the admin panel
2. Navigate to Settings (`/admin/settings`)
3. Click the "Disable 2FA" button
4. Confirm the action

**Warning:** This will delete your 2FA secret and all backup codes!

## Recommended Authenticator Apps

- **Google Authenticator** (iOS/Android) - Simple, reliable
- **Authy** (iOS/Android/Desktop) - Cloud backup, multi-device
- **1Password** (All platforms) - Integrated with password manager
- **Microsoft Authenticator** (iOS/Android) - Good UX
- **Bitwarden** (All platforms) - Open source

## Security Tips

1. **Don't lose your backup codes** - Print them or store encrypted
2. **Use a different device** - Don't keep codes on the same device as your authenticator
3. **Set up 2FA on multiple devices** - Use Authy to sync across devices
4. **Test before relying on it** - Make sure you can log in before logging out
5. **Keep your secret safe** - Never share the QR code or secret with anyone

## Troubleshooting

### "Invalid 2FA code" error
- Check your phone's time is correct (TOTP is time-based)
- Make sure you're looking at the right account in your authenticator
- Try waiting for the next code (they refresh every 30 seconds)
- Use a backup code if all else fails

### Lost access to authenticator
- Use one of your backup codes
- If you lost backup codes too, you'll need server access to disable 2FA directly in Redis:
  ```bash
  redis-cli DEL admin:2fa:secret admin:2fa:backup_codes
  ```

### Code keeps saying "invalid"
- Your server time might be out of sync
- Check server time: `date` (should match your phone time)
- Authenticator apps use UTC time synchronization

## Admin Logs

All login attempts (successful and failed) are now logged with:
- Timestamp
- IP address
- User agent
- Action type
- Success status
- Details (e.g., "invalid_password", "invalid_2fa_token", "rate_limited")

View logs via API:
```bash
curl https://your-domain.com/api/admin/logs?limit=50 \
  -H "Cookie: admin_session=YOUR_SESSION_TOKEN"
```

## Session Rotation

For security, sessions are now rotated on every successful login:
1. Old session token is destroyed
2. New session token is generated
3. Cookie is updated with new token

This prevents session fixation attacks.
