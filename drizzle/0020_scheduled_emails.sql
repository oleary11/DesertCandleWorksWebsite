-- Emails from /admin/emails scheduled for later. Resend holds and sends each email;
-- this keeps their Resend ids so a scheduled send can be listed and cancelled.
-- (scheduledEmails.ts also creates this on first use, so this is safe to re-run.)

CREATE TABLE IF NOT EXISTS "scheduled_emails" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "subject" text NOT NULL,
  "recipients_label" text NOT NULL,
  "recipient_count" integer NOT NULL,
  "scheduled_at" timestamp with time zone NOT NULL,
  "resend_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "thread_id" text,
  "status" varchar(20) NOT NULL DEFAULT 'scheduled',
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "scheduled_emails_at_idx" ON "scheduled_emails" ("scheduled_at");
