-- Conversations from /admin/emails: single-recipient emails we send, plus the
-- customer's replies delivered by the Resend inbound webhook.
-- (emailThreadsStore.ts also creates these on first use, so this is safe to re-run.)

CREATE TABLE IF NOT EXISTS "email_threads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "customer_email" varchar(255) NOT NULL,
  "customer_name" varchar(255),
  "subject" text NOT NULL,
  "personal" boolean NOT NULL DEFAULT false,
  "unread_count" integer NOT NULL DEFAULT 0,
  "last_message_at" timestamp with time zone NOT NULL DEFAULT now(),
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "email_threads_last_message_idx" ON "email_threads" ("last_message_at");
CREATE INDEX IF NOT EXISTS "email_threads_customer_idx" ON "email_threads" (lower("customer_email"));

CREATE TABLE IF NOT EXISTS "email_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "thread_id" uuid NOT NULL REFERENCES "email_threads"("id") ON DELETE CASCADE,
  "direction" varchar(3) NOT NULL,          -- 'out' | 'in'
  "from_email" varchar(255) NOT NULL,
  "subject" text NOT NULL DEFAULT '',
  "body_text" text NOT NULL DEFAULT '',
  "message_id" text,                        -- RFC Message-ID of inbound mail
  "resend_id" varchar(100) UNIQUE,          -- Resend email id; dedupes webhook retries
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "email_messages_thread_idx" ON "email_messages" ("thread_id", "created_at");
