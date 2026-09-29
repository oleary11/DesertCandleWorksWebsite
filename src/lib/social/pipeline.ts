import { FAL_COST_CENTS, FAL_MODELS, refreshFalJob, submitFalJob } from "./fal";
import {
  absoluteUrl,
  isOpenAIConfigured,
  listSocialProducts,
  planBatch,
  writeReelCopy,
  type BatchCounts,
  type PlannedPost,
} from "./content";
import {
  REEL_H,
  REEL_W,
  SLIDE_H,
  SLIDE_W,
  copyToBlob,
  cropTo,
  detailCrop,
  fetchImage,
  renderPhotoMeme,
  renderSlide,
  uploadToBlob,
} from "./render";
import { findMemePhoto, isStockPhotoConfigured } from "./memes";
import {
  createSocialPost,
  getSocialPost,
  listSocialPosts,
  recentHooks,
  updateSocialPost,
  updateSocialPostIfUnchanged,
  type SocialPostPatch,
} from "./store";
import type { MemePlan, ReelPlan, SlideshowPlan, SocialPost } from "./types";

const REEL_SECONDS = 10;

// The reel prompt, tuned in the fal sandbox. Kling uses the photo as the first frame, so this only
// describes camera motion and what must never change. Liquor-bottle candles tempt video models to
// add a flame and animate the wax like a drink, so both are ruled out explicitly.
function reelPrompt(productName: string, category: string, notes?: string): string {
  const name = productName.replace(/\s+candle$/i, "");
  const style = /whisk|bourbon|rye|scotch/i.test(category)
    ? "premium whiskey-advertisement"
    : /wine|prosecco|champagne|ros/i.test(category)
      ? "premium wine-advertisement"
      : category && !/other|home/i.test(category)
        ? `premium ${category.toLowerCase()}-advertisement`
        : "premium lifestyle-advertisement";

  return `Create a premium cinematic product reel from this image of a ${name} candle. Keep the candle jar, label, logo, typography, wax, and all product details completely unchanged and perfectly legible throughout the video.
Start with a slow, elegant camera push-in toward the candle with subtle natural parallax in the foreground props. Soft warm ambient light plays gently across the glass. The background should remain softly blurred with gentle ambient motion, creating a cozy luxury lifestyle atmosphere.
Halfway through, introduce a subtle 10 to 15 degree camera orbit around the product while keeping the candle centered and dominant in frame. Finish with a smooth close-up hero shot focused on the ${name} label.
Warm golden-hour lighting, shallow depth of field, soft shadows, realistic reflections, ${style} aesthetic, high-end commercial product photography, smooth stabilized camera motion, natural motion only, no dramatic transformations.
Vertical 9:16 social media reel, photorealistic, polished commercial quality.${notes ? `\n${notes}` : ""}
The candle is NOT lit and stays unlit for the entire video. Do not add, ignite or show any flame, fire, spark, ember, glow or smoke on the wick or anywhere else. The wick stays exactly as it is in the image. The wax is solid and never moves, ripples or flows.
Important: do not alter, rewrite, distort, animate, or replace any text or branding on the product. Do not change the candle shape, label design, colors, background objects, or composition. No new objects, no hands, no people, no floating particles, no text overlays, no morphing or warping.
Avoid: flame, fire, lit candle, burning wick, smoke, sparks, glow on the wick, liquid, pouring, sloshing, ripples in the wax, drink, morphing, warping, changing text, distorted label, extra objects, blur.`;
}

const SCENE_PROMPT = (setting: string) =>
  `Use the candle from the reference photo exactly as it is: same bottle shape, glass color, label artwork, every letter of the label text, wax and wick. Keep every color on the candle identical to the reference, including the exact color of the label printing, even where it is faint or low contrast. Do not redraw, restyle, re-letter, recolor, resize or change the candle in any way. Only change what is around it.

New setting: ${setting}

Photorealistic editorial product photograph, full-frame camera, 50mm lens, natural light that matches on the candle and the scene, true-to-life color, soft realistic shadows, subtle film grain. The candle is the clear subject and in sharp focus. No people, no hands, no added text or logos, no other bottles.`;

// ---------- Creating posts ----------

async function fail(post: SocialPost, err: unknown): Promise<SocialPost> {
  const error = err instanceof Error ? err.message : String(err);
  console.error(`[social] post ${post.id} failed:`, error);
  return (await updateSocialPost(post.id, { status: "failed", error })) ?? post;
}

/** Starts a reel: one 10 second clip animated from one photo of the product the admin picked. */
export async function createReel(productSlug: string, photoUrls: string[], motionNotes?: string): Promise<SocialPost> {
  const product = (await listSocialProducts()).find((p) => p.slug === productSlug);
  if (!product) throw new Error("Product not found or has no social photos");
  const source = photoUrls[0];
  if (!source) throw new Error("Pick a photo");

  const post = await createSocialPost({ kind: "reel", productSlug, hook: product.name });

  try {
    // Kling takes its aspect ratio from the first frame, and Reels need 9:16.
    const startFrame = await uploadToBlob(
      `social/${post.id}/start-0.jpg`,
      await cropTo(await fetchImage(source), REEL_W, REEL_H),
      "image/jpeg"
    );
    const prompt = reelPrompt(product.name, product.category, motionNotes);

    const copy = isOpenAIConfigured()
      ? await writeReelCopy(product, motionNotes, await recentHooks())
      : { hook: product.name, caption: "", hashtags: [] };

    // The turbo endpoint only takes image_url, prompt, duration (and multi_prompt): no negative
    // prompt or audio switch, so the things to avoid are spelled out inside the prompt itself.
    const job = await submitFalJob(post.id, "clip-0", FAL_MODELS.video, {
      image_url: startFrame,
      prompt,
      duration: String(REEL_SECONDS),
    });

    const plan: ReelPlan = { sourceImages: [source], startFrames: [startFrame], prompts: [prompt], motionNotes };
    return (
      (await updateSocialPost(post.id, {
        ...copy,
        plan,
        jobs: [job],
        coverImageUrl: startFrame,
        costCents: Math.round(REEL_SECONDS * FAL_COST_CENTS.videoPerSecond),
      })) ?? post
    );
  } catch (err) {
    return fail(post, err);
  }
}

async function startPlannedPost(planned: PlannedPost): Promise<SocialPost> {
  if (planned.kind === "meme") {
    const plan: MemePlan = { punchline: planned.punchline, photoQuery: planned.photoQuery };
    const post = await createSocialPost({ kind: "meme", hook: planned.hook, caption: planned.caption, hashtags: planned.hashtags, plan });
    try {
      // Like Platrly's person memes: a real stock photo with classic top/bottom text. Never AI.
      if (!isStockPhotoConfigured()) throw new Error("Memes need a stock photo key: set PEXELS_API_KEY or UNSPLASH_ACCESS_KEY");
      const photoUrl = await findMemePhoto(planned.photoQuery);
      if (!photoUrl) throw new Error(`No stock photo found for "${planned.photoQuery}"`);
      const jpeg = await renderPhotoMeme(await cropTo(await fetchImage(photoUrl), SLIDE_W, SLIDE_H), planned.hook, planned.punchline);
      const url = await uploadToBlob(`social/${post.id}/meme.jpg`, jpeg, "image/jpeg");
      return (await updateSocialPost(post.id, { status: "pending_review", slides: [url], coverImageUrl: url })) ?? post;
    } catch (err) {
      return fail(post, err);
    }
  }

  const plan: SlideshowPlan = { slides: planned.slides };
  const post = await createSocialPost({
    kind: "slideshow",
    productSlug: planned.productSlug,
    hook: planned.hook,
    caption: planned.caption,
    hashtags: planned.hashtags,
    plan,
  });
  try {
    const jobs = await Promise.all(
      planned.slides.flatMap((s, i) =>
        s.source === "scene" && s.scenePrompt
          ? [
              submitFalJob(post.id, `scene-${i}`, FAL_MODELS.imageEdit, {
                prompt: SCENE_PROMPT(s.scenePrompt),
                image_urls: [absoluteUrl(s.photoUrl)],
                aspect_ratio: "4:5",
                resolution: "2K",
                output_format: "jpeg",
              }),
            ]
          : []
      )
    );
    const updated = await updateSocialPost(post.id, { jobs, costCents: jobs.length * FAL_COST_CENTS.image });
    // All-photo slideshows have nothing to wait on, render them now.
    return jobs.length ? updated ?? post : advancePost(post.id);
  } catch (err) {
    return fail(post, err);
  }
}

/** Plans and starts a batch of collections, slideshows and memes. Scenes and memes finish asynchronously. */
export async function createBatch(counts: BatchCounts): Promise<SocialPost[]> {
  const planned = await planBatch(counts, await recentHooks());
  // In parallel: memes are generated inline (up to a minute each), and the whole batch has to fit
  // in one function run. startPlannedPost never throws; failures are saved on the post.
  return Promise.all(planned.map((p) => startPlannedPost(p)));
}

// ---------- Advancing posts as jobs finish ----------

async function finishSlideshow(post: SocialPost): Promise<SocialPostPatch> {
  const { slides } = post.plan as SlideshowPlan;
  const rendered: string[] = [];
  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    const scene = post.jobs.find((j) => j.key === `scene-${i}`)?.outputUrl;
    const source = await fetchImage(scene ?? s.photoUrl);
    const photo = !scene && s.detail ? await detailCrop(source, SLIDE_W, SLIDE_H) : await cropTo(source, SLIDE_W, SLIDE_H);
    const jpeg = await renderSlide(photo, s.headline, s.body, i === 0 ? "cover" : s.nameLabel ? "label" : "content");
    rendered.push(await uploadToBlob(`social/${post.id}/slide-${i}.jpg`, jpeg, "image/jpeg"));
  }
  return { slides: rendered, coverImageUrl: rendered[0] };
}

async function finishMeme(post: SocialPost): Promise<SocialPostPatch> {
  const url = post.jobs.find((j) => j.key === "meme")?.outputUrl;
  if (!url) throw new Error("Meme image missing");
  const jpeg = await cropTo(await fetchImage(url), SLIDE_W, SLIDE_H);
  const stored = await uploadToBlob(`social/${post.id}/meme.jpg`, jpeg, "image/jpeg");
  return { slides: [stored], coverImageUrl: stored };
}

/**
 * Moves a generating post forward: checks its fal jobs, and once they're all done either submits
 * the next step (the reel merge) or renders the final slides. Safe to call repeatedly and in parallel.
 */
export async function advancePost(id: string): Promise<SocialPost> {
  let post = await getSocialPost(id);
  if (!post) throw new Error("Post not found");
  if (post.status !== "generating") return post;

  const refreshed = await Promise.all(post.jobs.map((j) => refreshFalJob(j)));
  if (refreshed.some((j, i) => j.status !== post!.jobs[i].status)) {
    const saved = await updateSocialPostIfUnchanged(post.id, post.updatedAt, { jobs: refreshed });
    if (!saved) return (await getSocialPost(id)) ?? post; // someone else is handling it
    post = saved;
  }

  const failed = post.jobs.find((j) => j.status === "failed");
  if (failed) return (await updateSocialPost(post.id, { status: "failed", error: failed.error ?? "Generation failed" })) ?? post;
  if (post.jobs.some((j) => j.status === "pending")) return post;

  // Everything is done: claim the post so only one caller does the finishing work.
  const claimed = await updateSocialPostIfUnchanged(post.id, post.updatedAt, { status: "rendering" });
  if (!claimed) return (await getSocialPost(id)) ?? post;
  post = claimed;

  try {
    if (post.kind === "reel") {
      const clips = post.jobs.filter((j) => j.key.startsWith("clip-")).sort((a, b) => a.key.localeCompare(b.key));
      // Reels are a single clip now: store it as is. (Older two-clip reels get merged first.)
      if (clips.length === 1) {
        const videoUrl = await copyToBlob(clips[0].outputUrl!, `social/${post.id}/reel.mp4`, "video/mp4");
        return (await updateSocialPost(post.id, { status: "pending_review", videoUrl, error: null })) ?? post;
      }
      const merge = post.jobs.find((j) => j.key === "merge");
      if (!merge) {
        const job = await submitFalJob(post.id, "merge", FAL_MODELS.merge, {
          video_urls: clips.map((c) => c.outputUrl),
          resolution: { width: REEL_W, height: REEL_H },
          target_fps: 30,
        });
        return (await updateSocialPost(post.id, { status: "generating", jobs: [...post.jobs, job] })) ?? post;
      }
      const videoUrl = await copyToBlob(merge.outputUrl!, `social/${post.id}/reel.mp4`, "video/mp4");
      return (await updateSocialPost(post.id, { status: "pending_review", videoUrl, error: null })) ?? post;
    }

    const done = post.kind === "meme" ? await finishMeme(post) : await finishSlideshow(post);
    return (await updateSocialPost(post.id, { ...done, status: "pending_review", error: null })) ?? post;
  } catch (err) {
    return fail(post, err);
  }
}

/** Advances every in-flight post. Also frees posts stuck mid-render (e.g. a function timed out). */
export async function advanceAllGenerating(): Promise<void> {
  const posts = await listSocialPosts(["generating", "rendering"]);
  const stuckMs = 10 * 60 * 1000;
  for (const p of posts) {
    try {
      if (p.status === "rendering" && Date.now() - new Date(p.updatedAt).getTime() > stuckMs) {
        await updateSocialPost(p.id, { status: "generating" });
      }
      if (p.status === "generating" || p.status === "rendering") await advancePost(p.id);
    } catch (err) {
      console.error(`[social] advance ${p.id} failed:`, err);
    }
  }
}
