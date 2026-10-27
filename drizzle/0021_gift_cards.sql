-- Gift cards (lib/giftCards.ts): bought on /gift-cards or issued from admin, spent in the
-- cart. The ledger keeps every purchase, issue and use. (giftCards.ts also creates these
-- on first use, so this is safe to re-run.)

CREATE TABLE IF NOT EXISTS "gift_cards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" varchar(20) NOT NULL UNIQUE,
  "initial_cents" integer NOT NULL,
  "balance_cents" integer NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "source" varchar(20) NOT NULL DEFAULT 'purchase',
  "purchaser_name" text,
  "purchaser_email" text,
  "recipient_name" text,
  "recipient_email" text NOT NULL,
  "message" text,
  "send_at" timestamp with time zone,
  "emailed_at" timestamp with time zone,
  "stripe_session_id" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "gift_card_ledger" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "gift_card_id" uuid NOT NULL,
  "amount_cents" integer NOT NULL,
  "order_id" varchar(100),
  "note" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "gift_card_ledger_card_idx" ON "gift_card_ledger" ("gift_card_id");
