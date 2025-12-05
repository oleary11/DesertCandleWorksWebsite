"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Wrench, AlertCircle, CheckCircle } from "lucide-react";

export default function RepairOrderPage() {
  const [orderId, setOrderId] = useState("");
  const [productName, setProductName] = useState("");
  const [productSlug, setProductSlug] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [priceCents, setPriceCents] = useState(0);
  const [totalCents, setTotalCents] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleRepair(e: React.FormEvent) {
    e.preventDefault();
    setProcessing(true);
    setSuccess(false);
    setError("");

    try {
      const res = await fetch("/api/admin/repair-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          itemsToAdd: [
            {
              productSlug,
              productName,
              quantity,
              priceCents,
            },
          ],
          newTotalCents: totalCents,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to repair order");
      }

      setSuccess(true);
      // Clear form
      setOrderId("");
      setProductName("");
      setProductSlug("");
      setQuantity(1);
      setPriceCents(0);
      setTotalCents(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to repair order");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="min-h-screen p-6 bg-neutral-50">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)] mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Admin
          </Link>
          <h1 className="text-3xl font-bold">Repair Order</h1>
          <p className="text-[var(--color-muted)] mt-1">
            Manually add missing items to an existing order
          </p>
        </div>

        {/* Warning */}
        <div className="card p-4 bg-amber-50 border border-amber-200 mb-6">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              <p className="font-semibold mb-1">Use with caution</p>
              <p>
                This tool directly modifies order data in Redis. Only use this to fix orders
                that were partially processed due to webhook errors or unmapped products.
              </p>
            </div>
          </div>
        </div>

        {/* Success Message */}
        {success && (
          <div className="card p-4 bg-green-50 border border-green-200 mb-6">
            <div className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-green-600 text-sm">Order repaired successfully!</p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="card p-4 bg-rose-50 border border-rose-200 mb-6">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <p className="text-rose-600 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Form */}
        <div className="card p-6 bg-white">
          <h2 className="text-xl font-bold mb-4">Add Missing Product to Order</h2>
          <form onSubmit={handleRepair} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Order ID (Stripe Session ID)</label>
              <input
                type="text"
                className="input w-full font-mono text-sm"
                placeholder="cs_live_..."
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Product Name</label>
              <input
                type="text"
                className="input w-full"
                placeholder="Angels Envy Bourbon Candle"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Product Slug</label>
              <input
                type="text"
                className="input w-full"
                placeholder="unmapped-price_abc123 or angels-envy-bourbon-candle"
                value={productSlug}
                onChange={(e) => setProductSlug(e.target.value)}
                required
              />
              <p className="text-xs text-[var(--color-muted)] mt-1">
                Use "unmapped-[price_id]" for products not on website
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Quantity</label>
                <input
                  type="number"
                  className="input w-full"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value))}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Price (cents)</label>
                <input
                  type="number"
                  className="input w-full"
                  min="0"
                  placeholder="4499"
                  value={priceCents || ""}
                  onChange={(e) => setPriceCents(parseInt(e.target.value) || 0)}
                  required
                />
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  ${((priceCents || 0) / 100).toFixed(2)}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">New Order Total (cents)</label>
              <input
                type="number"
                className="input w-full"
                min="0"
                placeholder="13496"
                value={totalCents || ""}
                onChange={(e) => setTotalCents(parseInt(e.target.value) || 0)}
                required
              />
              <p className="text-xs text-[var(--color-muted)] mt-1">
                ${((totalCents || 0) / 100).toFixed(2)} (should match Stripe total)
              </p>
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full inline-flex items-center justify-center gap-2"
              disabled={processing}
            >
              <Wrench className="w-4 h-4" />
              {processing ? "Repairing Order..." : "Repair Order"}
            </button>
          </form>
        </div>

        {/* Quick Fill for Sharon's Order */}
        <div className="card p-4 bg-blue-50 border border-blue-200 mt-6">
          <p className="text-sm text-blue-900 font-semibold mb-2">Quick Fill: Sharon's Missing Angels Envy</p>
          <button
            onClick={() => {
              setOrderId("cs_live_b1oV3rNcTWzgv3LZTu3fnGHZSVpK2QawPB9XuVlg4xfi6bAt8ODAIFF1vD");
              setProductName("Angels Envy Bourbon Candle");
              setProductSlug("unmapped-angels-envy-bourbon");
              setQuantity(1);
              setPriceCents(4499);
              setTotalCents(13496);
            }}
            className="btn btn-sm"
          >
            Fill Form
          </button>
        </div>
      </div>
    </div>
  );
}
