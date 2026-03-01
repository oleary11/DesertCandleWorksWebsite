"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Globe,
  MapPin,
  Eye,
  Users,
  TrendingUp,
  ShoppingCart,
  Clock,
  FileText,
  Package,
} from "lucide-react";

type DayPreset = 1 | 7 | 30 | 90;

type TrafficData = {
  summary: {
    totalPageViews: number;
    uniqueSessions: number;
    avgPagesPerSession: number;
  };
  topPages: Array<{ path: string; views: number; percentage: number }>;
  topProducts: Array<{ path: string; slug: string; views: number }>;
  byHour: Array<{ hour: number; views: number }>;
  byDayOfWeek: Array<{ day: number; label: string; views: number }>;
  topCountries: Array<{ country: string; views: number; percentage: number }>;
  topRegions: Array<{ region: string; country: string; views: number }>;
  cartEvents: {
    addToCartSessions: number;
    checkoutStartedSessions: number;
    abandonedSessions: number;
    abandonmentRate: number;
  };
};

const COUNTRY_NAMES: Record<string, string> = {
  US: "United States",
  CA: "Canada",
  GB: "United Kingdom",
  AU: "Australia",
  DE: "Germany",
  FR: "France",
  MX: "Mexico",
  JP: "Japan",
  NL: "Netherlands",
  SE: "Sweden",
  NO: "Norway",
  BR: "Brazil",
  IN: "India",
  SG: "Singapore",
  NZ: "New Zealand",
};

function formatHour(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
}

export default function TrafficAnalyticsPage() {
  const [data, setData] = useState<TrafficData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<DayPreset>(30);

  const fetchData = useCallback(async (d: DayPreset) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/traffic?days=${d}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setData(json);
    } catch {
      // Silently fail — no data to display
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(days);
  }, [days, fetchData]);

  const maxHourViews = data
    ? Math.max(...data.byHour.map((h) => h.views), 1)
    : 1;
  const maxDayViews = data
    ? Math.max(...data.byDayOfWeek.map((d) => d.views), 1)
    : 1;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)] transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-ink)]">
            Traffic Analytics
          </h1>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            First-party visitor tracking — no third-party services
          </p>
        </div>

        {/* Date range selector */}
        <div className="flex gap-2 flex-wrap">
          {([1, 7, 30, 90] as DayPreset[]).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                days === d
                  ? "bg-teal-600 text-white"
                  : "bg-white border border-[var(--color-line)] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              {d === 1 ? "Today" : d === 7 ? "7 days" : d === 30 ? "30 days" : "90 days"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-[var(--color-muted)]">
          Loading traffic data…
        </div>
      ) : !data ? (
        <div className="card p-8 text-center text-[var(--color-muted)]">
          Failed to load traffic data. Please try again.
        </div>
      ) : (
        <div className="space-y-6">
          {/* KPI Summary Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-lg bg-teal-100 flex items-center justify-center">
                  <Users className="w-5 h-5 text-teal-600" />
                </div>
                <span className="text-sm text-[var(--color-muted)]">
                  Unique Visitors
                </span>
              </div>
              <p className="text-2xl font-bold">
                {data.summary.uniqueSessions.toLocaleString()}
              </p>
            </div>

            <div className="card p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Eye className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-sm text-[var(--color-muted)]">
                  Page Views
                </span>
              </div>
              <p className="text-2xl font-bold">
                {data.summary.totalPageViews.toLocaleString()}
              </p>
            </div>

            <div className="card p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                </div>
                <span className="text-sm text-[var(--color-muted)]">
                  Pages / Session
                </span>
              </div>
              <p className="text-2xl font-bold">
                {data.summary.avgPagesPerSession}
              </p>
            </div>

            <div className="card p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-lg bg-rose-100 flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-rose-600" />
                </div>
                <span className="text-sm text-[var(--color-muted)]">
                  Cart Abandonment
                </span>
              </div>
              <p className="text-2xl font-bold">
                {data.cartEvents.abandonmentRate}%
              </p>
            </div>
          </div>

          {/* Top Pages + Top Products */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Pages */}
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-[var(--color-muted)]" />
                <h2 className="font-semibold">Top Pages</h2>
              </div>
              {data.topPages.length === 0 ? (
                <p className="text-sm text-[var(--color-muted)]">
                  No page view data yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {data.topPages.map((page) => (
                    <div key={page.path}>
                      <div className="flex justify-between text-sm mb-1">
                        <span
                          className="text-[var(--color-ink)] truncate max-w-[75%] font-mono text-xs"
                          title={page.path}
                        >
                          {page.path}
                        </span>
                        <span className="text-[var(--color-muted)] shrink-0 ml-2">
                          {page.views.toLocaleString()} ({page.percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-[var(--color-line)] rounded-full h-1.5">
                        <div
                          className="bg-teal-500 h-1.5 rounded-full"
                          style={{ width: `${page.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Products */}
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Package className="w-5 h-5 text-[var(--color-muted)]" />
                <h2 className="font-semibold">Top Viewed Products</h2>
              </div>
              {data.topProducts.length === 0 ? (
                <p className="text-sm text-[var(--color-muted)]">
                  No product view data yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {data.topProducts.map((product, idx) => (
                    <div
                      key={product.slug}
                      className="flex items-center gap-3 text-sm"
                    >
                      <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold shrink-0">
                        {idx + 1}
                      </span>
                      <span className="flex-1 text-[var(--color-ink)] truncate">
                        {product.slug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                      </span>
                      <span className="text-[var(--color-muted)] shrink-0">
                        {product.views.toLocaleString()} views
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Hourly & Day-of-Week */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Visits by Hour */}
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-[var(--color-muted)]" />
                <h2 className="font-semibold">Visits by Hour of Day</h2>
              </div>
              <div className="flex items-end gap-1 h-32">
                {data.byHour.map(({ hour, views }) => {
                  const heightPct =
                    maxHourViews > 0
                      ? Math.round((views / maxHourViews) * 100)
                      : 0;
                  return (
                    <div
                      key={hour}
                      className="flex-1 flex flex-col items-center gap-0.5 group"
                      title={`${formatHour(hour)}: ${views} views`}
                    >
                      <div className="w-full flex items-end justify-center h-28">
                        <div
                          className="w-full bg-teal-400 group-hover:bg-teal-500 rounded-t-sm transition-colors"
                          style={{ height: `${heightPct}%`, minHeight: views > 0 ? 2 : 0 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-[var(--color-muted)] mt-1">
                <span>12 AM</span>
                <span>6 AM</span>
                <span>12 PM</span>
                <span>6 PM</span>
                <span>11 PM</span>
              </div>
            </div>

            {/* Visits by Day of Week */}
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-[var(--color-muted)]" />
                <h2 className="font-semibold">Visits by Day of Week</h2>
              </div>
              <div className="space-y-2">
                {data.byDayOfWeek.map(({ label, views }) => {
                  const pct =
                    maxDayViews > 0
                      ? Math.round((views / maxDayViews) * 100)
                      : 0;
                  return (
                    <div key={label} className="flex items-center gap-3 text-sm">
                      <span className="w-8 text-[var(--color-muted)] shrink-0">
                        {label}
                      </span>
                      <div className="flex-1 bg-[var(--color-line)] rounded-full h-2">
                        <div
                          className="bg-teal-400 h-2 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-12 text-right text-[var(--color-muted)] shrink-0">
                        {views.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Geography */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Countries */}
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="w-5 h-5 text-[var(--color-muted)]" />
                <h2 className="font-semibold">Top Countries</h2>
              </div>
              {data.topCountries.length === 0 ? (
                <p className="text-sm text-[var(--color-muted)]">
                  No geographic data yet. Geo data requires Vercel deployment.
                </p>
              ) : (
                <div className="space-y-3">
                  {data.topCountries.map((row) => (
                    <div key={row.country}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-[var(--color-ink)]">
                          {COUNTRY_NAMES[row.country] ?? row.country}
                        </span>
                        <span className="text-[var(--color-muted)]">
                          {row.views.toLocaleString()} ({row.percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-[var(--color-line)] rounded-full h-1.5">
                        <div
                          className="bg-blue-400 h-1.5 rounded-full"
                          style={{ width: `${row.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top US States */}
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-5 h-5 text-[var(--color-muted)]" />
                <h2 className="font-semibold">Top US States</h2>
              </div>
              {data.topRegions.length === 0 ? (
                <p className="text-sm text-[var(--color-muted)]">
                  No US state data yet. Geo data requires Vercel deployment.
                </p>
              ) : (
                <div className="space-y-2">
                  {data.topRegions.map((row) => (
                    <div
                      key={row.region}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-[var(--color-ink)]">
                        {row.region}
                      </span>
                      <span className="text-[var(--color-muted)]">
                        {row.views.toLocaleString()} views
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Cart Abandonment */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-5">
              <ShoppingCart className="w-5 h-5 text-[var(--color-muted)]" />
              <h2 className="font-semibold">Cart Abandonment</h2>
              <span className="ml-auto text-xs text-[var(--color-muted)]">
                Sessions in last {days} {days === 1 ? "day" : "days"}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-[var(--color-bg)] rounded-xl border border-[var(--color-line)]">
                <p className="text-2xl font-bold">
                  {data.cartEvents.addToCartSessions.toLocaleString()}
                </p>
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  Added to Cart
                </p>
              </div>
              <div className="text-center p-4 bg-[var(--color-bg)] rounded-xl border border-[var(--color-line)]">
                <p className="text-2xl font-bold">
                  {data.cartEvents.checkoutStartedSessions.toLocaleString()}
                </p>
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  Started Checkout
                </p>
              </div>
              <div className="text-center p-4 bg-[var(--color-bg)] rounded-xl border border-[var(--color-line)]">
                <p className="text-2xl font-bold text-rose-600">
                  {data.cartEvents.abandonedSessions.toLocaleString()}
                </p>
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  Abandoned
                </p>
              </div>
              <div className="text-center p-4 bg-[var(--color-bg)] rounded-xl border border-[var(--color-line)]">
                <p className={`text-2xl font-bold ${data.cartEvents.abandonmentRate > 70 ? "text-rose-600" : data.cartEvents.abandonmentRate > 40 ? "text-amber-600" : "text-green-600"}`}>
                  {data.cartEvents.abandonmentRate}%
                </p>
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  Abandonment Rate
                </p>
              </div>
            </div>

            {data.cartEvents.addToCartSessions === 0 && (
              <p className="text-sm text-[var(--color-muted)] text-center mt-4">
                No cart event data yet. Data will populate once customers interact with the store.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
