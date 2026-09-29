"use client";

import { useEffect, useState } from "react";
import { BarChart2, DollarSign, Package, Search, Undo2 } from "lucide-react";
import PageHeader from "../_components/PageHeader";
import { Badge, Modal, Stat } from "../_components/ui";
import Link from "next/link";
import CandleSpinner from "@/components/CandleSpinner";

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
      const res = await fetch(`/api/admin/refunds?t=${Date.now()}`, {
        cache: "no-store",
      });
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

      const result = await res.json();

      // The API creates a refund record before contacting the processor, so
      // refresh for both completed and failed attempts.
      await loadRefunds();

      if (res.ok) {
        setShowCreateModal(false);
        resetForm();
        alert("Refund processed successfully!");
      } else {
        const detail = typeof result.details === "string" ? `\n\n${result.details}` : "";
        alert(`Failed to process refund: ${result.error || "Unknown error"}${detail}`);
      }
    } catch (err) {
      console.error("Failed to create refund:", err);
      await loadRefunds();
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

  const STATUS_TONE: Record<RefundStatus, "green" | "blue" | "red" | "amber"> = {
    completed: "green",
    processing: "blue",
    failed: "red",
    pending: "amber",
  };

  const money = (cents: number) =>
    `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  function closeModal() {
    setShowCreateModal(false);
    resetForm();
  }

  const completed = refunds.filter((r) => r.status === "completed");
  const refundedTotal = completed.reduce((sum, r) => sum + r.amountCents, 0);

  return (
    <div className="a-ui mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Refunds"
        description="Refund an order and, if you like, put the items back in stock."
        actions={
          <>
            <Link href="/admin/refunds-analytics" className="a-btn">
              <BarChart2 className="h-4 w-4" aria-hidden />
              Analytics
            </Link>
            <button onClick={() => setShowCreateModal(true)} className="a-btn a-btn-primary">
              <Undo2 className="h-4 w-4" aria-hidden />
              New refund
            </button>
          </>
        }
      />

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-4 py-16">
          <CandleSpinner />
          <p className="text-sm font-medium text-[var(--a-muted)]">Loading refunds…</p>
        </div>
      ) : refunds.length === 0 ? (
        <div className="a-card flex flex-col items-center px-6 py-16 text-center">
          <span className="a-icon-tile mb-3 h-11 w-11">
            <Undo2 className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </span>
          <p className="font-medium text-[var(--a-ink)]">No refunds yet</p>
          <p className="mt-1 text-sm text-[var(--a-muted)]">Refunds you process will show up here.</p>
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Refunds" value={refunds.length} hint={`${completed.length} completed`} />
            <Stat label="Refunded" value={money(refundedTotal)} hint="Completed refunds" />
            <Stat
              className="col-span-2 sm:col-span-1"
              label="Restocked"
              value={completed.filter((r) => r.restoreInventory).length}
              hint="Completed refunds that put items back"
            />
          </div>

          {/* Desktop table */}
          <div className="a-card hidden overflow-hidden md:block">
            <table className="a-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th className="text-center">Restocked</th>
                  <th>Date</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {refunds.map((refund) => (
                  <tr key={refund.id}>
                    <td>
                      <p className="font-medium text-[var(--a-ink)]">{refund.email}</p>
                      <p
                        className="mt-0.5 font-mono text-xs text-[var(--a-muted)]"
                        title={`Refund ${refund.id}${refund.stripeRefundId ? ` · ${refund.stripeRefundId}` : ""}`}
                      >
                        Order {refund.orderId.slice(0, 14)}
                      </p>
                    </td>
                    <td>
                      <p>{REASON_LABELS[refund.reason]}</p>
                      {refund.reasonNote && <p className="mt-0.5 max-w-xs text-xs text-[var(--a-muted)]">{refund.reasonNote}</p>}
                    </td>
                    <td>
                      <Badge tone={STATUS_TONE[refund.status]}>{refund.status}</Badge>
                    </td>
                    <td className="text-center">
                      {refund.restoreInventory ? (
                        <Package className="inline h-4 w-4 text-[#1f6b3a]" aria-label="Inventory restored" />
                      ) : (
                        <span className="text-[var(--a-faint)]" aria-label="Not restocked">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap">
                      <p>{new Date(refund.createdAt).toLocaleDateString()}</p>
                      <p className="text-xs text-[var(--a-muted)]">
                        {new Date(refund.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </p>
                    </td>
                    <td className="a-num font-semibold">{money(refund.amountCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile list */}
          <ul className="a-card divide-y divide-[var(--a-line)] md:hidden">
            {refunds.map((refund) => (
              <li key={refund.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-[var(--a-ink)]">{refund.email}</p>
                  <p className="mt-0.5 text-sm text-[var(--a-muted)]">
                    {REASON_LABELS[refund.reason]} · {new Date(refund.createdAt).toLocaleDateString()}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <Badge tone={STATUS_TONE[refund.status]}>{refund.status}</Badge>
                    {refund.restoreInventory && <Badge>Restocked</Badge>}
                  </div>
                </div>
                <span className="shrink-0 font-semibold tabular-nums">{money(refund.amountCents)}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {showCreateModal && (
        <Modal
          title="New refund"
          description="Look up the order, choose an amount, then confirm."
          onClose={closeModal}
          busy={processingRefund}
          footer={
            <>
              <button type="button" onClick={closeModal} className="a-btn" disabled={processingRefund}>
                Cancel
              </button>
              <button type="submit" form="refund-form" className="a-btn a-btn-primary" disabled={processingRefund || !order}>
                {processingRefund ? "Processing…" : order && refundAmount ? `Refund $${refundAmount}` : "Refund"}
              </button>
            </>
          }
        >
          <form id="refund-form" onSubmit={handleCreateRefund} className="space-y-5">
            <div>
              <label htmlFor="refund-order-id" className="a-label">
                Order ID or checkout session ID
              </label>
              <div className="flex gap-2">
                <input
                  id="refund-order-id"
                  type="text"
                  className="a-input flex-1 font-mono"
                  placeholder="cs_live_… or pi_…"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void loadOrder();
                    }
                  }}
                  required
                />
                <button type="button" onClick={loadOrder} disabled={loadingOrder || !orderId.trim()} className="a-btn">
                  <Search className="h-4 w-4" aria-hidden />
                  {loadingOrder ? "Looking…" : "Look up"}
                </button>
              </div>
            </div>

            {order && (
              <div className="a-panel space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-[var(--a-muted)]">Customer</span>
                  <span className="truncate font-medium">{order.email}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-[var(--a-muted)]">Order total</span>
                  <span className="font-semibold tabular-nums">{money(order.totalCents)}</span>
                </div>
                <ul className="space-y-1 border-t border-[var(--a-line)] pt-2 text-xs text-[var(--a-muted)]">
                  {order.items.map((item, idx) => (
                    <li key={idx} className="flex justify-between gap-4">
                      <span>
                        {item.quantity} × {item.productName}
                      </span>
                      <span className="tabular-nums">{money(item.priceCents)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="refund-amount" className="a-label">
                  Amount
                </label>
                <div className="relative">
                  <DollarSign
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--a-faint)]"
                    aria-hidden
                  />
                  <input
                    id="refund-amount"
                    type="text"
                    inputMode="decimal"
                    className="a-input pl-9 tabular-nums"
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
                <p className="a-help">{order ? `Up to ${money(order.totalCents)}` : "Look up an order first."}</p>
              </div>

              <div>
                <label htmlFor="refund-reason" className="a-label">
                  Reason
                </label>
                <select
                  id="refund-reason"
                  className="a-select"
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
            </div>

            <div>
              <label htmlFor="refund-note" className="a-label">
                Notes <span className="font-normal text-[var(--a-muted)]">(optional)</span>
              </label>
              <textarea
                id="refund-note"
                className="a-textarea"
                rows={3}
                placeholder="Anything worth remembering about this refund"
                value={reasonNote}
                onChange={(e) => setReasonNote(e.target.value)}
              />
            </div>

            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="a-check mt-0.5"
                checked={restoreInventory}
                onChange={(e) => setRestoreInventory(e.target.checked)}
              />
              <span>
                <span className="font-medium text-[var(--a-ink)]">Put items back in stock</span>
                <span className="block text-[var(--a-muted)]">Adds the refunded items back to inventory.</span>
              </span>
            </label>
          </form>
        </Modal>
      )}
    </div>
  );
}
