"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type Product = {
  slug: string;
  name: string;
  price: number;
  variantConfig?: {
    wickTypes: Array<{ id: string; name: string }>;
    variantData: Record<string, { stock: number }>;
  };
};

type OrderItem = {
  productSlug: string;
  productName: string;
  quantity: number;
  priceCents: number;
  variantId?: string;
};

export default function TestOrderPage() {
  const [email, setEmail] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [itemPriceStrs, setItemPriceStrs] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; message?: string; error?: string } | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      const res = await fetch("/api/admin/products");
      const data = await res.json();
      setProducts(data.items || []);
    } catch (err) {
      console.error("Failed to load products:", err);
    }
  }

  function addItem() {
    setItems([
      ...items,
      {
        productSlug: "",
        productName: "",
        quantity: 1,
        priceCents: 0,
        variantId: "",
      },
    ]);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof OrderItem, value: string | number) {
    const newItems = [...items];

    if (field === "productSlug") {
      const product = products.find((p) => p.slug === value);
      if (product) {
        newItems[index] = {
          ...newItems[index],
          productSlug: product.slug,
          productName: product.name,
          priceCents: product.price * 100,
        };
      }
    } else {
      newItems[index] = { ...newItems[index], [field]: value };
    }

    setItems(newItems);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    const totalCents = items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);

    try {
      const res = await fetch("/api/admin/test-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          items: items.map((item) => ({
            productSlug: item.productSlug,
            productName: item.productName,
            quantity: item.quantity,
            priceCents: item.priceCents,
            variantId: item.variantId || undefined,
          })),
          totalCents,
          isGuest,
          sendEmail,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setResult({ success: true, message: data.message });
        setItems([]);
        setEmail("");
      } else {
        setResult({ error: data.error || "Failed to create test order" });
      }
    } catch {
      setResult({ error: "Network error" });
    } finally {
      setLoading(false);
    }
  }

  const totalCents = items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
  const pointsToEarn = Math.floor(totalCents / 100);

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin" className="btn">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-2xl font-semibold">Create Test Order</h1>
      </div>

      {/* Info Banner */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          <strong>Test the order and points system</strong> without going through Stripe checkout.
          This will create a real order and decrement stock. Enable &quot;Guest Checkout&quot; to test orders without user accounts,
          or leave it unchecked to award points to authenticated users.
        </p>
      </div>

      {/* Result Message */}
      {result && (
        <div className={`mb-6 p-4 rounded-lg ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <p className={`text-sm ${result.success ? 'text-green-900' : 'text-red-900'}`}>
            {result.success ? result.message : result.error}
          </p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* User Email & Options */}
        <div className="card p-6 space-y-4">
          <label className="block">
            <div className="text-sm font-medium mb-2">Customer Email</div>
            <input
              type="email"
              className="input w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              required
            />
            <p className="text-xs text-[var(--color-muted)] mt-1">
              {isGuest
                ? "Email for guest checkout - no account required"
                : "The user must have an account with this email address"}
            </p>
          </label>

          <div className="space-y-3 pt-3 border-t border-[var(--color-line)]">
            <label className="flex items-center gap-3 cursor-pointer py-2 -mx-2 px-2 rounded hover:bg-neutral-50">
              <input
                type="checkbox"
                checked={isGuest}
                onChange={(e) => setIsGuest(e.target.checked)}
                className="w-5 h-5 rounded border-[var(--color-line)] flex-shrink-0"
              />
              <div>
                <div className="text-sm font-medium">Guest Checkout</div>
                <div className="text-xs text-[var(--color-muted)]">
                  Create order without user account (no points awarded)
                </div>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer py-2 -mx-2 px-2 rounded hover:bg-neutral-50">
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
                className="w-5 h-5 rounded border-[var(--color-line)] flex-shrink-0"
              />
              <div>
                <div className="text-sm font-medium">Send Invoice Email</div>
                <div className="text-xs text-[var(--color-muted)]">
                  Send order confirmation email with invoice link
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Order Items */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Order Items</h2>
            <button type="button" className="btn btn-primary" onClick={addItem}>
              + Add Item
            </button>
          </div>

          {items.length === 0 ? (
            <p className="text-[var(--color-muted)] text-center py-8">No items yet. Click &quot;Add Item&quot; to get started.</p>
          ) : (
            <div className="space-y-4">
              {items.map((item, index) => {
                const product = products.find((p) => p.slug === item.productSlug);
                const hasVariants = product?.variantConfig?.wickTypes && product.variantConfig.wickTypes.length > 0;

                return (
                  <div key={index} className="p-4 border border-[var(--color-line)] rounded-lg">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Product */}
                      <label className="block">
                        <div className="text-xs font-medium mb-1">Product</div>
                        <select
                          className="input w-full text-sm"
                          value={item.productSlug}
                          onChange={(e) => updateItem(index, "productSlug", e.target.value)}
                          required
                        >
                          <option value="">Select product...</option>
                          {products.map((p) => (
                            <option key={p.slug} value={p.slug}>
                              {p.name} (${p.price.toFixed(2)})
                            </option>
                          ))}
                        </select>
                      </label>

                      {/* Variant (if applicable) */}
                      {hasVariants && (
                        <label className="block">
                          <div className="text-xs font-medium mb-1">Variant</div>
                          <select
                            className="input w-full text-sm"
                            value={item.variantId}
                            onChange={(e) => updateItem(index, "variantId", e.target.value)}
                          >
                            <option value="">Select variant...</option>
                            {product.variantConfig?.wickTypes.map((wick) => (
                              <option key={wick.id} value={wick.id}>
                                {wick.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}

                      {/* Quantity */}
                      <label className="block">
                        <div className="text-xs font-medium mb-1">Quantity</div>
                        <input
                          type="number"
                          className="input w-full text-sm"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value))}
                          min="1"
                          required
                        />
                      </label>

                      {/* Price */}
                      <label className="block">
                        <div className="text-xs font-medium mb-1">Unit Price ($)</div>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="input w-full text-sm"
                          value={itemPriceStrs[index] ?? (item.priceCents === 0 ? "" : (item.priceCents / 100).toString())}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "" || /^\d*\.?\d*$/.test(val)) {
                              setItemPriceStrs({ ...itemPriceStrs, [index]: val });
                            }
                          }}
                          onBlur={() => {
                            const val = itemPriceStrs[index];
                            if (val !== undefined) {
                              const num = parseFloat(val);
                              if (!isNaN(num)) {
                                updateItem(index, "priceCents", Math.round(parseFloat(num.toFixed(2)) * 100));
                                setItemPriceStrs({ ...itemPriceStrs, [index]: num.toFixed(2) });
                              } else if (val === "") {
                                updateItem(index, "priceCents", 0);
                                const copy = { ...itemPriceStrs };
                                delete copy[index];
                                setItemPriceStrs(copy);
                              }
                            }
                          }}
                          onFocus={() => {
                            if (itemPriceStrs[index] === undefined) {
                              setItemPriceStrs({
                                ...itemPriceStrs,
                                [index]: item.priceCents === 0 ? "" : (item.priceCents / 100).toString()
                              });
                            }
                          }}
                          required
                        />
                      </label>
                    </div>

                    <div className="mt-3 flex justify-between items-center">
                      <div className="text-sm">
                        Subtotal: <strong>${((item.priceCents * item.quantity) / 100).toFixed(2)}</strong>
                      </div>
                      <button
                        type="button"
                        className="btn text-sm text-red-600"
                        onClick={() => removeItem(index)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Order Summary */}
        {items.length > 0 && (
          <div className="card p-6 bg-neutral-50">
            <h3 className="font-semibold mb-3">Order Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Total Items:</span>
                <span>{items.reduce((sum, item) => sum + item.quantity, 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Amount:</span>
                <span className="font-semibold">${(totalCents / 100).toFixed(2)}</span>
              </div>
              <div className={`flex justify-between ${isGuest ? 'text-[var(--color-muted)]' : 'text-green-700'}`}>
                <span>Points to Award:</span>
                <span className="font-semibold">
                  {isGuest ? '0 points (guest)' : `${pointsToEarn} points`}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Link href="/admin" className="btn">
            Cancel
          </Link>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || items.length === 0}
          >
            {loading ? "Creating..." : "Create Test Order"}
          </button>
        </div>
      </form>
    </div>
  );
}
