-- Custom email frames (festive header/footer artwork + colours) uploaded from
-- /admin/emails. Fall and Christmas are built into lib/emailFrames.ts.
-- (emailFramesStore.ts also creates this on first use, so this is safe to re-run.)

CREATE TABLE IF NOT EXISTS "email_frames" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(100) NOT NULL,
  "header_image_url" text NOT NULL,
  "footer_image_url" text,
  "eyebrow" varchar(120),
  "products_heading" varchar(120),
  "page_color" varchar(9) NOT NULL,
  "card_color" varchar(9) NOT NULL,
  "panel_color" varchar(9) NOT NULL,
  "accent_color" varchar(9) NOT NULL,
  "secondary_color" varchar(9) NOT NULL,
  "text_color" varchar(9) NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
