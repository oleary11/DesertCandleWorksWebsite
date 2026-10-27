-- Custom email frames uploaded from /admin/emails: a transparent illustration (art)
-- composited into a header with the top of a colour panel (header), plus colours.
-- Fall and Christmas are built into lib/emailFrames.ts.
-- (emailFramesStore.ts also creates this on first use, so this is safe to re-run.)

CREATE TABLE IF NOT EXISTS "email_frames" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(100) NOT NULL,
  "header_image_url" text NOT NULL,
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
