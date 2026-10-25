-- One row per order we've asked for a Google review (lib/reviewRequests.ts).
-- (reviewRequests.ts also creates this on first use, so this is safe to re-run.)

CREATE TABLE IF NOT EXISTS "review_requests" (
  "order_id" varchar(255) PRIMARY KEY,
  "email" varchar(255) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'sent', -- sending | sent | failed
  "error" text,
  "sent_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "review_requests_email_idx" ON "review_requests" (lower("email"));
