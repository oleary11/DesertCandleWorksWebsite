"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PageHeader from "../_components/PageHeader";
import { Badge, Composition, DateRange, Panel, RankedBars, Stat } from "../_components/ui";
import CandleSpinner from "@/components/CandleSpinner";

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

type Product = {
  slug: string;
  name: string;
  price: number;
  costCents?: number;
  alcoholType?: string;
  stock?: number;
};

type ComparisonData = {
  revenue: number;
  netRevenue: number;
  stripeFees: number;
  orders: number;
  units: number;
  averageOrderValue: number;
};

type ProfitMargin = {
  slug: string;
  name: string;
  revenue: number;
  cost: number;
  stripeFees: number;
  profit: number;
  marginPercent: number;
};

type AnalyticsData = {
  totalRevenue: number;
  totalProductRevenue: number;
  totalShippingRevenue: number;
  totalTaxCollected: number;
  netRevenue: number;
  stripeFees: number;
  totalOrders: number;
  totalUnits: number;
  averageOrderValue: number;
  productSales: Array<{
    slug: string;
    name: string;
    units: number;
    revenue: number;
    stripeFees: number;
    shippingCost: number;
    taxAmount: number;
    alcoholType?: string;
  }>;
  alcoholTypeSales: Array<{
    name: string;
    units: number;
    revenue: number;
  }>;
  scentSales?: Array<{ name: string; units: number; revenue: number }>;
  wickTypeSales?: Array<{ name: string; units: number; revenue: number }>;
  paymentSourceSales?: Array<{ source: string; revenue: number; orders: number; units: number }>;
  profitMargins: ProfitMargin[];
  dateRange?: { startDate: string; endDate: string } | null;
  comparison?: ComparisonData | null;
};

type DatePreset = "today" | "week" | "month" | "lastMonth" | "ytd" | "allTime" | "custom";

export default function AdminAnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("allTime");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [showComparison, setShowComparison] = useState(false);

  useEffect(() => {
    // Only auto-load for non-custom presets
    if (datePreset !== "custom") {
      loadAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, showComparison]);

  // Helper functions for date calculations
  function getDateRange(preset: DatePreset): { start: string; end: string } | null {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (preset) {
      case "today":
        return {
          start: today.toISOString().split("T")[0],
          end: today.toISOString().split("T")[0],
        };
      case "week": {
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay()); // Sunday
        return {
          start: weekStart.toISOString().split("T")[0],
          end: today.toISOString().split("T")[0],
        };
      }
      case "month": {
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        return {
          start: monthStart.toISOString().split("T")[0],
          end: today.toISOString().split("T")[0],
        };
      }
      case "lastMonth": {
        const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        return {
          start: lastMonthStart.toISOString().split("T")[0],
          end: lastMonthEnd.toISOString().split("T")[0],
        };
      }
      case "ytd": {
        const yearStart = new Date(today.getFullYear(), 0, 1);
        return {
          start: yearStart.toISOString().split("T")[0],
          end: today.toISOString().split("T")[0],
        };
      }
      case "allTime":
        return null;
      case "custom":
        return null;
    }
  }

  function getComparisonRange(preset: DatePreset): { start: string; end: string } | null {
    if (preset === "allTime" || preset === "custom") return null;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (preset) {
      case "today": {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return {
          start: yesterday.toISOString().split("T")[0],
          end: yesterday.toISOString().split("T")[0],
        };
      }
      case "week": {
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay()); // This week's Sunday
        const prevWeekEnd = new Date(weekStart);
        prevWeekEnd.setDate(prevWeekEnd.getDate() - 1); // Last Saturday
        const prevWeekStart = new Date(prevWeekEnd);
        prevWeekStart.setDate(prevWeekStart.getDate() - 6); // Previous Sunday
        return {
          start: prevWeekStart.toISOString().split("T")[0],
          end: prevWeekEnd.toISOString().split("T")[0],
        };
      }
      case "month": {
        const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        return {
          start: lastMonthStart.toISOString().split("T")[0],
          end: lastMonthEnd.toISOString().split("T")[0],
        };
      }
      case "lastMonth": {
        const twoMonthsAgoStart = new Date(today.getFullYear(), today.getMonth() - 2, 1);
        const twoMonthsAgoEnd = new Date(today.getFullYear(), today.getMonth() - 1, 0);
        return {
          start: twoMonthsAgoStart.toISOString().split("T")[0],
          end: twoMonthsAgoEnd.toISOString().split("T")[0],
        };
      }
      case "ytd": {
        const lastYearStart = new Date(today.getFullYear() - 1, 0, 1);
        const lastYearEnd = new Date(today.getFullYear() - 1, 11, 31);
        return {
          start: lastYearStart.toISOString().split("T")[0],
          end: lastYearEnd.toISOString().split("T")[0],
        };
      }
    }
    return null;
  }

  function handlePresetChange(preset: DatePreset) {
    setDatePreset(preset);
    const range = getDateRange(preset);
    if (range) {
      setStartDate(range.start);
      setEndDate(range.end);
    } else if (preset === "allTime") {
      setStartDate("");
      setEndDate("");
      setShowComparison(false);
    }
  }

  async function loadAnalytics(overrideStartDate?: string, overrideEndDate?: string) {
    try {
      setLoading(true);
      let url = "/api/admin/analytics";
      const params = new URLSearchParams();

      const effectiveStartDate = overrideStartDate ?? startDate;
      const effectiveEndDate = overrideEndDate ?? endDate;

      console.log("[Analytics] Loading with dates:", { effectiveStartDate, effectiveEndDate, showComparison, datePreset });

      if (effectiveStartDate && effectiveEndDate) {
        params.append("startDate", effectiveStartDate);
        params.append("endDate", effectiveEndDate);

        if (showComparison) {
          const compRange = getComparisonRange(datePreset);
          console.log("[Analytics] Comparison range:", compRange);
          if (compRange) {
            params.append("compareStartDate", compRange.start);
            params.append("compareEndDate", compRange.end);
          }
        }
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      console.log("[Analytics] Fetching:", url);

      const res = await fetch(url, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
        },
      });
      if (!res.ok) {
        throw new Error("Failed to load analytics");
      }
      const data = await res.json();
      console.log("[Analytics] Data received:", data);
      setAnalytics(data);
    } catch (err) {
      setError("Failed to load analytics data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function calculatePercentageChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  function formatPercentageChange(change: number): string {
    const formatted = Math.abs(change).toFixed(1);
    return change > 0 ? `+${formatted}%` : `-${formatted}%`;
  }

  const money = (cents: number) =>
    `${cents < 0 ? "−" : ""}$${(Math.abs(cents) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (loading && !analytics) {
    return (
      <div className="a-ui flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <CandleSpinner />
        <p className="text-sm font-medium text-[var(--a-muted)]">Loading analytics…</p>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="a-ui mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader title="Sales analytics" />
        <div role="alert" className="a-card px-6 py-12 text-center text-sm text-[#b42318]">
          {error || "Couldn't load analytics."}
        </div>
      </div>
    );
  }

  const comparison = analytics.comparison;
  function delta(current: number, previous: number | undefined) {
    if (!comparison || previous === undefined) return undefined;
    const change = calculatePercentageChange(current, previous);
    return (
      <span className={change >= 0 ? "text-[var(--a-good)]" : "text-[var(--a-bad)]"}>
        {formatPercentageChange(change)} vs previous
      </span>
    );
  }

  return (
    <div className="a-ui mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Sales analytics"
        description="What sold, where it sold, and what it earned."
        actions={
          <Link href="/admin/analytics-overview" className="a-btn">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Business overview
          </Link>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        <DateRange
          preset={datePreset}
          presets={[
            { value: "today", label: "Today" },
            { value: "week", label: "This week" },
            { value: "month", label: "This month" },
            { value: "lastMonth", label: "Last month" },
            { value: "ytd", label: "Year to date" },
            { value: "allTime", label: "All time" },
            { value: "custom", label: "Custom range…" },
          ]}
          onPreset={(p) => (p === "custom" ? setDatePreset("custom") : handlePresetChange(p))}
          customStart={customStartDate}
          customEnd={customEndDate}
          onCustomStart={setCustomStartDate}
          onCustomEnd={setCustomEndDate}
          onApply={() => {
            if (customStartDate && customEndDate) {
              setStartDate(customStartDate);
              setEndDate(customEndDate);
              loadAnalytics(customStartDate, customEndDate);
            }
          }}
        />
        {datePreset !== "allTime" && (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--a-ink)]">
            <input type="checkbox" className="a-check" checked={showComparison} onChange={(e) => setShowComparison(e.target.checked)} />
            Compare to previous period
          </label>
        )}
        {loading && (
          <span role="status" className="text-sm text-[var(--a-muted)]">
            Updating…
          </span>
        )}
      </div>

      <div className={`transition-opacity ${loading ? "opacity-60" : ""}`}>
        {/* Key numbers */}
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Revenue" value={money(analytics.totalRevenue)} hint={delta(analytics.totalRevenue, comparison?.revenue) ?? "Products, shipping and tax"} />
          <Stat label="Net revenue" value={money(analytics.netRevenue)} hint={delta(analytics.netRevenue, comparison?.netRevenue) ?? "After Stripe and Square fees"} />
          <Stat label="Orders" value={analytics.totalOrders} hint={delta(analytics.totalOrders, comparison?.orders) ?? `${analytics.totalUnits} units sold`} />
          <Stat
            label="Average order"
            value={money(analytics.averageOrderValue)}
            hint={delta(analytics.averageOrderValue, comparison?.averageOrderValue) ?? `${money(analytics.stripeFees)} in fees`}
          />
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Panel title="Revenue mix">
            <Composition
              format={money}
              items={[
                { label: "Products", value: analytics.totalProductRevenue ?? 0 },
                { label: "Shipping", value: analytics.totalShippingRevenue ?? 0 },
                { label: "Tax collected", value: analytics.totalTaxCollected ?? 0 },
              ]}
            />
          </Panel>
          {analytics.paymentSourceSales && analytics.paymentSourceSales.length > 0 && (
            <Panel title="By payment source">
              <Composition format={money} items={analytics.paymentSourceSales.slice(0, 4).map((s) => ({ label: `${s.source} · ${s.orders} orders`, value: s.revenue }))} />
            </Panel>
          )}
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Panel title="Alcohol types" description="By revenue">
            <RankedBars format={money} items={analytics.alcoholTypeSales.map((t) => ({ label: t.name, value: t.revenue, sub: `${t.units} sold` }))} />
          </Panel>
          {analytics.scentSales && analytics.scentSales.length > 0 && (
            <Panel title="Scents" description="By revenue">
              <RankedBars format={money} items={analytics.scentSales.map((s) => ({ label: s.name, value: s.revenue, sub: `${s.units} sold` }))} />
            </Panel>
          )}
          {analytics.wickTypeSales && analytics.wickTypeSales.length > 0 && (
            <Panel title="Wick types" description="By revenue">
              <RankedBars format={money} items={analytics.wickTypeSales.map((w) => ({ label: w.name, value: w.revenue, sub: `${w.units} sold` }))} />
            </Panel>
          )}
        </div>

        {/* Products */}
        <Panel className="mb-6" title="Sales by product" description="Shipping and tax are split across products in proportion to price.">
          <div className="-mx-5 overflow-x-auto sm:-mx-6">
            <table className="a-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="text-right">Units</th>
                  <th className="text-right">Revenue</th>
                  <th className="text-right">Net</th>
                  <th className="text-right">Shipping</th>
                  <th className="text-right">Tax</th>
                </tr>
              </thead>
              <tbody>
                {analytics.productSales.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-sm text-[var(--a-muted)]">
                      No sales in this period.
                    </td>
                  </tr>
                )}
                {analytics.productSales.map((product) => (
                  <tr key={product.slug}>
                    <td>
                      <p className="font-medium text-[var(--a-ink)]">{product.name}</p>
                      <p className="text-xs text-[var(--a-muted)]">{product.alcoholType || "No type"}</p>
                    </td>
                    <td className="a-num">{product.units}</td>
                    <td className="a-num font-medium">{money(product.revenue)}</td>
                    <td className="a-num">{money(product.revenue - product.stripeFees)}</td>
                    <td className="a-num text-[var(--a-muted)]">{money(product.shippingCost ?? 0)}</td>
                    <td className="a-num text-[var(--a-muted)]">{money(product.taxAmount ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Margins */}
        {analytics.profitMargins.length > 0 && (
          <Panel title="Profit margins" description="Products with material costs set. Includes Stripe and Square fees.">
            <div className="-mx-5 overflow-x-auto sm:-mx-6">
              <table className="a-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="text-right">Revenue</th>
                    <th className="text-right">Materials</th>
                    <th className="text-right">Fees</th>
                    <th className="text-right">Profit</th>
                    <th className="text-right">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.profitMargins.map((product) => (
                    <tr key={product.slug}>
                      <td className="font-medium text-[var(--a-ink)]">{product.name}</td>
                      <td className="a-num">{money(product.revenue)}</td>
                      <td className="a-num text-[var(--a-muted)]">−{money(product.cost)}</td>
                      <td className="a-num text-[var(--a-muted)]">−{money(product.stripeFees)}</td>
                      <td className="a-num font-medium">{money(product.profit)}</td>
                      <td className="a-num">
                        <Badge tone={product.marginPercent > 50 ? "green" : product.marginPercent > 30 ? "amber" : "red"}>
                          {product.marginPercent.toFixed(1)}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
