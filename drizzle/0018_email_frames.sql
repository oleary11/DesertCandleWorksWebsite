-- Custom email frames uploaded from /admin/emails: a transparent illustration (art)
-- split into the layer above the colour panel (header) and inside its top (panel_art).
-- Fall and Christmas are built into lib/emailFrames.ts.
-- (emailFramesStore.ts also creates this on first use, so this is safe to re-run.)

CREATE TABLE IF NOT EXISTS "email_frames" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(100) NOT NULL,
  "header_image_url" text NOT NULL,
  "panel_art_url" text,
  "art_image_url" text,
  "products_heading" varchar(120),
  "page_color" varchar(9) NOT NULL,
  "card_color" varchar(9) NOT NULL,
  "panel_color" varchar(9) NOT NULL,
  "panel_text_color" varchar(9) NOT NULL,
  "button_color" varchar(9) NOT NULL,
  "button_text_color" varchar(9) NOT NULL,
  "link_color" varchar(9) NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
