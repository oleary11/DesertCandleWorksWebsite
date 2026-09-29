"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, Copy, CreditCard, FileText, Globe, Search, Store, Trash2, Truck } from "lucide-react";
import PageHeader from "../_components/PageHeader";
import { Badge, FilterSelect, Segmented, Stat } from "../_components/ui";
import { useModal } from "@/hooks/useModal";
import CandleSpinner from "@/components/CandleSpinner";

type Order = {
  id: string;
  userId?: string;
  email: string;
  totalCents: number;
  productSubtotalCents?: number;
  shippingCents?: number;
  taxCents?: number;
  discountCents?: number;
  pointsEarned: number;
  paymentMethod?: string;
  notes?: string;
  status: string;
  isGuest: boolean;
  items: Array<{
    productSlug: string;
    productName: string;
    quantity: number;
    priceCents: number;
    variantId?: string; // Format: "wickType-scentId" (e.g., "standard-vanilla")
  }>;
  shippingAddress?: {
    name?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  phone?: string;
  trackingNumber?: string;
  shippingStatus?: "pending" | "shipped" | "delivered";
  shippingMethod?: string;
  isLocalPickup?: boolean;
  shippedAt?: string;
  deliveredAt?: string;
  createdAt: string;
  completedAt?: string;
};

type Refund = {
  id: string;
  orderId: string;
  amountCents: number;
  reason: string;
  reasonNote?: string;
  status: string;
  createdAt: string;
  processedAt?: string;
};

// Helper to parse variant information from variantId
function parseVariantInfo(variantId?: string): { wick: string; scent: string } | null {
  if (!variantId) return null;

  // Known wick type IDs (in order of preference for matching)
  const knownWickTypes = ['standard-wick', 'wood', 'standard'];

  let wickType = '';
  let scentId = variantId;

  // Try to match known wick type prefixes
  for (const wick of knownWickTypes) {
    if (variantId.startsWith(wick + '-')) {
      wickType = wick;
      scentId = variantId.substring(wick.length + 1);
      break;
    }
  }

  // Fallback to old logic if no match found
  if (!wickType) {
    const parts = variantId.split('-');
    if (parts.length < 2) return null;
    wickType = parts[0];
    scentId = parts.slice(1).join('-');
  }

  // Format wick type for display
  const wickDisplay = wickType === 'wood' ? 'Wood Wick' : 'Standard Wick';

  // Format scent for display (capitalize first letter of each word)
  const scentDisplay = scentId
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return { wick: wickDisplay, scent: scentDisplay };
}

export default function AdminOrdersPage() {
  const { showAlert, showConfirm } = useModal();
  const [orders, setOrders] = useState<Order[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [refundMap, setRefundMap] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "pending">("all");
  const [datePreset, setDatePreset] = useState<"allTime" | "today" | "week" | "month" | "lastMonth" | "ytd" | "custom">("allTime");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [trackingInput, setTrackingInput] = useState<{ [orderId: string]: string }>({});
  const [updatingShipping, setUpdatingShipping] = useState<string | null>(null);
  const [checkingDeliveries, setCheckingDeliveries] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    try {
      const [ordersRes, refundsRes] = await Promise.all([
        fetch("/api/admin/debug-orders"),
        fetch("/api/admin/refunds"),
      ]);

      if (!ordersRes.ok) throw new Error("Failed to load orders");

      const ordersData = await ordersRes.json();
      setOrders(ordersData.ordersFromGetAllOrders || []);

      if (refundsRes.ok) {
        const refundsData = await refundsRes.json();
        setRefunds(refundsData || []);

        // Build refund map (orderId -> total refunded amount)
        const map = new Map<string, number>();
        const completedRefunds = (refundsData || []).filter((r: Refund) => r.status === "completed");
        for (const refund of completedRefunds) {
          const existing = map.get(refund.orderId) || 0;
          map.set(refund.orderId, existing + refund.amountCents);
        }
        setRefundMap(map);
      }
    } catch (err) {
      setError("Failed to load orders");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function toggleOrderExpansion(orderId: string) {
    setExpandedOrderId(expandedOrderId === orderId ? null : orderId);
  }

  function formatDate(isoString: string) {
    return new Date(isoString).toLocaleString();
  }

  function copyOrderId(orderId: string, e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(orderId);
    setCopiedId(orderId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function viewInvoice(order: Order, e: React.MouseEvent) {
    e.preventDefault();

    if (order.isGuest) {
      // For guest orders, we need to generate an access token
      try {
        const res = await fetch(`/api/admin/orders/invoice-token?orderId=${order.id}`);
        if (res.ok) {
          const data = await res.json();
          window.open(`/invoice/view?token=${data.token}`, "_blank");
        } else {
          await showAlert("Failed to generate invoice link", "Error");
        }
      } catch (err) {
        await showAlert("Failed to generate invoice link", "Error");
        console.error(err);
      }
    } else {
      // For registered users, link directly
      window.open(`/account/invoice/${order.id}`, "_blank");
    }
  }

  async function deleteOrderHandler(orderId: string, e: React.MouseEvent) {
    e.stopPropagation();

    // Confirm deletion
    const confirmed = await showConfirm(
      `Are you sure you want to delete this order?\n\nOrder ID: ${orderId}\n\nThis action cannot be undone.`,
      "Delete Order"
    );

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete order");
      }

      // Remove order from state
      setOrders(orders.filter((o) => o.id !== orderId));

      // Close expanded view if this order was expanded
      if (expandedOrderId === orderId) {
        setExpandedOrderId(null);
      }
    } catch (err) {
      await showAlert(err instanceof Error ? err.message : "Failed to delete order", "Error");
      console.error(err);
    }
  }

  async function updateShippingStatus(orderId: string, status: "shipped" | "delivered") {
    const trackingNumber = trackingInput[orderId]?.trim();

    if (!trackingNumber) {
      await showAlert("Please enter a tracking number", "Validation Error");
      return;
    }

    setUpdatingShipping(orderId);

    try {
      const res = await fetch("/api/admin/orders/update-shipping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          trackingNumber,
          shippingStatus: status,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update shipping");
      }

      const data = await res.json();

      // Update order in state
      setOrders(orders.map((o) => (o.id === orderId ? data.order : o)));

      // Clear tracking input
      setTrackingInput({ ...trackingInput, [orderId]: "" });

      // Show success message
      await showAlert(data.message + (data.warning ? `\n\nWarning: ${data.warning}` : ""), "Success");
    } catch (err) {
      await showAlert(err instanceof Error ? err.message : "Failed to update shipping", "Error");
      console.error(err);
    } finally {
      setUpdatingShipping(null);
    }
  }

  async function checkAllDeliveries() {
    const confirmed = await showConfirm(
      "Check USPS tracking for all shipped orders and auto-send delivery emails?",
      "Check Deliveries"
    );
    if (!confirmed) {
      return;
    }

    setCheckingDeliveries(true);

    try {
      const res = await fetch("/api/admin/check-deliveries", {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to check deliveries");
      }

      const data = await res.json();

      // Reload orders to show updated statuses
      await loadOrders();

      // Show results
      const summary = `Delivery Check Complete!\n\n` +
        `Checked: ${data.results.checked} orders\n` +
        `Delivered: ${data.results.delivered} emails sent\n` +
        `Errors: ${data.results.errors}\n\n` +
        `${data.results.details.map((d: { orderId: string; delivered?: boolean; status?: string; error?: string }) =>
          `${d.orderId}: ${d.delivered ? '✅ Delivered' : '📦 ' + d.status}${d.error ? ' (Error: ' + d.error + ')' : ''}`
        ).join('\n')}`;

      await showAlert(summary, "Delivery Check Complete");
    } catch (err) {
      await showAlert(err instanceof Error ? err.message : "Failed to check deliveries", "Error");
      console.error(err);
    } finally {
      setCheckingDeliveries(false);
    }
  }

  // Calculate Stripe fee for an order (2.9% + $0.30)
  function calculateStripeFee(amountCents: number): number {
    return Math.round(amountCents * 0.029) + 30; // 2.9% + 30 cents
  }

  // Calculate Square fee for an order (2.6% + $0.10 for card-present)
  function calculateSquareFee(amountCents: number): number {
    return Math.round(amountCents * 0.026) + 10; // 2.6% + 10 cents
  }

  // Helper function to check if an order is a manual sale
  function isManualSale(orderId: string): boolean {
    return orderId.startsWith("MS") || orderId.toLowerCase().startsWith("manual");
  }

  // Helper function to check if an order is from Square POS
  function isSquareSale(orderId: string): boolean {
    return orderId.startsWith("SQ");
  }

  // Calculate shipping cost for old orders that don't have it stored
  function getShippingCost(order: Order): number {
    // If shipping is already stored, use it
    if (order.shippingCents !== undefined) {
      return order.shippingCents;
    }

    // For old orders, calculate shipping as: total - products - tax
    if (order.productSubtotalCents) {
      const taxAmount = order.taxCents ?? 0;
      const calculatedShipping = order.totalCents - order.productSubtotalCents - taxAmount;
      // Ensure it's not negative
      return calculatedShipping > 0 ? calculatedShipping : 0;
    }

    // If we don't have enough data, return 0
    return 0;
  }

  function handlePresetChange(preset: typeof datePreset) {
    setDatePreset(preset);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const today = fmt(now);

    if (preset === "allTime") { setDateFrom(""); setDateTo(""); }
    else if (preset === "today") { setDateFrom(today); setDateTo(today); }
    else if (preset === "week") {
      const start = new Date(now); start.setDate(now.getDate() - now.getDay());
      setDateFrom(fmt(start)); setDateTo(today);
    } else if (preset === "month") {
      setDateFrom(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`); setDateTo(today);
    } else if (preset === "lastMonth") {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      setDateFrom(fmt(first)); setDateTo(fmt(last));
    } else if (preset === "ytd") {
      setDateFrom(`${now.getFullYear()}-01-01`); setDateTo(today);
    }
  }

  // Filter and search orders
  const filteredOrders = orders.filter((order) => {
    if (statusFilter !== "all" && order.status !== statusFilter) return false;

    if (dateFrom) {
      const orderDate = new Date(order.createdAt);
      const from = new Date(dateFrom + "T00:00:00");
      if (orderDate < from) return false;
    }
    if (dateTo) {
      const orderDate = new Date(order.createdAt);
      const to = new Date(dateTo + "T23:59:59");
      if (orderDate > to) return false;
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return (
        order.id.toLowerCase().includes(query) ||
        order.email.toLowerCase().includes(query) ||
        order.items.some((item) => item.productName.toLowerCase().includes(query))
      );
    }

    return true;
  });

  const money = (cents: number) =>
    `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  function channelOf(order: Order): { label: string; icon: typeof Globe } {
    if (isManualSale(order.id)) return { label: "Manual sale", icon: Store };
    if (isSquareSale(order.id)) return { label: "Square POS", icon: CreditCard };
    return { label: "Website", icon: Globe };
  }

  if (loading) {
    return (
      <div className="a-ui flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <CandleSpinner />
        <p className="text-sm font-medium text-[var(--a-muted)]">Loading orders…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="a-ui mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader title="Orders" />
        <div role="alert" className="a-card flex items-center justify-between gap-4 p-5">
          <p className="text-sm text-[#b42318]">{error}</p>
          <button className="a-btn a-btn-sm" onClick={() => { setError(""); setLoading(true); void loadOrders(); }}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  const completedOrders = filteredOrders.filter((o) => o.status === "completed");

  // Calculate total revenue excluding refunded amounts
  const totalRevenue = completedOrders.reduce((sum, o) => {
    const refundedAmount = refundMap.get(o.id) || 0;
    return sum + (o.totalCents - refundedAmount);
  }, 0);

  const filtersActive = searchQuery.trim() !== "" || statusFilter !== "all" || datePreset !== "allTime";

  return (
    <div className="a-ui mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Orders"
        description="Website, Square and in-person sales in one place."
        actions={
          <button onClick={checkAllDeliveries} disabled={checkingDeliveries} className="a-btn">
            <Truck className="h-4 w-4" aria-hidden />
            {checkingDeliveries ? "Checking…" : "Check deliveries"}
          </button>
        }
      />

      {/* Summary */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Orders" value={filteredOrders.length} hint={filtersActive ? `of ${orders.length} total` : "All time"} />
        <Stat label="Completed" value={completedOrders.length} hint={`${filteredOrders.length - completedOrders.length} pending`} />
        <Stat className="col-span-2 sm:col-span-1" label="Revenue" value={money(totalRevenue)} hint="Completed orders, after refunds" />
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center">
        <label className="relative block flex-1">
          <span className="sr-only">Search orders</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--a-faint)]" aria-hidden />
          <input
            type="text"
            placeholder="Search order ID, email or product…"
            className="a-input pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "all", label: <>All <span className="text-[var(--a-faint)]">{orders.length}</span></> },
              { value: "completed", label: <>Completed <span className="text-[var(--a-faint)]">{orders.filter((o) => o.status === "completed").length}</span></> },
              { value: "pending", label: <>Pending <span className="text-[var(--a-faint)]">{orders.filter((o) => o.status === "pending").length}</span></> },
            ]}
          />
          <div className="w-40">
            <FilterSelect
              label="Date range"
              value={datePreset === "allTime" ? "all" : datePreset}
              onChange={(p) => {
                const preset = p === "all" ? "allTime" : p;
                if (preset === "custom") setDatePreset("custom");
                else handlePresetChange(preset);
              }}
              options={[
                { value: "all", label: "All time" },
                { value: "today", label: "Today" },
                { value: "week", label: "This week" },
                { value: "month", label: "This month" },
                { value: "lastMonth", label: "Last month" },
                { value: "ytd", label: "Year to date" },
                { value: "custom", label: "Custom range…" },
              ]}
            />
          </div>
        </div>
      </div>

      {datePreset === "custom" && (
        <div className="a-card mb-4 flex flex-wrap items-end gap-3 p-4">
          <label className="block">
            <span className="a-label">Start date</span>
            <input type="date" className="a-input" value={customDateFrom} onChange={(e) => setCustomDateFrom(e.target.value)} />
          </label>
          <label className="block">
            <span className="a-label">End date</span>
            <input type="date" className="a-input" value={customDateTo} onChange={(e) => setCustomDateTo(e.target.value)} />
          </label>
          <button
            className="a-btn a-btn-primary"
            disabled={!customDateFrom || !customDateTo}
            onClick={() => { if (customDateFrom && customDateTo) { setDateFrom(customDateFrom); setDateTo(customDateTo); } }}
          >
            Apply
          </button>
        </div>
      )}

      {/* Orders list */}
      {filteredOrders.length === 0 ? (
        <div className="a-card px-6 py-16 text-center">
          <p className="font-medium text-[var(--a-ink)]">{filtersActive ? "No orders match" : "No orders yet"}</p>
          {filtersActive && <p className="mt-1 text-sm text-[var(--a-muted)]">Try a different search, status or date range.</p>}
        </div>
      ) : (
        <ul className="a-card divide-y divide-[var(--a-line)] overflow-hidden">
          {filteredOrders.map((order) => {
            const expanded = expandedOrderId === order.id;
            const refunded = refundMap.get(order.id) || 0;
            const channel = channelOf(order);
            const ChannelIcon = channel.icon;
            const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
            const fee = isManualSale(order.id) ? 0 : isSquareSale(order.id) ? calculateSquareFee(order.totalCents) : calculateStripeFee(order.totalCents);

            return (
              <li key={order.id} className={expanded ? "bg-[color-mix(in_oklab,var(--a-canvas)_60%,white)]" : undefined}>
                {/* Summary row */}
                <button
                  type="button"
                  onClick={() => toggleOrderExpansion(order.id)}
                  aria-expanded={expanded}
                  className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-[var(--a-canvas)] focus-visible:bg-[var(--a-canvas)] focus-visible:outline-none sm:px-5"
                >
                  <span className="a-icon-tile hidden h-9 w-9 sm:inline-flex" title={channel.label}>
                    <ChannelIcon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate font-medium text-[var(--a-ink)]">
                        {order.shippingAddress?.name || order.email || "Walk-in customer"}
                      </span>
                      {order.status === "pending" && <Badge tone="amber">Pending</Badge>}
                      {refunded > 0 && <Badge tone="red">{refunded >= order.totalCents ? "Refunded" : "Part refunded"}</Badge>}
                      {order.shippingStatus === "delivered" && <Badge tone="green">Delivered</Badge>}
                      {order.shippingStatus === "shipped" && <Badge tone="blue">Shipped</Badge>}
                      {order.isLocalPickup && <Badge tone="amber">Local pickup</Badge>}
                    </span>
                    <span className="mt-0.5 block truncate text-sm text-[var(--a-muted)]">
                      {channel.label} · {formatDate(order.createdAt)} · {itemCount} {itemCount === 1 ? "item" : "items"}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-semibold tabular-nums text-[var(--a-ink)]">{money(order.totalCents)}</span>
                    {refunded > 0 && <span className="block text-xs tabular-nums text-[#b42318]">−{money(refunded)}</span>}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-[var(--a-faint)] transition-transform ${expanded ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </button>

                {/* Details */}
                {expanded && (
                  <div className="border-t border-[var(--a-line)] px-4 pb-5 pt-4 sm:px-5">
                    {/* ID + actions */}
                    <div className="mb-5 flex flex-wrap items-center gap-2">
                      <span className="mr-auto break-all font-mono text-xs text-[var(--a-muted)]">{order.id}</span>
                      <button onClick={(e) => copyOrderId(order.id, e)} className="a-btn a-btn-sm">
                        {copiedId === order.id ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
                        {copiedId === order.id ? "Copied" : "Copy ID"}
                      </button>
                      <button onClick={(e) => viewInvoice(order, e)} className="a-btn a-btn-sm">
                        <FileText className="h-3.5 w-3.5" aria-hidden />
                        Invoice
                      </button>
                      <button
                        onClick={(e) => deleteOrderHandler(order.id, e)}
                        className="a-icon-btn a-icon-btn-danger h-8 w-8"
                        aria-label="Delete order"
                        title="Delete order"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                      {/* Left: items + money */}
                      <div className="space-y-5">
                        <section>
                          <h3 className="a-section-label mb-2 text-[var(--a-faint)]">Items</h3>
                          <ul className="space-y-2">
                            {order.items.map((item, idx) => {
                              const variantInfo = parseVariantInfo(item.variantId);
                              return (
                                <li key={idx} className="flex items-start justify-between gap-4 text-sm">
                                  <div className="min-w-0">
                                    <p className="text-[var(--a-ink)]">
                                      <span className="font-medium">{item.productName}</span>
                                      <span className="text-[var(--a-muted)]"> × {item.quantity}</span>
                                    </p>
                                    {variantInfo && (
                                      <p className="mt-0.5 text-xs text-[var(--a-muted)]">
                                        {variantInfo.scent} · {variantInfo.wick}
                                      </p>
                                    )}
                                  </div>
                                  <span className="shrink-0 tabular-nums">{money(item.priceCents)}</span>
                                </li>
                              );
                            })}
                          </ul>
                        </section>

                        <section>
                          <h3 className="a-section-label mb-2 text-[var(--a-faint)]">Payment</h3>
                          <dl className="space-y-1.5 text-sm">
                            <div className="flex justify-between">
                              <dt className="text-[var(--a-muted)]">Products</dt>
                              <dd className="tabular-nums">{money(order.productSubtotalCents ?? order.totalCents)}</dd>
                            </div>
                            {getShippingCost(order) > 0 && (
                              <div className="flex justify-between">
                                <dt className="text-[var(--a-muted)]">Shipping</dt>
                                <dd className="tabular-nums">{money(getShippingCost(order))}</dd>
                              </div>
                            )}
                            {order.taxCents !== undefined && order.taxCents > 0 && (
                              <div className="flex justify-between">
                                <dt className="text-[var(--a-muted)]">Tax</dt>
                                <dd className="tabular-nums">{money(order.taxCents)}</dd>
                              </div>
                            )}
                            {order.discountCents !== undefined && order.discountCents > 0 && (
                              <div className="flex justify-between">
                                <dt className="text-[var(--a-muted)]">Discount</dt>
                                <dd className="tabular-nums text-[#b42318]">−{money(order.discountCents)}</dd>
                              </div>
                            )}
                            <div className="flex justify-between border-t border-[var(--a-line)] pt-1.5 font-semibold">
                              <dt>Order total</dt>
                              <dd className="tabular-nums">{money(order.totalCents)}</dd>
                            </div>
                            {fee > 0 && (
                              <div className="flex justify-between">
                                <dt className="text-[var(--a-muted)]">
                                  {isSquareSale(order.id) ? "Square fee (2.6% + $0.10)" : "Stripe fee (2.9% + $0.30)"}
                                </dt>
                                <dd className="tabular-nums text-[var(--a-muted)]">−{money(fee)}</dd>
                              </div>
                            )}
                            <div className="flex justify-between border-t border-[var(--a-line)] pt-1.5 font-semibold text-[#1f6b3a]">
                              <dt>Net revenue{fee === 0 ? " (no fees)" : ""}</dt>
                              <dd className="tabular-nums">{money(order.totalCents - fee)}</dd>
                            </div>
                            {refunded > 0 && (
                              <div className="flex justify-between">
                                <dt className="text-[var(--a-muted)]">Refunded</dt>
                                <dd className="tabular-nums text-[#b42318]">−{money(refunded)}</dd>
                              </div>
                            )}
                          </dl>
                          {order.paymentMethod && (
                            <p className="mt-3 text-sm text-[var(--a-muted)]">
                              Paid by <span className="capitalize text-[var(--a-ink)]">{order.paymentMethod}</span>
                            </p>
                          )}
                        </section>
                      </div>

                      {/* Right: customer + shipping */}
                      <div className="space-y-5">
                        <section>
                          <h3 className="a-section-label mb-2 text-[var(--a-faint)]">Customer</h3>
                          <div className="space-y-0.5 text-sm">
                            {order.shippingAddress?.name && <p className="font-medium">{order.shippingAddress.name}</p>}
                            {order.email && <p className="text-[var(--a-muted)]">{order.email}{order.isGuest ? " · guest" : ""}</p>}
                            {order.phone && <p className="text-[var(--a-muted)]">{order.phone}</p>}
                          </div>
                          {order.shippingAddress && (
                            <address className="mt-3 space-y-0.5 text-sm not-italic">
                              {order.shippingAddress.line1 && <p>{order.shippingAddress.line1}</p>}
                              {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
                              {(order.shippingAddress.city || order.shippingAddress.state || order.shippingAddress.postalCode) && (
                                <p>
                                  {order.shippingAddress.city && `${order.shippingAddress.city}, `}
                                  {order.shippingAddress.state && `${order.shippingAddress.state} `}
                                  {order.shippingAddress.postalCode}
                                </p>
                              )}
                              {order.shippingAddress.country && <p>{order.shippingAddress.country}</p>}
                            </address>
                          )}
                          {order.shippingMethod && (
                            <p className={`mt-3 text-sm ${order.isLocalPickup ? "font-medium text-[#8a5a06]" : "text-[var(--a-muted)]"}`}>
                              {order.shippingMethod}
                              {order.isLocalPickup && " · customer will not receive a shipment"}
                            </p>
                          )}
                        </section>

                        <section>
                          <h3 className="a-section-label mb-2 text-[var(--a-faint)]">Shipping</h3>
                          {order.trackingNumber && (
                            <div className="a-panel mb-3 space-y-1 p-3 text-sm">
                              <p className="flex flex-wrap items-center gap-2">
                                <a
                                  href={`https://tools.usps.com/go/TrackConfirmAction?tLabels=${order.trackingNumber}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-[var(--a-accent-ink)] hover:underline"
                                >
                                  {order.trackingNumber}
                                </a>
                                <Badge tone={order.shippingStatus === "delivered" ? "green" : order.shippingStatus === "shipped" ? "blue" : "neutral"}>
                                  {order.shippingStatus || "pending"}
                                </Badge>
                              </p>
                              {order.shippedAt && <p className="text-xs text-[var(--a-muted)]">Shipped {formatDate(order.shippedAt)}</p>}
                              {order.deliveredAt && <p className="text-xs text-[var(--a-muted)]">Delivered {formatDate(order.deliveredAt)}</p>}
                            </div>
                          )}

                          {!isManualSale(order.id) && order.status === "completed" && (
                            <div>
                              <label className="block">
                                <span className="a-label">USPS tracking number</span>
                                <input
                                  type="text"
                                  placeholder="e.g. 9400100000000000000000"
                                  className="a-input font-mono"
                                  value={trackingInput[order.id] || order.trackingNumber || ""}
                                  onChange={(e) =>
                                    setTrackingInput({
                                      ...trackingInput,
                                      [order.id]: e.target.value,
                                    })
                                  }
                                  disabled={updatingShipping === order.id}
                                />
                              </label>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <button
                                  onClick={() => updateShippingStatus(order.id, "shipped")}
                                  disabled={updatingShipping === order.id || !trackingInput[order.id]?.trim()}
                                  className="a-btn a-btn-primary a-btn-sm"
                                >
                                  <Truck className="h-3.5 w-3.5" aria-hidden />
                                  {updatingShipping === order.id ? "Updating…" : "Mark shipped"}
                                </button>
                                <button
                                  onClick={() => updateShippingStatus(order.id, "delivered")}
                                  disabled={updatingShipping === order.id || !trackingInput[order.id]?.trim()}
                                  className="a-btn a-btn-sm"
                                >
                                  <Check className="h-3.5 w-3.5" aria-hidden />
                                  Mark delivered
                                </button>
                              </div>
                              <p className="a-help">Both buttons email the customer.</p>
                            </div>
                          )}

                          {isManualSale(order.id) && (
                            <p className="text-sm text-[var(--a-muted)]">No shipping tracking for manual sales.</p>
                          )}
                        </section>

                        {order.notes && (
                          <section>
                            <h3 className="a-section-label mb-2 text-[var(--a-faint)]">Notes</h3>
                            <p className="whitespace-pre-wrap rounded-lg border border-amber-200 bg-[#fdf6e7] p-3 text-sm text-[var(--a-ink)] [overflow-wrap:anywhere]">
                              {order.notes}
                            </p>
                          </section>
                        )}

                        {order.completedAt && (
                          <p className="text-xs text-[var(--a-muted)]">Completed {formatDate(order.completedAt)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
