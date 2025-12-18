"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, TrendingDown, Package, AlertTriangle } from "lucide-react";

type RefundAnalytics = {
  totalRefunds: number;
  totalRefundedCents: number;
  refundsByReason: Array<{
    reason: string;
    count: number;
    totalCents: number;
  }>;
  refundsByProduct: Array<{
    productSlug: string;
    productName: string;
    refundCount: number;
    totalRefundedCents: number;
  }>;
  refundRate: number; // Percentage of orders refunded
  averageRefundCents: number;
};

const REASON_LABELS: Record<string, string> = {
  customer_request: "Customer Request",
  damaged_product: "Damaged Product",
  wrong_item_sent: "Wrong Item Sent",
  quality_issue: "Quality Issue",
  shipping_delay: "Shipping Delay",
  duplicate_order: "Duplicate Order",
  other: "Other",
};

type RefundData = {
  id: string;
  orderId: string;
  amountCents: number;
  reason: string;
  status: string;
  items?: Array<{
    productSlug: string;
    productName: string;
    quantity: number;
    refundAmountCents: number;
  }>;
};

type OrderData = {
  status: string;
};

type DebugOrdersResponse = {
  ordersFromGetAllOrders?: OrderData[];
};

export default function RefundsAnalyticsPage() {
  const [analytics, setAnalytics] = useState<RefundAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadAnalytics();
  }, []);

  async function loadAnalytics() {
    try {
      setLoading(true);

      // Fetch refunds and orders data
      const [refundsRes, ordersRes] = await Promise.all([
        fetch("/api/admin/refunds"),
        fetch("/api/admin/debug-orders"),
      ]);

      if (!refundsRes.ok || !ordersRes.ok) {
        throw new Error("Failed to load data");
      }

      const refunds = (await refundsRes.json()) as RefundData[];
      const ordersData = (await ordersRes.json()) as DebugOrdersResponse;
      const orders: OrderData[] = ordersData.ordersFromGetAllOrders ?? [];

      // Filter completed refunds
      const completedRefunds = refunds.filter((r) => r.status === "completed");

      // Calculate total refunded amount
      const totalRefundedCents = completedRefunds.reduce((sum, r) => sum + r.amountCents, 0);

      // Group refunds by reason
      const reasonMap = new Map<string, { count: number; totalCents: number }>();
      for (const refund of completedRefunds) {
        const existing = reasonMap.get(refund.reason) ?? { count: 0, totalCents: 0 };
        existing.count += 1;
        existing.totalCents += refund.amountCents;
        reasonMap.set(refund.reason, existing);
      }

      const refundsByReason = Array.from(reasonMap.entries())
        .map(([reason, data]) => ({
          reason: REASON_LABELS[reason] || reason,
          count: data.count,
          totalCents: data.totalCents,
        }))
        .sort((a, b) => b.totalCents - a.totalCents);

      // Group refunds by product
      const productMap = new Map<
        string,
        { productName: string; refundCount: number; totalRefundedCents: number }
      >();

      for (const refund of completedRefunds) {
        if (!refund.items) continue;

        for (const item of refund.items) {
          const existing = productMap.get(item.productSlug) ?? {
            productName: item.productName,
            refundCount: 0,
            totalRefundedCents: 0,
          };

          existing.refundCount += item.quantity;
          existing.totalRefundedCents += item.refundAmountCents ?? 0;
          productMap.set(item.productSlug, existing);
        }
      }

      const refundsByProduct = Array.from(productMap.entries())
        .map(([productSlug, data]) => ({
          productSlug,
          productName: data.productName,
          refundCount: data.refundCount,
          totalRefundedCents: data.totalRefundedCents,
        }))
        .sort((a, b) => b.refundCount - a.refundCount);

      // Calculate refund rate
      const completedOrders = orders.filter((o) => o.status === "completed");
      const refundRate =
        completedOrders.length > 0 ? (completedRefunds.length / completedOrders.length) * 100 : 0;

      // Calculate average refund amount
      const averageRefundCents =
        completedRefunds.length > 0 ? totalRefundedCents / completedRefunds.length : 0;

      setAnalytics({
        totalRefunds: completedRefunds.length,
        totalRefundedCents,
        refundsByReason,
        refundsByProduct,
        refundRate,
        averageRefundCents,
      });
    } catch (err) {
      console.error("Failed to load refund analytics:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen p-6 bg-neutral-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12 text-[var(--color-muted)]">Loading analytics...</div>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="min-h-screen p-6 bg-neutral-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12 text-[var(--color-muted)]">Failed to load analytics</div>
        </div>
      </div>
    );
  }

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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Refunds Analytics</h1>
              <p className="text-[var(--color-muted)] mt-1">Insights into refunds and returns</p>
            </div>
            <div className="flex gap-3">
              <Link href="/admin/refunds" className="btn border border-[var(--color-line)] text-sm">
                Manage Refunds
              </Link>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Refunds */}
          <div className="card p-6 bg-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-red-600" />
              </div>
              <span className="text-sm font-medium text-[var(--color-muted)]">Total Refunds</span>
            </div>
            <p className="text-3xl font-bold">{analytics.totalRefunds}</p>
          </div>

          {/* Total Refunded Amount */}
          <div className="card p-6 bg-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-red-600" />
              </div>
              <span className="text-sm font-medium text-[var(--color-muted)]">Total Refunded</span>
            </div>
            <p className="text-3xl font-bold text-red-600">
              ${(analytics.totalRefundedCents / 100).toFixed(2)}
            </p>
          </div>

          {/* Refund Rate */}
          <div className="card p-6 bg-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-sm font-medium text-[var(--color-muted)]">Refund Rate</span>
            </div>
            <p className="text-3xl font-bold">{analytics.refundRate.toFixed(1)}%</p>
            <p className="text-xs text-[var(--color-muted)] mt-1">Of completed orders</p>
          </div>

          {/* Average Refund */}
          <div className="card p-6 bg-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-[var(--color-muted)]">Avg Refund</span>
            </div>
            <p className="text-3xl font-bold">${(analytics.averageRefundCents / 100).toFixed(2)}</p>
          </div>
        </div>

        {/* Refunds by Reason & Product */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Refunds by Reason */}
          <div className="card p-6 bg-white">
            <h2 className="text-xl font-bold mb-4">Refunds by Reason</h2>
            {analytics.refundsByReason.length === 0 ? (
              <p className="text-[var(--color-muted)] text-center py-8">No refunds yet</p>
            ) : (
              <div className="space-y-3">
                {analytics.refundsByReason.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between border-b border-[var(--color-line)] pb-3"
                  >
                    <div>
                      <p className="font-medium">{item.reason}</p>
                      <p className="text-xs text-[var(--color-muted)]">
                        {item.count} refund{item.count !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-600">
                        ${(item.totalCents / 100).toFixed(2)}
                      </p>
                      <p className="text-xs text-[var(--color-muted)] mt-0.5">
                        {analytics.totalRefundedCents > 0
                          ? ((item.totalCents / analytics.totalRefundedCents) * 100).toFixed(1)
                          : "0.0"}
                        %
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Most Refunded Products */}
          <div className="card p-6 bg-white">
            <h2 className="text-xl font-bold mb-4">Most Refunded Products</h2>
            {analytics.refundsByProduct.length === 0 ? (
              <p className="text-[var(--color-muted)] text-center py-8">No product refunds yet</p>
            ) : (
              <div className="space-y-3">
                {analytics.refundsByProduct.slice(0, 10).map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between border-b border-[var(--color-line)] pb-3"
                  >
                    <div>
                      <p className="font-medium">{item.productName}</p>
                      <p className="text-xs text-[var(--color-muted)]">
                        {item.refundCount} unit{item.refundCount !== 1 ? "s" : ""} refunded
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-600">
                        ${(item.totalRefundedCents / 100).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}