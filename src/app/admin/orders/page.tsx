"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Package, DollarSign, User, Calendar } from "lucide-react";

type Order = {
  id: string;
  userId?: string;
  email: string;
  totalCents: number;
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

  const completedOrders = orders.filter((o) => o.status === "completed");
  const pendingOrders = orders.filter((o) => o.status === "pending");
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

        {/* Orders List */}
        {orders.length === 0 ? (
          <div className="card p-8 bg-white text-center">
            <p className="text-[var(--color-muted)]">No orders found</p>
          </div>
        ) : (
          <div className="card p-6 bg-white">
            <h2 className="text-xl font-bold mb-4">Order History</h2>
            <div className="space-y-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="border border-[var(--color-line)] rounded-lg overflow-hidden"
                >
                  {/* Order Header */}
                  <button
                    onClick={() => toggleOrderExpansion(order.id)}
                    className="w-full p-4 bg-neutral-50 hover:bg-neutral-100 text-left"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm text-[var(--color-muted)]">
                            {order.id.slice(0, 20)}...
                          </span>
                          <span
                            className={`badge text-xs ${
                              order.status === "completed"
                                ? "bg-green-100 text-green-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {order.status}
                          </span>
                          {order.id.startsWith("manual-") && (
                            <span className="badge text-xs bg-blue-100 text-blue-700">
                              Manual Sale
                            </span>
                          )}
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
                        <div className="text-sm text-[var(--color-muted)]">
                          {order.items.reduce((sum, item) => sum + item.quantity, 0)} items
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Order Details (Expanded) */}
                  {expandedOrderId === order.id && (
                    <div className="p-4 border-t border-[var(--color-line)]">
                      {/* Full Order ID */}
                      <div className="mb-4 p-3 bg-neutral-100 rounded">
                        <p className="text-xs text-[var(--color-muted)] mb-1">Full Order ID (click to copy):</p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(order.id);
                          }}
                          className="font-mono text-sm text-[var(--color-ink)] hover:text-[var(--color-accent)] break-all text-left w-full"
                          title="Click to copy"
                        >
                          {order.id}
                        </button>
                      </div>

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
