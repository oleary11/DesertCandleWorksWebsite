"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, DollarSign } from "lucide-react";

type Product = {
  slug: string;
  name: string;
  price: number;
  stock: number;
  variantConfig?: {
    wickTypes: Array<{ id: string; name: string }>;
    variantData: Record<string, { stock: number }>;
  };
};

type SaleItem = {
  id: string;
  productSlug: string;
  productName: string;
  quantity: number;
  priceCents: number;
  variantId?: string;
};

export default function ManualSalePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [customerEmail, setCustomerEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "other">("cash");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      const res = await fetch("/api/admin/products");
      if (!res.ok) throw new Error("Failed to load products");
      const data = await res.json();
      setProducts(data.items || []);
    } catch (err) {
      setError("Failed to load products");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function addItem() {
    const newItem: SaleItem = {
      id: crypto.randomUUID(),
      productSlug: "",
      productName: "",
      quantity: 1,
      priceCents: 0,
    };
    setItems([...items, newItem]);
  }

  function removeItem(id: string) {
    setItems(items.filter((item) => item.id !== id));
  }

  function updateItem(id: string, updates: Partial<SaleItem>) {
    setItems(
      items.map((item) => {
        if (item.id === id) {
          return { ...item, ...updates };
        }
        return item;
      })
    );
  }

  function handleProductChange(itemId: string, productSlug: string) {
    const product = products.find((p) => p.slug === productSlug);
    if (product) {
      updateItem(itemId, {
        productSlug: product.slug,
        productName: product.name,
        priceCents: Math.round(product.price * 100),
        variantId: undefined, // Reset variant when product changes
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (items.length === 0) {
      setError("Please add at least one item");
      return;
    }

    // Validate all items have products selected
    for (const item of items) {
      if (!item.productSlug) {
        setError("Please select a product for all items");
        return;
      }
      if (item.quantity < 1) {
        setError("Quantity must be at least 1 for all items");
        return;
      }
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/admin/manual-sale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            productSlug: item.productSlug,
            productName: item.productName,
            quantity: item.quantity,
            priceCents: item.priceCents,
            variantId: item.variantId,
          })),
          customerEmail: customerEmail || undefined,
          paymentMethod,
          notes: notes || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to record sale");
      }

      setSuccess(`Sale recorded successfully! Order ID: ${data.orderId}`);
      // Reset form
      setItems([]);
      setCustomerEmail("");
      setPaymentMethod("cash");
      setNotes("");
      // Reload products to get updated stock
      loadProducts();
    } catch (err) {
      setError(String(err));
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  const totalCents = items.reduce((sum, item) => sum + item.priceCents, 0);

  if (loading) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-[var(--color-muted)]">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 bg-neutral-50">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)] mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Admin
          </Link>
          <h1 className="text-3xl font-bold">Record Manual Sale</h1>
          <p className="text-[var(--color-muted)] mt-1">
            Add in-person or cash sales to analytics and inventory
          </p>
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Items */}
          <div className="card p-6 bg-white">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Sale Items</h2>
              <button
                type="button"
                onClick={addItem}
                className="btn bg-[var(--color-ink)] text-white hover:bg-opacity-90"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </button>
            </div>

            {items.length === 0 ? (
              <p className="text-[var(--color-muted)] text-center py-8">
                No items added yet. Click &quot;Add Item&quot; to start.
              </p>
            ) : (
              <div className="space-y-4">
                {items.map((item) => {
                  const selectedProduct = products.find((p) => p.slug === item.productSlug);
                  const hasVariants = selectedProduct?.variantConfig?.wickTypes &&
                    selectedProduct.variantConfig.wickTypes.length > 0;

                  return (
                    <div key={item.id} className="flex gap-4 items-start border-b border-[var(--color-line)] pb-4">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* Product Select */}
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium mb-1">Product</label>
                          <select
                            className="input w-full"
                            value={item.productSlug}
                            onChange={(e) => handleProductChange(item.id, e.target.value)}
                            required
                          >
                            <option value="">Select product...</option>
                            {products.map((p) => (
                              <option key={p.slug} value={p.slug}>
                                {p.name} (Stock: {p.stock})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Variant Select (if applicable) */}
                        {hasVariants && (
                          <div>
                            <label className="block text-sm font-medium mb-1">Variant</label>
                            <select
                              className="input w-full"
                              value={item.variantId || ""}
                              onChange={(e) => updateItem(item.id, { variantId: e.target.value || undefined })}
                            >
                              <option value="">Base product</option>
                              {selectedProduct?.variantConfig?.wickTypes.map((wt) => (
                                <option key={wt.id} value={wt.id}>
                                  {wt.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Quantity */}
                        <div>
                          <label className="block text-sm font-medium mb-1">Quantity</label>
                          <input
                            type="number"
                            className="input w-full"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              updateItem(item.id, { quantity: parseInt(e.target.value) || 1 })
                            }
                            required
                          />
                        </div>

                        {/* Price */}
                        <div>
                          <label className="block text-sm font-medium mb-1">Price ($)</label>
                          <input
                            type="number"
                            className="input w-full"
                            step="0.01"
                            min="0"
                            value={(item.priceCents / 100).toFixed(2)}
                            onChange={(e) =>
                              updateItem(item.id, {
                                priceCents: Math.round(parseFloat(e.target.value || "0") * 100),
                              })
                            }
                            required
                          />
                        </div>
                      </div>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="btn bg-rose-600 text-white hover:bg-rose-700 mt-6"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Total */}
            {items.length > 0 && (
              <div className="mt-6 pt-4 border-t border-[var(--color-line)]">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold">Total:</span>
                  <span className="text-2xl font-bold text-green-600">
                    ${(totalCents / 100).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Payment Details */}
          <div className="card p-6 bg-white">
            <h2 className="text-xl font-bold mb-4">Payment Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Payment Method</label>
                <select
                  className="input w-full"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as "cash" | "card" | "other")}
                  required
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card (Non-Stripe)</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Customer Email <span className="text-[var(--color-muted)]">(optional)</span>
                </label>
                <input
                  type="email"
                  className="input w-full"
                  placeholder="customer@example.com"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium mb-1">
                Notes <span className="text-[var(--color-muted)]">(optional)</span>
              </label>
              <textarea
                className="textarea w-full"
                rows={3}
                placeholder="Add any notes about this sale..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={submitting || items.length === 0}
              className="btn bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex-1"
            >
              <DollarSign className="w-4 h-4 mr-2" />
              {submitting ? "Recording Sale..." : `Record Sale - $${(totalCents / 100).toFixed(2)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
