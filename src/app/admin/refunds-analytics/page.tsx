"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PageHeader from "../_components/PageHeader";
import { Panel, RankedBars, Stat } from "../_components/ui";
import CandleSpinner from "@/components/CandleSpinner";

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

  const money = (cents: number) =>
    `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (loading) {
    return (
      <div className="a-ui flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <CandleSpinner />
        <p className="text-sm font-medium text-[var(--a-muted)]">Loading analytics…</p>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="a-ui mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader title="Refund analytics" />
        <div role="alert" className="a-card px-6 py-12 text-center text-sm text-[var(--a-muted)]">
          Couldn&apos;t load analytics. Refresh to try again.
        </div>
      </div>
    );
  }

  return (
    <div className="a-ui mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Refund analytics"
        description="Completed refunds: why they happen and which products they come from."
        actions={
          <Link href="/admin/refunds" className="a-btn">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Refunds
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Refunds" value={analytics.totalRefunds} />
        <Stat label="Refunded" value={money(analytics.totalRefundedCents)} />
        <Stat label="Refund rate" value={`${analytics.refundRate.toFixed(1)}%`} hint="Of completed orders" />
        <Stat label="Average refund" value={money(analytics.averageRefundCents)} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="By reason" description="Amount refunded">
          <RankedBars
            format={money}
            items={analytics.refundsByReason.map((r) => ({
              label: r.reason,
              value: r.totalCents,
              sub: `${r.count} ${r.count === 1 ? "refund" : "refunds"}`,
            }))}
          />
        </Panel>
        <Panel title="Most refunded products" description="Amount refunded">
          <RankedBars
            format={money}
            items={analytics.refundsByProduct.map((p) => ({
              label: p.productName,
              value: p.totalRefundedCents,
              sub: `${p.refundCount} ${p.refundCount === 1 ? "unit" : "units"}`,
            }))}
          />
        </Panel>
      </div>
    </div>
  );
}
