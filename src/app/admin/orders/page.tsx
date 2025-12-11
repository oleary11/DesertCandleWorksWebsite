"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Package, DollarSign, User, Calendar } from "lucide-react";

type Order = {
  id: string;
  userId?: string;
  email: string;
  totalCents: number;
  productSubtotalCents?: number;
  shippingCents?: number;
  taxCents?: number;
  pointsEarned: number;
  status: string;
  isGuest: boolean;
  items: Array<{
    productSlug: string;
    productName: string;
    quantity: number;
    priceCents: number;
  }>;
  createdAt: string;
  completedAt?: string;
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "pending">("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    try {
      const res = await fetch("/api/admin/debug-orders");
      if (!res.ok) throw new Error("Failed to load orders");
      const data = await res.json();
      setOrders(data.ordersFromGetAllOrders || []);
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

  // Calculate Stripe fee for an order (2.9% + $0.30)
  function calculateStripeFee(amountCents: number): number {
    return Math.round(amountCents * 0.029) + 30; // 2.9% + 30 cents
  }

  // Helper function to check if an order is a manual sale
  function isManualSale(orderId: string): boolean {
    return orderId.startsWith("MS") || orderId.toLowerCase().startsWith("manual");
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

  // Filter and search orders
  const filteredOrders = orders.filter((order) => {
    // Status filter
    if (statusFilter !== "all" && order.status !== statusFilter) {
      return false;
    }

    // Search filter
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

  if (loading) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-[var(--color-muted)]">Loading orders...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-rose-600">{error}</p>
          <Link href="/admin" className="btn mt-4">
            Back to Admin
          </Link>
        </div>
      </div>
    );
  }

  const completedOrders = filteredOrders.filter((o) => o.status === "completed");
  const pendingOrders = filteredOrders.filter((o) => o.status === "pending");
  const totalRevenue = completedOrders.reduce((sum, o) => sum + o.totalCents, 0);

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
          <h1 className="text-3xl font-bold">All Orders</h1>
          <p className="text-[var(--color-muted)] mt-1">
            View all orders including Stripe and manual sales
          </p>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card p-6 bg-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-sm font-medium text-[var(--color-muted)]">Total Orders</span>
            </div>
            <p className="text-3xl font-bold">{orders.length}</p>
          </div>

          <div className="card p-6 bg-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-[var(--color-muted)]">Completed</span>
            </div>
            <p className="text-3xl font-bold">{completedOrders.length}</p>
          </div>

          <div className="card p-6 bg-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-sm font-medium text-[var(--color-muted)]">Total Revenue</span>
            </div>
            <p className="text-3xl font-bold">${(totalRevenue / 100).toFixed(2)}</p>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="card p-6 bg-white mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by order ID, email, or product..."
                className="input w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Status Filter */}
            <div className="flex gap-2">
              <button
                onClick={() => setStatusFilter("all")}
                className={`btn ${statusFilter === "all" ? "bg-[var(--color-accent)] text-white" : ""}`}
              >
                All ({orders.length})
              </button>
              <button
                onClick={() => setStatusFilter("completed")}
                className={`btn ${statusFilter === "completed" ? "bg-green-600 text-white" : ""}`}
              >
                Completed ({orders.filter((o) => o.status === "completed").length})
              </button>
              <button
                onClick={() => setStatusFilter("pending")}
                className={`btn ${statusFilter === "pending" ? "bg-amber-600 text-white" : ""}`}
              >
                Pending ({orders.filter((o) => o.status === "pending").length})
              </button>
            </div>
          </div>
        </div>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <div className="card p-8 bg-white text-center">
            <p className="text-[var(--color-muted)]">
              {searchQuery || statusFilter !== "all" ? "No orders match your filters" : "No orders found"}
            </p>
          </div>
        ) : (
          <div className="card p-6 bg-white">
            <h2 className="text-xl font-bold mb-4">
              Order History ({filteredOrders.length} {filteredOrders.length === 1 ? "order" : "orders"})
            </h2>
            <div className="space-y-4">
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="border border-[var(--color-line)] rounded-lg overflow-hidden"
                >
                  {/* Order Header */}
                  <div className="p-4 bg-neutral-50">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className={`badge text-xs ${
                              order.status === "completed"
                                ? "bg-green-100 text-green-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {order.status}
                          </span>
                          {isManualSale(order.id) && (
                            <span className="badge text-xs bg-blue-100 text-blue-700">
                              Manual Sale
                            </span>
                          )}
                        </div>

                        {/* Order ID with Copy Button */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-mono text-xs text-[var(--color-muted)] break-all">
                            {order.id}
                          </span>
                          <button
                            onClick={(e) => copyOrderId(order.id, e)}
                            className="btn btn-sm px-2 py-1 text-xs flex-shrink-0"
                            title="Copy Order ID"
                          >
                            {copiedId === order.id ? "Copied!" : "Copy"}
                          </button>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-[var(--color-muted)]">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {order.email}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(order.createdAt)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold">
                          ${(order.totalCents / 100).toFixed(2)}
                        </div>
                        {!isManualSale(order.id) && (
                          <div className="text-xs text-amber-600">
                            Stripe fee: -${(calculateStripeFee(order.totalCents) / 100).toFixed(2)}
                          </div>
                        )}
                        <div className="text-sm text-[var(--color-muted)]">
                          {order.items.reduce((sum, item) => sum + item.quantity, 0)} items
                        </div>
                      </div>
                    </div>

                    {/* Expand Button */}
                    <button
                      onClick={() => toggleOrderExpansion(order.id)}
                      className="w-full text-sm text-[var(--color-accent)] hover:underline"
                    >
                      {expandedOrderId === order.id ? "Hide Details" : "Show Details"}
                    </button>
                  </div>

                  {/* Order Details (Expanded) */}
                  {expandedOrderId === order.id && (
                    <div className="p-4 border-t border-[var(--color-line)]">
                      <h3 className="font-bold mb-2">Order Items:</h3>
                      <div className="space-y-2">
                        {order.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between items-center text-sm"
                          >
                            <div>
                              <span className="font-medium">{item.productName}</span>
                              <span className="text-[var(--color-muted)]"> x{item.quantity}</span>
                            </div>
                            <span className="font-medium">
                              ${(item.priceCents / 100).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Financial Breakdown */}
                      <div className="mt-4 pt-4 border-t border-[var(--color-line)] space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-[var(--color-muted)]">Product Subtotal:</span>
                          <span className="font-medium">${((order.productSubtotalCents ?? order.totalCents) / 100).toFixed(2)}</span>
                        </div>
                        {(() => {
                          const shippingCost = getShippingCost(order);
                          return shippingCost > 0 && (
                            <div className="flex justify-between">
                              <span className="text-[var(--color-muted)]">Shipping:</span>
                              <span className="font-medium">${(shippingCost / 100).toFixed(2)}</span>
                            </div>
                          );
                        })()}
                        {order.taxCents !== undefined && order.taxCents > 0 && (
                          <div className="flex justify-between">
                            <span className="text-[var(--color-muted)]">Tax:</span>
                            <span className="font-medium">${(order.taxCents / 100).toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between pt-2 border-t border-[var(--color-line)] font-bold">
                          <span>Order Total:</span>
                          <span>${(order.totalCents / 100).toFixed(2)}</span>
                        </div>
                        {!isManualSale(order.id) && (
                          <>
                            <div className="flex justify-between text-amber-600">
                              <span>Stripe Fee (2.9% + $0.30):</span>
                              <span className="font-medium">-${(calculateStripeFee(order.totalCents) / 100).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-[var(--color-line)] font-bold text-green-600">
                              <span>Net Revenue:</span>
                              <span>${((order.totalCents - calculateStripeFee(order.totalCents)) / 100).toFixed(2)}</span>
                            </div>
                          </>
                        )}
                        {isManualSale(order.id) && (
                          <div className="flex justify-between pt-2 border-t border-[var(--color-line)] font-bold text-green-600">
                            <span>Net Revenue (No Fees):</span>
                            <span>${(order.totalCents / 100).toFixed(2)}</span>
                          </div>
                        )}
                      </div>

                      {order.completedAt && (
                        <div className="mt-4 pt-4 border-t border-[var(--color-line)] text-sm text-[var(--color-muted)]">
                          Completed: {formatDate(order.completedAt)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
