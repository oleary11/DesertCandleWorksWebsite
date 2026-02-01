"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, DollarSign, RefreshCw, Package, AlertCircle, CheckCircle, Clock } from "lucide-react";
import Link from "next/link";

type RefundReason =
  | "customer_request"
  | "damaged_product"
  | "wrong_item_sent"
  | "quality_issue"
  | "shipping_delay"
  | "duplicate_order"
  | "other";

type RefundStatus = "pending" | "processing" | "completed" | "failed";

type Refund = {
  id: string;
  orderId: string;
  stripeRefundId?: string;
  email: string;
  userId?: string;
  amountCents: number;
  reason: RefundReason;
  reasonNote?: string;
  status: RefundStatus;
  restoreInventory: boolean;
  pointsToDeduct?: number;
  processedBy?: string;
  createdAt: string;
  processedAt?: string;
  items: Array<{
    productSlug: string;
    productName: string;
    quantity: number;
    variantId?: string;
    refundAmountCents: number;
  }>;
};

type Order = {
  id: string;
  email: string;
  totalCents: number;
  status: string;
  items: Array<{
    productSlug: string;
    productName: string;
    quantity: number;
    priceCents: number;
  }>;
  createdAt: string;
};

const REASON_LABELS: Record<RefundReason, string> = {
  customer_request: "Customer Request",
  damaged_product: "Damaged Product",
  wrong_item_sent: "Wrong Item Sent",
  quality_issue: "Quality Issue",
  shipping_delay: "Shipping Delay",
  duplicate_order: "Duplicate Order",
  other: "Other",
};

export default function RefundsPage() {
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [processingRefund, setProcessingRefund] = useState(false);

  // Create refund form state
  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [reason, setReason] = useState<RefundReason>("customer_request");
  const [reasonNote, setReasonNote] = useState("");
  const [restoreInventory, setRestoreInventory] = useState(true);
  const [refundAmount, setRefundAmount] = useState("");

  useEffect(() => {
    loadRefunds();
  }, []);

  async function loadRefunds() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/refunds");
      if (res.ok) {
        const data = await res.json();
        setRefunds(data);
      }
    } catch (err) {
      console.error("Failed to load refunds:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadOrder() {
    if (!orderId.trim()) return;

    try {
      setLoadingOrder(true);
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`);
      if (res.ok) {
        const data = await res.json();
        setOrder(data);
        setRefundAmount((data.totalCents / 100).toFixed(2)); // Default to full refund
      } else {
        alert("Order not found");
        setOrder(null);
      }
    } catch (err) {
      console.error("Failed to load order:", err);
      alert("Failed to load order");
    } finally {
      setLoadingOrder(false);
    }
  }

  async function handleCreateRefund(e: React.FormEvent) {
    e.preventDefault();

    if (!order) {
      alert("Please load an order first");
      return;
    }

    const amountCents = Math.round(parseFloat(refundAmount) * 100);

    if (amountCents <= 0 || amountCents > order.totalCents) {
      alert(`Refund amount must be between $0.01 and $${(order.totalCents / 100).toFixed(2)}`);
      return;
    }

    if (!confirm(`Process refund of $${(amountCents / 100).toFixed(2)} for order ${orderId}?`)) {
      return;
    }

    try {
      setProcessingRefund(true);
      const res = await fetch("/api/admin/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          reason,
          reasonNote: reasonNote.trim() || undefined,
          amountCents,
          restoreInventory,
        }),
      });

      if (res.ok) {
        alert("Refund processed successfully!");
        setShowCreateModal(false);
        resetForm();
        await loadRefunds();
      } else {
        const error = await res.json();
        alert(`Failed to process refund: ${error.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Failed to create refund:", err);
      alert("Failed to process refund");
    } finally {
      setProcessingRefund(false);
    }
  }

  function resetForm() {
    setOrderId("");
    setOrder(null);
    setReason("customer_request");
    setReasonNote("");
    setRestoreInventory(true);
    setRefundAmount("");
  }

  function getStatusColor(status: RefundStatus) {
    switch (status) {
      case "completed":
        return "text-emerald-600 bg-emerald-50";
      case "processing":
        return "text-blue-600 bg-blue-50";
      case "failed":
        return "text-rose-600 bg-rose-50";
      case "pending":
        return "text-amber-600 bg-amber-50";
    }
  }

  function getStatusIcon(status: RefundStatus) {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4" />;
      case "processing":
        return <Clock className="w-4 h-4 animate-spin" />;
      case "failed":
        return <AlertCircle className="w-4 h-4" />;
      case "pending":
        return <Clock className="w-4 h-4" />;
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)] mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Admin
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[var(--color-ink)]">Refund Management</h1>
              <p className="text-sm text-[var(--color-muted)] mt-1">
                Process refunds and manage returns
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn bg-[var(--color-accent)] text-white hover:opacity-90"
            >
              <RefreshCw className="w-4 h-4" />
              Process Refund
            </button>
          </div>
        </div>

        {/* Refunds List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-accent)] mx-auto mb-4"></div>
              <p className="text-[var(--color-muted)]">Loading refunds...</p>
            </div>
          </div>
        ) : refunds.length === 0 ? (
          <div className="card p-12 text-center">
            <RefreshCw className="w-12 h-12 text-[var(--color-muted)] mx-auto mb-4" />
            <h3 className="text-lg font-medium text-[var(--color-ink)] mb-2">No refunds yet</h3>
            <p className="text-sm text-[var(--color-muted)]">
              Processed refunds will appear here
            </p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider">
                      Refund ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider">
                      Order ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider">
                      Reason
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider">
                      Inventory
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-neutral-200">
                  {refunds.map((refund) => (
                    <tr key={refund.id} className="hover:bg-neutral-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-mono text-[var(--color-ink)]">
                          {refund.id.slice(0, 8)}
                        </div>
                        {refund.stripeRefundId && (
                          <div className="text-xs text-[var(--color-muted)] font-mono">
                            {refund.stripeRefundId}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-mono text-[var(--color-ink)]">
                          {refund.orderId.slice(0, 12)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-[var(--color-ink)]">{refund.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-[var(--color-ink)]">
                          ${(refund.amountCents / 100).toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-[var(--color-ink)]">
                          {REASON_LABELS[refund.reason]}
                        </div>
                        {refund.reasonNote && (
                          <div className="text-xs text-[var(--color-muted)] mt-1">
                            {refund.reasonNote}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                            refund.status
                          )}`}
                        >
                          {getStatusIcon(refund.status)}
                          {refund.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {refund.restoreInventory ? (
                          <span title="Inventory restored">
                            <Package className="w-4 h-4 text-emerald-600 inline" />
                          </span>
                        ) : (
                          <span className="text-[var(--color-muted)]">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-[var(--color-ink)]">
                          {new Date(refund.createdAt).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-[var(--color-muted)]">
                          {new Date(refund.createdAt).toLocaleTimeString()}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Create Refund Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
              <div>
                <h2 className="text-xl font-semibold text-[var(--color-ink)]">Process Refund</h2>
                <p className="text-sm text-[var(--color-muted)] mt-0.5">
                  Issue a refund and optionally restore inventory
                </p>
              </div>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                disabled={processingRefund}
              >
                <span className="sr-only">Close</span>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateRefund} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 min-h-0">
                {/* Order ID */}
                <div>
                  <label className="block text-sm font-medium text-[var(--color-ink)] mb-2">
                    Order ID / Checkout Session ID
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="input flex-1"
                      placeholder="cs_test_... or pi_..."
                      value={orderId}
                      onChange={(e) => setOrderId(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={loadOrder}
                      disabled={loadingOrder || !orderId.trim()}
                      className="btn bg-neutral-200 hover:bg-neutral-300"
                    >
                      {loadingOrder ? "Loading..." : "Load Order"}
                    </button>
                  </div>
                </div>

                {/* Order Details */}
                {order && (
                  <div className="bg-neutral-50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-[var(--color-muted)]">Customer:</span>
                      <span className="text-sm font-medium text-[var(--color-ink)]">{order.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-[var(--color-muted)]">Order Total:</span>
                      <span className="text-sm font-semibold text-[var(--color-ink)]">
                        ${(order.totalCents / 100).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-[var(--color-muted)]">Items:</span>
                      <span className="text-sm text-[var(--color-ink)]">{order.items.length} product(s)</span>
                    </div>
                    <div className="pt-2 border-t border-neutral-200">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="text-xs text-[var(--color-muted)] mb-1">
                          {item.quantity}x {item.productName} - ${(item.priceCents / 100).toFixed(2)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Refund Amount */}
                <div>
                  <label className="block text-sm font-medium text-[var(--color-ink)] mb-2">
                    Refund Amount (USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <DollarSign className="w-4 h-4 text-[var(--color-muted)]" />
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="input !pl-9"
                      placeholder="0.00"
                      value={refundAmount}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "" || /^\d*\.?\d*$/.test(val)) {
                          setRefundAmount(val);
                        }
                      }}
                      onBlur={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && order) {
                          const max = order.totalCents / 100;
                          setRefundAmount(Math.min(val, max).toFixed(2));
                        }
                      }}
                      required
                      disabled={!order}
                    />
                  </div>
                  {order && (
                    <p className="text-xs text-[var(--color-muted)] mt-1">
                      Maximum: ${(order.totalCents / 100).toFixed(2)}
                    </p>
                  )}
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-sm font-medium text-[var(--color-ink)] mb-2">
                    Refund Reason
                  </label>
                  <select
                    className="input"
                    value={reason}
                    onChange={(e) => setReason(e.target.value as RefundReason)}
                    required
                  >
                    {Object.entries(REASON_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Reason Note */}
                <div>
                  <label className="block text-sm font-medium text-[var(--color-ink)] mb-2">
                    Additional Notes (Optional)
                  </label>
                  <textarea
                    className="textarea"
                    rows={3}
                    placeholder="Additional details about the refund..."
                    value={reasonNote}
                    onChange={(e) => setReasonNote(e.target.value)}
                  />
                </div>

                {/* Restore Inventory */}
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="restoreInventory"
                    checked={restoreInventory}
                    onChange={(e) => setRestoreInventory(e.target.checked)}
                    className="w-4 h-4 rounded border-neutral-300 text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                  />
                  <label htmlFor="restoreInventory" className="text-sm text-[var(--color-ink)]">
                    Restore inventory (add items back to stock)
                  </label>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-200 bg-neutral-50">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="btn bg-white border border-neutral-300 hover:bg-neutral-50"
                  disabled={processingRefund}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn bg-[var(--color-accent)] text-white hover:opacity-90"
                  disabled={processingRefund || !order}
                >
                  {processingRefund ? "Processing..." : "Process Refund"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
