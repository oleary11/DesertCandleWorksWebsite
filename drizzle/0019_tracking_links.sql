-- Tracking links (desertcandleworks.com/go/<slug>) and which source each website order
-- came from. (lib/trackingLinks.ts also creates these on first use, so this is safe to re-run.)

CREATE TABLE IF NOT EXISTS "tracking_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug" varchar(80) NOT NULL UNIQUE,
  "name" varchar(120) NOT NULL,
  "destination" text NOT NULL DEFAULT '/',
  "source" varchar(40) NOT NULL,            -- instagram, tiktok, email, qr, ...
  "medium" varchar(40),                     -- social, organic, email, print, referral
  "campaign" varchar(80),
  "promo_code" varchar(50),                 -- auto-applied in the cart
  "clicks" integer NOT NULL DEFAULT 0,
  "last_click_at" timestamp with time zone,
  "archived" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "order_attribution" (
  "order_id" varchar(255) PRIMARY KEY,
  "source" varchar(60) NOT NULL,            -- direct when unknown
  "medium" varchar(40),
  "campaign" varchar(80),
  "link_id" uuid,                           -- tracking_links.id when bought after a /go link
  "via" varchar(10),                        -- link | utm | referrer
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "order_attribution_link_idx" ON "order_attribution" ("link_id");
CREATE INDEX IF NOT EXISTS "order_attribution_source_idx" ON "order_attribution" ("source");
