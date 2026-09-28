-- Social media generator: AI-assisted reels, photo slideshows and memes that
-- are reviewed in /admin/social and then posted to Instagram, TikTok and Facebook.

CREATE TABLE IF NOT EXISTS "social_posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "kind" varchar(20) NOT NULL,                       -- 'reel' | 'slideshow' | 'meme'
  "status" varchar(20) NOT NULL DEFAULT 'generating', -- generating | pending_review | approved | publishing | published | failed | rejected
  "product_slug" varchar(100),
  "hook" text NOT NULL DEFAULT '',
  "caption" text NOT NULL DEFAULT '',
  "hashtags" jsonb NOT NULL DEFAULT '[]',
  "plan" jsonb NOT NULL DEFAULT '{}',                -- what the LLM / admin asked for (slides, prompts, source photos)
  "jobs" jsonb NOT NULL DEFAULT '[]',                -- fal.ai jobs in flight for this post
  "slides" jsonb NOT NULL DEFAULT '[]',              -- final rendered image URLs, in order
  "video_url" text,
  "cover_image_url" text,
  "cost_cents" integer NOT NULL DEFAULT 0,
  "queue_order" integer,
  "error" text,
  "published_at" timestamp with time zone,
  "instagram_post_id" varchar(100),
  "tiktok_post_id" varchar(100),
  "facebook_post_id" varchar(100),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "social_posts_status_idx" ON "social_posts" ("status");
CREATE INDEX IF NOT EXISTS "social_posts_created_at_idx" ON "social_posts" ("created_at");

-- Product photos switched off for social (e.g. older AI-made shots). Keyed by image URL
-- so it works for both static /images/* paths and Blob uploads without touching products.
CREATE TABLE IF NOT EXISTS "social_excluded_images" (
  "image_url" text PRIMARY KEY,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
