-- Log of every Desert Candle Works email sent through Resend, for the "Sent" tab in
-- /admin/emails. (emailLog.ts also creates this on first use, so this is safe to re-run.)

CREATE TABLE IF NOT EXISTS "email_log" (
  "resend_id" varchar(100) PRIMARY KEY,
  "to_email" text NOT NULL DEFAULT '',
  "from_email" text NOT NULL DEFAULT '',
  "subject" text NOT NULL DEFAULT '',
  "category" varchar(30) NOT NULL DEFAULT 'other', -- order | shipping | delivered | refund | account | message | personal | notification | other
  "order_id" varchar(100),
  "last_event" varchar(30),                        -- Resend status: sent, delivered, bounced, opened, ...
  "sent_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "email_log_sent_at_idx" ON "email_log" ("sent_at");
CREATE INDEX IF NOT EXISTS "email_log_category_idx" ON "email_log" ("category");
CREATE INDEX IF NOT EXISTS "email_log_order_idx" ON "email_log" ("order_id");
