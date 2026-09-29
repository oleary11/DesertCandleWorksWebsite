"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import PageHeader from "../_components/PageHeader";
import { Composition, DateRange, Panel, RankedBars, Stat } from "../_components/ui";
import CandleSpinner from "@/components/CandleSpinner";

type SalesAnalytics = {
  totalRevenue: number;
  totalProductRevenue: number;
  totalShippingRevenue: number;
  totalTaxCollected: number;
  totalRefunded: number;
  totalOrders: number;
  stripeFees: number;
  scentSales?: Array<{ name: string; units: number; revenue: number }>;
  wickTypeSales?: Array<{ name: string; units: number; revenue: number }>;
  paymentSourceSales?: Array<{ source: string; revenue: number; orders: number; units: number }>;
};

type PurchaseAnalytics = {
  totalSpent: number;
  totalShipping: number;
  totalTax: number;
  totalPurchases: number;
};

type MonthlyData = {
  month: string;
  revenue: number;
  costs: number;
  profit: number;
};

type DatePreset = "today" | "week" | "month" | "lastMonth" | "ytd" | "allTime" | "custom";

export default function UnifiedAnalyticsPage() {
  const [salesData, setSalesData] = useState<SalesAnalytics | null>(null);
  const [purchaseData, setPurchaseData] = useState<PurchaseAnalytics | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  // Date filtering state
  const [datePreset, setDatePreset] = useState<DatePreset>("allTime");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // Federal "set-aside"/estimated payment rate (you can tweak via dropdown)
  const [fedRate, setFedRate] = useState(0.25);

  // Tax period selection
  const currentYear = new Date().getFullYear();
  const getCurrentQuarter = () => {
    const month = new Date().getMonth();
    const quarter = Math.floor(month / 3) + 1;
    return `Q${quarter}` as "Q1" | "Q2" | "Q3" | "Q4";
  };
  const [taxYear, setTaxYear] = useState(currentYear);
  const [taxPeriod, setTaxPeriod] = useState<"Q1" | "Q2" | "Q3" | "Q4" | "YEAR">(getCurrentQuarter());
  const [taxPeriodSalesData, setTaxPeriodSalesData] = useState<SalesAnalytics | null>(null);
  const [taxPeriodPurchaseData, setTaxPeriodPurchaseData] = useState<PurchaseAnalytics | null>(null);
  const [loadingTaxPeriod, setLoadingTaxPeriod] = useState(false);

  function getTaxPeriodDates(year: number, period: "Q1" | "Q2" | "Q3" | "Q4" | "YEAR") {
    if (period === "YEAR") {
      return {
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`,
      };
    }

    const quarterMap = {
      Q1: { start: "01-01", end: "03-31" },
      Q2: { start: "04-01", end: "06-30" },
      Q3: { start: "07-01", end: "09-30" },
      Q4: { start: "10-01", end: "12-31" },
    };

    const { start, end } = quarterMap[period];
    return {
      startDate: `${year}-${start}`,
      endDate: `${year}-${end}`,
    };
  }

  const loadAnalytics = useCallback(async (overrideStartDate?: string, overrideEndDate?: string) => {
    try {
      setLoading(true);

      let salesUrl = "/api/admin/analytics";
      let purchasesUrl = "/api/admin/purchases/analytics";

      const effectiveStartDate = overrideStartDate ?? startDate;
      const effectiveEndDate = overrideEndDate ?? endDate;

      if (effectiveStartDate && effectiveEndDate) {
        const params = `?startDate=${effectiveStartDate}&endDate=${effectiveEndDate}`;
        salesUrl += params;
        purchasesUrl += params;
      }

      const [salesRes, purchasesRes] = await Promise.all([
        fetch(salesUrl),
        fetch(purchasesUrl),
      ]);

      if (salesRes.ok && purchasesRes.ok) {
        const sales = await salesRes.json();
        const purchases = await purchasesRes.json();
        setSalesData(sales);
        setPurchaseData(purchases);
      }
    } catch (err) {
      console.error("Failed to load analytics:", err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  const loadTaxPeriodAnalytics = useCallback(async () => {
    try {
      setLoadingTaxPeriod(true);
      const { startDate: taxStartDate, endDate: taxEndDate } = getTaxPeriodDates(taxYear, taxPeriod);

      const [salesRes, purchasesRes] = await Promise.all([
        fetch(`/api/admin/analytics?startDate=${taxStartDate}&endDate=${taxEndDate}`),
        fetch(`/api/admin/purchases/analytics?startDate=${taxStartDate}&endDate=${taxEndDate}`),
      ]);

      if (salesRes.ok && purchasesRes.ok) {
        const sales = await salesRes.json();
        const purchases = await purchasesRes.json();
        setTaxPeriodSalesData(sales);
        setTaxPeriodPurchaseData(purchases);
      }
    } catch (err) {
      console.error("Failed to load tax period analytics:", err);
    } finally {
      setLoadingTaxPeriod(false);
    }
  }, [taxYear, taxPeriod]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    // Auto-load when date range changes (for non-custom presets)
    if (datePreset !== "custom" && (startDate || endDate || datePreset === "allTime")) {
      loadAnalytics();
    }
  }, [startDate, endDate, datePreset, loadAnalytics]);

  useEffect(() => {
    loadTaxPeriodAnalytics();
  }, [loadTaxPeriodAnalytics]);

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

  function formatDate(d: Date) {
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function getQuarter(date: Date) {
    return Math.floor(date.getMonth() / 3) + 1; // 1-4
  }

  function getNextIrsEstimatedDueDate(today: Date) {
    const y = today.getFullYear();
    const d = today;

    // IRS estimated tax due dates (typical schedule):
    // Q1 -> Apr 15, Q2 -> Jun 15, Q3 -> Sep 15, Q4 -> Jan 15 (next year)
    const apr15 = new Date(y, 3, 15);
    const jun15 = new Date(y, 5, 15);
    const sep15 = new Date(y, 8, 15);
    const jan15Next = new Date(y + 1, 0, 15);

    if (d <= apr15) return apr15;
    if (d <= jun15) return jun15;
    if (d <= sep15) return sep15;
    return jan15Next;
  }

  function getNextAzTptQuarterlyDueDate(today: Date) {
    // Quarterly TPT returns are typically due the 20th of the month following quarter end:
    // Q1 (Jan-Mar) -> Apr 20
    // Q2 (Apr-Jun) -> Jul 20
    // Q3 (Jul-Sep) -> Oct 20
    // Q4 (Oct-Dec) -> Jan 20 (next year)
    const y = today.getFullYear();
    const q = getQuarter(today);

    const dueMap = {
      1: new Date(y, 3, 20),
      2: new Date(y, 6, 20),
      3: new Date(y, 9, 20),
      4: new Date(y + 1, 0, 20),
    } as const;

    return dueMap[q as 1 | 2 | 3 | 4];
  }

  if (loading) {
    return (
      <div className="a-ui flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <CandleSpinner />
        <p className="text-sm font-medium text-[var(--a-muted)]">Loading analytics…</p>
      </div>
    );
  }

  if (!salesData || !purchaseData) {
    return (
      <div className="a-ui mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader title="Business overview" />
        <div role="alert" className="a-card px-6 py-12 text-center text-sm text-[var(--a-muted)]">
          Couldn&apos;t load analytics. Refresh the page to try again.
        </div>
      </div>
    );
  }

  // Calculate key metrics
  const grossRevenue = salesData.totalRevenue || 0;
  const totalCosts = purchaseData.totalSpent || 0;
  const stripeFees = salesData.stripeFees || 0;
  const netRevenue = grossRevenue - stripeFees;
  const grossProfit = netRevenue - totalCosts;
  const grossMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;

  // Product revenue only (excluding shipping and tax)
  const productRevenue = salesData.totalProductRevenue || 0;
  const productCosts =
    (purchaseData.totalSpent || 0) -
    (purchaseData.totalShipping || 0) -
    (purchaseData.totalTax || 0);
  const productProfit = productRevenue - productCosts;
  const productMargin =
    productRevenue > 0 ? (productProfit / productRevenue) * 100 : 0;

  // --- Tax Planning (AZ TPT + Federal Estimated) ---
  const today = new Date();
  const currentQuarter = getQuarter(today);

  // Calculate tax amounts based on selected period
  const taxSales = taxPeriodSalesData || salesData;
  const taxPurchases = taxPeriodPurchaseData || purchaseData;

  // AZ TPT owed: since you ONLY collect AZ tax right now, this is fine.
  const azTptToRemitCents = taxSales.totalTaxCollected || 0;

  // Federal estimate: sales tax collected is NOT income.
  // Use product + shipping revenue (exclude tax), then subtract Stripe fees and costs.
  const taxProductRevenue = taxSales.totalProductRevenue || 0;
  const taxShippingRevenue = taxSales.totalShippingRevenue || 0;
  const taxStripeFees = taxSales.stripeFees || 0;
  const taxTotalCosts = taxPurchases.totalSpent || 0;
  const businessRevenueExcludingTax = taxProductRevenue + taxShippingRevenue;
  const federalNetProfitCents =
    businessRevenueExcludingTax - taxStripeFees - taxTotalCosts;

  // Only show federal payment if net profit > 0 for the quarter
  const suggestedFederalPaymentCents = federalNetProfitCents > 0
    ? Math.round(federalNetProfitCents * fedRate)
    : 0;

  // Calculate due dates based on selected period
  const getSelectedPeriodDueDates = () => {
    if (taxPeriod === "YEAR") {
      // For full year, use current quarter's due dates
      return {
        irsDue: getNextIrsEstimatedDueDate(today),
        azTptDue: getNextAzTptQuarterlyDueDate(today),
      };
    }

    // For specific quarters, calculate the due date for that quarter
    const quarterNum = parseInt(taxPeriod[1]) as 1 | 2 | 3 | 4;

    // IRS estimated tax due dates
    const irsDueMap = {
      1: new Date(taxYear, 3, 15),  // Apr 15
      2: new Date(taxYear, 5, 15),  // Jun 15
      3: new Date(taxYear, 8, 15),  // Sep 15
      4: new Date(taxYear + 1, 0, 15), // Jan 15 (next year)
    } as const;

    // AZ TPT quarterly due dates
    const azTptDueMap = {
      1: new Date(taxYear, 3, 20),  // Apr 20
      2: new Date(taxYear, 6, 20),  // Jul 20
      3: new Date(taxYear, 9, 20),  // Oct 20
      4: new Date(taxYear + 1, 0, 20), // Jan 20 (next year)
    } as const;

    return {
      irsDue: irsDueMap[quarterNum],
      azTptDue: azTptDueMap[quarterNum],
    };
  };

  const { irsDue: nextIrsDue, azTptDue: nextAzTptDue } = getSelectedPeriodDueDates();

  const money = (cents: number) =>
    `${cents < 0 ? "−" : ""}$${(Math.abs(cents) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const perOrder = (cents: number) => ((salesData.totalOrders || 0) > 0 ? money(cents / salesData.totalOrders) : "—");

  return (
    <div className="a-ui mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Business overview"
        description="Revenue, costs and profit for the period you pick."
        actions={
          <>
            <Link href="/admin/analytics" className="a-btn">
              Sales details
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
            <Link href="/admin/purchases/analytics" className="a-btn">
              Purchase details
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </>
        }
      />

      <div className="mb-6">
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
      </div>

      {/* Headline numbers */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Revenue" value={money(grossRevenue)} hint={`${salesData.totalOrders || 0} orders`} />
        <Stat label="Costs" value={money(totalCosts)} hint={`${purchaseData.totalPurchases || 0} purchases`} />
        <Stat
          label="Net profit"
          value={money(grossProfit)}
          tone={grossProfit >= 0 ? "good" : "bad"}
          hint="After costs and payment fees"
        />
        <Stat
          label="Margin"
          value={`${(grossMargin || 0).toFixed(1)}%`}
          tone={grossMargin >= 0 ? "good" : "bad"}
          hint={`Product margin ${(productMargin || 0).toFixed(1)}%`}
        />
      </div>

      {/* Taxes */}
      <Panel
        className="mb-6"
        title="Taxes to set aside"
        description={taxPeriod === "YEAR" ? `Full year ${taxYear}` : `${taxYear} ${taxPeriod}`}
        actions={
          <>
            <label className="block">
              <span className="sr-only">Tax year</span>
              <select value={taxYear} onChange={(e) => setTaxYear(Number(e.target.value))} className="a-select h-9 w-24">
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
                <option value={2027}>2027</option>
              </select>
            </label>
            <label className="block">
              <span className="sr-only">Tax period</span>
              <select
                value={taxPeriod}
                onChange={(e) => setTaxPeriod(e.target.value as "Q1" | "Q2" | "Q3" | "Q4" | "YEAR")}
                className="a-select h-9 w-28"
              >
                <option value="Q1">Q1</option>
                <option value="Q2">Q2</option>
                <option value="Q3">Q3</option>
                <option value="Q4">Q4</option>
                <option value="YEAR">Full year</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--a-muted)]">
              Federal
              <select value={fedRate} onChange={(e) => setFedRate(Number(e.target.value))} className="a-select h-9 w-20">
                <option value={0.2}>20%</option>
                <option value={0.25}>25%</option>
                <option value={0.3}>30%</option>
                <option value={0.33}>33%</option>
              </select>
            </label>
          </>
        }
      >
        {loadingTaxPeriod && <p className="mb-3 text-sm text-[var(--a-muted)]">Loading tax period…</p>}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="a-panel">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-[var(--a-ink)]">Arizona TPT</p>
                <p className="text-xs text-[var(--a-muted)]">Sales tax you collected. It passes straight through to the state.</p>
              </div>
              <p className="shrink-0 text-right text-xs text-[var(--a-muted)]">
                Due
                <span className="block text-sm font-semibold text-[var(--a-ink)]">{formatDate(nextAzTptDue)}</span>
              </p>
            </div>
            <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{money(azTptToRemitCents || 0)}</p>
          </div>

          <div className="a-panel">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-[var(--a-ink)]">Federal estimated tax (1040-ES)</p>
                <p className="text-xs text-[var(--a-muted)]">
                  {federalNetProfitCents > 0
                    ? `${Math.round(fedRate * 100)}% of business profit (sales tax excluded).`
                    : "Nothing due: business profit is $0 or less."}
                </p>
              </div>
              <p className="shrink-0 text-right text-xs text-[var(--a-muted)]">
                Due
                <span className="block text-sm font-semibold text-[var(--a-ink)]">{formatDate(nextIrsDue)}</span>
              </p>
            </div>
            <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{money(suggestedFederalPaymentCents || 0)}</p>
            <p className="mt-1 text-xs text-[var(--a-muted)]">
              Profit (products + shipping − Stripe − costs):{" "}
              <span className={`font-medium ${federalNetProfitCents > 0 ? "text-[var(--a-good)]" : "text-[var(--a-bad)]"}`}>
                {money(federalNetProfitCents || 0)}
              </span>
            </p>
          </div>
        </div>
      </Panel>

      {/* Where money came from / went */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Revenue" description={`${money(grossRevenue)} from ${salesData.totalOrders || 0} orders`}>
          <Composition
            format={money}
            items={[
              { label: "Products", value: productRevenue || 0 },
              { label: "Shipping", value: salesData.totalShippingRevenue || 0 },
              { label: "Tax collected", value: salesData.totalTaxCollected || 0 },
            ]}
          />
          <dl className="mt-4 space-y-1.5 border-t border-[var(--a-line)] pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--a-muted)]">
                Payment fees <span className="text-xs">({grossRevenue > 0 ? (((stripeFees || 0) / grossRevenue) * 100).toFixed(1) : 0}%)</span>
              </dt>
              <dd className="tabular-nums text-[var(--a-bad)]">−{money(stripeFees || 0)}</dd>
            </div>
            <div className="flex justify-between font-semibold">
              <dt>Net revenue</dt>
              <dd className="tabular-nums">{money(netRevenue || 0)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--a-muted)]">Product revenue per order</dt>
              <dd className="tabular-nums">{perOrder(productRevenue || 0)}</dd>
            </div>
          </dl>
        </Panel>

        <Panel title="Costs" description={`${money(totalCosts)} across ${purchaseData.totalPurchases || 0} purchases`}>
          <Composition
            format={money}
            items={[
              { label: "Products and supplies", value: productCosts || 0 },
              { label: "Shipping", value: purchaseData.totalShipping || 0 },
              { label: "Tax paid", value: purchaseData.totalTax || 0 },
            ]}
          />
          <dl className="mt-4 space-y-1.5 border-t border-[var(--a-line)] pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--a-muted)]">Cost per order</dt>
              <dd className="tabular-nums">{perOrder(totalCosts || 0)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--a-muted)]">Average purchase</dt>
              <dd className="tabular-nums">
                {(purchaseData.totalPurchases || 0) > 0 ? money((totalCosts || 0) / purchaseData.totalPurchases) : "—"}
              </dd>
            </div>
          </dl>
        </Panel>
      </div>

      {/* Payment sources */}
      {salesData.paymentSourceSales && salesData.paymentSourceSales.length > 0 && (
        <Panel className="mb-6" title="Revenue by payment source" description="Website (Stripe), Square and manual sales.">
          <Composition
            format={money}
            items={salesData.paymentSourceSales.slice(0, 4).map((s) => ({ label: s.source, value: s.revenue }))}
          />
          <div className="mt-4 overflow-x-auto border-t border-[var(--a-line)] pt-3">
            <table className="a-table a-table-dense">
              <thead>
                <tr>
                  <th>Source</th>
                  <th className="text-right">Orders</th>
                  <th className="text-right">Units</th>
                  <th className="text-right">Avg order</th>
                </tr>
              </thead>
              <tbody>
                {salesData.paymentSourceSales.map((source) => (
                  <tr key={source.source}>
                    <td>{source.source}</td>
                    <td className="a-num">{source.orders}</td>
                    <td className="a-num">{source.units}</td>
                    <td className="a-num">{source.orders > 0 ? money(source.revenue / source.orders) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* Scents and wicks */}
      {((salesData.scentSales && salesData.scentSales.length > 0) || (salesData.wickTypeSales && salesData.wickTypeSales.length > 0)) && (
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {salesData.scentSales && salesData.scentSales.length > 0 && (
            <Panel title="Top scents" description="By revenue">
              <RankedBars
                format={money}
                items={salesData.scentSales.map((s) => ({ label: s.name, value: s.revenue, sub: `${s.units} sold` }))}
              />
            </Panel>
          )}
          {salesData.wickTypeSales && salesData.wickTypeSales.length > 0 && (
            <Panel title="Wick types" description="By revenue">
              <RankedBars
                format={money}
                items={salesData.wickTypeSales.map((w) => ({ label: w.name, value: w.revenue, sub: `${w.units} sold` }))}
              />
            </Panel>
          )}
        </div>
      )}

      {/* Profitability */}
      <Panel title="Profitability">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="a-panel">
            <p className="text-xs font-medium text-[var(--a-muted)]">Product profit</p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${productProfit >= 0 ? "text-[var(--a-good)]" : "text-[var(--a-bad)]"}`}>
              {money(productProfit || 0)}
            </p>
            <p className="mt-0.5 text-xs text-[var(--a-muted)]">{(productMargin || 0).toFixed(1)}% margin · product revenue − product costs</p>
          </div>
          <div className="a-panel">
            <p className="text-xs font-medium text-[var(--a-muted)]">Net profit</p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${grossProfit >= 0 ? "text-[var(--a-good)]" : "text-[var(--a-bad)]"}`}>
              {money(grossProfit || 0)}
            </p>
            <p className="mt-0.5 text-xs text-[var(--a-muted)]">{(grossMargin || 0).toFixed(1)}% margin · after all costs and fees</p>
          </div>
          <div className="a-panel">
            <p className="text-xs font-medium text-[var(--a-muted)]">Profit per order</p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${grossProfit >= 0 ? "text-[var(--a-good)]" : "text-[var(--a-bad)]"}`}>
              {perOrder(grossProfit || 0)}
            </p>
            <p className="mt-0.5 text-xs text-[var(--a-muted)]">Average order value {perOrder(grossRevenue || 0)}</p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
