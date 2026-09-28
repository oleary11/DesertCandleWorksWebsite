"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
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

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "review", label: "Review" },
  { id: "queue", label: "Queue" },
  { id: "history", label: "History" },
  { id: "reel", label: "New reel" },
  { id: "photos", label: "Photos" },
];

const KIND_META: Record<Kind, { label: string; icon: typeof Clapperboard; cls: string }> = {
  reel: { label: "Reel", icon: Clapperboard, cls: "bg-rose-100 text-rose-700" },
  slideshow: { label: "Slideshow", icon: ImageIcon, cls: "bg-amber-100 text-amber-800" },
  meme: { label: "Meme", icon: Laugh, cls: "bg-sky-100 text-sky-700" },
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
const REEL_COST = 1.12;
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

  const batchCost = batch.slideshows * 1.5 * SCENE_COST + batch.memes * SCENE_COST;

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="btn">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold">Social Media</h1>
            <p className="text-sm text-[var(--color-muted)]">
              Reels, slideshows and memes for Instagram, TikTok and Facebook
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1 text-sm" title="Several products, real photos only. No AI image cost.">
            Collections
            <input
              type="number"
              min={0}
              max={12}
              className="input w-16 py-1"
              value={batch.collections}
              onChange={(e) => setBatch((b) => ({ ...b, collections: Number(e.target.value) }))}
            />
          </label>
          <label className="flex items-center gap-1 text-sm" title="One product, with 1-2 AI scene slides.">
            Slideshows
            <input
              type="number"
              min={0}
              max={12}
              className="input w-16 py-1"
              value={batch.slideshows}
              onChange={(e) => setBatch((b) => ({ ...b, slideshows: Number(e.target.value) }))}
            />
          </label>
          <label className="flex items-center gap-1 text-sm">
            Memes
            <input
              type="number"
              min={0}
              max={6}
              className="input w-16 py-1"
              value={batch.memes}
              onChange={(e) => setBatch((b) => ({ ...b, memes: Number(e.target.value) }))}
            />
          </label>
          <button className="btn btn-primary" onClick={generateBatch} disabled={generating}>
            {generating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
            {generating ? "Planning…" : `Generate (~$${batchCost.toFixed(2)})`}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto border-b border-[var(--color-line)]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === t.id ? "border-[var(--color-ink)] text-[var(--color-ink)]" : "border-transparent text-neutral-500 hover:text-neutral-800"
            }`}
          >
            {t.label}
            {t.id === "review" && tab === "review" && counts.review > 0 ? ` (${counts.review})` : ""}
          </button>
        ))}
      </div>

      {tab === "reel" ? (
        <NewReel onCreated={() => setTab("review")} />
      ) : tab === "photos" ? (
        <PhotoLibrary />
      ) : loading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <CandleSpinner />
          <p className="text-sm font-medium text-[var(--color-muted)]">Loading posts…</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="card p-8 text-center text-sm text-[var(--color-muted)]">
          {tab === "review"
            ? "Nothing to review. Generate a batch or start a new reel."
            : tab === "queue"
              ? "The queue is empty. Approve posts in Review and they'll go out at 7:30 AM and 6 PM, one per slot."
              : "Nothing posted yet."}
        </div>
      ) : (
        <>
          {tab === "review" && counts.generating > 0 && (
            <p className="mb-4 text-sm text-[var(--color-muted)]">
              {counts.generating} generating. Reels take a few minutes; this page checks every 15 seconds.
            </p>
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

  return (
    <div className="card overflow-hidden flex flex-col">
      {/* Media */}
      <div className={`relative bg-neutral-900 ${post.kind === "reel" ? "aspect-[9/16]" : "aspect-[4/5]"}`}>
        {post.kind === "reel" && post.videoUrl ? (
          <video src={post.videoUrl} poster={post.coverImageUrl ?? undefined} controls loop playsInline className="w-full h-full object-cover" />
        ) : post.slides.length ? (
          <SlideCarousel slides={post.slides} />
        ) : post.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.coverImageUrl} alt="" className="w-full h-full object-cover opacity-60" />
        ) : null}
        {busy && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40 text-white text-sm">
            <Loader2 className="w-6 h-6 animate-spin" />
            {STATUS_LABEL[post.status]}
          </div>
        )}
        <span className={`absolute top-2 left-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${meta.cls}`}>
          <Icon className="w-3.5 h-3.5" />
          {meta.label}
        </span>
        {post.queueOrder && (
          <span className="absolute top-2 right-2 rounded-full bg-white/90 px-2 py-0.5 text-xs font-semibold">#{post.queueOrder}</span>
        )}
      </div>

      {/* Copy */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div className="flex items-center justify-between text-xs text-[var(--color-muted)]">
          <span>
            {STATUS_LABEL[post.status]}
            {post.productSlug ? ` · ${post.productSlug}` : ""}
          </span>
          <span>{money(post.costCents)}</span>
        </div>

        {editable ? (
          <>
            <input className="input text-sm font-medium" value={hook} onChange={(e) => setHook(e.target.value)} placeholder="Hook" />
            <textarea className="textarea text-sm" rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption" />
            <input className="input text-xs" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="hashtags separated by spaces" />
          </>
        ) : (
          <>
            <p className="text-sm font-medium">{post.hook}</p>
            <p className="text-sm text-[var(--color-muted)] whitespace-pre-line">{post.caption}</p>
            <p className="text-xs text-neutral-500">{post.hashtags.map((h) => `#${h}`).join(" ")}</p>
          </>
        )}

        {post.error && <p className="text-xs text-red-600 whitespace-pre-line">{post.error}</p>}

        {post.status === "published" && (
          <p className="text-xs text-[var(--color-muted)]">
            {[post.instagramPostId && "Instagram", post.tiktokPostId && "TikTok", post.facebookPostId && "Facebook"].filter(Boolean).join(" · ")}
            {post.publishedAt ? ` · ${new Date(post.publishedAt).toLocaleString()}` : ""}
          </p>
        )}

        {/* Actions */}
        <div className="mt-auto pt-2 flex flex-wrap gap-2">
          {post.status === "pending_review" && (
            <>
              <button className="btn btn-primary text-sm" onClick={() => onAct("approve", copy())}>
                <Check className="w-4 h-4 mr-1" /> Approve
              </button>
              <button className="btn text-sm" onClick={() => onAct("reject", copy())}>
                <X className="w-4 h-4 mr-1" /> Reject
              </button>
            </>
          )}
          {post.status === "approved" && (
            <>
              <button className="btn text-sm" disabled={isFirst} onClick={() => onAct("up")} aria-label="Move up">
                <ArrowUp className="w-4 h-4" />
              </button>
              <button className="btn text-sm" disabled={isLast} onClick={() => onAct("down")} aria-label="Move down">
                <ArrowDown className="w-4 h-4" />
              </button>
              <button className="btn btn-primary text-sm" onClick={onPublish}>
                <Send className="w-4 h-4 mr-1" /> Post now
              </button>
              <button className="btn text-sm" onClick={() => onAct("unqueue")}>
                <Undo2 className="w-4 h-4 mr-1" /> Unqueue
              </button>
            </>
          )}
          {post.status === "failed" && hasMedia && (
            <button className="btn btn-primary text-sm" onClick={() => onAct("approve", copy())}>
              <Check className="w-4 h-4 mr-1" /> Approve
            </button>
          )}
          {editable && dirty && post.status !== "pending_review" && (
            <button className="btn text-sm" onClick={() => onAct("", copy())}>
              Save
            </button>
          )}
          {!busy && (
            <button className="btn text-sm ml-auto" onClick={onDelete} aria-label="Delete">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
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

function NewReel({ onCreated }: { onCreated: () => void }) {
  const { showAlert } = useModal();
  const { products } = useProducts();
  const [slug, setSlug] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const product = products?.find((p) => p.slug === slug);

  function toggle(url: string) {
    setPicked((cur) => (cur.includes(url) ? cur.filter((u) => u !== url) : cur.length >= 2 ? [cur[1], url] : [...cur, url]));
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
      <div className="flex justify-center py-12">
        <CandleSpinner />
      </div>
    );
  }

  return (
    <div className="card p-4 sm:p-6 flex flex-col gap-5 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold">New reel</h2>
        <p className="text-sm text-[var(--color-muted)]">
          10 seconds: two 5 second shots of the real candle with gentle motion (flame flicker, a slow push-in). Pick one photo, or two for two
          different shots. About ${REEL_COST.toFixed(2)} and a few minutes to generate.
        </p>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Product
        <select
          className="select"
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
      </label>

      {product && (
        <div>
          <p className="text-sm font-medium mb-2">Photos {picked.length ? `(${picked.length}/2 picked)` : ""}</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {product.photos.map((ph) => {
              const n = picked.indexOf(ph.url);
              return (
                <button
                  key={ph.url}
                  onClick={() => toggle(ph.url)}
                  className={`relative aspect-[3/4] overflow-hidden rounded-lg border-2 ${
                    n >= 0 ? "border-[var(--color-ink)]" : "border-transparent"
                  } ${ph.enabled ? "" : "opacity-50"}`}
                  title={ph.enabled ? undefined : "Switched off for social in Photos"}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ph.url} alt="" className="w-full h-full object-cover" />
                  {n >= 0 && (
                    <span className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-ink)] text-xs font-semibold text-white">
                      {n + 1}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-[var(--color-muted)]">
            Use real photos with a lit flame and a crisp label. Photos are cropped to 9:16 around the candle.
          </p>
        </div>
      )}

      <label className="flex flex-col gap-1 text-sm font-medium">
        Notes (optional)
        <textarea
          className="textarea"
          rows={2}
          maxLength={300}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. moody evening feel, new fall scent"
        />
      </label>

      <div>
        <button className="btn btn-primary" disabled={!slug || !picked.length || submitting} onClick={submit}>
          {submitting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Clapperboard className="w-4 h-4 mr-1" />}
          {submitting ? "Starting…" : "Generate reel"}
        </button>
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
      <div className="flex justify-center py-12">
        <CandleSpinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-[var(--color-muted)]">
        Slideshows only use photos switched on here. Switch off anything that looks AI-made, blurry or low resolution.
      </p>
      {products.map((p) => (
        <div key={p.slug}>
          <h3 className="text-sm font-semibold mb-2">{p.name}</h3>
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-2">
            {p.photos.map((ph) => (
              <button
                key={ph.url}
                onClick={() => toggle(p.slug, ph.url, !ph.enabled)}
                className={`relative aspect-[3/4] overflow-hidden rounded-lg border ${
                  ph.enabled ? "border-[var(--color-line)]" : "border-red-300"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ph.url} alt="" className={`w-full h-full object-cover ${ph.enabled ? "" : "opacity-30 grayscale"}`} />
                <span
                  className={`absolute bottom-1 left-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                    ph.enabled ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
                  }`}
                >
                  {ph.enabled ? "On" : "Off"}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
