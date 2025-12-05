"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search, Mail, CheckCircle, AlertCircle } from "lucide-react";

interface Order {
  orderId: string;
  email: string;
  totalCents: number;
  status: string;
  createdAt: string;
  completedAt?: string;
  items: Array<{
    productSlug: string;
    productName: string;
    quantity: number;
    priceCents: number;
  }>;
  isGuest: boolean;
  pointsEarned: number;
}

export default function AdminInvoicesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"email" | "orderId">("email");
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [customEmail, setCustomEmail] = useState("");

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError("");
    setOrder(null);
    setSendSuccess(false);

    try {
      const params = new URLSearchParams();
      params.set(searchType, searchQuery.trim());

      const res = await fetch(`/api/admin/orders/search?${params}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to find order");
      }

      if (data.order && data.order.orderId) {
        setOrder(data.order);
      } else {
        setError("No order found with that " + (searchType === "email" ? "email address" : "order number"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to search for order");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendInvoice() {
    if (!order) return;

    // For manual sales, require custom email input
    if (order.email === "manual-sale@admin.local" && !customEmail.trim()) {
      setError("Please enter a customer email address for this manual sale");
      return;
    }

    setSending(true);
    setSendSuccess(false);
    setError("");

    try {
      const res = await fetch("/api/admin/orders/send-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.orderId,
          customEmail: customEmail.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to send invoice");
      }

      setSendSuccess(true);
      setCustomEmail(""); // Clear custom email after success
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invoice");
    } finally {
      setSending(false);
    }
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
          <h1 className="text-3xl font-bold">Send Order Invoices</h1>
          <p className="text-[var(--color-muted)] mt-1">
            Search for orders and send/resend invoice emails
          </p>
        </div>

        {/* Search Form */}
        <div className="card p-6 bg-white mb-6">
          <h2 className="text-xl font-bold mb-4">Search for Order</h2>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="searchType"
                  value="email"
                  checked={searchType === "email"}
                  onChange={(e) => setSearchType(e.target.value as "email")}
                />
                <span>Email Address</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="searchType"
                  value="orderId"
                  checked={searchType === "orderId"}
                  onChange={(e) => setSearchType(e.target.value as "orderId")}
                />
                <span>Order Number</span>
              </label>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                className="input flex-1"
                placeholder={
                  searchType === "email"
                    ? "customer@example.com"
                    : "cs_test_abc123..."
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                required
              />
              <button
                type="submit"
                className="btn btn-primary inline-flex items-center gap-2"
                disabled={loading}
              >
                <Search className="w-4 h-4" />
                {loading ? "Searching..." : "Search"}
              </button>
            </div>
          </form>
        </div>

        {/* Error Message */}
        {error && (
          <div className="card p-4 bg-rose-50 border border-rose-200 mb-6">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <p className="text-rose-600 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Success Message */}
        {sendSuccess && (
          <div className="card p-4 bg-green-50 border border-green-200 mb-6">
            <div className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-green-600 text-sm">
                Invoice email sent successfully to {order?.email}!
              </p>
            </div>
          </div>
        )}

        {/* Order Details */}
        {order && order.orderId && (
          <div className="card p-6 bg-white">
            <div className="mb-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold mb-1">
                    Order #{order.orderId.slice(0, 16)}
                  </h2>
                  <p className="text-sm text-[var(--color-muted)] font-mono text-xs">
                    {order.orderId}
                  </p>
                  <p className="text-sm text-[var(--color-muted)]">
                    {new Date(order.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Custom Email Input for Manual Sales */}
              {order.email === "manual-sale@admin.local" && (
                <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded">
                  <p className="text-sm text-amber-900 mb-2">
                    This is a manual sale. Enter the customer&apos;s email address to send the invoice:
                  </p>
                  <input
                    type="email"
                    className="input w-full"
                    placeholder="customer@example.com"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    required
                  />
                </div>
              )}

              <button
                onClick={handleSendInvoice}
                disabled={sending}
                className="btn btn-primary inline-flex items-center gap-2"
              >
                <Mail className="w-4 h-4" />
                {sending ? "Sending..." : "Send Invoice Email"}
              </button>
            </div>

            {/* Customer Info */}
            <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-neutral-50 rounded">
              <div>
                <p className="text-xs text-[var(--color-muted)] mb-1">Customer Email</p>
                <p className="font-medium">{order.email}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-muted)] mb-1">Account Type</p>
                <p className="font-medium">
                  {order.isGuest ? "Guest Checkout" : "Registered User"}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-muted)] mb-1">Status</p>
                <p className="font-medium capitalize">{order.status}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-muted)] mb-1">Points Earned</p>
                <p className="font-medium">{order.pointsEarned} points</p>
              </div>
            </div>

            {/* Order Items */}
            <div>
              <h3 className="font-semibold mb-3">Order Items</h3>
              <div className="space-y-2">
                {order.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-neutral-50 rounded"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{item.productName}</p>
                      {item.productSlug.startsWith("unmapped-") && (
                        <div className="text-xs text-amber-600 mt-1 p-2 bg-amber-50 rounded">
                          <p className="font-semibold">⚠️ Not listed on website</p>
                          <p className="text-[var(--color-muted)] mt-1">
                            To link future sales: Add this product to your website via <strong>/admin/products</strong>, then set its <strong>Stripe Price ID</strong> to match this unmapped product&apos;s ID. Future orders will automatically link to the real product.
                          </p>
                          <p className="text-[var(--color-muted)] mt-1 font-mono text-xs">
                            Unmapped ID: {item.productSlug}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-[var(--color-muted)]">Qty: {item.quantity}</p>
                      <p className="font-medium">
                        ${(item.priceCents / 100).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="flex items-center justify-between pt-4 mt-4 border-t border-[var(--color-line)]">
                <p className="font-semibold text-lg">Total</p>
                <p className="font-bold text-xl">
                  ${(order.totalCents / 100).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
