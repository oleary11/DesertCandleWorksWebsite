"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, TrendingUp, DollarSign, Package, ShoppingCart } from "lucide-react";

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

type AnalyticsData = {
  totalRevenue: number;
  totalOrders: number;
  totalUnits: number;
  averageOrderValue: number;
  productSales: Array<{
    slug: string;
    name: string;
    units: number;
    revenue: number;
    alcoholType?: string;
  }>;
  alcoholTypeSales: Array<{
    name: string;
    units: number;
    revenue: number;
  }>;
  profitMargins: Array<{
    slug: string;
    name: string;
    revenue: number;
    cost: number;
    profit: number;
    marginPercent: number;
  }>;
};

export default function AdminAnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    try {
      const res = await fetch("/api/admin/analytics");
      if (!res.ok) {
        throw new Error("Failed to load analytics");
      }
      const data = await res.json();
      setAnalytics(data);
    } catch (err) {
      setError("Failed to load analytics data");
      console.error(err);
    } finally {
      setLoading(false);
    }
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
          <Link href="/admin" className="btn mt-4">
            Back to Admin
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
            href="/admin"
            className="inline-flex items-center gap-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)] mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Admin
          </Link>
          <h1 className="text-3xl font-bold">Sales Analytics</h1>
          <p className="text-[var(--color-muted)] mt-1">
            Overview of your business performance and profitability
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="card p-6 bg-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-sm font-medium text-[var(--color-muted)]">Total Revenue</span>
            </div>
            <p className="text-3xl font-bold">${(analytics.totalRevenue / 100).toFixed(2)}</p>
          </div>

          <div className="card p-6 bg-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-[var(--color-muted)]">Total Orders</span>
            </div>
            <p className="text-3xl font-bold">{analytics.totalOrders}</p>
          </div>

          <div className="card p-6 bg-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Package className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-sm font-medium text-[var(--color-muted)]">Units Sold</span>
            </div>
            <p className="text-3xl font-bold">{analytics.totalUnits}</p>
          </div>

          <div className="card p-6 bg-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-sm font-medium text-[var(--color-muted)]">Avg Order Value</span>
            </div>
            <p className="text-3xl font-bold">${(analytics.averageOrderValue / 100).toFixed(2)}</p>
          </div>
        </div>

        {/* Best Selling Products */}
        <div className="card p-6 bg-white mb-8">
          <h2 className="text-xl font-bold mb-4">Best Selling Products</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-line)]">
                  <th className="text-left py-3 text-sm font-semibold">Product</th>
                  <th className="text-left py-3 text-sm font-semibold">Alcohol Type</th>
                  <th className="text-right py-3 text-sm font-semibold">Units Sold</th>
                  <th className="text-right py-3 text-sm font-semibold">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {analytics.productSales.slice(0, 10).map((product) => (
                  <tr key={product.slug} className="border-b border-[var(--color-line)]">
                    <td className="py-3 text-sm">{product.name}</td>
                    <td className="py-3 text-sm text-[var(--color-muted)]">
                      {product.alcoholType || "N/A"}
                    </td>
                    <td className="py-3 text-sm text-right font-medium">{product.units}</td>
                    <td className="py-3 text-sm text-right font-medium">
                      ${(product.revenue / 100).toFixed(2)}
                    </td>
                  </tr>
                ))}
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

        {/* Profit Margins */}
        {analytics.profitMargins.length > 0 && (
          <div className="card p-6 bg-white">
            <h2 className="text-xl font-bold mb-4">Profit Margins</h2>
            <p className="text-sm text-[var(--color-muted)] mb-4">
              Products with cost data configured
            </p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--color-line)]">
                    <th className="text-left py-3 text-sm font-semibold">Product</th>
                    <th className="text-right py-3 text-sm font-semibold">Revenue</th>
                    <th className="text-right py-3 text-sm font-semibold">Cost</th>
                    <th className="text-right py-3 text-sm font-semibold">Profit</th>
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
