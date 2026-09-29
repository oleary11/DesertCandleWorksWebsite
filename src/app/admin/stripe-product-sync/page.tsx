"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Image, CheckCircle, AlertCircle, UploadCloud, Search } from "lucide-react";
import CandleSpinner from "@/components/CandleSpinner";

type ProductSyncStatus = {
  slug: string;
  name: string;
  stripePriceId: string | null;
  hasImage: boolean;
  imageUrl: string | null;
  stripeImageUrl: string | null;
  needsSync: boolean;
};

export default function StripeProductSyncPage() {
  const [products, setProducts] = useState<ProductSyncStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [pushing, setPushing] = useState(false);
  const [pushProgress, setPushProgress] = useState<{ current: number; total: number } | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);
    setError("");
    setSelectedSlugs([]);
    try {
      const res = await fetch("/api/admin/stripe-product-sync");
      if (!res.ok) throw new Error("Failed to load products");
      const data = await res.json();
      setProducts(data.products || []);
    } catch (err) {
      setError("Failed to load products: " + String(err));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function syncProduct(slug: string) {
    setSyncing(slug);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/admin/stripe-product-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to sync product");
      }

      if (data.skipped) {
        setSuccess(`${data.productName} already has an image in Stripe`);
      } else {
        setSuccess(`Successfully synced image for ${data.productName}!`);
      }

      // Reload products to update status
      await loadProducts();
    } catch (err) {
      setError(String(err));
      console.error(err);
    } finally {
      setSyncing(null);
    }
  }

  async function forceSyncProduct(slug: string) {
    setSyncing(slug);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/admin/stripe-product-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, force: true }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update photo");
      }

      setSuccess(`Photo updated in Stripe for ${data.productName}!`);
      await loadProducts();
    } catch (err) {
      setError(String(err));
      console.error(err);
    } finally {
      setSyncing(null);
    }
  }

  async function pushSelectedPhotos() {
    if (selectedSlugs.length === 0) return;
    setPushing(true);
    setPushProgress({ current: 0, total: selectedSlugs.length });
    setError("");
    setSuccess("");

    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < selectedSlugs.length; i++) {
      const slug = selectedSlugs[i];
      try {
        const res = await fetch("/api/admin/stripe-product-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, force: true }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed");
        succeeded++;
      } catch (err) {
        console.error(`Failed to sync ${slug}:`, err);
        failed++;
      }
      setPushProgress({ current: i + 1, total: selectedSlugs.length });
    }

    setPushing(false);
    setPushProgress(null);
    setSelectedSlugs([]);
    setSuccess(`Updated ${succeeded} photo(s)${failed > 0 ? `, ${failed} failed` : ""}.`);
    await loadProducts();
  }

  async function syncAllProducts() {
    setSyncingAll(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/admin/stripe-product-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncAll: true }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to sync products");
      }

      setSuccess(`Successfully synced ${data.synced} product(s)! Skipped ${data.skipped} (already have images).`);

      // Reload products to update status
      await loadProducts();
    } catch (err) {
      setError(String(err));
      console.error(err);
    } finally {
      setSyncingAll(false);
    }
  }

  const productsNeedingSync = products.filter((p) => p.needsSync);
  const productsWithImages = products.filter((p) => p.hasImage);

  const searchLower = search.toLowerCase();
  const filteredProducts = search
    ? products.filter((p) => p.name.toLowerCase().includes(searchLower))
    : products;

  const allFilteredSelected =
    filteredProducts.length > 0 && filteredProducts.every((p) => selectedSlugs.includes(p.slug));
  const someFilteredSelected = filteredProducts.some((p) => selectedSlugs.includes(p.slug));

  if (loading) {
    return (
      <div className="a-ui flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <CandleSpinner />
          <p className="text-sm font-medium text-[var(--a-ink)]">Loading products…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="a-ui">
      {/* Loading overlay — shown during single sync or bulk push */}
      {(pushing || syncing !== null) && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
          <div className="a-card flex min-w-[220px] flex-col items-center gap-4 px-10 py-8 shadow-2xl">
            <CandleSpinner />
            <p className="text-sm font-medium text-[var(--a-ink)]">
              {pushProgress
                ? `Pushing photos… ${pushProgress.current} / ${pushProgress.total}`
                : "Updating photo…"}
            </p>
          </div>
        </div>
      )}
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-[var(--a-ink)] sm:text-[2.125rem]">Stripe Product Image Sync</h1>
              <p className="mt-1.5 text-[15px] text-[var(--a-muted)]">
                Sync product images from your database to Stripe
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={loadProducts}
                disabled={loading}
                className="a-btn bg-[var(--color-ink)] text-white hover:bg-opacity-90"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </button>
              {productsNeedingSync.length > 0 && (
                <button
                  onClick={syncAllProducts}
                  disabled={syncingAll}
                  className="a-btn bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {syncingAll ? "Syncing..." : `Sync All (${productsNeedingSync.length})`}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-[#fdecea] p-4">
            <p className="text-rose-600 text-sm">{error}</p>
          </div>
        )}
        {success && (
          <div className="a-card p-4 bg-green-50 border border-green-200 mb-6">
            <p className="text-green-600 text-sm">{success}</p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="a-card p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="a-icon-tile">
                <Image className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-[var(--a-muted)]">
                Total Products
              </span>
            </div>
            <p className="text-3xl font-bold">{products.length}</p>
          </div>

          <div className="a-card p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-sm font-medium text-[var(--a-muted)]">
                With Images
              </span>
            </div>
            <p className="text-3xl font-bold">{productsWithImages.length}</p>
          </div>

          <div className="a-card p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-sm font-medium text-[var(--a-muted)]">
                Need Sync
              </span>
            </div>
            <p className="text-3xl font-bold text-amber-600">{productsNeedingSync.length}</p>
          </div>
        </div>

        {/* Products Needing Sync */}
        {productsNeedingSync.length > 0 && (
          <div className="a-card p-5 mb-8">
            <h2 className="text-xl font-bold mb-4 text-amber-600">
              Products Missing Images in Stripe
            </h2>
            <p className="text-sm text-[var(--a-muted)] mb-4">
              These products have images in your database but not in Stripe. Click &quot;Sync&quot; to upload them.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--a-line)]">
                    <th className="text-left py-3 text-sm font-semibold">Product</th>
                    <th className="text-left py-3 text-sm font-semibold">Image Preview</th>
                    <th className="text-left py-3 text-sm font-semibold">Stripe Price ID</th>
                    <th className="text-right py-3 text-sm font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {productsNeedingSync.map((product) => (
                    <tr key={product.slug} className="border-b border-[var(--a-line)]">
                      <td className="py-3 text-sm font-medium">{product.name}</td>
                      <td className="py-3">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-12 h-12 object-cover rounded"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                            <Image className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                      </td>
                      <td className="py-3 text-sm font-mono text-[var(--a-muted)]">
                        {product.stripePriceId ? product.stripePriceId.slice(0, 20) + '...' : 'None'}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => syncProduct(product.slug)}
                          disabled={syncing === product.slug || !product.stripePriceId}
                          className="a-btn bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          {syncing === product.slug ? "Syncing..." : product.stripePriceId ? "Sync" : "No Stripe Price"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* All Products */}
        <div className="a-card p-5">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold text-[var(--a-ink)]">All Products</h2>
              {selectedSlugs.length > 0 && (
                <span className="text-sm text-[var(--a-muted)]">{selectedSlugs.length} selected</span>
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {selectedSlugs.length > 0 && (
                <button
                  onClick={pushSelectedPhotos}
                  disabled={pushing}
                  className="a-btn btn-primary flex items-center gap-1.5"
                >
                  <UploadCloud className="w-4 h-4" />
                  Push Selected ({selectedSlugs.length})
                </button>
              )}
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--a-muted)] pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search products…"
                  className="a-input !pl-9"
                />
              </div>
            </div>
          </div>
          {products.length === 0 ? (
            <p className="text-center text-[var(--a-muted)] py-8">
              No products found
            </p>
          ) : filteredProducts.length === 0 ? (
            <p className="text-center text-[var(--a-muted)] py-8">
              No products match &ldquo;{search}&rdquo;
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--a-line)]">
                    <th className="w-10 py-3 pl-1 pr-3">
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        ref={(el) => { if (el) el.indeterminate = someFilteredSelected && !allFilteredSelected; }}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSlugs([...new Set([...selectedSlugs, ...filteredProducts.map((p) => p.slug)])]);
                          } else {
                            setSelectedSlugs(selectedSlugs.filter((s) => !filteredProducts.some((p) => p.slug === s)));
                          }
                        }}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </th>
                    <th className="text-left py-3 text-sm font-semibold">Product</th>
                    <th className="text-left py-3 text-sm font-semibold">Your Image</th>
                    <th className="text-left py-3 text-sm font-semibold">Stripe Image</th>
                    <th className="text-left py-3 text-sm font-semibold">Stripe Price ID</th>
                    <th className="text-center py-3 text-sm font-semibold">Status</th>
                    <th className="text-right py-3 text-sm font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => (
                    <tr
                      key={product.slug}
                      className={`border-b border-[var(--a-line)] transition-colors ${selectedSlugs.includes(product.slug) ? "bg-[var(--a-tint)]" : ""}`}
                    >
                      <td className="py-3 pl-1 pr-3">
                        <input
                          type="checkbox"
                          checked={selectedSlugs.includes(product.slug)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedSlugs([...selectedSlugs, product.slug]);
                            else setSelectedSlugs(selectedSlugs.filter((s) => s !== product.slug));
                          }}
                          className="w-4 h-4 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 text-sm font-medium">{product.name}</td>
                      {/* Your image (from DB) */}
                      <td className="py-3">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-16 h-16 object-cover rounded border border-[var(--a-line)]"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-gray-100 rounded border border-[var(--a-line)] flex items-center justify-center">
                            <Image className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                      </td>
                      {/* Stripe image */}
                      <td className="py-3">
                        {product.stripeImageUrl ? (
                          <img
                            src={product.stripeImageUrl}
                            alt={`${product.name} on Stripe`}
                            className="w-16 h-16 object-cover rounded border border-[var(--a-line)]"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-gray-100 rounded border border-dashed border-gray-300 flex items-center justify-center" title="No image in Stripe">
                            <Image className="w-6 h-6 text-gray-300" />
                          </div>
                        )}
                      </td>
                      <td className="py-3 text-sm font-mono text-[var(--a-muted)]">
                        {product.stripePriceId ? product.stripePriceId.slice(0, 20) + '...' : 'None'}
                      </td>
                      <td className="py-3 text-center">
                        {product.hasImage ? (
                          <span className="inline-flex items-center gap-1 text-green-600">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-sm">Synced</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-600">
                            <AlertCircle className="w-4 h-4" />
                            <span className="text-sm">Needs Sync</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => forceSyncProduct(product.slug)}
                          disabled={syncing === product.slug || !product.stripePriceId || !product.imageUrl}
                          title={!product.imageUrl ? "No image on file" : !product.stripePriceId ? "No Stripe Price ID" : "Force upload current photo to Stripe"}
                          className="a-btn flex items-center gap-1.5 ml-auto disabled:opacity-40"
                        >
                          <UploadCloud className="w-4 h-4" />
                          {syncing === product.slug ? "Updating…" : "Update Photo"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
