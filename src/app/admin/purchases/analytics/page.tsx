"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, TrendingUp, Package, DollarSign, Calendar, PieChart } from "lucide-react";

type CategoryBreakdown = {
  category: string;
  totalCents: number;
  itemCount: number;
};

type VendorBreakdown = {
  vendor: string;
  totalCents: number;
  purchaseCount: number;
};

type MonthlySpending = {
  month: string;
  totalCents: number;
};

type AnalyticsData = {
  totalSpent: number;
  totalShipping: number;
  totalTax: number;
  totalPurchases: number;
  categoryBreakdown: CategoryBreakdown[];
  vendorBreakdown: VendorBreakdown[];
  monthlySpending: MonthlySpending[];
};

type DatePreset = "today" | "week" | "month" | "lastMonth" | "ytd" | "allTime" | "custom";

export default function PurchaseAnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  // Date filtering state
  const [datePreset, setDatePreset] = useState<DatePreset>("allTime");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  useEffect(() => {
    loadAnalytics();
  }, []);

  useEffect(() => {
    // Auto-load when date range changes (for non-custom presets)
    if (datePreset !== "custom" && (startDate || endDate || datePreset === "allTime")) {
      loadAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  // Helper function for date calculations
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

  function handlePresetChange(preset: DatePreset) {
    setDatePreset(preset);
    const range = getDateRange(preset);
    if (range) {
      setStartDate(range.start);
      setEndDate(range.end);
    } else if (preset === "allTime") {
      setStartDate("");
      setEndDate("");
    }
  }

  async function loadAnalytics(overrideStartDate?: string, overrideEndDate?: string) {
    try {
      setLoading(true);
      let url = "/api/admin/purchases/analytics";

      const effectiveStartDate = overrideStartDate ?? startDate;
      const effectiveEndDate = overrideEndDate ?? endDate;

      if (effectiveStartDate && effectiveEndDate) {
        url += `?startDate=${effectiveStartDate}&endDate=${effectiveEndDate}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (err) {
      console.error("Failed to load analytics:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen p-6 bg-neutral-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12 text-[var(--color-muted)]">
            Loading analytics...
          </div>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="min-h-screen p-6 bg-neutral-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12 text-[var(--color-muted)]">
            Failed to load analytics
          </div>
        </div>
      </div>
    );
  }

  const avgPurchaseSize = analytics.totalPurchases > 0
    ? analytics.totalSpent / analytics.totalPurchases
    : 0;

  const productSubtotal = analytics.totalSpent - analytics.totalShipping - analytics.totalTax;

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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Purchase Analytics</h1>
              <p className="text-[var(--color-muted)] mt-1">
                Spending insights and cost breakdown
              </p>
            </div>
          </div>
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
            <div className="flex flex-wrap items-end gap-4">
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
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="card p-6 bg-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-sm font-medium text-[var(--color-muted)]">Total Spent</span>
            </div>
            <p className="text-3xl font-bold">${(analytics.totalSpent / 100).toFixed(2)}</p>
            <p className="text-xs text-[var(--color-muted)] mt-1">
              Products: ${(productSubtotal / 100).toFixed(2)}<br/>
              Shipping: ${(analytics.totalShipping / 100).toFixed(2)} | Tax: ${(analytics.totalTax / 100).toFixed(2)}
            </p>
          </div>

          <div className="card p-6 bg-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-[var(--color-muted)]">Total Purchases</span>
            </div>
            <p className="text-3xl font-bold">{analytics.totalPurchases}</p>
            <p className="text-xs text-[var(--color-muted)] mt-1">Purchase orders placed</p>
          </div>

          <div className="card p-6 bg-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-sm font-medium text-[var(--color-muted)]">Avg Purchase</span>
            </div>
            <p className="text-3xl font-bold">${(avgPurchaseSize / 100).toFixed(2)}</p>
            <p className="text-xs text-[var(--color-muted)] mt-1">Per purchase order</p>
          </div>

          <div className="card p-6 bg-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-orange-600" />
              </div>
              <span className="text-sm font-medium text-[var(--color-muted)]">Active Months</span>
            </div>
            <p className="text-3xl font-bold">{analytics.monthlySpending.length}</p>
            <p className="text-xs text-[var(--color-muted)] mt-1">Months with purchases</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Spending by Category */}
          <div className="card p-6 bg-white">
            <div className="flex items-center gap-2 mb-4">
              <PieChart className="w-5 h-5 text-[var(--color-accent)]" />
              <h2 className="text-xl font-bold">Spending by Category</h2>
            </div>

            {analytics.categoryBreakdown.length === 0 ? (
              <div className="text-center py-8 text-[var(--color-muted)] text-sm">
                No category data available
              </div>
            ) : (
              <div className="space-y-3">
                {analytics.categoryBreakdown.map((item) => {
                  const percentage = analytics.totalSpent > 0
                    ? (item.totalCents / analytics.totalSpent) * 100
                    : 0;

                  return (
                    <div key={item.category} className="border-b border-[var(--color-line)] pb-3 last:border-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-medium capitalize">{item.category}</p>
                          <p className="text-xs text-[var(--color-muted)]">
                            {item.itemCount} item{item.itemCount !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">
                            ${(item.totalCents / 100).toFixed(2)}
                          </p>
                          <p className="text-xs text-[var(--color-muted)]">
                            {percentage.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                      <div className="w-full bg-neutral-100 rounded-full h-2">
                        <div
                          className="bg-[var(--color-accent)] h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Spending by Vendor */}
          <div className="card p-6 bg-white">
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-5 h-5 text-[var(--color-accent)]" />
              <h2 className="text-xl font-bold">Spending by Vendor</h2>
            </div>

            {analytics.vendorBreakdown.length === 0 ? (
              <div className="text-center py-8 text-[var(--color-muted)] text-sm">
                No vendor data available
              </div>
            ) : (
              <div className="space-y-3">
                {analytics.vendorBreakdown.map((item) => {
                  const percentage = analytics.totalSpent > 0
                    ? (item.totalCents / analytics.totalSpent) * 100
                    : 0;
                  const avgPerPurchase = item.purchaseCount > 0
                    ? item.totalCents / item.purchaseCount
                    : 0;

                  return (
                    <div key={item.vendor} className="border-b border-[var(--color-line)] pb-3 last:border-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-medium">{item.vendor}</p>
                          <p className="text-xs text-[var(--color-muted)]">
                            {item.purchaseCount} purchase{item.purchaseCount !== 1 ? "s" : ""} •
                            Avg ${(avgPerPurchase / 100).toFixed(2)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">
                            ${(item.totalCents / 100).toFixed(2)}
                          </p>
                          <p className="text-xs text-[var(--color-muted)]">
                            {percentage.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                      <div className="w-full bg-neutral-100 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Monthly Spending Timeline */}
        <div className="card p-6 bg-white">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-[var(--color-accent)]" />
            <h2 className="text-xl font-bold">Monthly Spending</h2>
          </div>

          {analytics.monthlySpending.length === 0 ? (
            <div className="text-center py-8 text-[var(--color-muted)] text-sm">
              No monthly data available
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-semibold">Month</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold">Total Spent</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-line)]">
                  {analytics.monthlySpending.map((month, index) => {
                    const maxSpending = Math.max(...analytics.monthlySpending.map(m => m.totalCents));
                    const barWidth = maxSpending > 0 ? (month.totalCents / maxSpending) * 100 : 0;

                    // Calculate month-over-month change
                    const prevMonth = index > 0 ? analytics.monthlySpending[index - 1] : null;
                    const change = prevMonth
                      ? ((month.totalCents - prevMonth.totalCents) / prevMonth.totalCents) * 100
                      : 0;

                    return (
                      <tr key={month.month} className="hover:bg-neutral-50">
                        <td className="py-3 px-4 text-sm font-medium">
                          {(() => {
                            const [year, monthNum] = month.month.split("-");
                            const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
                            return date.toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "long"
                            });
                          })()}
                        </td>
                        <td className="py-3 px-4 text-sm text-right font-bold text-green-600">
                          ${(month.totalCents / 100).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 max-w-[200px]">
                              <div className="w-full bg-neutral-100 rounded-full h-2">
                                <div
                                  className="bg-green-500 h-2 rounded-full transition-all"
                                  style={{ width: `${barWidth}%` }}
                                />
                              </div>
                            </div>
                            {prevMonth && (
                              <span className={`text-xs ${change > 0 ? 'text-red-600' : change < 0 ? 'text-green-600' : 'text-[var(--color-muted)]'}`}>
                                {change > 0 ? '▲' : change < 0 ? '▼' : '●'} {Math.abs(change).toFixed(0)}%
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
