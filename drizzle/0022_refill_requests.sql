-- Bottle refill requests from /refills (lib/refills.ts): requested -> awaiting_payment
-- (bottle arrived intact, payment link sent) -> paid -> done, or broken / cancelled.
-- (refills.ts also creates this on first use, so this is safe to re-run.)

CREATE TABLE IF NOT EXISTS "refill_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "number" serial,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "phone" text NOT NULL,
  "bottle" text NOT NULL,
  "scent" text NOT NULL,
  "send_method" varchar(20) NOT NULL,
  "return_method" varchar(20) NOT NULL,
  "address" jsonb,
  "notes" text,
  "status" varchar(30) NOT NULL DEFAULT 'requested',
  "shipping_cents" integer,
  "shipping_service" text,
  "paid_cents" integer,
  "stripe_session_id" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
