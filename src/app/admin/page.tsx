"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

/* ---------- Types ---------- */
type WickType = {
  id: string;
  name: string;
};

type Scent = {
  id: string;
  name: string;
};

type VariantConfig = {
  wickTypes: WickType[];
  scents: Scent[];
  variantData: Record<string, { stripePriceId: string; stock: number }>;
};

type Product = {
  slug: string;
  name: string;
  price: number;
  image?: string;
  sku: string;
  stripePriceId?: string;
  seoDescription: string;
  bestSeller?: boolean;
  stock: number;
  variantConfig?: VariantConfig;
};

/* ---------- Helpers ---------- */
function emptyProduct(): Product {
  return {
    slug: "",
    name: "",
    price: 0,
    image: "",
    sku: "",
    stripePriceId: "",
    seoDescription: "",
    bestSeller: false,
    stock: 0,
  };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** parse "DCW-0015" -> { prefix: "DCW-", num: 15, width: 4 } */
function parseSku(sku: string) {
  const m = sku.match(/^([A-Za-z]+-?)(\d+)$/);
  if (!m) return { prefix: "DCW-", num: 0, width: 4 };
  return { prefix: m[1], num: Number(m[2]), width: m[2].length };
}

/** From existing items + staged drafts, compute next SKU like DCW-0016 */
function computeNextSku(allSkus: string[]): string {
  if (allSkus.length === 0) return "DCW-0001";
  let best = { prefix: "DCW-", num: 0, width: 4 };
  for (const s of allSkus) {
    const p = parseSku(s);
    if (p.num > best.num) best = p;
  }
  const next = best.num + 1;
  const padded = String(next).padStart(best.width, "0");
  return `${best.prefix}${padded}`;
}

function getTotalStock(p: Product): number {
  if (p.variantConfig) {
    const { wickTypes, scents, variantData } = p.variantConfig;
    let total = 0;
    for (const wick of wickTypes) {
      for (const scent of scents) {
        const variantId = `${wick.id}-${scent.id}`;
        total += variantData[variantId]?.stock ?? 0;
      }
    }
    return total;
  }
  return p.stock ?? 0;
}

function generateVariantsForDisplay(p: Product) {
  if (!p.variantConfig) return [];

  const { wickTypes, scents, variantData } = p.variantConfig;
  const variants: Array<{
    id: string;
    wickName: string;
    scentName: string;
    stock: number;
    stripePriceId: string;
  }> = [];

  for (const wick of wickTypes) {
    for (const scent of scents) {
      const variantId = `${wick.id}-${scent.id}`;
      const data = variantData[variantId] || { stripePriceId: "", stock: 0 };
      variants.push({
        id: variantId,
        wickName: wick.name,
        scentName: scent.name,
        stock: data.stock,
        stripePriceId: data.stripePriceId,
      });
    }
  }

  return variants;
}

/* ---------- Component ---------- */
export default function AdminPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Staged local drafts keyed by slug (full product objects)
  const [staged, setStaged] = useState<Record<string, Product>>({});
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/products", { cache: "no-store" });
    const j = (await res.json()) as { items?: Product[] };
    setItems(j.items || []);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  const isServerItem = (slug: string) => items.some((x) => x.slug === slug);
  const hasDraft = (slug: string) => staged[slug] !== undefined;

  // merged view = server items overlayed with staged changes/new items
  const merged = useMemo(() => {
    const bySlug = new Map<string, Product>();
    for (const p of items) bySlug.set(p.slug, p);
    for (const [slug, p] of Object.entries(staged)) bySlug.set(slug, p);
    return Array.from(bySlug.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [items, staged]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return merged;
    return merged.filter(
      (p) =>
        p.slug.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
    );
  }, [merged, filter]);

  /* ---------- Drafting & Publishing ---------- */

  // Stage (no network): create/replace a draft for slug
  function stageProduct(p: Product) {
    const slug = (p.slug || "").trim();
    if (!slug) {
      setSlugError("Slug is required");
      return;
    }
    if (!SLUG_REGEX.test(slug)) {
      setSlugError("Use lowercase letters/numbers with single hyphens");
      return;
    }
    setSlugError(null);
    setStaged((prev) => ({ ...prev, [slug]: { ...p, slug } }));
  }

  // Remove a staged draft (undo)
  function discardDraft(slug: string) {
    setStaged((prev) => {
      const copy = { ...prev };
      delete copy[slug];
      return copy;
    });
  }

  // Publish a single product: POST (new) or PATCH (existing)
  async function publishOne(slug: string) {
    const draft = staged[slug];
    if (!draft) return;

    setSaving(true);
    setError(null);

    const isNew = !isServerItem(slug);
    const res = await fetch(isNew ? "/api/admin/products" : `/api/admin/products/${slug}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });

    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setError(j.error || "Publish failed");
    } else {
      discardDraft(slug);
      await load();
    }
    setSaving(false);
  }

  // Publish all drafts
  async function publishAll() {
    const slugs = Object.keys(staged);
    setSaving(true);
    setError(null);
    for (const slug of slugs) {
      const isNew = !isServerItem(slug);
      const res = await fetch(isNew ? "/api/admin/products" : `/api/admin/products/${slug}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(staged[slug]),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error || `Publish failed for ${slug}`);
        setSaving(false);
        return; // stop on first failure
      }
    }
    setStaged({});
    await load();
    setSaving(false);
  }

  // Delete (server)
  async function deleteProduct(slug: string) {
    if (!confirm(`Delete ${slug}?`)) return;
    discardDraft(slug);
    const res = await fetch(`/api/admin/products/${slug}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  // Stock edits: stage only (no network)
  function changeStock(slug: string, op: "incr" | "decr", amt = 1) {
    const base = staged[slug] ?? merged.find((x) => x.slug === slug)!;
    const next = Math.max(0, (base.stock ?? 0) + (op === "incr" ? amt : -amt));
    stageProduct({ ...base, stock: next });
  }

  // Image upload (only updates the draft via the modal)
  async function handleImagePick(
    e: React.ChangeEvent<HTMLInputElement>,
    editingLocal: Product | null,
    setEditingLocal: (v: Product) => void
  ) {
    const file = e.target.files?.[0];
    if (!file || !editingLocal) return;

    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    if (!res.ok) {
      alert("Upload failed");
      return;
    }

    const { url } = (await res.json()) as { url: string };
    setEditingLocal({ ...editingLocal, image: url });
  }

  // Next SKU for new product modal
  const nextSku = useMemo(() => {
    const allSkus = [...items.map((i) => i.sku), ...Object.values(staged).map((d) => d.sku)].filter(
      Boolean
    );
    return computeNextSku(allSkus);
  }, [items, staged]);

  /* ---------- UI ---------- */
  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-semibold">Admin · Products</h1>
        <div className="flex flex-wrap items-center gap-2">
          {Object.keys(staged).length > 0 && (
            <>
              <button className="btn" onClick={() => setStaged({})} disabled={saving}>
                Discard all
              </button>
              <button className="btn btn-primary" onClick={publishAll} disabled={saving}>
                {saving ? "Publishing…" : `Publish all (${Object.keys(staged).length})`}
              </button>
            </>
          )}
          <form action="/api/admin/logout" method="post">
            <button className="btn btn-ghost w-full sm:w-auto">Log out</button>
          </form>
        </div>
      </div>

      {/* Filter + New */}
      <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:items-center">
        <input
          className="input w-full sm:max-w-sm"
          placeholder="Filter by name, slug, SKU…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button
          className="btn btn-primary w-full sm:w-auto"
          onClick={() => {
            const p = emptyProduct();
            p.sku = nextSku; // default auto-increment
            setEditing(p);
            setSlugTouched(false);
            setSlugError(null);
            setError(null);
          }}
        >
          + New product
        </button>
      </div>

      {/* Content */}
      <div className="mt-4">
        {loading ? (
          <p>Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-[var(--color-muted)]">No products.</p>
        ) : (
          <>
            {/* Desktop/tablet table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-[var(--color-line)]">
                    <th className="py-2 pr-3">Image</th>
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">Slug</th>
                    <th className="py-2 pr-3">Price</th>
                    <th className="py-2 pr-3">Stock</th>
                    <th className="py-2 pr-3">Best</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const isDraft = hasDraft(p.slug);
                    return (
                      <tr key={p.slug} className="border-b border-[var(--color-line)]">
                        <td className="py-2 pr-3">
                          {p.image ? (
                            <Image
                              src={p.image}
                              alt=""
                              width={48}
                              height={48}
                              className="object-contain"
                            />
                          ) : (
                            <span>—</span>
                          )}
                        </td>
                        <td className="py-2 pr-3">{p.name}</td>
                        <td className="py-2 pr-3">{p.slug}</td>
                        <td className="py-2 pr-3">${p.price.toFixed(2)}</td>
                        <td className="py-2 pr-3">
                          {p.variantConfig ? (
                            <span className="text-sm">
                              {getTotalStock(p)} <span className="text-[var(--color-muted)]">(variants)</span>
                            </span>
                          ) : (
                            <div className="inline-flex items-center gap-2">
                              <button
                                className="btn min-w-10"
                                onClick={() => changeStock(p.slug, "decr", 1)}
                                aria-label={`Decrease ${p.name} stock`}
                              >
                                −
                              </button>
                              <input
                                className="input w-20 text-center"
                                inputMode="numeric"
                                type="number"
                                value={p.stock}
                                onChange={(e) => {
                                  const v = Math.max(0, Math.floor(Number(e.target.value || 0)));
                                  const base = staged[p.slug] ?? p;
                                  stageProduct({ ...base, stock: v });
                                }}
                              />
                              <button
                                className="btn min-w-10"
                                onClick={() => changeStock(p.slug, "incr", 1)}
                                aria-label={`Increase ${p.name} stock`}
                              >
                                +
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="py-2 pr-3">{p.bestSeller ? "★" : "—"}</td>
                        <td className="py-2 pr-3">
                          {isDraft ? (
                            <span className="badge">Draft</span>
                          ) : (
                            <span className="text-xs text-[var(--color-muted)]">Published</span>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              className="btn"
                              onClick={() => {
                                setEditing(p);
                                setSlugTouched(true);
                                setSlugError(null);
                                setError(null);
                              }}
                            >
                              Edit
                            </button>

                            {isDraft ? (
                              <>
                                <button
                                  className="btn btn-primary"
                                  disabled={saving}
                                  onClick={() => publishOne(p.slug)}
                                >
                                  {saving ? "Publishing…" : "Publish"}
                                </button>
                                <button className="btn" onClick={() => discardDraft(p.slug)}>
                                  Discard
                                </button>
                              </>
                            ) : null}

                            <button className="btn" onClick={() => void deleteProduct(p.slug)}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="md:hidden grid grid-cols-1 gap-3">
              {filtered.map((p) => {
                const isDraft = hasDraft(p.slug);
                return (
                  <div key={p.slug} className="card p-4">
                    <div className="flex items-center gap-3">
                      <div className="relative h-16 w-16 flex-shrink-0 rounded-xl overflow-hidden bg-white">
                        {p.image ? (
                          <Image
                            src={p.image}
                            alt=""
                            fill
                            sizes="64px"
                            className="object-contain"
                          />
                        ) : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium truncate">{p.name}</h3>
                          {p.bestSeller ? <span className="badge">Best</span> : null}
                          {isDraft ? <span className="badge">Draft</span> : null}
                        </div>
                        <div className="text-xs text-[var(--color-muted)] truncate">
                          {p.slug} · ${p.price.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      {/* Stock control */}
                      {p.variantConfig ? (
                        <div className="text-sm">
                          Stock: {getTotalStock(p)} <span className="text-[var(--color-muted)]">(variants)</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            className="btn min-w-12 h-10"
                            onClick={() => changeStock(p.slug, "decr", 1)}
                            aria-label={`Decrease ${p.name} stock`}
                          >
                            −
                          </button>
                          <input
                            className="input w-20 h-10 text-center"
                            inputMode="numeric"
                            type="number"
                            value={p.stock}
                            onChange={(e) => {
                              const v = Math.max(0, Math.floor(Number(e.target.value || 0)));
                              const base = staged[p.slug] ?? p;
                              stageProduct({ ...base, stock: v });
                            }}
                          />
                          <button
                            className="btn min-w-12 h-10"
                            onClick={() => changeStock(p.slug, "incr", 1)}
                            aria-label={`Increase ${p.name} stock`}
                          >
                            +
                          </button>
                        </div>
                      )}

                      {/* Row actions */}
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          className="btn h-10"
                          onClick={() => {
                            setEditing(p);
                            setSlugTouched(true);
                            setSlugError(null);
                            setError(null);
                          }}
                        >
                          Edit
                        </button>

                        {isDraft ? (
                          <>
                            <button
                              className="btn btn-primary h-10"
                              disabled={saving}
                              onClick={() => publishOne(p.slug)}
                            >
                              {saving ? "…" : "Publish"}
                            </button>
                            <button className="btn h-10" onClick={() => discardDraft(p.slug)}>
                              Discard
                            </button>
                          </>
                        ) : null}

                        <button className="btn h-10" onClick={() => void deleteProduct(p.slug)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ---------- Edit/Create Modal (scrollable on mobile) ---------- */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              setEditing(null);
              setSlugTouched(false);
              setSlugError(null);
              setError(null);
            }}
          />
          {/* panel */}
          <div
            className="
              relative card w-[92vw] max-w-[720px]
              h-[92svh] sm:h-auto sm:max-h-[90svh]
              overflow-y-auto
              p-5 sm:p-6
            "
          >
            <div className="sticky top-0 -mx-5 sm:-mx-6 bg-[var(--color-surface)]/80 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-surface)]/70 border-b border-[var(--color-line)] px-5 sm:px-6 py-3 z-10 flex items-center justify-between">
              <h2 className="text-lg sm:text-xl font-semibold">
                {isServerItem(editing.slug) ? "Edit product (staged)" : "New product (staged)"}
              </h2>
              <button
                className="btn"
                onClick={() => {
                  setEditing(null);
                  setSlugTouched(false);
                  setSlugError(null);
                  setError(null);
                }}
                aria-label="Close"
              >
                Close
              </button>
            </div>

            {error && <p className="text-rose-600 text-sm mt-3">{error}</p>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              {/* Name (auto-slug if slug not manually touched & product is new) */}
              <label className="block">
                <div className="text-xs mb-1">Name</div>
                <input
                  className="input"
                  value={editing.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setEditing((prev) => {
                      if (!prev) return prev;
                      const next = { ...prev, name };
                      if (!slugTouched && !isServerItem(prev.slug)) {
                        next.slug = slugify(name);
                        setSlugError(
                          next.slug && SLUG_REGEX.test(next.slug)
                            ? null
                            : "Use lowercase letters/numbers with single hyphens"
                        );
                      }
                      return next;
                    });
                  }}
                />
              </label>

              {/* Slug */}
              <label className="block">
                <div className="text-xs mb-1">Slug</div>
                <input
                  className="input"
                  value={editing.slug}
                  disabled={isServerItem(editing.slug)} // keep URLs stable once published
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    setSlugTouched(true);
                    setEditing({ ...editing, slug: v });
                    setSlugError(
                      v && SLUG_REGEX.test(v)
                        ? null
                        : "Use lowercase letters/numbers with single hyphens"
                    );
                  }}
                  onBlur={(e) => {
                    const cleaned = slugify(e.target.value);
                    setEditing((prev) => (prev ? { ...prev, slug: cleaned } : prev));
                    setSlugError(
                      cleaned && SLUG_REGEX.test(cleaned)
                        ? null
                        : "Use lowercase letters/numbers with single hyphens"
                    );
                  }}
                  placeholder="e.g. woodford-reserve-candle"
                />
                {slugError && <p className="text-rose-600 text-xs mt-1">{slugError}</p>}
              </label>

              <label className="block">
                <div className="text-xs mb-1">Price</div>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={editing.price}
                  onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })}
                />
              </label>

              <label className="block">
                <div className="text-xs mb-1">SKU</div>
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    value={editing.sku}
                    onChange={(e) => setEditing({ ...editing, sku: e.target.value })}
                    placeholder="DCW-0001"
                  />
                  <button
                    type="button"
                    className="btn"
                    onClick={() =>
                      setEditing((prev) =>
                        prev
                          ? {
                              ...prev,
                              sku: computeNextSku([
                                ...items.map((i) => i.sku),
                                ...Object.values(staged).map((d) => d.sku),
                              ])
                            }
                          : prev
                      )
                    }
                    title="Use next available SKU"
                  >
                    Auto
                  </button>
                </div>
              </label>

              <label className="block sm:col-span-2">
                <div className="text-xs mb-1">Stripe Price ID</div>
                <input
                  className="input"
                  value={editing.stripePriceId || ""}
                  onChange={(e) => setEditing({ ...editing, stripePriceId: e.target.value })}
                />
              </label>

              {/* Image URL + Browse */}
              <label className="block sm:col-span-2">
                <div className="text-xs mb-1">Image</div>
                <div className="flex items-center gap-3">
                  <input
                    className="input flex-1"
                    value={editing.image || ""}
                    onChange={(e) => setEditing({ ...editing, image: e.target.value })}
                    placeholder="/images/woodford.png or https://…"
                  />
                  <label className="btn cursor-pointer">
                    Browse…
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImagePick(e, editing, (v) => setEditing(v))}
                    />
                  </label>
                </div>
                {editing.image ? (
                  <div className="mt-3 relative w-full h-40 rounded-xl overflow-hidden">
                    <Image src={editing.image} alt="" fill className="object-contain" />
                  </div>
                ) : null}
              </label>

              <label className="block sm:col-span-2">
                <div className="text-xs mb-1">Description</div>
                <textarea
                  className="textarea"
                  rows={4}
                  value={editing.seoDescription}
                  onChange={(e) => setEditing({ ...editing, seoDescription: e.target.value })}
                />
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!editing.bestSeller}
                  onChange={(e) => setEditing({ ...editing, bestSeller: e.target.checked })}
                />
                <span className="text-sm">Best Seller</span>
              </label>

              <label className="block">
                <div className="text-xs mb-1">Stock (base, if not using variants)</div>
                <input
                  className="input"
                  type="number"
                  value={editing.stock}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      stock: Math.max(0, Number(e.target.value)),
                    })
                  }
                  disabled={!!editing.variantConfig}
                />
              </label>
            </div>

            {/* ---------- Variants Section ---------- */}
            <div className="mt-6 border-t border-[var(--color-line)] pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Product Variants</h3>
                {!editing.variantConfig ? (
                  <button
                    type="button"
                    className="btn btn-primary text-xs"
                    onClick={() => {
                      setEditing({
                        ...editing,
                        variantConfig: {
                          wickTypes: [{ id: "standard", name: "Standard Wick" }],
                          scents: [{ id: "unscented", name: "Unscented" }],
                          variantData: {},
                        },
                      });
                    }}
                  >
                    Enable Variants
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn text-xs"
                    onClick={() => {
                      if (confirm("Remove all variants? This will delete all variant data.")) {
                        setEditing({ ...editing, variantConfig: undefined });
                      }
                    }}
                  >
                    Disable Variants
                  </button>
                )}
              </div>

              {editing.variantConfig ? (
                <div className="space-y-4">
                  {/* Wick Types */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-medium">Wick Types</h4>
                      <button
                        type="button"
                        className="btn text-xs"
                        onClick={() => {
                          const newId = `wick-${Date.now()}`;
                          setEditing({
                            ...editing,
                            variantConfig: {
                              ...editing.variantConfig!,
                              wickTypes: [
                                ...editing.variantConfig!.wickTypes,
                                { id: newId, name: "New Wick Type" },
                              ],
                            },
                          });
                        }}
                      >
                        + Add Wick Type
                      </button>
                    </div>
                    <div className="space-y-2">
                      {editing.variantConfig.wickTypes.map((wick, idx) => (
                        <div key={wick.id} className="flex items-center gap-2">
                          <input
                            className="input text-sm flex-1"
                            value={wick.name}
                            onChange={(e) => {
                              const newWicks = [...editing.variantConfig!.wickTypes];
                              newWicks[idx] = { ...wick, name: e.target.value };
                              setEditing({
                                ...editing,
                                variantConfig: {
                                  ...editing.variantConfig!,
                                  wickTypes: newWicks,
                                },
                              });
                            }}
                            placeholder="e.g., Wood Wick"
                          />
                          <button
                            type="button"
                            className="btn text-xs"
                            onClick={() => {
                              setEditing({
                                ...editing,
                                variantConfig: {
                                  ...editing.variantConfig!,
                                  wickTypes: editing.variantConfig!.wickTypes.filter((_, i) => i !== idx),
                                },
                              });
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Scents */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-medium">Scents</h4>
                      <button
                        type="button"
                        className="btn text-xs"
                        onClick={() => {
                          const newId = `scent-${Date.now()}`;
                          setEditing({
                            ...editing,
                            variantConfig: {
                              ...editing.variantConfig!,
                              scents: [
                                ...editing.variantConfig!.scents,
                                { id: newId, name: "New Scent" },
                              ],
                            },
                          });
                        }}
                      >
                        + Add Scent
                      </button>
                    </div>
                    <div className="space-y-2">
                      {editing.variantConfig.scents.map((scent, idx) => (
                        <div key={scent.id} className="flex items-center gap-2">
                          <input
                            className="input text-sm flex-1"
                            value={scent.name}
                            onChange={(e) => {
                              const newScents = [...editing.variantConfig!.scents];
                              newScents[idx] = { ...scent, name: e.target.value };
                              setEditing({
                                ...editing,
                                variantConfig: {
                                  ...editing.variantConfig!,
                                  scents: newScents,
                                },
                              });
                            }}
                            placeholder="e.g., Vanilla"
                          />
                          <button
                            type="button"
                            className="btn text-xs"
                            onClick={() => {
                              setEditing({
                                ...editing,
                                variantConfig: {
                                  ...editing.variantConfig!,
                                  scents: editing.variantConfig!.scents.filter((_, i) => i !== idx),
                                },
                              });
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Generated Variants Grid */}
                  <div>
                    <h4 className="text-xs font-medium mb-2">
                      Generated Variants ({editing.variantConfig.wickTypes.length} × {editing.variantConfig.scents.length} ={" "}
                      {editing.variantConfig.wickTypes.length * editing.variantConfig.scents.length} total)
                    </h4>
                    <div className="max-h-96 overflow-y-auto space-y-2 border border-[var(--color-line)] rounded-lg p-2">
                      {generateVariantsForDisplay(editing).map((v) => (
                        <div key={v.id} className="card p-2">
                          <div className="text-xs font-medium mb-1">
                            {v.wickName} / {v.scentName}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block">
                              <div className="text-xs mb-1">Stock</div>
                              <input
                                className="input text-xs"
                                type="number"
                                value={v.stock}
                                onChange={(e) => {
                                  const newData = { ...editing.variantConfig!.variantData };
                                  newData[v.id] = {
                                    ...newData[v.id],
                                    stock: Math.max(0, Number(e.target.value)),
                                  };
                                  setEditing({
                                    ...editing,
                                    variantConfig: {
                                      ...editing.variantConfig!,
                                      variantData: newData,
                                    },
                                  });
                                }}
                              />
                            </label>
                            <label className="block">
                              <div className="text-xs mb-1">Stripe Price ID</div>
                              <input
                                className="input text-xs"
                                value={v.stripePriceId}
                                onChange={(e) => {
                                  const newData = { ...editing.variantConfig!.variantData };
                                  newData[v.id] = {
                                    ...newData[v.id],
                                    stripePriceId: e.target.value,
                                  };
                                  setEditing({
                                    ...editing,
                                    variantConfig: {
                                      ...editing.variantConfig!,
                                      variantData: newData,
                                    },
                                  });
                                }}
                                placeholder="price_xxxxx"
                              />
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[var(--color-muted)]">
                  Click &ldquo;Enable Variants&rdquo; to add wick types and scents. Variants will be automatically generated for all combinations.
                </p>
              )}
            </div>

            <div className="sticky bottom-0 -mx-5 sm:-mx-6 bg-[var(--color-surface)]/80 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-surface)]/70 border-t border-[var(--color-line)] px-5 sm:px-6 py-3 mt-6 flex justify-end gap-2">
              <button
                className="btn"
                onClick={() => {
                  setEditing(null);
                  setSlugTouched(false);
                  setSlugError(null);
                  setError(null);
                }}
              >
                Cancel
              </button>

              {/* SAVE → STAGE ONLY (no publish here) */}
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (!editing) return;
                  stageProduct(editing);
                  setEditing(null);
                }}
              >
                Save draft
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}