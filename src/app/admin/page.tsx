"use client";

import { useEffect, useMemo, useState } from "react";

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
};

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

function parseSku(sku: string) {
  const m = sku.match(/^([A-Za-z]+-?)(\d+)$/);
  if (!m) return { prefix: "DCW-", num: 0, width: 4 };
  return { prefix: m[1], num: Number(m[2]), width: m[2].length };
}

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

export default function AdminPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [staged, setStaged] = useState<Record<string, Product>>({});
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/products", { cache: "no-store" });
    const j = await res.json();
    setItems(j.items || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const isServerItem = (slug: string) => items.some(x => x.slug === slug);
  const hasDraft = (slug: string) => staged[slug] !== undefined;

  const merged = useMemo(() => {
    const bySlug = new Map<string, Product>();
    for (const p of items) bySlug.set(p.slug, p);
    for (const [slug, p] of Object.entries(staged)) bySlug.set(slug, p);
    return Array.from(bySlug.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [items, staged]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return merged;
    return merged.filter(p =>
      p.slug.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q)
    );
  }, [merged, filter]);

  function stageProduct(p: Product) {
    const slug = (p.slug || "").trim();
    if (!slug) { setSlugError("Slug is required"); return; }
    if (!SLUG_REGEX.test(slug)) { setSlugError("Use lowercase letters/numbers with single hyphens"); return; }
    setSlugError(null);
    setStaged(prev => ({ ...prev, [slug]: { ...p, slug } }));
  }

  function discardDraft(slug: string) {
    setStaged(prev => {
      const copy = { ...prev };
      delete copy[slug];
      return copy;
    });
  }

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
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Publish failed");
    } else {
      discardDraft(slug);
      await load();
    }
    setSaving(false);
  }

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
        const j = await res.json().catch(() => ({}));
        setError(j.error || `Publish failed for ${slug}`);
        setSaving(false);
        return; 
      }
    }

    setStaged({});
    await load();
    setSaving(false);
  }

  async function deleteProduct(slug: string) {
    if (!confirm(`Delete ${slug}?`)) return;
    discardDraft(slug);
    const res = await fetch(`/api/admin/products/${slug}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  function changeStock(slug: string, op: "incr" | "decr", amt = 1) {
    const base = staged[slug] ?? merged.find(x => x.slug === slug)!;
    const next = Math.max(0, (base.stock ?? 0) + (op === "incr" ? amt : -amt));
    stageProduct({ ...base, stock: next });
  }

  function setStockTyped(slug: string, value: number) {
    const v = Math.max(0, Math.floor(Number(value || 0)));
    const base = staged[slug] ?? merged.find(x => x.slug === slug)!;
    stageProduct({ ...base, stock: v });
  }

  async function handleImagePick(
    e: React.ChangeEvent<HTMLInputElement>,
    editing: Product | null,
    setEditingLocal: (v: Product) => void
  ) {
    const file = e.target.files?.[0];
    if (!file || !editing) return;

    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    if (!res.ok) { alert("Upload failed"); return; }

    const { url } = await res.json();
    setEditingLocal({ ...editing, image: url });
  }

  const nextSku = useMemo(() => {
    const allSkus = [
      ...items.map(i => i.sku),
      ...Object.values(staged).map(d => d.sku),
    ].filter(Boolean);
    return computeNextSku(allSkus);
  }, [items, staged]);

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Admin · Products</h1>
        <div className="flex items-center gap-3">
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
            <button className="btn btn-ghost">Log out</button>
          </form>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <input
          className="input max-w-sm"
          placeholder="Filter by name, slug, SKU…"
          value={filter}
          onChange={(e)=>setFilter(e.target.value)}
        />
        <button
          className="btn btn-primary"
          onClick={() => {
            const p = emptyProduct();
            p.sku = nextSku; 
            setEditing(p);
            setSlugTouched(false);
            setSlugError(null);
            setError(null);
          }}
        >
          + New product
        </button>
      </div>

      <div className="mt-6">
        {loading ? (
          <p>Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-[var(--color-muted)]">No products.</p>
        ) : (
          <div className="overflow-x-auto">
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
                {filtered.map(p => {
                  const isDraft = hasDraft(p.slug);
                  return (
                    <tr key={p.slug} className="border-b border-[var(--color-line)]">
                      <td className="py-2 pr-3">
                        {p.image ? <img src={p.image} alt="" className="h-12 w-12 object-contain" /> : <span>—</span>}
                      </td>
                      <td className="py-2 pr-3">{p.name}</td>
                      <td className="py-2 pr-3">{p.slug}</td>
                      <td className="py-2 pr-3">${p.price.toFixed(2)}</td>
                      <td className="py-2 pr-3">
                        <div className="inline-flex items-center gap-2">
                          <button className="btn" onClick={()=>changeStock(p.slug,"decr",1)}>-</button>
                          <input
                            className="input w-16 text-center"
                            type="number"
                            value={p.stock}
                            onChange={(e) => {
                              const v = Math.max(0, Math.floor(Number(e.target.value || 0)));
                              const base = staged[p.slug] ?? p;
                              stageProduct({ ...base, stock: v });
                            }}
                            onBlur={(e) => {
                              const v = Math.max(0, Math.floor(Number(e.target.value || 0)));
                              const base = staged[p.slug] ?? p;
                              stageProduct({ ...base, stock: v });
                            }}
                          />
                          <button className="btn" onClick={()=>changeStock(p.slug,"incr",1)}>+</button>
                        </div>
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
                              <button className="btn btn-primary" disabled={saving} onClick={() => publishOne(p.slug)}>
                                {saving ? "Publishing…" : "Publish"}
                              </button>
                              <button className="btn" onClick={() => discardDraft(p.slug)}>
                                Discard
                              </button>
                            </>
                          ) : null}

                          <button className="btn" onClick={()=>deleteProduct(p.slug)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="card p-6 w-[720px] max-w-[95vw]">
            <h2 className="text-xl font-semibold">
              {isServerItem(editing.slug) ? "Edit product (staged)" : "New product (staged)"}
            </h2>

            {error && <p className="text-rose-600 text-sm mt-2">{error}</p>}

            <div className="grid grid-cols-2 gap-4 mt-4">
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

              <label className="block">
                <div className="text-xs mb-1">Slug</div>
                <input
                  className="input"
                  value={editing.slug}
                  disabled={isServerItem(editing.slug)}
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
                  onChange={(e)=>setEditing({ ...editing, price: Number(e.target.value) })}
                />
              </label>

              <label className="block">
                <div className="text-xs mb-1">SKU</div>
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    value={editing.sku}
                    onChange={(e)=>setEditing({ ...editing, sku: e.target.value })}
                    placeholder={nextSku}
                  />
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setEditing(prev => prev ? { ...prev, sku: nextSku } : prev)}
                    title="Use next available SKU"
                  >
                    Use {nextSku}
                  </button>
                </div>
              </label>

              <label className="block col-span-2">
                <div className="text-xs mb-1">Stripe Price ID</div>
                <input
                  className="input"
                  value={editing.stripePriceId || ""}
                  onChange={(e)=>setEditing({ ...editing, stripePriceId: e.target.value })}
                />
              </label>

              <label className="block col-span-2">
                <div className="text-xs mb-1">Image</div>
                <div className="flex items-center gap-3">
                  <input
                    className="input flex-1"
                    value={editing.image || ""}
                    onChange={(e)=>setEditing({ ...editing, image: e.target.value })}
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
                  <div className="mt-3">
                    <img src={editing.image} alt="" className="h-24 object-contain" />
                  </div>
                ) : null}
              </label>

              <label className="block col-span-2">
                <div className="text-xs mb-1">Description</div>
                <textarea
                  className="textarea"
                  rows={4}
                  value={editing.seoDescription}
                  onChange={(e)=>setEditing({ ...editing, seoDescription: e.target.value })}
                />
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!editing.bestSeller}
                  onChange={(e)=>setEditing({ ...editing, bestSeller: e.target.checked })}
                />
                <span className="text-sm">Best Seller</span>
              </label>

              <label className="block">
                <div className="text-xs mb-1">Stock</div>
                <input
                  className="input"
                  type="number"
                  value={editing.stock}
                  onChange={(e)=>setEditing({ ...editing, stock: Math.max(0, Number(e.target.value)) })}
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
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

              <button
                className="btn btn-primary"
                onClick={() => {
                  if (!editing) return;
                  stageProduct(editing);
                  setEditing(null);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}