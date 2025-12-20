# Security Fix: Remove Exposed Database Credentials

## Problem
The PostgreSQL connection string was accidentally committed to `MIGRATION_COMPLETE.md` and pushed to GitHub.

## Steps to Fix

### 1. Regenerate Neon Database Password (DO THIS FIRST!)

1. Go to https://console.neon.tech
2. Select your project
3. Navigate to Settings → Database
4. Click "Reset password"
5. Copy the new connection string
6. Update your `.env.local` file:
   ```bash
   DATABASE_URL=<new_connection_string>
   ```

### 2. Remove Sensitive Data from Local File

Edit `MIGRATION_COMPLETE.md` and replace the connection string section:

```markdown
## Database Credentials

**Neon Database URL:**
Stored in `.env.local` as `DATABASE_URL` (never commit this file!)
```

### 3. Commit the Fix

```bash
git add MIGRATION_COMPLETE.md
git commit -m "Remove exposed database credentials"
```

### 4. Remove from Git History (Required!)

Since the credential is already in Git history and pushed to GitHub, you need to remove it:

**Option A: Using BFG Repo-Cleaner (Recommended)**
```bash
# Install BFG (if not already installed)
# Windows: Download from https://rtyley.github.io/bfg-repo-cleaner/
# Mac: brew install bfg
# Linux: Download JAR file

# Replace the exposed string in all commits
bfg --replace-text passwords.txt

# Force push to GitHub
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force
```

Create a `passwords.txt` file with:
```
postgresql://neondb_owner:npg_56pZVjJrwDgc@ep-polished-dawn-afnbv60z-pooler.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require===>***REMOVED***
```

**Option B: Using git filter-repo**
```bash
# Install git-filter-repo
pip install git-filter-repo

# Remove the file from history
git filter-repo --path MIGRATION_COMPLETE.md --invert-paths --force

# Or replace the content
git filter-repo --replace-text passwords.txt --force
```

**Option C: Nuclear Option - Delete and Re-push**
If this is a relatively new repo:
```bash
# Delete the repo on GitHub
# Then re-initialize locally:
rm -rf .git
git init
git add .
git commit -m "Initial commit with secure credentials"
git remote add origin <your-github-url>
git push -u origin main --force
```

### 5. Verify on GitHub

After force-pushing, verify that:
1. The connection string is no longer visible in any commits on GitHub
2. Check: https://github.com/oleary11/DesertCandleWorksWebsite/commits/main
3. View MIGRATION_COMPLETE.md to confirm it shows the sanitized version

### 6. Prevent Future Leaks

1. Add to `.gitignore` (already done):
   ```
   .env
   .env.local
   .env*.local
   ```

2. Never commit files with credentials
3. Always use environment variables
4. Consider using `git-secrets` to prevent accidental commits:
   ```bash
   # Install git-secrets
   git secrets --install
   git secrets --register-aws
   ```

## Why This Matters

The exposed connection string allows:
- Anyone to connect to your database
- Read all customer data
- Modify or delete data
- Incur charges on your account

**Immediate impact after password reset:**
- Old connection string becomes invalid
- Your app continues working with new credentials in `.env.local`
- Attackers can no longer access the database
