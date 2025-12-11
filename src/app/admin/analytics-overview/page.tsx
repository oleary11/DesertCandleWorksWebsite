"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, DollarSign, TrendingUp, TrendingDown, Receipt, PieChart } from "lucide-react";

type SalesAnalytics = {
  totalRevenue: number;
  totalProductRevenue: number;
  totalShippingRevenue: number;
  totalTaxCollected: number;
  totalOrders: number;
  stripeFees: number;
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

export default function UnifiedAnalyticsPage() {
  const [salesData, setSalesData] = useState<SalesAnalytics | null>(null);
  const [purchaseData, setPurchaseData] = useState<PurchaseAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    try {
      setLoading(true);
      const [salesRes, purchasesRes] = await Promise.all([
        fetch("/api/admin/analytics"),
        fetch("/api/admin/purchases/analytics"),
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

  if (!salesData || !purchaseData) {
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

  // Calculate key metrics
  const grossRevenue = salesData.totalRevenue || 0;
  const totalCosts = purchaseData.totalSpent || 0;
  const stripeFees = salesData.stripeFees || 0;
  const netRevenue = grossRevenue - stripeFees;
  const grossProfit = netRevenue - totalCosts;
  const grossMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;

  // Product revenue only (excluding shipping and tax)
  const productRevenue = salesData.totalProductRevenue || 0;
  const productCosts = (purchaseData.totalSpent || 0) - (purchaseData.totalShipping || 0) - (purchaseData.totalTax || 0);
  const productProfit = productRevenue - productCosts;
  const productMargin = productRevenue > 0 ? (productProfit / productRevenue) * 100 : 0;

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
              <h1 className="text-3xl font-bold">Business Overview</h1>
              <p className="text-[var(--color-muted)] mt-1">
                Complete financial overview - revenue, costs, and profitability
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/admin/analytics"
                className="btn border border-[var(--color-line)] text-sm"
              >
                Sales Details
              </Link>
              <Link
                href="/admin/purchases/analytics"
                className="btn border border-[var(--color-line)] text-sm"
              >
                Purchase Details
              </Link>
            </div>
          </div>
        </div>

        {/* Top-Level Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Gross Revenue */}
          <div className="card p-6 bg-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-[var(--color-muted)]">Gross Revenue</span>
            </div>
            <p className="text-3xl font-bold">${((grossRevenue || 0) / 100).toFixed(2)}</p>
            <p className="text-xs text-[var(--color-muted)] mt-1">
              Products: ${((productRevenue || 0) / 100).toFixed(2)}<br/>
              Shipping: ${((salesData.totalShippingRevenue || 0) / 100).toFixed(2)} • Tax: ${((salesData.totalTaxCollected || 0) / 100).toFixed(2)}
            </p>
          </div>

          {/* Total Costs */}
          <div className="card p-6 bg-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <Receipt className="w-5 h-5 text-orange-600" />
              </div>
              <span className="text-sm font-medium text-[var(--color-muted)]">Total Costs</span>
            </div>
            <p className="text-3xl font-bold text-orange-600">${((totalCosts || 0) / 100).toFixed(2)}</p>
            <p className="text-xs text-[var(--color-muted)] mt-1">
              Products: ${((productCosts || 0) / 100).toFixed(2)}<br/>
              Shipping: ${((purchaseData.totalShipping || 0) / 100).toFixed(2)} • Tax: ${((purchaseData.totalTax || 0) / 100).toFixed(2)}
            </p>
          </div>

          {/* Net Profit */}
          <div className="card p-6 bg-white">
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-10 h-10 rounded-lg ${grossProfit >= 0 ? 'bg-green-100' : 'bg-red-100'} flex items-center justify-center`}>
                {grossProfit >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-green-600" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-600" />
                )}
              </div>
              <span className="text-sm font-medium text-[var(--color-muted)]">Net Profit</span>
            </div>
            <p className={`text-3xl font-bold ${grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${((grossProfit || 0) / 100).toFixed(2)}
            </p>
            <p className="text-xs text-[var(--color-muted)] mt-1">
              After COGS & Stripe fees<br/>
              Stripe fees: ${((stripeFees || 0) / 100).toFixed(2)}
            </p>
          </div>

          {/* Gross Margin */}
          <div className="card p-6 bg-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <PieChart className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-sm font-medium text-[var(--color-muted)]">Gross Margin</span>
            </div>
            <p className={`text-3xl font-bold ${grossMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {(grossMargin || 0).toFixed(1)}%
            </p>
            <p className="text-xs text-[var(--color-muted)] mt-1">
              Net revenue vs costs<br/>
              Product margin: {(productMargin || 0).toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Detailed Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Revenue Breakdown */}
          <div className="card p-6 bg-white">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="w-5 h-5 text-[var(--color-accent)]" />
              <h2 className="text-xl font-bold">Revenue Breakdown</h2>
            </div>

            <div className="space-y-4">
              <div className="border-b border-[var(--color-line)] pb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Gross Revenue</span>
                  <span className="text-lg font-bold text-blue-600">${((grossRevenue || 0) / 100).toFixed(2)}</span>
                </div>
                <p className="text-xs text-[var(--color-muted)]">{salesData.totalOrders || 0} orders</p>
              </div>

              <div className="border-b border-[var(--color-line)] pb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Product Sales</span>
                  <span className="text-lg font-bold">${((productRevenue || 0) / 100).toFixed(2)}</span>
                </div>
                <div className="w-full bg-neutral-100 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${grossRevenue > 0 ? ((productRevenue || 0) / grossRevenue) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div className="border-b border-[var(--color-line)] pb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Shipping Revenue</span>
                  <span className="text-lg font-bold">${((salesData.totalShippingRevenue || 0) / 100).toFixed(2)}</span>
                </div>
                <div className="w-full bg-neutral-100 rounded-full h-2">
                  <div
                    className="bg-sky-500 h-2 rounded-full transition-all"
                    style={{ width: `${grossRevenue > 0 ? ((salesData.totalShippingRevenue || 0) / grossRevenue) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div className="border-b border-[var(--color-line)] pb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Tax Collected</span>
                  <span className="text-lg font-bold">${((salesData.totalTaxCollected || 0) / 100).toFixed(2)}</span>
                </div>
                <div className="w-full bg-neutral-100 rounded-full h-2">
                  <div
                    className="bg-indigo-500 h-2 rounded-full transition-all"
                    style={{ width: `${grossRevenue > 0 ? ((salesData.totalTaxCollected || 0) / grossRevenue) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div className="pt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-red-600">Stripe Fees</span>
                  <span className="text-lg font-bold text-red-600">-${((stripeFees || 0) / 100).toFixed(2)}</span>
                </div>
                <p className="text-xs text-[var(--color-muted)]">~{grossRevenue > 0 ? (((stripeFees || 0) / grossRevenue) * 100).toFixed(2) : 0}% of gross revenue</p>
              </div>

              <div className="pt-2 border-t-2 border-[var(--color-line)]">
                <div className="flex items-center justify-between">
                  <span className="font-bold">Net Revenue</span>
                  <span className="text-xl font-bold text-green-600">${((netRevenue || 0) / 100).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Cost Breakdown */}
          <div className="card p-6 bg-white">
            <div className="flex items-center gap-2 mb-4">
              <Receipt className="w-5 h-5 text-[var(--color-accent)]" />
              <h2 className="text-xl font-bold">Cost Breakdown</h2>
            </div>

            <div className="space-y-4">
              <div className="border-b border-[var(--color-line)] pb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Total Spent</span>
                  <span className="text-lg font-bold text-orange-600">${((totalCosts || 0) / 100).toFixed(2)}</span>
                </div>
                <p className="text-xs text-[var(--color-muted)]">{purchaseData.totalPurchases || 0} purchase orders</p>
              </div>

              <div className="border-b border-[var(--color-line)] pb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Product Costs</span>
                  <span className="text-lg font-bold">${((productCosts || 0) / 100).toFixed(2)}</span>
                </div>
                <div className="w-full bg-neutral-100 rounded-full h-2">
                  <div
                    className="bg-orange-500 h-2 rounded-full transition-all"
                    style={{ width: `${totalCosts > 0 ? ((productCosts || 0) / totalCosts) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div className="border-b border-[var(--color-line)] pb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Shipping Costs</span>
                  <span className="text-lg font-bold">${((purchaseData.totalShipping || 0) / 100).toFixed(2)}</span>
                </div>
                <div className="w-full bg-neutral-100 rounded-full h-2">
                  <div
                    className="bg-amber-500 h-2 rounded-full transition-all"
                    style={{ width: `${totalCosts > 0 ? ((purchaseData.totalShipping || 0) / totalCosts) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div className="border-b border-[var(--color-line)] pb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Purchase Tax</span>
                  <span className="text-lg font-bold">${((purchaseData.totalTax || 0) / 100).toFixed(2)}</span>
                </div>
                <div className="w-full bg-neutral-100 rounded-full h-2">
                  <div
                    className="bg-yellow-500 h-2 rounded-full transition-all"
                    style={{ width: `${totalCosts > 0 ? ((purchaseData.totalTax || 0) / totalCosts) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div className="pt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Cost per Order</span>
                  <span className="text-lg font-bold text-[var(--color-muted)]">
                    ${(salesData.totalOrders || 0) > 0 ? ((totalCosts || 0) / salesData.totalOrders / 100).toFixed(2) : '0.00'}
                  </span>
                </div>
                <p className="text-xs text-[var(--color-muted)]">Average cost of goods per order</p>
              </div>

              <div className="pt-2 border-t-2 border-[var(--color-line)]">
                <div className="flex items-center justify-between">
                  <span className="font-bold">Revenue per Order</span>
                  <span className="text-xl font-bold text-green-600">
                    ${(salesData.totalOrders || 0) > 0 ? ((productRevenue || 0) / salesData.totalOrders / 100).toFixed(2) : '0.00'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Profitability Summary */}
        <div className="card p-6 bg-white">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-[var(--color-accent)]" />
            <h2 className="text-xl font-bold">Profitability Summary</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-6 bg-blue-50 rounded-lg">
              <p className="text-sm text-[var(--color-muted)] mb-2">Product Profit</p>
              <p className={`text-3xl font-bold ${productProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${((productProfit || 0) / 100).toFixed(2)}
              </p>
              <p className="text-xs text-[var(--color-muted)] mt-1">
                {(productMargin || 0).toFixed(1)}% margin
              </p>
              <p className="text-xs text-[var(--color-muted)] mt-2">
                Product revenue minus product costs
              </p>
            </div>

            <div className="text-center p-6 bg-purple-50 rounded-lg">
              <p className="text-sm text-[var(--color-muted)] mb-2">Net Profit</p>
              <p className={`text-3xl font-bold ${grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${((grossProfit || 0) / 100).toFixed(2)}
              </p>
              <p className="text-xs text-[var(--color-muted)] mt-1">
                {(grossMargin || 0).toFixed(1)}% margin
              </p>
              <p className="text-xs text-[var(--color-muted)] mt-2">
                After all costs & fees
              </p>
            </div>

            <div className="text-center p-6 bg-green-50 rounded-lg">
              <p className="text-sm text-[var(--color-muted)] mb-2">Profit per Order</p>
              <p className={`text-3xl font-bold ${grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${(salesData.totalOrders || 0) > 0 ? ((grossProfit || 0) / salesData.totalOrders / 100).toFixed(2) : '0.00'}
              </p>
              <p className="text-xs text-[var(--color-muted)] mt-1">
                Average per transaction
              </p>
              <p className="text-xs text-[var(--color-muted)] mt-2">
                Net profit ÷ total orders
              </p>
            </div>
          </div>

          <div className="mt-6 p-4 bg-neutral-50 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-[var(--color-muted)]">Orders:</span>
                <p className="font-bold">{salesData.totalOrders || 0}</p>
              </div>
              <div>
                <span className="text-[var(--color-muted)]">Purchases:</span>
                <p className="font-bold">{purchaseData.totalPurchases || 0}</p>
              </div>
              <div>
                <span className="text-[var(--color-muted)]">Avg Order Value:</span>
                <p className="font-bold">${(salesData.totalOrders || 0) > 0 ? ((grossRevenue || 0) / salesData.totalOrders / 100).toFixed(2) : '0.00'}</p>
              </div>
              <div>
                <span className="text-[var(--color-muted)]">Avg Purchase Cost:</span>
                <p className="font-bold">${(purchaseData.totalPurchases || 0) > 0 ? ((totalCosts || 0) / purchaseData.totalPurchases / 100).toFixed(2) : '0.00'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
