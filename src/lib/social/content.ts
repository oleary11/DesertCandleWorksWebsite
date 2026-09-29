import { listResolvedProducts } from "@/lib/resolvedProducts";
import type { Product } from "@/lib/products";
import { listExcludedImages } from "./store";
import type { SlidePlan } from "./types";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const TEXT_MODEL = "gpt-5.6-terra";

export const BRAND_CONTEXT = `Desert Candle Works is a small candle studio in Scottsdale, Arizona.
Every candle is poured by hand into an upcycled liquor bottle that local bars and restaurants saved for us.
Each bottle is cut on a wet tile saw and hand-sanded smooth, then filled with 100% natural coconut apricot wax:
clean burning, no black soot, no smoke. Warm, desert, golden-hour, handmade, a little playful about the fact
that your candle used to be a bottle of tequila.`;

const VOICE_SYSTEM = `You write social posts for Desert Candle Works.

${BRAND_CONTEXT}

Voice: warm, confident, a little witty, never corporate. Short sentences. Sounds like the maker, not an ad agency.
Never say "elevate", "indulge", "curated", "experience", "journey", "vibes" or "game changer".
No dashes of any kind, use commas or periods. Emojis: at most one per caption, often none.
Never make health, safety or "non-toxic" claims. Never claim a scent does anything beyond smelling good.
Liquor brand names on the bottles belong to their owners: describe the candle, never imply the brand made or endorses it.`;

export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

async function chatJson<T>(system: string, user: string, maxTokens = 6000): Promise<T> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not configured");
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: TEXT_MODEL,
      max_completion_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`OpenAI error: ${data?.error?.message ?? res.status}`);
  const text: string = data.choices?.[0]?.message?.content ?? "";
  try {
    return JSON.parse(text.replace(/^```json\s*/i, "").replace(/\s*```$/, "")) as T;
  } catch {
    throw new Error(`OpenAI returned invalid JSON: ${text.slice(0, 300)}`);
  }
}

/** Relative /images/* paths need the live site in front so fal and Instagram can fetch them. */
export function absoluteUrl(url: string): string {
  if (/^https?:\/\//.test(url)) return url;
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "https://www.desertcandleworks.com").replace(/\/$/, "");
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
}

export function productPhotos(p: Product): string[] {
  const all = [...(p.images ?? []), ...(p.image ? [p.image] : [])];
  return [...new Set(all.filter(Boolean))];
}

export type SocialProduct = {
  slug: string;
  name: string;
  description: string;
  category: string; // spirit / wine type, e.g. "Tequila"
  price: number;
  bestSeller: boolean;
  photos: string[];
};

/** Products that are on the site and have at least one photo switched on for social. */
export async function listSocialProducts(): Promise<SocialProduct[]> {
  const [products, excluded] = await Promise.all([listResolvedProducts(), listExcludedImages()]);
  return products
    .filter((p) => p.visibleOnWebsite !== false)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      description: (p.seoDescription || "").slice(0, 240),
      category: p.alcoholType || (p.productType === "home_goods" ? "Home goods" : "Other"),
      price: p.price,
      bestSeller: !!p.bestSeller,
      photos: productPhotos(p).filter((u) => !excluded.has(u)),
    }))
    .filter((p) => p.photos.length > 0);
}

// ---------- Batch planning (collections + slideshows + memes) ----------

export type PlannedSlideshow = {
  kind: "slideshow";
  productSlug: string | null; // null for multi-product collections
  hook: string;
  caption: string;
  hashtags: string[];
  slides: SlidePlan[];
};
export type PlannedMeme = { kind: "meme"; hook: string; caption: string; hashtags: string[]; memePrompt: string };
export type PlannedPost = PlannedSlideshow | PlannedMeme;

type RawSlide = { source?: string; photo_index?: number; scene_prompt?: string; headline?: string; body?: string };
type RawPost = {
  kind?: string;
  product_slug?: string;
  product_slugs?: string[];
  hook?: string;
  caption?: string;
  hashtags?: string[];
  slides?: RawSlide[];
  meme_prompt?: string;
};

const SLIDESHOW_ANGLES = [
  "bottle origin story: which bar or night out this bottle might have come from, told lightly",
  "the making: cutting, sanding, pouring, the craft behind one candle",
  "styling: where this candle looks best in a home (nightstand, bath ledge, bar cart, patio)",
  "gift idea: who this exact candle is the perfect gift for",
  "scent notes: what it smells like, described like a memory rather than a list",
  "desert living: Arizona golden hour, monsoon nights, slow evenings",
  "sustainability without preaching: one less bottle in a landfill",
  "before and after: empty bottle to finished candle",
];

export type BatchCounts = { collections: number; slideshows: number; memes: number };

const COLLECTION_THEMES = [
  "a few of our favorites",
  "best sellers",
  "one spirit type (tequila, whiskey and bourbon, gin, wine, mezcal, vodka...)",
  "gift ideas, for a specific person (the tequila friend, the whiskey dad, the wine mom, a host gift)",
  "gifts under a price point",
  "new on the shelf",
  "pick your pour: which one are you",
  "fresh out of the saw: bottles that just became candles",
];

/**
 * Plans a batch in one OpenAI call:
 * - collections: several products, real photos only (no AI image cost)
 * - slideshows: one product, may include 1-2 AI scene slides
 * - memes
 */
export async function planBatch(counts: BatchCounts, hooksToAvoid: string[]): Promise<PlannedPost[]> {
  const { collections, slideshows, memes } = counts;
  const products = await listSocialProducts();
  if (!products.length && collections + slideshows > 0) {
    throw new Error("No products have photos switched on for social. Turn some on in the Photos tab.");
  }

  // Rotate products so the same bottle isn't featured twice in one batch when we can help it.
  const shuffled = [...products].sort(() => Math.random() - 0.5);
  const assignments = Array.from({ length: slideshows }, (_, i) => ({
    product: shuffled[i % Math.max(shuffled.length, 1)],
    angle: SLIDESHOW_ANGLES[Math.floor(Math.random() * SLIDESHOW_ANGLES.length)],
  }));
  const themes = [...COLLECTION_THEMES].sort(() => Math.random() - 0.5).slice(0, collections);

  const productLines = assignments
    .map(
      (a, i) =>
        `Slideshow ${i + 1}: product_slug="${a.product.slug}" name="${a.product.name}" photos=${a.product.photos.length} angle="${a.angle}"\n   about: ${a.product.description}`
    )
    .join("\n");
  const catalog = products
    .map((p) => `${p.slug} | ${p.name} | ${p.category} | $${p.price}${p.bestSeller ? " | best seller" : ""}`)
    .join("\n");

  const prompt = `Plan ${collections} collection posts, ${slideshows} single product slideshow posts and ${memes} meme posts for Instagram, TikTok and Facebook.

${hooksToAvoid.length ? `RECENT HOOKS, do not reuse these angles or openings:\n${hooksToAvoid.map((h) => `- ${h}`).join("\n")}\n` : ""}
COLLECTION POSTS (${collections})
Themes to use, one each: ${themes.length ? themes.map((t) => `"${t}"`).join(", ") : "(none)"}
- A cover slide with the hook, then one real product photo per slide labeled with its name. Nothing else to design.
- product_slugs: 4 to 7 products from the catalog that genuinely fit the theme. The first one is on the cover, so pick a striking one.
- Vary products across collections; don't reuse the same product in two collections unless the theme needs it.
- hook: the cover headline, short and warm, max 7 words, e.g. "A few of our favorites", "For the tequila people", "Gifts under $30".

CATALOG (slug | name | type | price):
${catalog || "(none)"}

SINGLE PRODUCT SLIDESHOWS (${slideshows}, one post each, in this order):
${productLines || "(none)"}
- 3 to 5 slides. Slide 1 is the cover and carries the hook as its headline.
- Each slide is either "photo" (the real product photo, untouched) or "scene" (the same real candle placed into a new setting by an image editor).
- Use "photo" for the cover most of the time. Use 1 or 2 "scene" slides per post, never more.
- photo_index picks which of the product's photos to use (0 based, less than its photo count). Vary it.
- scene_prompt describes ONLY the setting, light and props around the candle, like a brief for a product photographer:
  real materials, natural window or golden hour light, shallow depth of field, lived in but tidy.
  Arizona touches are welcome (saguaro silhouettes through a window, terracotta, adobe walls, desert patio at dusk).
  Never ask for people, hands, faces, pets, text, logos or other bottles. Never describe the candle itself.
- headline: max 7 words. body: optional, max 18 words. Text sits on the photo, so less is more. Final slide can be a soft call to action like "Shop the bottle, link in bio".

MEMES (${memes})
- A single image, relatable candle-person humor (buying too many candles, saving the good candle, "just one more", the smell of a new candle, candle math, burning a candle so the house looks clean).
- meme_prompt: a complete image generation prompt for a clean, well known meme layout or a funny realistic still life. Include the exact caption text to render, max 14 words total, spelled exactly.
- NO people, faces, hands or characters in memes. Objects, candles, rooms, cats are fine.
- About one in three memes can nod to candles made from old liquor bottles. Keep the rest general.

EVERY POST
- hook: max 9 words, the line that stops the scroll. Every hook starts differently.
- caption: 1 to 3 short sentences, under 220 characters, no hashtags.
- hashtags: 6 to 10, lowercase, no #. Mix broad (candles, candlelover, smallbusiness) with specific (scottsdale, arizonamade, upcycled, homedecor, giftideas).

Return JSON: {"posts":[
  {"kind":"collection","hook":"...","product_slugs":["..."],"caption":"...","hashtags":["..."]},
  {"kind":"slideshow","product_slug":"...","hook":"...","slides":[{"source":"photo"|"scene","photo_index":0,"scene_prompt":"...","headline":"...","body":"..."}],"caption":"...","hashtags":["..."]},
  {"kind":"meme","hook":"...","meme_prompt":"...","caption":"...","hashtags":["..."]}
]}
Collections first, then slideshows in assignment order, then memes.`;

  const { posts } = await chatJson<{ posts: RawPost[] }>(VOICE_SYSTEM, prompt, 12000);
  if (!Array.isArray(posts)) throw new Error("OpenAI plan had no posts array");

  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const planned: PlannedPost[] = [];

  for (const raw of posts) {
    const hashtags = (raw.hashtags ?? []).map((h) => h.replace(/^#/, "").toLowerCase().replace(/\s+/g, "")).slice(0, 12);

    if (raw.kind === "meme" && raw.meme_prompt) {
      planned.push({ kind: "meme", hook: raw.hook ?? "", caption: raw.caption ?? "", hashtags, memePrompt: raw.meme_prompt });
      continue;
    }

    if (raw.kind === "collection") {
      const picks = [...new Set(raw.product_slugs ?? [])]
        .map((slug) => bySlug.get(slug))
        .filter((p): p is SocialProduct => !!p)
        .slice(0, 7);
      if (picks.length < 3 || !raw.hook) continue;
      const slides: SlidePlan[] = [
        { source: "photo", photoUrl: picks[0].photos[0], headline: raw.hook },
        ...picks.slice(1).map((p, i, rest) => ({
          source: "photo" as const,
          photoUrl: p.photos[0],
          headline: p.name,
          body: i === rest.length - 1 ? "Link in bio" : undefined,
          nameLabel: true,
        })),
      ];
      planned.push({ kind: "slideshow", productSlug: null, hook: raw.hook, caption: raw.caption ?? "", hashtags, slides });
      continue;
    }

    const product = raw.product_slug ? bySlug.get(raw.product_slug) : undefined;
    if (raw.kind !== "slideshow" || !product || !raw.slides?.length) continue;

    const shown = new Set<string>();
    const slides: SlidePlan[] = raw.slides.slice(0, 5).map((s, i) => {
      const scene = s.source === "scene" && !!s.scene_prompt && i > 0; // cover stays a real photo
      let idx = Math.min(Math.max(Number(s.photo_index) || 0, 0), product.photos.length - 1);
      // Prefer a photo this post hasn't shown yet; if they're all used, fall back to a close-up.
      if (!scene && shown.has(product.photos[idx])) {
        const unused = product.photos.findIndex((u) => !shown.has(u));
        if (unused >= 0) idx = unused;
      }
      const photoUrl = product.photos[idx];
      const detail = !scene && shown.has(photoUrl);
      if (!scene) shown.add(photoUrl);
      return {
        source: scene ? "scene" : "photo",
        photoUrl,
        scenePrompt: scene ? s.scene_prompt : undefined,
        detail: detail || undefined,
        headline: s.headline ?? "",
        body: s.body || undefined,
      };
    });
    planned.push({ kind: "slideshow", productSlug: product.slug, hook: raw.hook ?? slides[0].headline, caption: raw.caption ?? "", hashtags, slides });
  }
  return planned;
}

// ---------- Reel copy ----------

export async function writeReelCopy(
  product: SocialProduct,
  notes: string | undefined,
  hooksToAvoid: string[]
): Promise<{ hook: string; caption: string; hashtags: string[] }> {
  const prompt = `Write the copy for a 10 second product reel of this candle. The video is slow, cinematic footage of the real, unlit candle (a push-in, a slight orbit, a close-up on the label), no talking.

Product: ${product.name}
About: ${product.description}
${notes ? `Maker's notes for this reel: ${notes}` : ""}
${hooksToAvoid.length ? `Avoid these recent hooks:\n${hooksToAvoid.slice(0, 15).map((h) => `- ${h}`).join("\n")}` : ""}

hook: max 8 words, used as the reel's title, no quotes.
caption: 1 to 3 short sentences under 220 characters, no hashtags.
hashtags: 6 to 10, lowercase, no #.

Return JSON: {"hook":"...","caption":"...","hashtags":["..."]}`;

  const out = await chatJson<{ hook?: string; caption?: string; hashtags?: string[] }>(VOICE_SYSTEM, prompt, 1500);
  return {
    hook: out.hook ?? product.name,
    caption: out.caption ?? "",
    hashtags: (out.hashtags ?? []).map((h) => h.replace(/^#/, "").toLowerCase().replace(/\s+/g, "")).slice(0, 12),
  };
}
