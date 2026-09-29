// Memes, made the same way as Platrly's: OpenAI image generation for format memes, or a real
// stock photo with classic top/bottom text when the joke needs a real person.

const OPENAI_BASE = "https://api.openai.com/v1";
const PEXELS_BASE = "https://api.pexels.com/v1";

// Same image model Platrly uses for its memes.
const MEME_IMAGE_MODEL = "gpt-image-2.5-flare";

/** Generates a meme image with OpenAI and returns it as a PNG buffer (portrait 1024x1536). */
export async function generateMemeImage(prompt: string): Promise<Buffer> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not configured");

  const res = await fetch(`${OPENAI_BASE}/images/generations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MEME_IMAGE_MODEL, prompt, n: 1, size: "1024x1536", quality: "high" }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`OpenAI image error: ${data?.error?.message ?? res.status}`);

  const b64: string | undefined = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI returned no image data");
  return Buffer.from(b64, "base64");
}

export function isPexelsConfigured(): boolean {
  return !!process.env.PEXELS_API_KEY;
}

/** A random portrait stock photo for the query, or null if nothing matched. */
export async function searchPexelsPhoto(query: string): Promise<string | null> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;
  const res = await fetch(
    `${PEXELS_BASE}/search?query=${encodeURIComponent(query)}&per_page=20&orientation=portrait&size=large`,
    { headers: { Authorization: key } }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { photos?: Array<{ src: { portrait: string } }> };
  const photos = data.photos ?? [];
  return photos.length ? photos[Math.floor(Math.random() * photos.length)].src.portrait : null;
}

const NSFW_WORDS = ["sex", "porn", "nude", "naked", "nsfw", "fuck", "shit", "ass", "dick", "cock", "pussy", "boob", "tit", "horny", "cum", "boner", "orgasm", "fetish"];

/**
 * Titles of this week's top posts on r/memes and r/AdviceAnimals, so meme formats track what's
 * circulating right now (the format energy, not the content). Empty if Reddit doesn't answer.
 */
export async function fetchTrendingFormats(): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch("https://www.reddit.com/r/memes+AdviceAnimals/top.json?t=week&limit=30", {
      headers: { "User-Agent": "desertcandleworks-social-bot/1.0 (content automation)" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      data?: { children?: Array<{ data: { title: string; over_18: boolean; score: number } }> };
    };
    return (data.data?.children ?? [])
      .filter((p) => !p.data.over_18 && !NSFW_WORDS.some((w) => p.data.title.toLowerCase().includes(w)))
      .sort((a, b) => b.data.score - a.data.score)
      .slice(0, 7)
      .map((p) => p.data.title);
  } catch {
    return [];
  }
}
