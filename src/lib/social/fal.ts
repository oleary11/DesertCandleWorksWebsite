import crypto from "crypto";
import type { FalJob } from "./types";

// fal.ai hosts every model the generator uses behind one queue API.
// Env: FAL_KEY. Prices are per fal's model pages (Sept 2026).
export const FAL_MODELS = {
  // Image-to-video. Picked after testing in the fal sandbox on real DCW product photos.
  video: "fal-ai/kling-video/v3/turbo/pro/image-to-video",
  // Product-preserving scene edits and meme images.
  imageEdit: "fal-ai/nano-banana-pro/edit",
  image: "fal-ai/nano-banana-pro",
  // Joins the reel's clips into one video.
  merge: "fal-ai/ffmpeg-api/merge-videos",
} as const;

// Cents, used for the running cost shown in admin.
export const FAL_COST_CENTS = {
  videoPerSecond: 14,
  image: 15,
};

const QUEUE = "https://queue.fal.run";

export function isFalConfigured(): boolean {
  return !!process.env.FAL_KEY;
}

function falHeaders(): Record<string, string> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY not configured");
  return { Authorization: `Key ${key}`, "Content-Type": "application/json" };
}

/** Token that proves a webhook call came from a job we submitted for this post. */
export function webhookToken(postId: string): string {
  const secret = process.env.CRON_SECRET || process.env.FAL_KEY || "";
  return crypto.createHmac("sha256", secret).update(`social:${postId}`).digest("hex").slice(0, 32);
}

function webhookUrl(postId: string): string | null {
  const base = process.env.NEXT_PUBLIC_BASE_URL;
  // fal can't reach localhost; the admin page polls instead.
  if (!base || /localhost|127\.0\.0\.1/.test(base)) return null;
  return `${base.replace(/\/$/, "")}/api/social/fal-webhook?post=${postId}&token=${webhookToken(postId)}`;
}

export async function submitFalJob(
  postId: string,
  key: string,
  endpoint: string,
  input: Record<string, unknown>
): Promise<FalJob> {
  const hook = webhookUrl(postId);
  const url = `${QUEUE}/${endpoint}${hook ? `?fal_webhook=${encodeURIComponent(hook)}` : ""}`;
  const res = await fetch(url, { method: "POST", headers: falHeaders(), body: JSON.stringify(input) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.request_id) {
    throw new Error(`fal submit ${endpoint} failed (${res.status}): ${JSON.stringify(data).slice(0, 300)}`);
  }
  return {
    key,
    endpoint,
    requestId: data.request_id,
    statusUrl: data.status_url,
    responseUrl: data.response_url,
    status: "pending",
  };
}

/** Pulls the first image or video URL out of a fal result, whatever the model's shape. */
function outputUrlOf(result: Record<string, unknown>): string | undefined {
  const video = result.video as { url?: string } | undefined;
  if (video?.url) return video.url;
  const images = result.images as Array<{ url?: string }> | undefined;
  if (images?.[0]?.url) return images[0].url;
  const image = result.image as { url?: string } | undefined;
  return image?.url;
}

/** Checks a pending job and returns it updated (done/failed) or unchanged if still running. */
export async function refreshFalJob(job: FalJob): Promise<FalJob> {
  if (job.status !== "pending") return job;

  const statusRes = await fetch(job.statusUrl, { headers: falHeaders(), cache: "no-store" });
  const status = await statusRes.json().catch(() => ({}));
  if (status.status !== "COMPLETED") return job;

  const res = await fetch(job.responseUrl, { headers: falHeaders(), cache: "no-store" });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = result.detail ? JSON.stringify(result.detail) : res.status;
    return { ...job, status: "failed", error: `fal ${job.endpoint}: ${String(detail).slice(0, 300)}` };
  }
  const outputUrl = outputUrlOf(result);
  if (!outputUrl) return { ...job, status: "failed", error: `fal ${job.endpoint} returned no output` };
  return { ...job, status: "done", outputUrl };
}
