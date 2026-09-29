"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle, Mail, Search } from "lucide-react";
import PageHeader from "../_components/PageHeader";
import { Badge, Segmented } from "../_components/ui";

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

  const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const isManual = order?.email === "manual-sale@admin.local";

  return (
    <div className="a-ui mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader title="Order invoices" description="Find an order and send (or resend) its invoice email." />

      <form onSubmit={handleSearch} className="a-card mb-6 p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-[var(--a-ink)]">Find by</p>
          <Segmented
            label="Search by"
            value={searchType}
            onChange={setSearchType}
            options={[
              { value: "email", label: "Email" },
              { value: "orderId", label: "Order number" },
            ]}
          />
        </div>
        <div className="flex gap-2">
          <label className="relative block flex-1">
            <span className="sr-only">{searchType === "email" ? "Customer email" : "Order number"}</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--a-faint)]" aria-hidden />
            <input
              type={searchType === "email" ? "email" : "text"}
              className={`a-input pl-9 ${searchType === "orderId" ? "font-mono" : ""}`}
              placeholder={searchType === "email" ? "customer@example.com" : "cs_live_… or order ID"}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              required
            />
          </label>
          <button type="submit" className="a-btn a-btn-primary" disabled={loading}>
            {loading ? "Searching…" : "Search"}
          </button>
        </div>
      </form>

      {error && (
        <div role="alert" className="mb-6 flex items-start gap-2 rounded-lg border border-red-200 bg-[#fdecea] p-4 text-sm text-[#7a1a12]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {error}
        </div>
      )}

      {sendSuccess && (
        <div role="status" className="mb-6 flex items-start gap-2 rounded-lg border border-green-200 bg-[#e8f5ec] p-4 text-sm text-[#1f4d2e]">
          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Invoice sent to {order?.email}.
        </div>
      )}

      {order && order.orderId && (
        <section className="a-card overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--a-line)] p-5">
            <div className="min-w-0">
              <p className="a-section-label text-[var(--a-faint)]">Order</p>
              <p className="mt-0.5 break-all font-mono text-sm font-medium text-[var(--a-ink)]">{order.orderId}</p>
              <p className="mt-0.5 text-sm text-[var(--a-muted)]">{new Date(order.createdAt).toLocaleString()}</p>
            </div>
            <p className="text-2xl font-semibold tabular-nums">{money(order.totalCents)}</p>
          </div>

          <dl className="grid grid-cols-2 gap-4 border-b border-[var(--a-line)] p-5 text-sm sm:grid-cols-4">
            <div className="col-span-2">
              <dt className="text-xs text-[var(--a-muted)]">Customer</dt>
              <dd className="truncate font-medium">{order.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--a-muted)]">Account</dt>
              <dd className="font-medium">{order.isGuest ? "Guest" : "Registered"}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--a-muted)]">Status</dt>
              <dd>
                <Badge tone={order.status === "completed" ? "green" : "amber"}>{order.status}</Badge>
              </dd>
            </div>
          </dl>

          <div className="p-5">
            <h2 className="a-section-label mb-2 text-[var(--a-faint)]">Items</h2>
            <ul className="divide-y divide-[var(--a-line)]">
              {order.items.map((item, idx) => (
                <li key={idx} className="py-2.5 text-sm first:pt-0">
                  <div className="flex items-start justify-between gap-4">
                    <p>
                      <span className="font-medium text-[var(--a-ink)]">{item.productName}</span>
                      <span className="text-[var(--a-muted)]"> × {item.quantity}</span>
                    </p>
                    <span className="shrink-0 tabular-nums">{money(item.priceCents)}</span>
                  </div>
                  {item.productSlug.startsWith("unmapped-") && (
                    <div className="mt-2 rounded-lg border border-amber-200 bg-[#fdf6e7] p-3 text-xs text-[#6b4a0b]">
                      <p className="font-semibold">Not listed on the website</p>
                      <p className="mt-1">
                        To link future sales, add this product in Products and set its Stripe Price ID to this unmapped ID.
                      </p>
                      <p className="mt-1 font-mono">{item.productSlug}</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-[var(--a-muted)]">{order.pointsEarned} reward points earned</p>
          </div>

          <div className="border-t border-[var(--a-line)] bg-[var(--a-canvas)] p-5">
            {isManual && (
              <label className="mb-3 block">
                <span className="a-label">Customer email</span>
                <input
                  type="email"
                  className="a-input"
                  placeholder="customer@example.com"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  required
                />
                <p className="a-help">This was a manual sale, so there&apos;s no email on file.</p>
              </label>
            )}
            <button onClick={handleSendInvoice} disabled={sending} className="a-btn a-btn-primary w-full sm:w-auto">
              <Mail className="h-4 w-4" aria-hidden />
              {sending ? "Sending…" : "Send invoice email"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
