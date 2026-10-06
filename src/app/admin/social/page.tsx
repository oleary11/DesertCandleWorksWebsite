"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Clapperboard,
  ImageIcon,
  Laugh,
  Loader2,
  Send,
  Sparkles,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { useModal } from "@/hooks/useModal";
import CandleSpinner from "@/components/CandleSpinner";
import SlideCarousel from "./SlideCarousel";
import PageHeader from "../_components/PageHeader";
import { Badge, Menu, Tabs } from "../_components/ui";

/* ---------- Types (mirror src/lib/social/types.ts) ---------- */
type Kind = "reel" | "slideshow" | "meme";
type Status = "generating" | "rendering" | "pending_review" | "approved" | "publishing" | "published" | "failed" | "rejected";

type Post = {
  id: string;
  kind: Kind;
  status: Status;
  productSlug: string | null;
  hook: string;
  caption: string;
  hashtags: string[];
  slides: string[];
  videoUrl: string | null;
  coverImageUrl: string | null;
  costCents: number;
  queueOrder: number | null;
  error: string | null;
  publishedAt: string | null;
  instagramPostId: string | null;
  tiktokPostId: string | null;
  facebookPostId: string | null;
  createdAt: string;
};

type Photo = { url: string; enabled: boolean };
type ProductPhotos = { slug: string; name: string; photos: Photo[] };

type Tab = "review" | "queue" | "history" | "reel" | "photos";

const KIND_META: Record<Kind, { label: string; icon: typeof Clapperboard }> = {
  reel: { label: "Reel", icon: Clapperboard },
  slideshow: { label: "Slideshow", icon: ImageIcon },
  meme: { label: "Meme", icon: Laugh },
};

const STATUS_LABEL: Record<Status, string> = {
  generating: "Generating…",
  rendering: "Finishing…",
  pending_review: "Needs review",
  approved: "Queued",
  publishing: "Posting…",
  published: "Posted",
  failed: "Failed",
  rejected: "Rejected",
};

// Mirrors the fal prices in src/lib/social/fal.ts, for the estimates shown before generating.
const REEL_COST = 1.4;
const SCENE_COST = 0.15;

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

/* ---------- Page ---------- */
export default function AdminSocialPage() {
  const { showAlert, showConfirm } = useModal();
  const [tab, setTab] = useState<Tab>("review");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [batch, setBatch] = useState({ collections: 2, slideshows: 1, memes: 1 });

  const load = useCallback(async (view: Tab) => {
    if (view === "reel" || view === "photos") return;
    try {
      const data = await api<{ posts: Post[] }>(`/api/admin/social/posts?view=${view}`);
      setPosts(data.posts);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load(tab);
  }, [tab, load]);

  // While anything is generating, nudge it along (fal webhooks can't reach local dev) and refresh.
  const inFlight = posts.some((p) => p.status === "generating" || p.status === "rendering");
  const tabRef = useRef(tab);
  tabRef.current = tab;
  useEffect(() => {
    if (!inFlight || tab !== "review") return;
    const t = setInterval(async () => {
      await fetch("/api/admin/social/advance", { method: "POST" }).catch(() => {});
      load(tabRef.current);
    }, 15000);
    return () => clearInterval(t);
  }, [inFlight, tab, load]);

  async function generateBatch() {
    setGenerating(true);
    try {
      await api("/api/admin/social/generate", { method: "POST", body: JSON.stringify(batch) });
      setTab("review");
      await load("review");
    } catch (err) {
      await showAlert(err instanceof Error ? err.message : "Generate failed", "Couldn't generate");
    } finally {
      setGenerating(false);
    }
  }

  async function act(post: Post, action: string, copy?: Partial<Post>) {
    try {
      await api(`/api/admin/social/posts/${post.id}`, { method: "PATCH", body: JSON.stringify({ action, ...copy }) });
      await load(tab);
    } catch (err) {
      await showAlert(err instanceof Error ? err.message : "Update failed", "Couldn't update");
    }
  }

  async function remove(post: Post) {
    if (!(await showConfirm("Delete this post? This can't be undone.", "Delete post"))) return;
    try {
      await api(`/api/admin/social/posts/${post.id}`, { method: "DELETE" });
      await load(tab);
    } catch (err) {
      await showAlert(err instanceof Error ? err.message : "Delete failed", "Couldn't delete");
    }
  }

  async function publishNow(post: Post) {
    if (!(await showConfirm("Post this to Instagram, TikTok and Facebook right now?", "Post now"))) return;
    setPosts((ps) => ps.map((p) => (p.id === post.id ? { ...p, status: "publishing" } : p)));
    try {
      const { post: done } = await api<{ post: Post }>(`/api/admin/social/posts/${post.id}/publish`, { method: "POST" });
      if (done.error) await showAlert(done.error, done.status === "published" ? "Posted, with some errors" : "Posting failed");
    } catch (err) {
      await showAlert(err instanceof Error ? err.message : "Publish failed", "Posting failed");
    }
    await load(tab);
  }

  const counts = useMemo(() => {
    const c = { review: 0, generating: 0 };
    for (const p of posts) {
      if (p.status === "pending_review") c.review++;
      if (p.status === "generating" || p.status === "rendering") c.generating++;
    }
    return c;
  }, [posts]);

  const batchCost = batch.slideshows * 1.5 * SCENE_COST;

  const [batchOpen, setBatchOpen] = useState(false);

  return (
    <div className="a-ui mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Social media"
        description="Reels, slideshows and memes for Instagram, TikTok and Facebook."
        actions={
          <>
            <button className="a-btn" onClick={() => setTab("reel")}>
              <Clapperboard className="h-4 w-4" aria-hidden />
              New reel
            </button>
            <Menu
              primary
              panel
              label={
                <>
                  <Sparkles className="h-4 w-4" aria-hidden />
                  Generate batch
                </>
              }
              open={batchOpen}
              onOpenChange={setBatchOpen}
            >
              <p className="text-sm font-semibold text-[var(--a-ink)]">Generate a batch</p>
              <p className="mb-3 mt-0.5 text-xs text-[var(--a-muted)]">New posts land in Review for you to approve.</p>
              <div className="space-y-2.5">
                {(
                  [
                    { key: "collections", label: "Collections", hint: "Several products, real photos only", max: 12 },
                    { key: "slideshows", label: "Slideshows", hint: "One product, 1–2 AI scene slides", max: 12 },
                    { key: "memes", label: "Memes", hint: "Real meme templates with custom captions", max: 6 },
                  ] as const
                ).map((row) => (
                  <label key={row.key} className="flex items-center justify-between gap-4">
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-[var(--a-ink)]">{row.label}</span>
                      <span className="block text-xs text-[var(--a-muted)]">{row.hint}</span>
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={row.max}
                      className="a-input h-9 w-16 text-center tabular-nums"
                      value={batch[row.key]}
                      onChange={(e) => setBatch((b) => ({ ...b, [row.key]: Number(e.target.value) }))}
                    />
                  </label>
                ))}
              </div>
              <button
                className="a-btn a-btn-primary mt-4 w-full"
                onClick={() => {
                  setBatchOpen(false);
                  void generateBatch();
                }}
                disabled={generating}
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
                {generating ? "Planning…" : `Generate · about $${batchCost.toFixed(2)}`}
              </button>
            </Menu>
          </>
        }
      />

      <Tabs
        label="Posts"
        value={tab === "reel" ? null : tab}
        onChange={setTab}
        tabs={[
          { value: "review", label: "Review", count: tab === "review" ? counts.review : undefined },
          { value: "queue", label: "Queue" },
          { value: "history", label: "History" },
          { value: "photos", label: "Photos" },
        ]}
      />

      {generating && (
        <p role="status" className="mb-4 flex items-center gap-2 text-sm text-[var(--a-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Planning the batch…
        </p>
      )}

      {tab === "reel" ? (
        <NewReel onCreated={() => setTab("review")} onCancel={() => setTab("review")} />
      ) : tab === "photos" ? (
        <PhotoLibrary />
      ) : loading ? (
        <div className="flex flex-col items-center justify-center gap-4 py-16">
          <CandleSpinner />
          <p className="text-sm font-medium text-[var(--a-muted)]">Loading posts…</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="a-card px-6 py-16 text-center">
          <p className="font-medium text-[var(--a-ink)]">
            {tab === "review" ? "Nothing to review" : tab === "queue" ? "The queue is empty" : "Nothing posted yet"}
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-[var(--a-muted)]">
            {tab === "review"
              ? "Generate a batch or start a new reel."
              : tab === "queue"
                ? "Approve posts in Review and they'll go out at 7:30 AM and 6 PM, one per slot."
                : "Posts appear here once they go out."}
          </p>
        </div>
      ) : (
        <>
          {tab === "review" && counts.generating > 0 && (
            <p className="mb-4 flex items-center gap-2 text-sm text-[var(--a-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {counts.generating} generating. Reels take a few minutes; this page checks every 15 seconds.
            </p>
          )}
          {tab === "queue" && (
            <p className="mb-4 text-sm text-[var(--a-muted)]">Posts go out at 7:30 AM and 6 PM, one per slot, in this order.</p>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p, i) => (
              <PostCard
                key={p.id}
                post={p}
                isFirst={i === 0}
                isLast={i === posts.length - 1}
                onAct={(action, copy) => act(p, action, copy)}
                onDelete={() => remove(p)}
                onPublish={() => publishNow(p)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- Post card ---------- */
function PostCard({
  post,
  isFirst,
  isLast,
  onAct,
  onDelete,
  onPublish,
}: {
  post: Post;
  isFirst: boolean;
  isLast: boolean;
  onAct: (action: string, copy?: Partial<Post>) => void;
  onDelete: () => void;
  onPublish: () => void;
}) {
  const [caption, setCaption] = useState(post.caption);
  const [hook, setHook] = useState(post.hook);
  const [tags, setTags] = useState(post.hashtags.join(" "));
  const meta = KIND_META[post.kind];
  const Icon = meta.icon;
  const busy = post.status === "generating" || post.status === "rendering" || post.status === "publishing";
  const editable = post.status === "pending_review" || post.status === "approved" || post.status === "failed";
  const hasMedia = post.kind === "reel" ? !!post.videoUrl : post.slides.length > 0;

  const copy = () => ({
    caption,
    hook,
    hashtags: tags.split(/[\s,]+/).filter(Boolean),
  });
  const dirty = caption !== post.caption || hook !== post.hook || tags !== post.hashtags.join(" ");
  const statusTone = post.status === "failed" ? "red" : post.status === "published" ? "green" : post.status === "pending_review" ? "amber" : "neutral";

  return (
    <article className="a-card flex flex-col overflow-hidden">
      {/* Media */}
      <div className={`relative bg-[#1c1916] ${post.kind === "reel" ? "aspect-[9/16]" : "aspect-[4/5]"}`}>
        {post.kind === "reel" && post.videoUrl ? (
          <video src={post.videoUrl} poster={post.coverImageUrl ?? undefined} controls loop playsInline className="h-full w-full object-cover" />
        ) : post.slides.length ? (
          <SlideCarousel slides={post.slides} />
        ) : post.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.coverImageUrl} alt="" className="h-full w-full object-cover opacity-60" />
        ) : null}
        {busy && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/45 text-sm text-white">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
            {STATUS_LABEL[post.status]}
          </div>
        )}
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium text-[var(--a-ink)] shadow-sm backdrop-blur">
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {meta.label}
        </span>
        {post.queueOrder && (
          <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-xs font-semibold text-[var(--a-ink)] shadow-sm">
            #{post.queueOrder}
          </span>
        )}
      </div>

      {/* Copy */}
      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex items-center justify-between gap-2 text-xs text-[var(--a-muted)]">
          <span className="flex min-w-0 items-center gap-2">
            <Badge tone={statusTone}>{STATUS_LABEL[post.status]}</Badge>
            {post.productSlug && <span className="truncate">{post.productSlug}</span>}
          </span>
          <span className="shrink-0 tabular-nums">{money(post.costCents)}</span>
        </div>

        {editable ? (
          <>
            <label className="block">
              <span className="sr-only">Hook</span>
              <input className="a-input font-medium" value={hook} onChange={(e) => setHook(e.target.value)} placeholder="Hook" />
            </label>
            <label className="block">
              <span className="sr-only">Caption</span>
              <textarea className="a-textarea" rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption" />
            </label>
            <label className="block">
              <span className="sr-only">Hashtags</span>
              <input className="a-input text-xs" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="hashtags separated by spaces" />
            </label>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-[var(--a-ink)]">{post.hook}</p>
            <p className="whitespace-pre-line text-sm text-[var(--a-muted)]">{post.caption}</p>
            <p className="text-xs text-[var(--a-faint)]">{post.hashtags.map((h) => `#${h}`).join(" ")}</p>
          </>
        )}

        {post.error && <p className="whitespace-pre-line rounded-md bg-[#fdecea] px-2.5 py-2 text-xs text-[#7a1a12]">{post.error}</p>}

        {post.status === "published" && (
          <p className="text-xs text-[var(--a-muted)]">
            {[post.instagramPostId && "Instagram", post.tiktokPostId && "TikTok", post.facebookPostId && "Facebook"].filter(Boolean).join(" · ")}
            {post.publishedAt ? ` · ${new Date(post.publishedAt).toLocaleString()}` : ""}
          </p>
        )}

        {/* Actions */}
        <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-[var(--a-line)] pt-3">
          {post.status === "pending_review" && (
            <>
              <button className="a-btn a-btn-primary a-btn-sm" onClick={() => onAct("approve", copy())}>
                <Check className="h-3.5 w-3.5" aria-hidden /> Approve
              </button>
              <button className="a-btn a-btn-sm" onClick={() => onAct("reject", copy())}>
                <X className="h-3.5 w-3.5" aria-hidden /> Reject
              </button>
            </>
          )}
          {post.status === "approved" && (
            <>
              <button className="a-btn a-btn-primary a-btn-sm" onClick={onPublish}>
                <Send className="h-3.5 w-3.5" aria-hidden /> Post now
              </button>
              <button className="a-btn a-btn-sm" onClick={() => onAct("unqueue")}>
                <Undo2 className="h-3.5 w-3.5" aria-hidden /> Unqueue
              </button>
              <button className="a-icon-btn h-8 w-8" disabled={isFirst} onClick={() => onAct("up")} aria-label="Move up in queue" title="Move up">
                <ArrowUp className="h-4 w-4" aria-hidden />
              </button>
              <button className="a-icon-btn h-8 w-8" disabled={isLast} onClick={() => onAct("down")} aria-label="Move down in queue" title="Move down">
                <ArrowDown className="h-4 w-4" aria-hidden />
              </button>
            </>
          )}
          {post.status === "failed" && hasMedia && (
            <button className="a-btn a-btn-primary a-btn-sm" onClick={() => onAct("approve", copy())}>
              <Check className="h-3.5 w-3.5" aria-hidden /> Approve
            </button>
          )}
          {editable && dirty && post.status !== "pending_review" && (
            <button className="a-btn a-btn-sm" onClick={() => onAct("", copy())}>
              Save
            </button>
          )}
          {!busy && (
            <button className="a-icon-btn a-icon-btn-danger ml-auto h-8 w-8" onClick={onDelete} aria-label="Delete post" title="Delete">
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

/* ---------- New reel ---------- */
function useProducts() {
  const [products, setProducts] = useState<ProductPhotos[] | null>(null);
  const reload = useCallback(async () => {
    const data = await api<{ products: ProductPhotos[] }>("/api/admin/social/products");
    setProducts(data.products);
  }, []);
  useEffect(() => {
    reload().catch(console.error);
  }, [reload]);
  return { products, setProducts, reload };
}

function NewReel({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const { showAlert } = useModal();
  const { products } = useProducts();
  const [slug, setSlug] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const product = products?.find((p) => p.slug === slug);

  function toggle(url: string) {
    setPicked((cur) => (cur[0] === url ? [] : [url]));
  }

  async function submit() {
    setSubmitting(true);
    try {
      await api("/api/admin/social/reel", { method: "POST", body: JSON.stringify({ productSlug: slug, photoUrls: picked, notes }) });
      onCreated();
    } catch (err) {
      await showAlert(err instanceof Error ? err.message : "Reel failed", "Couldn't start the reel");
    } finally {
      setSubmitting(false);
    }
  }

  if (!products) {
    return (
      <div className="flex justify-center py-16">
        <CandleSpinner />
      </div>
    );
  }

  return (
    <div className="a-card max-w-3xl">
      <div className="border-b border-[var(--a-line)] px-5 py-4 sm:px-6">
        <h2 className="text-lg font-semibold tracking-tight text-[var(--a-ink)]">New reel</h2>
        <p className="mt-0.5 text-sm text-[var(--a-muted)]">
          One 10 second cinematic shot from a single photo: a slow push-in, a slight orbit, and a close-up on the label. The candle stays
          unlit and unchanged.
        </p>
      </div>

      <div className="space-y-6 px-5 py-5 sm:px-6">
        <div>
          <label htmlFor="reel-product" className="a-label">
            1. Product
          </label>
          <select
            id="reel-product"
            className="a-select sm:max-w-sm"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setPicked([]);
            }}
          >
            <option value="">Choose a product…</option>
            {products.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="a-label">2. Photo</p>
          {product ? (
            <>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {product.photos.map((ph) => {
                  const selected = picked.includes(ph.url);
                  return (
                    <button
                      key={ph.url}
                      type="button"
                      onClick={() => toggle(ph.url)}
                      aria-pressed={selected}
                      className={`relative aspect-[3/4] overflow-hidden rounded-lg ring-offset-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--a-accent)] ${
                        selected ? "ring-2 ring-[var(--a-ink)]" : "ring-1 ring-[var(--a-line)] hover:ring-[var(--a-line-strong)]"
                      } ${ph.enabled ? "" : "opacity-50"}`}
                      title={ph.enabled ? undefined : "Switched off for social in Photos"}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={ph.url} alt="" className="h-full w-full object-cover" />
                      {selected && (
                        <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--a-ink)] text-white">
                          <Check className="h-4 w-4" aria-hidden />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="a-help">Pick a sharp, well lit photo with the label facing the camera. It&apos;s cropped to 9:16 around the candle.</p>
            </>
          ) : (
            <p className="rounded-lg border border-dashed border-[var(--a-line-strong)] px-4 py-6 text-center text-sm text-[var(--a-muted)]">
              Choose a product to see its photos.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="reel-notes" className="a-label">
            3. Notes <span className="font-normal text-[var(--a-muted)]">(optional)</span>
          </label>
          <textarea
            id="reel-notes"
            className="a-textarea"
            rows={2}
            maxLength={300}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. moody evening feel, new fall scent"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--a-line)] bg-[var(--a-canvas)] px-5 py-3 sm:px-6">
        <p className="text-xs text-[var(--a-muted)]">About ${REEL_COST.toFixed(2)} and a few minutes to generate.</p>
        <div className="flex gap-2">
          <button className="a-btn" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button className="a-btn a-btn-primary" disabled={!slug || !picked.length || submitting} onClick={submit}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Clapperboard className="h-4 w-4" aria-hidden />}
            {submitting ? "Starting…" : "Generate reel"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Photo library ---------- */
function PhotoLibrary() {
  const { showAlert } = useModal();
  const { products, setProducts } = useProducts();

  async function toggle(slug: string, url: string, enabled: boolean) {
    setProducts((ps) =>
      ps?.map((p) => (p.slug === slug ? { ...p, photos: p.photos.map((ph) => (ph.url === url ? { ...ph, enabled } : ph)) } : p)) ?? ps
    );
    try {
      await api("/api/admin/social/photos", { method: "POST", body: JSON.stringify({ url, enabled }) });
    } catch (err) {
      await showAlert(err instanceof Error ? err.message : "Update failed", "Couldn't update photo");
    }
  }

  if (!products) {
    return (
      <div className="flex justify-center py-16">
        <CandleSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--a-muted)]">
        Slideshows only use photos switched on here. Tap a photo to switch it off if it looks AI-made, blurry or low resolution.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {products.map((p) => {
        const on = p.photos.filter((ph) => ph.enabled).length;
        return (
          <section key={p.slug} className="a-card p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="truncate text-sm font-semibold text-[var(--a-ink)]">{p.name}</h3>
              <span className="shrink-0 text-xs text-[var(--a-muted)]">
                {on} of {p.photos.length} on
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {p.photos.map((ph) => (
                <button
                  key={ph.url}
                  type="button"
                  onClick={() => toggle(p.slug, ph.url, !ph.enabled)}
                  aria-pressed={ph.enabled}
                  aria-label={ph.enabled ? "Photo on for social. Switch off" : "Photo off for social. Switch on"}
                  className={`relative aspect-[3/4] overflow-hidden rounded-lg ring-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--a-accent)] ${
                    ph.enabled ? "ring-[var(--a-line)]" : "ring-[#f3b8b1]"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ph.url} alt="" className={`h-full w-full object-cover ${ph.enabled ? "" : "opacity-30 grayscale"}`} />
                  <span className="absolute bottom-1.5 left-1.5">
                    <Badge tone={ph.enabled ? "green" : "red"}>{ph.enabled ? "On" : "Off"}</Badge>
                  </span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
      </div>
    </div>
  );
}
