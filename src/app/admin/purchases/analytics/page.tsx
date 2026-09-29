"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PageHeader from "../../_components/PageHeader";
import { Composition, DateRange, Panel, RankedBars, Stat } from "../../_components/ui";
import CandleSpinner from "@/components/CandleSpinner";

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

  const money = (cents: number) =>
    `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const monthLabel = (ym: string, style: "short" | "long" = "long") => {
    const [year, monthNum] = ym.split("-");
    return new Date(parseInt(year), parseInt(monthNum) - 1, 1).toLocaleDateString("en-US", {
      year: style === "long" ? "numeric" : "2-digit",
      month: style,
    });
  };

  if (loading && !analytics) {
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
        <PageHeader title="Purchase analytics" />
        <div role="alert" className="a-card px-6 py-12 text-center text-sm text-[var(--a-muted)]">
          Couldn&apos;t load analytics. Refresh to try again.
        </div>
      </div>
    );
  }

  const avgPurchaseSize = analytics.totalPurchases > 0 ? analytics.totalSpent / analytics.totalPurchases : 0;
  const productSubtotal = analytics.totalSpent - analytics.totalShipping - analytics.totalTax;
  const maxMonth = Math.max(...analytics.monthlySpending.map((m) => m.totalCents), 0);

  return (
    <div className="a-ui mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Purchase analytics"
        description="Where the money goes: categories, vendors and months."
        actions={
          <>
            <Link href="/admin/purchases" className="a-btn">
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              Cost of goods
            </Link>
            <Link href="/admin/analytics-overview" className="a-btn">
              Business overview
            </Link>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
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
        {loading && (
          <span role="status" className="text-sm text-[var(--a-muted)]">
            Updating…
          </span>
        )}
      </div>

      <div className={`space-y-6 transition-opacity ${loading ? "opacity-60" : ""}`}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Spent" value={money(analytics.totalSpent)} hint={`${money(analytics.totalShipping + analytics.totalTax)} shipping + tax`} />
          <Stat label="Purchases" value={analytics.totalPurchases} />
          <Stat label="Average purchase" value={money(avgPurchaseSize)} />
          <Stat label="Months with purchases" value={analytics.monthlySpending.length} />
        </div>

        <Panel title="Spending mix">
          <Composition
            format={money}
            items={[
              { label: "Products and supplies", value: productSubtotal },
              { label: "Shipping", value: analytics.totalShipping },
              { label: "Tax", value: analytics.totalTax },
            ]}
          />
        </Panel>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Panel title="By category">
            <RankedBars
              format={money}
              items={analytics.categoryBreakdown.map((c) => ({
                label: c.category.charAt(0).toUpperCase() + c.category.slice(1),
                value: c.totalCents,
                sub: `${c.itemCount} ${c.itemCount === 1 ? "item" : "items"}`,
              }))}
            />
          </Panel>
          <Panel title="By vendor">
            <RankedBars
              format={money}
              items={analytics.vendorBreakdown.map((v) => ({
                label: v.vendor,
                value: v.totalCents,
                sub: `${v.purchaseCount} ${v.purchaseCount === 1 ? "purchase" : "purchases"}`,
              }))}
            />
          </Panel>
        </div>

        <Panel title="Monthly spending">
          {analytics.monthlySpending.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--a-muted)]">No purchases in this period.</p>
          ) : (
            <>
              <div className="flex h-44 items-end gap-[2px] border-b border-[var(--a-line)]" role="img" aria-label="Spending by month; exact values in the table below">
                {analytics.monthlySpending.map((m) => (
                  <div key={m.month} className="group flex h-full flex-1 items-end" title={`${monthLabel(m.month)}: ${money(m.totalCents)}`}>
                    <div
                      className="w-full rounded-t-[4px] bg-[var(--a-viz-single)] transition-opacity group-hover:opacity-75"
                      style={{ height: `${maxMonth > 0 ? (m.totalCents / maxMonth) * 100 : 0}%`, minHeight: m.totalCents > 0 ? 2 : 0 }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-1.5 flex justify-between text-xs text-[var(--a-muted)]">
                <span>{monthLabel(analytics.monthlySpending[0].month, "short")}</span>
                {analytics.monthlySpending.length > 1 && (
                  <span>{monthLabel(analytics.monthlySpending[analytics.monthlySpending.length - 1].month, "short")}</span>
                )}
              </div>

              <div className="-mx-5 mt-5 overflow-x-auto border-t border-[var(--a-line)] sm:-mx-6">
                <table className="a-table a-table-dense">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th className="text-right">Spent</th>
                      <th className="text-right">vs previous month</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.monthlySpending.map((month, index) => {
                      const prevMonth = index > 0 ? analytics.monthlySpending[index - 1] : null;
                      const change =
                        prevMonth && prevMonth.totalCents > 0 ? ((month.totalCents - prevMonth.totalCents) / prevMonth.totalCents) * 100 : null;
                      return (
                        <tr key={month.month}>
                          <td>{monthLabel(month.month)}</td>
                          <td className="a-num font-medium">{money(month.totalCents)}</td>
                          <td className="a-num">
                            {change === null ? (
                              <span className="text-[var(--a-faint)]">—</span>
                            ) : (
                              <span className={change > 0 ? "text-[var(--a-bad)]" : change < 0 ? "text-[var(--a-good)]" : "text-[var(--a-muted)]"}>
                                {change > 0 ? "▲" : change < 0 ? "▼" : "•"} {Math.abs(change).toFixed(0)}%
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
