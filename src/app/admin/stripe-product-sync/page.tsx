"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, Image, CheckCircle, AlertCircle } from "lucide-react";

type ProductSyncStatus = {
  slug: string;
  name: string;
  stripePriceId: string | null;
  hasImage: boolean;
  imageUrl: string | null;
  needsSync: boolean;
};

export default function StripeProductSyncPage() {
  const [products, setProducts] = useState<ProductSyncStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);
    setError("");
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

  if (loading) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-[var(--color-muted)]">Loading products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 bg-neutral-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)] mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Admin
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Stripe Product Image Sync</h1>
              <p className="text-[var(--color-muted)] mt-1">
                Sync product images from your database to Stripe
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={loadProducts}
                disabled={loading}
                className="btn bg-[var(--color-ink)] text-white hover:bg-opacity-90"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </button>
              {productsNeedingSync.length > 0 && (
                <button
                  onClick={syncAllProducts}
                  disabled={syncingAll}
                  className="btn bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {syncingAll ? "Syncing..." : `Sync All (${productsNeedingSync.length})`}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="card p-4 bg-rose-50 border border-rose-200 mb-6">
            <p className="text-rose-600 text-sm">{error}</p>
          </div>
        )}
        {success && (
          <div className="card p-4 bg-green-50 border border-green-200 mb-6">
            <p className="text-green-600 text-sm">{success}</p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card p-6 bg-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Image className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-[var(--color-muted)]">
                Total Products
              </span>
            </div>
            <p className="text-3xl font-bold">{products.length}</p>
          </div>

          <div className="card p-6 bg-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-sm font-medium text-[var(--color-muted)]">
                With Images
              </span>
            </div>
            <p className="text-3xl font-bold">{productsWithImages.length}</p>
          </div>

          <div className="card p-6 bg-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-sm font-medium text-[var(--color-muted)]">
                Need Sync
              </span>
            </div>
            <p className="text-3xl font-bold text-amber-600">{productsNeedingSync.length}</p>
          </div>
        </div>

        {/* Products Needing Sync */}
        {productsNeedingSync.length > 0 && (
          <div className="card p-6 bg-white mb-8">
            <h2 className="text-xl font-bold mb-4 text-amber-600">
              Products Missing Images in Stripe
            </h2>
            <p className="text-sm text-[var(--color-muted)] mb-4">
              These products have images in your database but not in Stripe. Click &quot;Sync&quot; to upload them.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--color-line)]">
                    <th className="text-left py-3 text-sm font-semibold">Product</th>
                    <th className="text-left py-3 text-sm font-semibold">Image Preview</th>
                    <th className="text-left py-3 text-sm font-semibold">Stripe Price ID</th>
                    <th className="text-right py-3 text-sm font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {productsNeedingSync.map((product) => (
                    <tr key={product.slug} className="border-b border-[var(--color-line)]">
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
                      <td className="py-3 text-sm font-mono text-[var(--color-muted)]">
                        {product.stripePriceId ? product.stripePriceId.slice(0, 20) + '...' : 'None'}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => syncProduct(product.slug)}
                          disabled={syncing === product.slug || !product.stripePriceId}
                          className="btn bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
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
        <div className="card p-6 bg-white">
          <h2 className="text-xl font-bold mb-4">All Products</h2>
          {products.length === 0 ? (
            <p className="text-center text-[var(--color-muted)] py-8">
              No products found
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--color-line)]">
                    <th className="text-left py-3 text-sm font-semibold">Product</th>
                    <th className="text-left py-3 text-sm font-semibold">Image</th>
                    <th className="text-left py-3 text-sm font-semibold">Stripe Price ID</th>
                    <th className="text-center py-3 text-sm font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.slug} className="border-b border-[var(--color-line)]">
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
                      <td className="py-3 text-sm font-mono text-[var(--color-muted)]">
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
