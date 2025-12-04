"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

/* ---------- Types ---------- */
type AlcoholType = { id: string; name: string; sortOrder?: number };

type WickType = {
  id: string;
  name: string;
};

type GlobalScent = {
  id: string;
  name: string;
  limited: boolean;
  enabledProducts?: string[];
  sortOrder?: number;
};

type VariantConfig = {
  wickTypes: WickType[];
  // scents are now global - not stored per product
  variantData: Record<string, { stock: number }>;
};

type Product = {
  slug: string;
  name: string;
  price: number;
  image?: string;
  images?: string[]; // Multiple images support
  sku: string;
  stripePriceId?: string;
  seoDescription: string;
  bestSeller?: boolean;
  youngDumb?: boolean;
  stock: number;
  variantConfig?: VariantConfig;
  alcoholType?: string; // NEW
  materialCost?: number; // Cost to make the product (from calculator)
  visibleOnWebsite?: boolean; // Controls shop page visibility
};

/* ---------- Helpers ---------- */
function emptyProduct(): Product {
  return {
    slug: "",
    name: "",
    price: 0,
    image: "",
    images: [],
    sku: "",
    stripePriceId: "",
    seoDescription: "",
    bestSeller: false,
    youngDumb: false,
    stock: 0,
    alcoholType: "Other", // NEW default
    visibleOnWebsite: true, // Default to visible
    variantConfig: {
      wickTypes: [{ id: "standard", name: "Standard Wick" }],
      variantData: {},
    },
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
    const { variantData } = p.variantConfig;
    let total = 0;
    for (const data of Object.values(variantData)) {
      total += data.stock ?? 0;
    }
    return total;
  }
  return p.stock ?? 0;
}

function generateVariantsForDisplay(p: Product, globalScents: GlobalScent[]) {
  if (!p.variantConfig) return [];

  const { wickTypes, variantData } = p.variantConfig;
  const variants: Array<{
    id: string;
    wickName: string;
    scentName: string;
    stock: number;
  }> = [];

  // Filter scents based on limited flag and enabled products
  const availableScents = globalScents.filter((scent) => {
    if (!scent.limited) return true;
    return scent.enabledProducts?.includes(p.slug) ?? false;
  });

  for (const wick of wickTypes) {
    for (const scent of availableScents) {
      const variantId = `${wick.id}-${scent.id}`;
      const data = variantData[variantId] || { stock: 0 };
      variants.push({
        id: variantId,
        wickName: wick.name,
        scentName: scent.name,
        stock: data.stock,
      });
    }
  }

  return variants;
}

/* ---------- Component ---------- */
export default function AdminPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [globalScents, setGlobalScents] = useState<GlobalScent[]>([]);
  const [alcoholTypes, setAlcoholTypes] = useState<AlcoholType[]>([]); // NEW
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New filter and sort states
  const [visibleFilter, setVisibleFilter] = useState<"all" | "visible" | "hidden">("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<"all" | "in-stock" | "out-of-stock">("all");
  const [bestFilter, setBestFilter] = useState<"all" | "best" | "not-best">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [sortBy, setSortBy] = useState<"name" | "price" | "stock" | "best" | "status" | "none">("none");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Staged local drafts keyed by slug (full product objects)
  const [staged, setStaged] = useState<Record<string, Product>>({});
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [productsRes, scentsRes, typesRes] = await Promise.all([
      fetch("/api/admin/products", { cache: "no-store" }),
      fetch("/api/admin/scents", { cache: "no-store" }),
      fetch("/api/admin/alcohol-types?active=1", { cache: "no-store" })
    ]);
    const productsData = (await productsRes.json()) as { items?: Product[] };
    const scentsData = (await scentsRes.json()) as { scents?: GlobalScent[] };
    const typesData = (await typesRes.json()) as { types?: AlcoholType[] };
    setItems(productsData.items || []);
    setGlobalScents(scentsData.scents || []);
    setAlcoholTypes(typesData.types || []); // NEW
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
    let result = [...merged];

    // Text search filter
    const q = filter.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (p) =>
          p.slug.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q)
      );
    }

    // Visible filter
    if (visibleFilter === "visible") {
      result = result.filter((p) => p.visibleOnWebsite !== false);
    } else if (visibleFilter === "hidden") {
      result = result.filter((p) => p.visibleOnWebsite === false);
    }

    // Type filter
    if (typeFilter !== "all") {
      result = result.filter((p) => (p.alcoholType || "Other") === typeFilter);
    }

    // Stock filter
    if (stockFilter === "in-stock") {
      result = result.filter((p) => getTotalStock(p) > 0);
    } else if (stockFilter === "out-of-stock") {
      result = result.filter((p) => getTotalStock(p) === 0);
    }

    // Best seller filter
    if (bestFilter === "best") {
      result = result.filter((p) => p.bestSeller === true);
    } else if (bestFilter === "not-best") {
      result = result.filter((p) => p.bestSeller !== true);
    }

    // Status filter
    if (statusFilter === "published") {
      result = result.filter((p) => !hasDraft(p.slug));
    } else if (statusFilter === "draft") {
      result = result.filter((p) => hasDraft(p.slug));
    }

    // Sorting
    if (sortBy !== "none") {
      result.sort((a, b) => {
        let comparison = 0;

        switch (sortBy) {
          case "name":
            comparison = a.name.localeCompare(b.name);
            break;
          case "price":
            comparison = a.price - b.price;
            break;
          case "stock":
            comparison = getTotalStock(a) - getTotalStock(b);
            break;
          case "best":
            comparison = (a.bestSeller ? 1 : 0) - (b.bestSeller ? 1 : 0);
            break;
          case "status":
            comparison = (hasDraft(a.slug) ? 1 : 0) - (hasDraft(b.slug) ? 1 : 0);
            break;
        }

        return sortDirection === "asc" ? comparison : -comparison;
      });
    }

    return result;
  }, [merged, filter, visibleFilter, typeFilter, stockFilter, bestFilter, statusFilter, sortBy, sortDirection, staged]);

  /* ---------- Sorting Helper ---------- */

  function handleSort(column: typeof sortBy) {
    if (column === "none") return;

    if (sortBy === column) {
      // Toggle direction if clicking the same column
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // New column, default to ascending
      setSortBy(column);
      setSortDirection("asc");
    }
  }

  function SortableHeader({ column, children }: { column: typeof sortBy; children: React.ReactNode }) {
    if (column === "none") {
      return <th className="py-2 pr-3">{children}</th>;
    }

    const isActive = sortBy === column;
    const arrow = isActive ? (sortDirection === "asc" ? " ↑" : " ↓") : "";

    return (
      <th className="py-2 pr-3">
        <button
          className="text-left font-semibold hover:text-[var(--color-accent)] transition-colors"
          onClick={() => handleSort(column)}
        >
          {children}{arrow}
        </button>
      </th>
    );
  }

  /* ---------- CSV Export ---------- */

  function exportToCSV() {
    const headers = [
      "Visible",
      "Name",
      "Slug",
      "SKU",
      "Price",
      "Material Cost",
      "Type",
      "Stock",
      "Best Seller",
      "Young & Dumb",
      "Status",
      "Stripe Price ID",
      "SEO Description",
      "Image",
    ];

    const rows = filtered.map((p) => [
      p.visibleOnWebsite !== false ? "Yes" : "No",
      p.name,
      p.slug,
      p.sku || "",
      p.price.toFixed(2),
      p.materialCost ? p.materialCost.toFixed(2) : "",
      p.alcoholType || "Other",
      getTotalStock(p).toString(),
      p.bestSeller ? "Yes" : "No",
      p.youngDumb ? "Yes" : "No",
      hasDraft(p.slug) ? "Draft" : "Published",
      p.stripePriceId || "",
      p.seoDescription || "",
      p.images?.[0] || p.image || "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `products-export-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

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

    console.log("[Admin] Publishing product:", slug, draft);

    setSaving(true);
    setError(null);

    const isNew = !isServerItem(slug);
    console.log(`[Admin] ${isNew ? 'Creating new' : 'Updating existing'} product`);

    const res = await fetch(isNew ? "/api/admin/products" : `/api/admin/products/${slug}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });

    console.log("[Admin] Response status:", res.status);

    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      console.error("[Admin] Publish failed:", j);
      const errorMsg = j.error || `Publish failed (${res.status})`;
      setError(errorMsg);
      alert(`Failed to publish product:\n\n${errorMsg}`);
    } else {
      console.log("[Admin] Publish successful");
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
        const errorMsg = j.error || `Publish failed for ${slug}`;
        setError(errorMsg);
        alert(`Failed to publish product "${slug}":\n\n${errorMsg}`);
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

  // Image upload (supports multiple images)
  async function handleImagePick(
    e: React.ChangeEvent<HTMLInputElement>,
    editingLocal: Product | null,
    setEditingLocal: (v: Product) => void
  ) {
    const files = e.target.files;
    if (!files || files.length === 0 || !editingLocal) return;

    console.log(`[Admin] Starting upload of ${files.length} image(s)`);

    try {
      const uploadedUrls: string[] = [];

      // Upload each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`[Admin] Uploading image ${i + 1}/${files.length}:`, {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
        });

        const fd = new FormData();
        fd.append("file", file);

        const res = await fetch("/api/admin/upload", { method: "POST", body: fd });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
          console.error("[Admin] Upload failed:", errorData);
          alert(`Upload failed for ${file.name}: ${errorData.error || "Unknown error"}\n${errorData.details || ""}`);
          continue; // Continue with other files
        }

        const { url } = (await res.json()) as { url: string };
        console.log(`[Admin] Upload ${i + 1} successful, URL:`, url);
        uploadedUrls.push(url);
      }

      if (uploadedUrls.length > 0) {
        // Append to existing images array
        const currentImages = editingLocal.images || [];
        setEditingLocal({
          ...editingLocal,
          images: [...currentImages, ...uploadedUrls],
          // Keep legacy image field pointing to first image for backward compatibility
          image: currentImages.length === 0 && uploadedUrls.length > 0 ? uploadedUrls[0] : editingLocal.image
        });
      }
    } catch (error) {
      console.error("[Admin] Upload error:", error);
      alert(`Upload failed: ${error instanceof Error ? error.message : "Network error"}`);
    }
  }

  // Remove image from array
  function removeImage(index: number, editingLocal: Product | null, setEditingLocal: (v: Product) => void) {
    if (!editingLocal) return;
    const newImages = [...(editingLocal.images || [])];
    newImages.splice(index, 1);
    setEditingLocal({
      ...editingLocal,
      images: newImages,
      // Update legacy image field
      image: newImages.length > 0 ? newImages[0] : undefined
    });
  }

  // Reorder images (move up)
  function moveImageUp(index: number, editingLocal: Product | null, setEditingLocal: (v: Product) => void) {
    if (!editingLocal || index === 0) return;
    const newImages = [...(editingLocal.images || [])];
    [newImages[index - 1], newImages[index]] = [newImages[index], newImages[index - 1]];
    setEditingLocal({
      ...editingLocal,
      images: newImages,
      image: newImages[0]
    });
  }

  // Reorder images (move down)
  function moveImageDown(index: number, editingLocal: Product | null, setEditingLocal: (v: Product) => void) {
    if (!editingLocal || !editingLocal.images || index === editingLocal.images.length - 1) return;
    const newImages = [...editingLocal.images];
    [newImages[index], newImages[index + 1]] = [newImages[index + 1], newImages[index]];
    setEditingLocal({
      ...editingLocal,
      images: newImages,
      image: newImages[0]
    });
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
          <a href="/admin/scents" className="btn">
            Scents
          </a>
          <a href="/admin/alcohol-types" className="btn">Types</a>
          <a href="/admin/analytics" className="btn">
            Analytics
          </a>
          <a href="/admin/orders" className="btn">
            Orders
          </a>
          <a href="/admin/manual-sale" className="btn">
            Manual Sale
          </a>
          <a href="/admin/calculator" className="btn">
            Calculator
          </a>
          <a href="/admin/test-order" className="btn">
            Test Order
          </a>
          <a href="/admin/stripe-sync" className="btn">
            Stripe Sync
          </a>
          <a href="/admin/diagnostics/stripe-prices" className="btn">
            Stripe Diagnostics
          </a>
          <a href="/admin/settings" className="btn">
            Settings
          </a>
          <form action="/api/admin/logout" method="post">
            <button className="btn btn-ghost w-full sm:w-auto">Log out</button>
          </form>
        </div>
      </div>

      {/* Filter + New */}
      {/* Search and Controls */}
      <div className="mt-4 space-y-4">
        {/* Search and Primary Actions */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <input
            className="input flex-1 sm:max-w-md"
            placeholder="Search by name, slug, or SKU…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <button
            className="btn bg-green-600 text-white hover:bg-green-700 w-full sm:w-auto"
            onClick={exportToCSV}
            disabled={filtered.length === 0}
          >
            Export to CSV ({filtered.length})
          </button>
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

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Visible Filter */}
          <div>
            <label className="block text-xs font-medium mb-1 text-[var(--color-muted)]">Visibility</label>
            <select
              className="input w-full text-sm"
              value={visibleFilter}
              onChange={(e) => setVisibleFilter(e.target.value as typeof visibleFilter)}
            >
              <option value="all">All</option>
              <option value="visible">Visible</option>
              <option value="hidden">Hidden</option>
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-xs font-medium mb-1 text-[var(--color-muted)]">Type</label>
            <select
              className="input w-full text-sm"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">All Types</option>
              {alcoholTypes.map((type) => (
                <option key={type.id} value={type.name}>
                  {type.name}
                </option>
              ))}
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Stock Filter */}
          <div>
            <label className="block text-xs font-medium mb-1 text-[var(--color-muted)]">Stock</label>
            <select
              className="input w-full text-sm"
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as typeof stockFilter)}
            >
              <option value="all">All</option>
              <option value="in-stock">In Stock</option>
              <option value="out-of-stock">Out of Stock</option>
            </select>
          </div>

          {/* Best Seller Filter */}
          <div>
            <label className="block text-xs font-medium mb-1 text-[var(--color-muted)]">Best Seller</label>
            <select
              className="input w-full text-sm"
              value={bestFilter}
              onChange={(e) => setBestFilter(e.target.value as typeof bestFilter)}
            >
              <option value="all">All</option>
              <option value="best">Best Sellers</option>
              <option value="not-best">Not Best Sellers</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-xs font-medium mb-1 text-[var(--color-muted)]">Status</label>
            <select
              className="input w-full text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            >
              <option value="all">All</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>

        {/* Clear Filters */}
        <div className="flex justify-end">
          <button
            className="btn w-full sm:w-auto text-sm"
            onClick={() => {
              setFilter("");
              setVisibleFilter("all");
              setTypeFilter("all");
              setStockFilter("all");
              setBestFilter("all");
              setStatusFilter("all");
              setSortBy("none");
              setSortDirection("asc");
            }}
          >
            Clear All Filters
          </button>
        </div>
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
                    <SortableHeader column="none">Visible</SortableHeader>
                    <SortableHeader column="none">Image</SortableHeader>
                    <SortableHeader column="name">Name</SortableHeader>
                    <SortableHeader column="none">Slug</SortableHeader>
                    <SortableHeader column="price">Price</SortableHeader>
                    <SortableHeader column="none">Cost</SortableHeader>
                    <SortableHeader column="none">Type</SortableHeader>
                    <SortableHeader column="stock">Stock</SortableHeader>
                    <SortableHeader column="best">Best</SortableHeader>
                    <SortableHeader column="status">Status</SortableHeader>
                    <SortableHeader column="none">Actions</SortableHeader>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const isDraft = hasDraft(p.slug);
                    return (
                      <tr key={p.slug} className="border-b border-[var(--color-line)]">
                        <td className="py-2 pr-3">
                          <input
                            type="checkbox"
                            checked={p.visibleOnWebsite !== false}
                            onChange={(e) => {
                              const updated = { ...p, visibleOnWebsite: e.target.checked };
                              stageProduct(updated);
                            }}
                            title={p.visibleOnWebsite !== false ? "Visible on shop" : "Hidden from shop"}
                          />
                        </td>
                        <td className="py-2 pr-3">
                          {(() => {
                            const img = p.images?.[0] ?? p.image;
                            return img ? (
                              <Image
                                src={img}
                                alt=""
                                width={48}
                                height={48}
                                className="object-contain"
                              />
                            ) : (
                              <span>—</span>
                            );
                          })()}
                        </td>
                        <td className="py-2 pr-3">{p.name}</td>
                        <td className="py-2 pr-3">{p.slug}</td>
                        <td className="py-2 pr-3">${p.price.toFixed(2)}</td>
                        <td className="py-2 pr-3">
                          {p.materialCost ? (
                            <span className="text-sm">
                              ${p.materialCost.toFixed(2)}
                              {p.price > 0 && (
                                <span className="block text-xs text-green-600">
                                  +{(((p.price - p.materialCost) / p.price) * 100).toFixed(0)}%
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-[var(--color-muted)]">—</span>
                          )}
                        </td>
                        <td className="py-2 pr-3">{p.alcoholType ?? "Other"}</td>
                        <td className="py-2 pr-3">
                          <span className="text-sm">
                            {getTotalStock(p)}{" "}
                            <span className="text-[var(--color-muted)]">(variants)</span>
                          </span>
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
                      <div className="flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={p.visibleOnWebsite !== false}
                          onChange={(e) => {
                            const updated = { ...p, visibleOnWebsite: e.target.checked };
                            stageProduct(updated);
                          }}
                          title={p.visibleOnWebsite !== false ? "Visible on shop" : "Hidden from shop"}
                        />
                      </div>
                      <div className="relative h-16 w-16 flex-shrink-0 rounded-xl overflow-hidden bg-white">
                        {(() => {
                          const img = p.images?.[0] ?? p.image;
                          return img ? (
                            <Image src={img} alt="" fill sizes="64px" className="object-contain" />
                          ) : null;
                        })()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium truncate">{p.name}</h3>
                          {p.bestSeller ? <span className="badge">Best</span> : null}
                          {isDraft ? <span className="badge">Draft</span> : null}
                        </div>
                        <div className="text-xs text-[var(--color-muted)] truncate">
                          {p.slug} · ${p.price.toFixed(2)} · {p.alcoholType ?? "Other"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      {/* Stock control */}
                      <div className="text-sm">
                        Stock: {getTotalStock(p)}{" "}
                        <span className="text-[var(--color-muted)]">(variants)</span>
                      </div>

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
              {/* Name */}
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

              {/* Price */}
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

              {/* SKU */}
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
                              ]),
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

              {/* Alcohol Type — NEW */}
              <label className="block">
                <div className="text-xs mb-1">Alcohol Type</div>
                <div className="flex gap-2">
                  <select
                    className="input flex-1"
                    value={editing.alcoholType || ""}
                    onChange={async (e) => {
                      const v = e.target.value;
                      if (v === "__new__") {
                        const name = window.prompt("Enter new alcohol type (e.g., Tequila):");
                        if (name && name.trim()) {
                          const res = await fetch("/api/admin/alcohol-types", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ name: name.trim() }),
                          });
                          if (res.ok) {
                            await load();
                            setEditing((prev) => (prev ? { ...prev, alcoholType: name.trim() } : prev));
                          } else {
                            alert("Failed to create type");
                          }
                        }
                        return;
                      }
                      setEditing({ ...editing, alcoholType: v || undefined });
                    }}
                  >
                    <option value="">— Select type —</option>
                    {/* Active types only */}
                    {alcoholTypes.map((t) => (
                      <option key={t.id} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                    {/* If the current product has an archived type, show it as disabled but visible */}
                    {editing.alcoholType &&
                      !alcoholTypes.some((t) => t.name === editing.alcoholType) && (
                        <option value={editing.alcoholType} disabled>
                          {editing.alcoholType} (archived)
                        </option>
                      )}
                    <option value="__new__">+ Add new type…</option>
                  </select>
                </div>
              </label>

              {/* Stripe Price ID */}
              <label className="block sm:col-span-2">
                <div className="text-xs mb-1">Stripe Price ID</div>
                <input
                  className="input"
                  value={editing.stripePriceId || ""}
                  onChange={(e) => setEditing({ ...editing, stripePriceId: e.target.value })}
                />
              </label>

              {/* Images - Multiple Upload */}
              <div className="block sm:col-span-2">
                <div className="text-xs mb-1">Product Images</div>
                <label className="btn cursor-pointer w-full">
                  + Add Images
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleImagePick(e, editing, (v) => setEditing(v))}
                  />
                </label>

                {/* Display current images */}
                {editing.images && editing.images.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {editing.images.map((img, idx) => (
                      <div key={idx} className="card p-3 flex items-center gap-3">
                        <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-white">
                          <Image src={img} alt={`Product image ${idx + 1}`} fill className="object-contain" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-[var(--color-muted)] truncate">{img}</div>
                          {idx === 0 && <span className="text-xs font-medium text-green-600">Primary</span>}
                        </div>
                        <div className="flex gap-1">
                          {idx > 0 && (
                            <button
                              type="button"
                              className="btn text-xs px-2 py-1"
                              onClick={() => moveImageUp(idx, editing, (v) => setEditing(v))}
                              title="Move up"
                            >
                              ↑
                            </button>
                          )}
                          {editing.images && idx < editing.images.length - 1 && (
                            <button
                              type="button"
                              className="btn text-xs px-2 py-1"
                              onClick={() => moveImageDown(idx, editing, (v) => setEditing(v))}
                              title="Move down"
                            >
                              ↓
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn text-xs px-2 py-1"
                            onClick={() => removeImage(idx, editing, (v) => setEditing(v))}
                            title="Remove"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-[var(--color-muted)]">No images yet. Click &quot;Add Images&quot; to upload.</p>
                )}
              </div>

              {/* Description */}
              <label className="block sm:col-span-2">
                <div className="text-xs mb-1">Description</div>
                <textarea
                  className="textarea"
                  rows={4}
                  value={editing.seoDescription}
                  onChange={(e) => setEditing({ ...editing, seoDescription: e.target.value })}
                />
              </label>

              {/* Visible on Website */}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editing.visibleOnWebsite !== false}
                  onChange={(e) => setEditing({ ...editing, visibleOnWebsite: e.target.checked })}
                />
                <span className="text-sm">Show on Website</span>
              </label>

              {/* Best Seller */}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!editing.bestSeller}
                  onChange={(e) => setEditing({ ...editing, bestSeller: e.target.checked })}
                />
                <span className="text-sm">Best Seller</span>
              </label>

              {/* Young & Dumb */}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!editing.youngDumb}
                  onChange={(e) => setEditing({ ...editing, youngDumb: e.target.checked })}
                />
                <span className="text-sm">Young & Dumb</span>
              </label>

              {/* Base Stock (disabled when variants used) */}
              <label className="block">
                <div className="text-xs mb-1">Stock (base, if not using variants)</div>
                <input
                  className="input"
                  type="number"
                  value={editing.stock}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      stock: e.target.value === "" ? 0 : Number(e.target.value),
                    })
                  }
                  onBlur={(e) => {
                    const val = e.target.value === "" ? 0 : Number(e.target.value);
                    setEditing({
                      ...editing,
                      stock: Math.max(0, val),
                    });
                  }}
                  disabled={!!editing.variantConfig}
                />
              </label>
            </div>

            {/* ---------- Variants Section ---------- */}
            <div className="mt-6 border-t border-[var(--color-line)] pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Product Variants</h3>
                <p className="text-xs text-[var(--color-muted)]">
                  All products use the global scents system
                </p>
              </div>

              {(() => {
                // Auto-initialize variantConfig if it doesn't exist
                if (!editing.variantConfig) {
                  setEditing({
                    ...editing,
                    variantConfig: {
                      wickTypes: [{ id: "standard", name: "Standard Wick" }],
                      variantData: {},
                    },
                  });
                  return null;
                }
                return (
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
                                    wickTypes: editing.variantConfig!.wickTypes.filter(
                                      (_, i) => i !== idx
                                    ),
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

                    {/* Scents are now managed globally - show info */}
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-xs text-blue-900">
                        <strong>Scents are now global.</strong> All scents from the global scents list
                        will automatically appear as variants for this product.
                        <a href="/admin/scents" className="underline ml-1">
                          Manage scents →
                        </a>
                      </p>
                    </div>

                    {/* Generated Variants Grid */}
                    <div>
                      {(() => {
                        const availableScents = globalScents.filter((scent) => {
                          if (!scent.limited) return true;
                          return scent.enabledProducts?.includes(editing.slug) ?? false;
                        });
                        const variantsForDisplay = generateVariantsForDisplay(editing, globalScents);

                        return (
                          <>
                            <h4 className="text-xs font-medium mb-2">
                              Generated Variants ({editing.variantConfig.wickTypes.length} wick types ×{" "}
                              {availableScents.length} available scents = {variantsForDisplay.length} total)
                            </h4>
                            {availableScents.length === 0 ? (
                              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                <p className="text-xs text-amber-900">
                                  No scents available for this product.{" "}
                                  <a href="/admin/scents" className="underline">
                                    Manage scents →
                                  </a>
                                </p>
                              </div>
                            ) : (
                              <div className="max-h-96 overflow-y-auto space-y-2 border border-[var(--color-line)] rounded-lg p-2">
                                {variantsForDisplay.map((v) => (
                                  <div key={v.id} className="card p-2">
                                    <div className="text-xs font-medium mb-1">
                                      {v.wickName} / {v.scentName}
                                    </div>
                                    <label className="block">
                                      <div className="text-xs mb-1">Stock</div>
                                      <input
                                        className="input text-xs"
                                        type="number"
                                        value={v.stock}
                                        onChange={(e) => {
                                          const newData = { ...editing.variantConfig!.variantData };
                                          newData[v.id] = {
                                            stock: e.target.value === "" ? 0 : Number(e.target.value),
                                          };
                                          setEditing({
                                            ...editing,
                                            variantConfig: {
                                              ...editing.variantConfig!,
                                              variantData: newData,
                                            },
                                          });
                                        }}
                                        onBlur={(e) => {
                                          const val = e.target.value === "" ? 0 : Number(e.target.value);
                                          const newData = { ...editing.variantConfig!.variantData };
                                          newData[v.id] = {
                                            stock: Math.max(0, val),
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
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                );
              })()}
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