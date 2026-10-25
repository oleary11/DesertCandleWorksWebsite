-- Keep our own copy of each email's content: Resend deletes sent emails after ~30 days.
-- (emailLog.ts also adds these on first use, so this is safe to re-run.)

ALTER TABLE "email_log" ADD COLUMN IF NOT EXISTS "reply_to" text;
ALTER TABLE "email_log" ADD COLUMN IF NOT EXISTS "html_body" text;
ALTER TABLE "email_log" ADD COLUMN IF NOT EXISTS "text_body" text;
