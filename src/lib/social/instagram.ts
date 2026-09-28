// Posts to @desertcandleworks through Meta's Graph API.
//
// Two ways to connect, picked by which env vars are set:
// - Instagram Login (INSTAGRAM_POST_ACCESS_TOKEN + INSTAGRAM_POST_USER_ID): posts everything, but
//   Meta doesn't allow attaching music to reels on this login type.
// - Facebook Login (META_PAGE_ACCESS_TOKEN + INSTAGRAM_POST_USER_ID): also attaches a trending
//   track from Meta's Instagram Audio API to reels. Used whenever it's set.

type IgConn = { host: string; token: string; userId: string; audio: boolean };

function connection(): IgConn {
  const userId = process.env.INSTAGRAM_POST_USER_ID;
  const pageToken = process.env.META_PAGE_ACCESS_TOKEN;
  const igToken = process.env.INSTAGRAM_POST_ACCESS_TOKEN;
  if (!userId || (!pageToken && !igToken)) throw new Error("Instagram posting not configured");
  return pageToken
    ? { host: "https://graph.facebook.com/v21.0", token: pageToken, userId, audio: true }
    : { host: "https://graph.instagram.com/v21.0", token: igToken!, userId, audio: false };
}

export function isInstagramConfigured(): boolean {
  return !!process.env.INSTAGRAM_POST_USER_ID && !!(process.env.META_PAGE_ACCESS_TOKEN || process.env.INSTAGRAM_POST_ACCESS_TOKEN);
}

async function igPost(c: IgConn, path: string, body: Record<string, unknown>): Promise<{ id: string }> {
  const res = await fetch(`${c.host}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, access_token: c.token }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(`Instagram: ${data.error?.message ?? res.status}`);
  return data as { id: string };
}

/** Waits for Instagram to finish processing a container. Video takes much longer than images. */
async function waitForContainer(c: IgConn, id: string, attempts: number): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const res = await fetch(`${c.host}/${id}?fields=status_code,status&access_token=${c.token}`, { cache: "no-store" });
    const data = await res.json();
    if (data.status_code === "FINISHED") return;
    if (data.status_code === "ERROR") throw new Error(`Instagram couldn't process the media: ${data.status ?? "unknown error"}`);
  }
  throw new Error("Instagram took too long to process the media");
}

async function publishContainer(c: IgConn, creationId: string): Promise<string> {
  const { id } = await igPost(c, `/${c.userId}/media_publish`, { creation_id: creationId });
  return id;
}

export async function publishInstagramImage(imageUrl: string, caption: string): Promise<string> {
  const c = connection();
  const { id } = await igPost(c, `/${c.userId}/media`, { image_url: imageUrl, caption });
  await waitForContainer(c, id, 12);
  return publishContainer(c, id);
}

export async function publishInstagramCarousel(imageUrls: string[], caption: string): Promise<string> {
  if (imageUrls.length < 2) return publishInstagramImage(imageUrls[0], caption);
  const c = connection();
  const children = await Promise.all(
    imageUrls.slice(0, 10).map((url) => igPost(c, `/${c.userId}/media`, { image_url: url, is_carousel_item: true }).then((r) => r.id))
  );
  await Promise.all(children.map((id) => waitForContainer(c, id, 12)));
  const { id } = await igPost(c, `/${c.userId}/media`, { media_type: "CAROUSEL", children, caption });
  await waitForContainer(c, id, 12);
  return publishContainer(c, id);
}

/** A random pick from Meta's trending, third-party-cleared music. Null if unavailable. */
async function trendingAudioId(c: IgConn): Promise<string | null> {
  try {
    const res = await fetch(`${c.host}/ig_audio?audio_type=music&user_id=${c.userId}&access_token=${c.token}`, { cache: "no-store" });
    const data = await res.json();
    const pool = ((data.audio ?? []) as Array<{ audio_id: string }>).slice(0, 20);
    return pool.length ? pool[Math.floor(Math.random() * pool.length)].audio_id : null;
  } catch {
    return null;
  }
}

export async function publishInstagramReel(videoUrl: string, caption: string, coverUrl?: string | null): Promise<string> {
  const c = connection();
  const audioId = c.audio ? await trendingAudioId(c) : null;
  const { id } = await igPost(c, `/${c.userId}/media`, {
    media_type: "REELS",
    video_url: videoUrl,
    caption,
    share_to_feed: true,
    ...(coverUrl ? { cover_url: coverUrl } : {}),
    ...(audioId ? { audio_configuration: { audio_id: audioId, audio_volume: 100, video_volume: 0 } } : {}),
  });
  await waitForContainer(c, id, 36);
  return publishContainer(c, id);
}
