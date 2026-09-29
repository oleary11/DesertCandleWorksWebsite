// Memes, made the way Platrly makes its person memes: a real stock photo with classic bold
// top/bottom text. No AI-generated images.
//
// Photos come from Unsplash first, then Pexels. Env: PEXELS_API_KEY and/or UNSPLASH_ACCESS_KEY.

const UNSPLASH_BASE = "https://api.unsplash.com";
const PEXELS_BASE = "https://api.pexels.com/v1";

export function isStockPhotoConfigured(): boolean {
  return !!(process.env.UNSPLASH_ACCESS_KEY || process.env.PEXELS_API_KEY);
}

function pick<T>(items: T[]): T | undefined {
  return items.length ? items[Math.floor(Math.random() * items.length)] : undefined;
}

async function searchUnsplash(query: string): Promise<string | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `${UNSPLASH_BASE}/search/photos?query=${encodeURIComponent(query)}&per_page=10&orientation=portrait&content_filter=high`,
      { headers: { Authorization: `Client-ID ${key}` } }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { results?: Array<{ urls: { regular: string } }> };
    return pick(data.results ?? [])?.urls.regular ?? null;
  } catch {
    return null;
  }
}

async function searchPexels(query: string): Promise<string | null> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `${PEXELS_BASE}/search?query=${encodeURIComponent(query)}&per_page=20&orientation=portrait&size=large`,
      { headers: { Authorization: key } }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { photos?: Array<{ src: { portrait: string } }> };
    return pick(data.photos ?? [])?.src.portrait ?? null;
  } catch {
    return null;
  }
}

/** A real portrait stock photo for the query: Unsplash first, Pexels as the fallback. */
export async function findMemePhoto(query: string): Promise<string | null> {
  return (await searchUnsplash(query)) ?? (await searchPexels(query));
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
