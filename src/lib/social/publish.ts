import { isInstagramConfigured, publishInstagramCarousel, publishInstagramImage, publishInstagramReel } from "./instagram";
import {
  isZernioConfigured,
  publishFacebookPhotos,
  publishFacebookReel,
  publishTikTokPhotos,
  publishTikTokVideo,
} from "./zernio";
import { compactQueue, getSocialPost, listQueue, updateSocialPost, updateSocialPostIfUnchanged } from "./store";
import type { SocialPost } from "./types";

function fullCaption(post: SocialPost): string {
  const tags = post.hashtags.map((h) => `#${h}`).join(" ");
  return tags ? `${post.caption}\n\n${tags}` : post.caption;
}

type Platform = "instagram" | "tiktok" | "facebook";

async function publishTo(platform: Platform, post: SocialPost, caption: string): Promise<string> {
  const images = post.slides;
  if (post.kind === "reel") {
    if (!post.videoUrl) throw new Error("Reel has no video");
    if (platform === "instagram") return publishInstagramReel(post.videoUrl, caption, post.coverImageUrl);
    if (platform === "tiktok") return publishTikTokVideo(post.videoUrl, caption);
    return publishFacebookReel(post.videoUrl, caption, post.hook);
  }
  if (!images.length) throw new Error("Post has no images");
  if (platform === "instagram") {
    return images.length > 1 ? publishInstagramCarousel(images, caption) : publishInstagramImage(images[0], caption);
  }
  if (platform === "tiktok") return publishTikTokPhotos(images, caption);
  return publishFacebookPhotos(images, caption);
}

/**
 * Posts to every configured platform. Platforms fail independently; one that already succeeded
 * (its post id is saved) is skipped on a retry so nothing double-posts.
 */
export async function publishPost(id: string): Promise<SocialPost> {
  const post = await getSocialPost(id);
  if (!post) throw new Error("Post not found");
  if (post.status === "published") return post;

  const claimed = await updateSocialPostIfUnchanged(post.id, post.updatedAt, { status: "publishing", error: null });
  if (!claimed) throw new Error("Post is already being published");

  const caption = fullCaption(claimed);
  const targets: Array<{ platform: Platform; done: string | null; on: boolean }> = [
    { platform: "instagram", done: claimed.instagramPostId, on: isInstagramConfigured() },
    { platform: "tiktok", done: claimed.tiktokPostId, on: isZernioConfigured() },
    { platform: "facebook", done: claimed.facebookPostId, on: isZernioConfigured() },
  ];

  const ids: Partial<Record<Platform, string>> = {};
  const errors: string[] = [];
  await Promise.all(
    targets
      .filter((t) => t.on && !t.done)
      .map(async (t) => {
        try {
          ids[t.platform] = await publishTo(t.platform, claimed, caption);
        } catch (err) {
          errors.push(`${t.platform}: ${err instanceof Error ? err.message : String(err)}`);
        }
      })
  );

  const anySuccess = targets.some((t) => t.done) || Object.keys(ids).length > 0;
  const updated = await updateSocialPost(post.id, {
    status: anySuccess ? "published" : "failed",
    error: errors.length ? errors.join("\n") : null,
    queueOrder: null,
    ...(anySuccess ? { publishedAt: new Date() } : {}),
    ...(ids.instagram ? { instagramPostId: ids.instagram } : {}),
    ...(ids.tiktok ? { tiktokPostId: ids.tiktok } : {}),
    ...(ids.facebook ? { facebookPostId: ids.facebook } : {}),
  });
  await compactQueue();
  return updated ?? claimed;
}

/** Publishes the approved post at the front of the queue, if any. Used by the posting crons. */
export async function publishNextInQueue(): Promise<SocialPost | null> {
  const [next] = await listQueue();
  return next ? publishPost(next.id) : null;
}
