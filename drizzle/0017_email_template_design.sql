-- Saved email templates can carry a promotion look (e.g. the fall promo design).
-- (The email-templates API also adds this on first use, so this is safe to re-run.)

ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "design" jsonb;
