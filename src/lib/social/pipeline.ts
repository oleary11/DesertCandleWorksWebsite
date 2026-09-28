import { FAL_COST_CENTS, FAL_MODELS, refreshFalJob, submitFalJob } from "./fal";
import {
  absoluteUrl,
  isOpenAIConfigured,
  listSocialProducts,
  planBatch,
  writeReelCopy,
  type PlannedPost,
} from "./content";
import { REEL_H, REEL_W, SLIDE_H, SLIDE_W, copyToBlob, cropTo, detailCrop, fetchImage, renderSlide, uploadToBlob } from "./render";
import {
  createSocialPost,
  getSocialPost,
  listSocialPosts,
  recentHooks,
  updateSocialPost,
  updateSocialPostIfUnchanged,
  type SocialPostPatch,
} from "./store";
import type { FalJob, MemePlan, ReelPlan, SlideshowPlan, SocialPost } from "./types";

const REEL_CLIP_SECONDS = 5;

// Kling reads the photo as the first frame, so these only describe motion. Restrained motion keeps
// the label and glass stable, which is what makes it read as real footage rather than AI.
const CLIP_MOTION = [
  "Locked-off tripod shot. Soft natural light slowly drifts across the glass and the room, like a cloud passing the sun, and the reflections on the bottle shift gently. If a flame is already visible it flickers softly; do not add one. Everything else stays perfectly still.",
  "Very slow, smooth dolly push-in toward the candle, like a high-end commercial. Reflections on the glass move naturally with the camera. If a flame is already visible it flickers softly; do not add one. Calm, steady, cinematic.",
];

const CLIP_NEGATIVE =
  "changing label, warped text, morphing bottle, melting glass, distorted shape, extra objects, people, hands, fast motion, camera shake, blur, low quality, cartoon, CGI, oversaturated";

const SCENE_PROMPT = (setting: string) =>
  `Use the candle from the reference photo exactly as it is: same bottle shape, glass color, label artwork, every letter of the label text, wax and wick. Keep every color on the candle identical to the reference, including the exact color of the label printing, even where it is faint or low contrast. Do not redraw, restyle, re-letter, recolor, resize or change the candle in any way. Only change what is around it.

New setting: ${setting}

Photorealistic editorial product photograph, full-frame camera, 50mm lens, natural light that matches on the candle and the scene, true-to-life color, soft realistic shadows, subtle film grain. The candle is the clear subject and in sharp focus. No people, no hands, no added text or logos, no other bottles.`;

const MEME_STYLE =
  "Crisp, shareable social media meme image. Render the caption text exactly as written, correctly spelled, in a bold clean meme font with strong contrast. No people, faces, hands or characters.";

// ---------- Creating posts ----------

async function fail(post: SocialPost, err: unknown): Promise<SocialPost> {
  const error = err instanceof Error ? err.message : String(err);
  console.error(`[social] post ${post.id} failed:`, error);
  return (await updateSocialPost(post.id, { status: "failed", error })) ?? post;
}

/** Starts a reel for a product the admin picked, from one or two of its photos. */
export async function createReel(productSlug: string, photoUrls: string[], motionNotes?: string): Promise<SocialPost> {
  const product = (await listSocialProducts()).find((p) => p.slug === productSlug);
  if (!product) throw new Error("Product not found or has no social photos");
  if (!photoUrls.length) throw new Error("Pick at least one photo");

  const sources = photoUrls.slice(0, 2);
  const post = await createSocialPost({ kind: "reel", productSlug, hook: product.name });

  try {
    // Kling takes its aspect ratio from the first frame, and Reels need 9:16.
    const startFrames = await Promise.all(
      sources.map(async (url, i) =>
        uploadToBlob(`social/${post.id}/start-${i}.jpg`, await cropTo(await fetchImage(url), REEL_W, REEL_H), "image/jpeg")
      )
    );
    // One photo: both clips use it with different motion. Two: one clip each.
    const frames = [startFrames[0], startFrames[1] ?? startFrames[0]];
    const prompts = CLIP_MOTION.map((m) => (motionNotes ? `${m} ${motionNotes}` : m));

    const copy = isOpenAIConfigured()
      ? await writeReelCopy(product, motionNotes, await recentHooks())
      : { hook: product.name, caption: "", hashtags: [] };

    const jobs: FalJob[] = await Promise.all(
      frames.map((frame, i) =>
        submitFalJob(post.id, `clip-${i}`, FAL_MODELS.video, {
          start_image_url: frame,
          prompt: prompts[i],
          negative_prompt: CLIP_NEGATIVE,
          duration: String(REEL_CLIP_SECONDS),
          generate_audio: false,
        })
      )
    );

    const plan: ReelPlan = { sourceImages: sources, startFrames, prompts, motionNotes };
    return (
      (await updateSocialPost(post.id, {
        ...copy,
        plan,
        jobs,
        coverImageUrl: startFrames[0],
        costCents: Math.round(frames.length * REEL_CLIP_SECONDS * FAL_COST_CENTS.videoPerSecond),
      })) ?? post
    );
  } catch (err) {
    return fail(post, err);
  }
}

async function startPlannedPost(planned: PlannedPost): Promise<SocialPost> {
  if (planned.kind === "meme") {
    const plan: MemePlan = { memePrompt: planned.memePrompt };
    const post = await createSocialPost({ kind: "meme", hook: planned.hook, caption: planned.caption, hashtags: planned.hashtags, plan });
    try {
      const job = await submitFalJob(post.id, "meme", FAL_MODELS.image, {
        prompt: `${planned.memePrompt}\n\n${MEME_STYLE}`,
        aspect_ratio: "4:5",
        resolution: "2K",
        output_format: "png",
      });
      return (await updateSocialPost(post.id, { jobs: [job], costCents: FAL_COST_CENTS.image })) ?? post;
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

/** Plans and starts a batch of slideshows and memes. Scenes and memes finish asynchronously. */
export async function createBatch(slideshows: number, memes: number): Promise<SocialPost[]> {
  const planned = await planBatch(slideshows, memes, await recentHooks());
  const posts: SocialPost[] = [];
  for (const p of planned) posts.push(await startPlannedPost(p));
  return posts;
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
    const jpeg = await renderSlide(photo, s.headline, s.body, i === 0);
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
      const merge = post.jobs.find((j) => j.key === "merge");
      if (!merge) {
        const clips = post.jobs.filter((j) => j.key.startsWith("clip-")).sort((a, b) => a.key.localeCompare(b.key));
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
