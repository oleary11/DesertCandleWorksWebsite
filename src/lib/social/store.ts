import { db } from "@/lib/db/client";
import { socialPosts, socialExcludedImages } from "@/lib/db/schema";
import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";
import type { SocialPost, SocialStatus } from "./types";

type Row = typeof socialPosts.$inferSelect;

function toPost(r: Row): SocialPost {
  return {
    id: r.id,
    kind: r.kind as SocialPost["kind"],
    status: r.status as SocialStatus,
    productSlug: r.productSlug,
    hook: r.hook,
    caption: r.caption,
    hashtags: (r.hashtags as string[]) ?? [],
    plan: (r.plan as SocialPost["plan"]) ?? {},
    jobs: (r.jobs as SocialPost["jobs"]) ?? [],
    slides: (r.slides as string[]) ?? [],
    videoUrl: r.videoUrl,
    coverImageUrl: r.coverImageUrl,
    costCents: r.costCents,
    queueOrder: r.queueOrder,
    error: r.error,
    publishedAt: r.publishedAt?.toISOString() ?? null,
    instagramPostId: r.instagramPostId,
    tiktokPostId: r.tiktokPostId,
    facebookPostId: r.facebookPostId,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export type NewSocialPost = {
  kind: SocialPost["kind"];
  productSlug?: string | null;
  hook?: string;
  caption?: string;
  hashtags?: string[];
  plan?: SocialPost["plan"];
};

export async function createSocialPost(p: NewSocialPost): Promise<SocialPost> {
  const [row] = await db
    .insert(socialPosts)
    .values({
      kind: p.kind,
      productSlug: p.productSlug ?? null,
      hook: p.hook ?? "",
      caption: p.caption ?? "",
      hashtags: p.hashtags ?? [],
      plan: p.plan ?? {},
      // Set from JS (millisecond precision) so updateSocialPostIfUnchanged can match it exactly;
      // Postgres now() carries microseconds that a JS Date can't round-trip.
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();
  return toPost(row);
}

export async function getSocialPost(id: string): Promise<SocialPost | null> {
  const [row] = await db.select().from(socialPosts).where(eq(socialPosts.id, id)).limit(1);
  return row ? toPost(row) : null;
}

export type SocialPostPatch = Partial<
  Pick<
    SocialPost,
    | "status"
    | "hook"
    | "caption"
    | "hashtags"
    | "plan"
    | "jobs"
    | "slides"
    | "videoUrl"
    | "coverImageUrl"
    | "costCents"
    | "queueOrder"
    | "error"
    | "instagramPostId"
    | "tiktokPostId"
    | "facebookPostId"
  >
> & { publishedAt?: Date | null };

export async function updateSocialPost(id: string, patch: SocialPostPatch): Promise<SocialPost | null> {
  const [row] = await db
    .update(socialPosts)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(socialPosts.id, id))
    .returning();
  return row ? toPost(row) : null;
}

/**
 * Updates only if nobody else touched the post since `seenUpdatedAt` (webhooks for a post's jobs
 * can land at the same moment). Returns null when another writer got there first.
 */
export async function updateSocialPostIfUnchanged(
  id: string,
  seenUpdatedAt: string,
  patch: SocialPostPatch
): Promise<SocialPost | null> {
  const [row] = await db
    .update(socialPosts)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(socialPosts.id, id), eq(socialPosts.updatedAt, new Date(seenUpdatedAt))))
    .returning();
  return row ? toPost(row) : null;
}

export async function deleteSocialPost(id: string): Promise<void> {
  await db.delete(socialPosts).where(eq(socialPosts.id, id));
}

export async function listSocialPosts(statuses?: SocialStatus[], limit = 100): Promise<SocialPost[]> {
  const rows = await db
    .select()
    .from(socialPosts)
    .where(statuses?.length ? inArray(socialPosts.status, statuses) : undefined)
    .orderBy(desc(socialPosts.createdAt))
    .limit(limit);
  return rows.map(toPost);
}

/** Approved posts in the order they'll go out. */
export async function listQueue(): Promise<SocialPost[]> {
  const rows = await db
    .select()
    .from(socialPosts)
    .where(eq(socialPosts.status, "approved"))
    .orderBy(asc(socialPosts.queueOrder), asc(socialPosts.createdAt));
  return rows.map(toPost);
}

export async function nextQueueOrder(): Promise<number> {
  const rows = await db
    .select({ q: socialPosts.queueOrder })
    .from(socialPosts)
    .where(and(eq(socialPosts.status, "approved"), isNotNull(socialPosts.queueOrder)))
    .orderBy(desc(socialPosts.queueOrder))
    .limit(1);
  return (rows[0]?.q ?? 0) + 1;
}

/** Renumbers the approved queue to 1…N in its current order. */
export async function compactQueue(): Promise<void> {
  const queue = await listQueue();
  await Promise.all(
    queue.map((p, i) => (p.queueOrder === i + 1 ? null : updateSocialPost(p.id, { queueOrder: i + 1 })))
  );
}

export async function recentHooks(limit = 30): Promise<string[]> {
  const rows = await db
    .select({ hook: socialPosts.hook })
    .from(socialPosts)
    .orderBy(desc(socialPosts.createdAt))
    .limit(limit);
  return rows.map((r) => r.hook).filter(Boolean);
}

export async function listExcludedImages(): Promise<Set<string>> {
  const rows = await db.select().from(socialExcludedImages);
  return new Set(rows.map((r) => r.imageUrl));
}

export async function setImageExcluded(imageUrl: string, excluded: boolean): Promise<void> {
  if (excluded) {
    await db.insert(socialExcludedImages).values({ imageUrl }).onConflictDoNothing();
  } else {
    await db.delete(socialExcludedImages).where(eq(socialExcludedImages.imageUrl, imageUrl));
  }
}
