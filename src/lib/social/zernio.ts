// Zernio (zernio.com) posts to the DCW TikTok and Facebook Page for us.
// Env: ZERNIO_API_KEY. Account ids are looked up by platform, or pinned with
// ZERNIO_TIKTOK_ACCOUNT_ID / ZERNIO_FACEBOOK_ACCOUNT_ID.
const BASE = "https://zernio.com/api/v1";

export function isZernioConfigured(): boolean {
  return !!process.env.ZERNIO_API_KEY;
}

async function zernio(path: string, init: RequestInit = {}) {
  const key = process.env.ZERNIO_API_KEY;
  if (!key) throw new Error("ZERNIO_API_KEY not configured");
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
}

const cachedAccounts: Record<string, string> = {};

async function accountId(platform: "tiktok" | "facebook"): Promise<string> {
  const pinned = process.env[`ZERNIO_${platform.toUpperCase()}_ACCOUNT_ID`];
  if (pinned) return pinned;
  if (cachedAccounts[platform]) return cachedAccounts[platform];

  const res = await zernio(`/accounts?platform=${platform}`);
  const data = await res.json();
  if (!res.ok) throw new Error(`Zernio accounts lookup failed: ${data.error ?? res.status}`);
  const account = (data.accounts ?? []).find(
    (a: { platform: string; isActive: boolean }) => a.platform === platform && a.isActive
  );
  if (!account) throw new Error(`No active ${platform} account connected in Zernio`);
  cachedAccounts[platform] = account._id as string;
  return cachedAccounts[platform];
}

type PostResponse = { status: number; data: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Turns a POST /posts response into the Zernio post id, or throws with the platform's error.
 * 207 means the post exists but publishing didn't fully succeed; "scheduled" there means Zernio
 * is retrying a transient error itself, so it still counts as success.
 */
function postIdFrom({ status, data }: PostResponse, platform: string): string {
  if (status === 207) {
    const postStatus = data.post?.status;
    if (postStatus === "scheduled" && data.post?._id) return data.post._id;
    const detail = data.platformResults?.find((r: { platform: string }) => r.platform === platform)?.error;
    throw new Error(`${platform} publish failed via Zernio: ${detail ?? data.error ?? postStatus ?? "unknown error"}`);
  }
  if (status < 200 || status >= 300) {
    throw new Error(`${platform} publish failed via Zernio (${status}): ${data.error ?? JSON.stringify(data)}`);
  }
  return data.post?._id ?? "unknown";
}

async function createPost(body: Record<string, unknown>): Promise<PostResponse> {
  const res = await zernio("/posts", { method: "POST", body: JSON.stringify({ ...body, publishNow: true }) });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

// ---------- TikTok ----------

type Track = { id: string; name: string; artist: string; clip?: { id: string } };

/**
 * A random track from TikTok's current trending Commercial Music Library chart. These are cleared
 * for business accounts, so posts don't get muted. Null if the chart is unavailable.
 */
async function trendingTrack(tiktokAccountId: string): Promise<{ id: string; label: string } | null> {
  try {
    const res = await zernio(`/accounts/${tiktokAccountId}/tiktok/commercial-music?countryCode=US`);
    if (!res.ok) return null;
    const { tracks } = (await res.json()) as { tracks?: Track[] };
    const pool = (tracks ?? []).slice(0, 20);
    if (!pool.length) return null;
    const t = pool[Math.floor(Math.random() * pool.length)];
    // The clip is the trending excerpt, the part people recognise.
    return { id: t.clip?.id ?? t.id, label: `${t.name} — ${t.artist}` };
  } catch {
    return null;
  }
}

// TikTok photo titles max out at 90 characters with hashtags stripped; the full caption goes in description.
function photoTitle(caption: string): string {
  const firstLine = caption.split("\n").find((l) => l.trim()) ?? "";
  return firstLine.replace(/#\S+/g, "").replace(/\s+/g, " ").trim().slice(0, 90);
}

const TIKTOK_BASE = {
  privacy_level: "PUBLIC_TO_EVERYONE",
  allow_comment: true,
  content_preview_confirmed: true,
  express_consent_given: true,
};

export async function publishTikTokPhotos(imageUrls: string[], caption: string): Promise<string> {
  const account = await accountId("tiktok");
  const track = await trendingTrack(account);

  const send = (musicSoundId?: string) =>
    createPost({
      content: photoTitle(caption),
      mediaItems: imageUrls.slice(0, 35).map((url) => ({ type: "image", url })),
      platforms: [{ platform: "tiktok", accountId: account }],
      tiktokSettings: {
        ...TIKTOK_BASE,
        media_type: "photo",
        photo_cover_index: 0,
        description: caption.slice(0, 4000),
        ...(musicSoundId ? { musicSoundInfo: { musicSoundId } } : { auto_add_music: true }),
      },
    });

  let res = await send(track?.id);
  // If the track is refused, post once more with TikTok's own music pick so the post still goes out.
  if (track && (res.status === 400 || (res.status === 207 && res.data.post?.status === "failed"))) {
    console.warn(`[social] TikTok refused track "${track.label}", retrying with auto music`);
    res = await send();
  }
  return postIdFrom(res, "tiktok");
}

export async function publishTikTokVideo(videoUrl: string, caption: string): Promise<string> {
  const account = await accountId("tiktok");
  const track = await trendingTrack(account);

  const send = (musicSoundId?: string) =>
    createPost({
      content: caption.slice(0, 2200),
      mediaItems: [{ type: "video", url: videoUrl }],
      platforms: [{ platform: "tiktok", accountId: account }],
      tiktokSettings: {
        ...TIKTOK_BASE,
        allow_duet: true,
        allow_stitch: true,
        media_type: "video",
        ...(musicSoundId ? { musicSoundInfo: { musicSoundId, musicSoundVolume: 100 }, videoOriginalSoundVolume: 0 } : {}),
      },
    });

  let res = await send(track?.id);
  if (track && (res.status === 400 || (res.status === 207 && res.data.post?.status === "failed"))) {
    console.warn(`[social] TikTok refused track "${track.label}", posting the video without it`);
    res = await send();
  }
  return postIdFrom(res, "tiktok");
}

// ---------- Facebook Page ----------

export async function publishFacebookPhotos(imageUrls: string[], caption: string): Promise<string> {
  const account = await accountId("facebook");
  const res = await createPost({
    content: caption,
    // Facebook allows up to 10 images in one post.
    mediaItems: imageUrls.slice(0, 10).map((url) => ({ type: "image", url })),
    platforms: [{ platform: "facebook", accountId: account }],
  });
  return postIdFrom(res, "facebook");
}

export async function publishFacebookReel(videoUrl: string, caption: string, title: string): Promise<string> {
  const account = await accountId("facebook");
  const res = await createPost({
    content: caption,
    mediaItems: [{ type: "video", url: videoUrl }],
    platforms: [{ platform: "facebook", accountId: account, platformSpecificData: { contentType: "reel", title } }],
  });
  return postIdFrom(res, "facebook");
}
