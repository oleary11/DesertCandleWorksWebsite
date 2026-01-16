"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, TrendingUp, DollarSign, Package, ShoppingCart, Calendar, Truck, Receipt } from "lucide-react";

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

  if (loading) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-[var(--color-muted)]">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-rose-600">{error}</p>
          <Link href="/admin/analytics-overview" className="btn mt-4">
            Back to Overview
          </Link>
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
            href="/admin/analytics-overview"
            className="inline-flex items-center gap-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)] mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Overview
          </Link>
          <h1 className="text-3xl font-bold">Sales Analytics</h1>
          <p className="text-[var(--color-muted)] mt-1">
            Overview of your business performance and profitability
          </p>
        </div>

        {/* Date Range Controls */}
        <div className="card p-6 bg-white mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-[var(--color-muted)]" />
            <h2 className="text-lg font-semibold">Date Range</h2>
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              className={`btn ${datePreset === "today" ? "bg-[var(--color-accent)] text-white" : ""}`}
              onClick={() => handlePresetChange("today")}
            >
              Today
            </button>
            <button
              className={`btn ${datePreset === "week" ? "bg-[var(--color-accent)] text-white" : ""}`}
              onClick={() => handlePresetChange("week")}
            >
              This Week
            </button>
            <button
              className={`btn ${datePreset === "month" ? "bg-[var(--color-accent)] text-white" : ""}`}
              onClick={() => handlePresetChange("month")}
            >
              This Month
            </button>
            <button
              className={`btn ${datePreset === "lastMonth" ? "bg-[var(--color-accent)] text-white" : ""}`}
              onClick={() => handlePresetChange("lastMonth")}
            >
              Last Month
            </button>
            <button
              className={`btn ${datePreset === "ytd" ? "bg-[var(--color-accent)] text-white" : ""}`}
              onClick={() => handlePresetChange("ytd")}
            >
              Year to Date
            </button>
            <button
              className={`btn ${datePreset === "allTime" ? "bg-[var(--color-accent)] text-white" : ""}`}
              onClick={() => handlePresetChange("allTime")}
            >
              All Time
            </button>
            <button
              className={`btn ${datePreset === "custom" ? "bg-[var(--color-accent)] text-white" : ""}`}
              onClick={() => setDatePreset("custom")}
            >
              Custom Range
            </button>
          </div>

          {/* Custom Date Pickers */}
          {datePreset === "custom" && (
            <div className="flex flex-wrap items-end gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Start Date</label>
                <input
                  type="date"
                  className="input"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">End Date</label>
                <input
                  type="date"
                  className="input"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                />
              </div>
              <button
                className="btn bg-[var(--color-accent)] text-white px-6"
                onClick={() => {
                  if (customStartDate && customEndDate) {
                    setStartDate(customStartDate);
                    setEndDate(customEndDate);
                    loadAnalytics(customStartDate, customEndDate);
                  }
                }}
                disabled={!customStartDate || !customEndDate}
              >
                Go
              </button>
            </div>
          )}

          {/* Comparison Toggle */}
          {datePreset !== "allTime" && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showComparison}
                onChange={(e) => setShowComparison(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm">
                Show comparison to previous period
                {datePreset === "month" && " (vs last month)"}
                {datePreset === "week" && " (vs last week)"}
                {datePreset === "ytd" && " (vs last year)"}
                {datePreset === "today" && " (vs yesterday)"}
                {datePreset === "lastMonth" && " (vs two months ago)"}
              </span>
            </label>
          )}
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Gross Revenue Card */}
          <div className="card p-6 bg-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-sm font-medium text-[var(--color-muted)]">Gross Revenue</span>
            </div>
            <p className="text-3xl font-bold">${(analytics.totalRevenue / 100).toFixed(2)}</p>
            <p className="text-xs text-[var(--color-muted)] mt-1">
              Products: ${((analytics.totalProductRevenue ?? 0) / 100).toFixed(2)}<br/>
              Shipping: ${((analytics.totalShippingRevenue ?? 0) / 100).toFixed(2)} | Tax: ${((analytics.totalTaxCollected ?? 0) / 100).toFixed(2)}
            </p>
            {analytics.comparison && (
              <div className="mt-2">
                <span
                  className={`text-sm font-medium ${
                    calculatePercentageChange(analytics.totalRevenue, analytics.comparison.revenue) >= 0
                      ? "text-green-600"
                      : "text-rose-600"
                  }`}
                >
                  {formatPercentageChange(
                    calculatePercentageChange(analytics.totalRevenue, analytics.comparison.revenue)
                  )}{" "}
                  vs previous period
                </span>
              </div>
            )}
          </div>

          {/* Net Revenue Card */}
          <div className="card p-6 bg-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-emerald-600" />
              </div>
              <span className="text-sm font-medium text-[var(--color-muted)]">Net Revenue</span>
            </div>
            <p className="text-3xl font-bold">${(analytics.netRevenue / 100).toFixed(2)}</p>
            <p className="text-xs text-[var(--color-muted)] mt-1">After Stripe + Square fees</p>
            {analytics.comparison && (
              <div className="mt-2">
                <span
                  className={`text-sm font-medium ${
                    calculatePercentageChange(analytics.netRevenue, analytics.comparison.netRevenue) >= 0
                      ? "text-green-600"
                      : "text-rose-600"
                  }`}
                >
                  {formatPercentageChange(
                    calculatePercentageChange(analytics.netRevenue, analytics.comparison.netRevenue)
                  )}{" "}
                  vs previous period
                </span>
              </div>
            )}
          </div>

          {/* Orders Card */}
          <div className="card p-6 bg-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-[var(--color-muted)]">Total Orders</span>
            </div>
            <p className="text-3xl font-bold">{analytics.totalOrders}</p>
            {analytics.comparison && (
              <div className="mt-2">
                <span
                  className={`text-sm font-medium ${
                    calculatePercentageChange(analytics.totalOrders, analytics.comparison.orders) >= 0
                      ? "text-green-600"
                      : "text-rose-600"
                  }`}
                >
                  {formatPercentageChange(
                    calculatePercentageChange(analytics.totalOrders, analytics.comparison.orders)
                  )}{" "}
                  vs previous period
                </span>
              </div>
            )}
          </div>

          {/* Units Card */}
          <div className="card p-6 bg-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Package className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-sm font-medium text-[var(--color-muted)]">Units Sold</span>
            </div>
            <p className="text-3xl font-bold">{analytics.totalUnits}</p>
            {analytics.comparison && (
              <div className="mt-2">
                <span
                  className={`text-sm font-medium ${
                    calculatePercentageChange(analytics.totalUnits, analytics.comparison.units) >= 0
                      ? "text-green-600"
                      : "text-rose-600"
                  }`}
                >
                  {formatPercentageChange(
                    calculatePercentageChange(analytics.totalUnits, analytics.comparison.units)
                  )}{" "}
                  vs previous period
                </span>
              </div>
            )}
          </div>

          {/* AOV Card */}
          <div className="card p-6 bg-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-sm font-medium text-[var(--color-muted)]">Avg Order Value</span>
            </div>
            <p className="text-3xl font-bold">${(analytics.averageOrderValue / 100).toFixed(2)}</p>
            {analytics.comparison && (
              <div className="mt-2">
                <span
                  className={`text-sm font-medium ${
                    calculatePercentageChange(analytics.averageOrderValue, analytics.comparison.averageOrderValue) >= 0
                      ? "text-green-600"
                      : "text-rose-600"
                  }`}
                >
                  {formatPercentageChange(
                    calculatePercentageChange(analytics.averageOrderValue, analytics.comparison.averageOrderValue)
                  )}{" "}
                  vs previous period
                </span>
              </div>
            )}
          </div>

          {/* Total Shipping Card */}
          <div className="card p-6 bg-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
                <Truck className="w-5 h-5 text-sky-600" />
              </div>
              <span className="text-sm font-medium text-[var(--color-muted)]">Shipping Collected</span>
            </div>
            <p className="text-3xl font-bold">${((analytics.totalShippingRevenue ?? 0) / 100).toFixed(2)}</p>
            <p className="text-xs text-[var(--color-muted)] mt-1">Total shipping revenue</p>
          </div>

          {/* Total Tax Card */}
          <div className="card p-6 bg-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                <Receipt className="w-5 h-5 text-indigo-600" />
              </div>
              <span className="text-sm font-medium text-[var(--color-muted)]">Tax Collected</span>
            </div>
            <p className="text-3xl font-bold">${((analytics.totalTaxCollected ?? 0) / 100).toFixed(2)}</p>
            <p className="text-xs text-[var(--color-muted)] mt-1">Total sales tax collected</p>
          </div>
        </div>

        {/* Sales By Product */}
        <div className="card p-6 bg-white mb-8">
          <h2 className="text-xl font-bold mb-4">Sales By Product</h2>
          <p className="text-sm text-[var(--color-muted)] mb-4">
            Revenue breakdown by product including tax collected and shipping costs (allocated proportionally)
          </p>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-line)]">
                  <th className="text-left py-3 text-sm font-semibold">Product</th>
                  <th className="text-left py-3 text-sm font-semibold">Alcohol Type</th>
                  <th className="text-right py-3 text-sm font-semibold">Units Sold</th>
                  <th className="text-right py-3 text-sm font-semibold">Gross Revenue</th>
                  <th className="text-right py-3 text-sm font-semibold">Net Revenue</th>
                  <th className="text-right py-3 text-sm font-semibold">Shipping</th>
                  <th className="text-right py-3 text-sm font-semibold">Tax Collected</th>
                </tr>
              </thead>
              <tbody>
                {analytics.productSales.map((product) => {
                  const netRevenue = product.revenue - product.stripeFees;
                  return (
                    <tr key={product.slug} className="border-b border-[var(--color-line)]">
                      <td className="py-3 text-sm">{product.name}</td>
                      <td className="py-3 text-sm text-[var(--color-muted)]">
                        {product.alcoholType || "N/A"}
                      </td>
                      <td className="py-3 text-sm text-right font-medium">{product.units}</td>
                      <td className="py-3 text-sm text-right font-medium">
                        ${(product.revenue / 100).toFixed(2)}
                      </td>
                      <td className="py-3 text-sm text-right font-medium text-green-600">
                        ${(netRevenue / 100).toFixed(2)}
                      </td>
                      <td className="py-3 text-sm text-right text-[var(--color-muted)]">
                        ${((product.shippingCost ?? 0) / 100).toFixed(2)}
                      </td>
                      <td className="py-3 text-sm text-right text-blue-600">
                        ${((product.taxAmount ?? 0) / 100).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sales by Alcohol Type */}
        <div className="card p-6 bg-white mb-8">
          <h2 className="text-xl font-bold mb-4">Sales by Alcohol Type</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-line)]">
                  <th className="text-left py-3 text-sm font-semibold">Alcohol Type</th>
                  <th className="text-right py-3 text-sm font-semibold">Units Sold</th>
                  <th className="text-right py-3 text-sm font-semibold">Revenue</th>
                  <th className="text-right py-3 text-sm font-semibold">% of Total</th>
                </tr>
              </thead>
              <tbody>
                {analytics.alcoholTypeSales.map((type) => (
                  <tr key={type.name} className="border-b border-[var(--color-line)]">
                    <td className="py-3 text-sm font-medium">{type.name}</td>
                    <td className="py-3 text-sm text-right">{type.units}</td>
                    <td className="py-3 text-sm text-right font-medium">
                      ${(type.revenue / 100).toFixed(2)}
                    </td>
                    <td className="py-3 text-sm text-right text-[var(--color-muted)]">
                      {((type.revenue / analytics.totalRevenue) * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment Source Analytics */}
        {analytics.paymentSourceSales && analytics.paymentSourceSales.length > 0 && (
          <div className="card p-6 bg-white mb-8">
            <h2 className="text-xl font-bold mb-4">Revenue by Payment Source</h2>
            <p className="text-sm text-[var(--color-muted)] mb-4">
              Breakdown of revenue by payment method (Stripe, Square, Manual sales)
            </p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--color-line)]">
                    <th className="text-left py-3 text-sm font-semibold">Payment Source</th>
                    <th className="text-right py-3 text-sm font-semibold">Orders</th>
                    <th className="text-right py-3 text-sm font-semibold">Units Sold</th>
                    <th className="text-right py-3 text-sm font-semibold">Revenue</th>
                    <th className="text-right py-3 text-sm font-semibold">Avg Order Value</th>
                    <th className="text-right py-3 text-sm font-semibold">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.paymentSourceSales.map((source) => {
                    const percentage = analytics.totalRevenue > 0
                      ? (source.revenue / analytics.totalRevenue) * 100
                      : 0;
                    const avgOrderValue = source.orders > 0 ? source.revenue / source.orders : 0;

                    return (
                      <tr key={source.source} className="border-b border-[var(--color-line)]">
                        <td className="py-3 text-sm font-medium">{source.source}</td>
                        <td className="py-3 text-sm text-right">{source.orders}</td>
                        <td className="py-3 text-sm text-right">{source.units}</td>
                        <td className="py-3 text-sm text-right font-medium text-green-600">
                          ${(source.revenue / 100).toFixed(2)}
                        </td>
                        <td className="py-3 text-sm text-right text-[var(--color-muted)]">
                          ${(avgOrderValue / 100).toFixed(2)}
                        </td>
                        <td className="py-3 text-sm text-right text-[var(--color-muted)]">
                          {percentage.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Scent and Wick Analytics */}
        {((analytics.scentSales && analytics.scentSales.length > 0) ||
          (analytics.wickTypeSales && analytics.wickTypeSales.length > 0)) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Scent Sales */}
            {analytics.scentSales && analytics.scentSales.length > 0 && (
              <div className="card p-6 bg-white">
                <h2 className="text-xl font-bold mb-4">Sales by Scent</h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[var(--color-line)]">
                        <th className="text-left py-3 text-sm font-semibold">Scent</th>
                        <th className="text-right py-3 text-sm font-semibold">Units</th>
                        <th className="text-right py-3 text-sm font-semibold">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.scentSales.map((scent, idx) => (
                        <tr key={idx} className="border-b border-[var(--color-line)]">
                          <td className="py-3 text-sm font-medium">{scent.name}</td>
                          <td className="py-3 text-sm text-right">{scent.units}</td>
                          <td className="py-3 text-sm text-right font-medium text-blue-600">
                            ${(scent.revenue / 100).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Wick Type Sales */}
            {analytics.wickTypeSales && analytics.wickTypeSales.length > 0 && (
              <div className="card p-6 bg-white">
                <h2 className="text-xl font-bold mb-4">Sales by Wick Type</h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[var(--color-line)]">
                        <th className="text-left py-3 text-sm font-semibold">Wick Type</th>
                        <th className="text-right py-3 text-sm font-semibold">Units</th>
                        <th className="text-right py-3 text-sm font-semibold">Revenue</th>
                        <th className="text-right py-3 text-sm font-semibold">% of Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.wickTypeSales.map((wick, idx) => {
                        const totalWickRevenue = analytics.wickTypeSales?.reduce((sum, w) => sum + w.revenue, 0) || 0;
                        const percentage = totalWickRevenue > 0 ? (wick.revenue / totalWickRevenue) * 100 : 0;

                        return (
                          <tr key={idx} className="border-b border-[var(--color-line)]">
                            <td className="py-3 text-sm font-medium">{wick.name}</td>
                            <td className="py-3 text-sm text-right">{wick.units}</td>
                            <td className="py-3 text-sm text-right font-medium text-blue-600">
                              ${(wick.revenue / 100).toFixed(2)}
                            </td>
                            <td className="py-3 text-sm text-right text-[var(--color-muted)]">
                              {percentage.toFixed(1)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Profit Margins */}
        {analytics.profitMargins.length > 0 && (
          <div className="card p-6 bg-white">
            <h2 className="text-xl font-bold mb-4">Profit Margins</h2>
            <p className="text-sm text-[var(--color-muted)] mb-4">
              Products with cost data configured (includes Stripe + Square fees)
            </p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--color-line)]">
                    <th className="text-left py-3 text-sm font-semibold">Product</th>
                    <th className="text-right py-3 text-sm font-semibold">Revenue</th>
                    <th className="text-right py-3 text-sm font-semibold">Material Cost</th>
                    <th className="text-right py-3 text-sm font-semibold">Payment Fees</th>
                    <th className="text-right py-3 text-sm font-semibold">Net Profit</th>
                    <th className="text-right py-3 text-sm font-semibold">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.profitMargins.map((product) => (
                    <tr key={product.slug} className="border-b border-[var(--color-line)]">
                      <td className="py-3 text-sm">{product.name}</td>
                      <td className="py-3 text-sm text-right">
                        ${(product.revenue / 100).toFixed(2)}
                      </td>
                      <td className="py-3 text-sm text-right text-rose-600">
                        -${(product.cost / 100).toFixed(2)}
                      </td>
                      <td className="py-3 text-sm text-right text-amber-600">
                        -${(product.stripeFees / 100).toFixed(2)}
                      </td>
                      <td className="py-3 text-sm text-right font-medium text-green-600">
                        ${(product.profit / 100).toFixed(2)}
                      </td>
                      <td className="py-3 text-sm text-right font-bold">
                        <span
                          className={
                            product.marginPercent > 50
                              ? "text-green-600"
                              : product.marginPercent > 30
                              ? "text-amber-600"
                              : "text-rose-600"
                          }
                        >
                          {product.marginPercent.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
