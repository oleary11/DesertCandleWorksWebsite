// Same real template/caption-box approach as Platrly. Never fall back to stock photos.
import { mergeMemeTemplates, type MemeTemplate } from "./meme-selection";
export type { MemeTemplate } from "./meme-selection";

const IMGFLIP_BASE = "https://api.imgflip.com";

export function isMemeConfigured(): boolean {
  return !!(process.env.IMGFLIP_API_KEY || (process.env.IMGFLIP_USERNAME && process.env.IMGFLIP_PASSWORD));
}

export async function fetchMemeTemplates(): Promise<MemeTemplate[]> {
  const res = await fetch(`${IMGFLIP_BASE}/get_memes`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Could not load Imgflip meme templates (${res.status})`);
  const data = await res.json() as { success?: boolean; data?: { memes?: MemeTemplate[] } };
  const templates = mergeMemeTemplates(data.data?.memes ?? []);
  if (!data.success || !templates.length) throw new Error("Imgflip returned no usable meme templates");
  return templates;
}

/** Reject malformed plans before creating any review posts or calling Imgflip. */
export function validateMemeTexts(template: MemeTemplate, texts: unknown): string[] {
  if (!Array.isArray(texts) || texts.length !== template.box_count || texts.some((t) => typeof t !== "string")) {
    throw new Error(`Meme ${template.name} needs exactly ${template.box_count} text boxes`);
  }
  const trimmed = texts.map((t: string) => t.trim());
  if (trimmed.every((t) => !t)) throw new Error(`Meme ${template.name} has no caption text`);
  return trimmed;
}

export async function captionMeme(templateId: string, texts: string[]): Promise<string> {
  if (!isMemeConfigured()) throw new Error("Memes need Imgflip credentials: set IMGFLIP_API_KEY or IMGFLIP_USERNAME and IMGFLIP_PASSWORD");
  const params = new URLSearchParams({ template_id: templateId });
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  if (process.env.IMGFLIP_API_KEY) {
    headers.Authorization = `Bearer ${process.env.IMGFLIP_API_KEY}`;
  } else {
    params.set("username", process.env.IMGFLIP_USERNAME!);
    params.set("password", process.env.IMGFLIP_PASSWORD!);
  }
  texts.forEach((text, i) => params.append(`boxes[${i}][text]`, text));
  const res = await fetch(`${IMGFLIP_BASE}/caption_image`, {
    method: "POST", headers, body: params.toString(), signal: AbortSignal.timeout(30000),
  });
  const data = await res.json() as { success?: boolean; data?: { url?: string }; error_message?: string };
  if (!res.ok || !data.success || !data.data?.url) throw new Error(`Imgflip caption failed: ${data.error_message ?? res.status}`);
  return data.data.url;
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
