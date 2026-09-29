"use client";

import { useEffect, useState, useCallback } from "react";
import PageHeader from "../_components/PageHeader";
import { Panel, RankedBars, Segmented, Stat } from "../_components/ui";
import USStateHeatMap from "@/components/USStateHeatMap";
import CandleSpinner from "@/components/CandleSpinner";

type DayPreset = 1 | 7 | 30 | 90;

type TrafficData = {
  summary: {
    totalPageViews: number;
    uniqueSessions: number;
    avgPagesPerSession: number;
    avgPageSeconds: number;
  };
  topPages: Array<{ path: string; views: number; percentage: number }>;
  topProducts: Array<{ path: string; slug: string; views: number; avgSeconds: number }>;
  stateTimes: Record<string, number>;
  byHour: Array<{ hour: number; views: number }>;
  byDayOfWeek: Array<{ day: number; label: string; views: number }>;
  topCountries: Array<{ country: string; views: number; percentage: number }>;
  topRegions: Array<{ region: string; country: string; views: number }>;
  topCities: Array<{ city: string; region: string; visitors: number; avgSeconds: number }>;
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

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "--";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

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
  const [humanOnly, setHumanOnly] = useState(true);

  const fetchData = useCallback(async (d: DayPreset, human: boolean) => {
    setLoading(true);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const url = `/api/admin/traffic?days=${d}&tz=${encodeURIComponent(tz)}${human ? "&humanOnly=1" : ""}`;
      const res = await fetch(url);
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
    fetchData(days, humanOnly);
  }, [days, humanOnly, fetchData]);

  const maxHourViews = data ? Math.max(...data.byHour.map((h) => h.views), 1) : 1;
  const peakHour = data?.byHour.reduce((best, h) => (h.views > best.views ? h : best), { hour: 0, views: 0 });

  return (
    <div className="a-ui mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader title="Traffic" description="First-party visitor tracking. No third-party services." />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Segmented
          label="Time range"
          value={String(days) as "1" | "7" | "30" | "90"}
          onChange={(v) => setDays(Number(v) as DayPreset)}
          options={[
            { value: "1", label: "Today" },
            { value: "7", label: "7 days" },
            { value: "30", label: "30 days" },
            { value: "90", label: "90 days" },
          ]}
        />
        <label
          className="flex cursor-pointer items-center gap-2 text-sm text-[var(--a-ink)]"
          title="Hides sessions with less than 3 seconds on page (bot drive-bys)"
        >
          <input type="checkbox" className="a-check" checked={humanOnly} onChange={(e) => setHumanOnly(e.target.checked)} />
          Engaged visitors only
        </label>
        {loading && data && (
          <span role="status" className="text-sm text-[var(--a-muted)]">
            Updating…
          </span>
        )}
      </div>

      {loading && !data ? (
        <div className="flex flex-col items-center justify-center gap-4 py-16">
          <CandleSpinner />
          <p className="text-sm font-medium text-[var(--a-muted)]">Loading…</p>
        </div>
      ) : !data ? (
        <div role="alert" className="a-card px-6 py-12 text-center text-sm text-[var(--a-muted)]">
          Couldn&apos;t load traffic data. Refresh to try again.
        </div>
      ) : (
        <div className={`space-y-6 transition-opacity ${loading ? "opacity-60" : ""}`}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Visitors" value={data.summary.uniqueSessions.toLocaleString()} hint="Unique sessions" />
            <Stat label="Page views" value={data.summary.totalPageViews.toLocaleString()} />
            <Stat label="Pages per visit" value={data.summary.avgPagesPerSession} />
            <Stat label="Time on page" value={formatDuration(data.summary.avgPageSeconds)} hint="Average" />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Panel title="Top pages" description="By views">
              <RankedBars
                format={(v) => v.toLocaleString()}
                items={data.topPages.map((p) => ({ label: p.path, value: p.views, sub: `${p.percentage}%` }))}
              />
            </Panel>
            <Panel title="Most viewed products" description="Views · average time on page">
              <RankedBars
                format={(v) => v.toLocaleString()}
                items={data.topProducts.map((p) => ({
                  label: p.slug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
                  value: p.views,
                  sub: p.avgSeconds > 0 ? formatDuration(p.avgSeconds) : undefined,
                }))}
              />
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Panel
              title="Visits by hour"
              description={peakHour && peakHour.views > 0 ? `Busiest around ${formatHour(peakHour.hour)}` : "Your local time"}
            >
              <div className="flex h-36 items-end gap-[2px]" role="img" aria-label="Page views by hour of day">
                {data.byHour.map(({ hour, views }) => (
                  <div key={hour} className="group relative flex h-full flex-1 items-end" title={`${formatHour(hour)}: ${views} views`}>
                    <div
                      className="w-full rounded-t-[4px] bg-[var(--a-viz-single)] transition-opacity group-hover:opacity-75"
                      style={{ height: `${(views / maxHourViews) * 100}%`, minHeight: views > 0 ? 2 : 0 }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-between border-t border-[var(--a-line)] pt-1.5 text-xs text-[var(--a-muted)]">
                <span>12 AM</span>
                <span>6 AM</span>
                <span>12 PM</span>
                <span>6 PM</span>
                <span>11 PM</span>
              </div>
            </Panel>

            <Panel title="Visits by day of week">
              <RankedBars
                limit={7}
                sort={false}
                format={(v) => v.toLocaleString()}
                items={data.byDayOfWeek.map((d) => ({ label: d.label, value: d.views }))}
              />
            </Panel>
          </div>

          <Panel title="Visitors by US state" description="Unique visitors">
            {data.topRegions.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--a-muted)]">No state data yet. Location data only comes through on the live site.</p>
            ) : (
              <USStateHeatMap regions={data.topRegions} stateTimes={data.stateTimes} />
            )}
          </Panel>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Panel title="Top countries" description="By views">
              {data.topCountries.length === 0 ? (
                <p className="py-6 text-center text-sm text-[var(--a-muted)]">No location data yet.</p>
              ) : (
                <RankedBars
                  format={(v) => v.toLocaleString()}
                  items={data.topCountries.map((c) => ({ label: COUNTRY_NAMES[c.country] ?? c.country, value: c.views, sub: `${c.percentage}%` }))}
                />
              )}
            </Panel>
            <Panel title="Top US cities" description="Unique visitors · average time on page">
              {data.topCities.length === 0 ? (
                <p className="py-6 text-center text-sm text-[var(--a-muted)]">No city data yet.</p>
              ) : (
                <RankedBars
                  format={(v) => v.toLocaleString()}
                  items={data.topCities.map((c) => ({
                    label: c.region ? `${c.city}, ${c.region}` : c.city,
                    value: c.visitors,
                    sub: c.avgSeconds > 0 ? formatDuration(c.avgSeconds) : undefined,
                  }))}
                />
              )}
            </Panel>
          </div>

          <Panel title="Cart abandonment" description={`Sessions in the last ${days} ${days === 1 ? "day" : "days"}`}>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { label: "Added to cart", value: data.cartEvents.addToCartSessions.toLocaleString() },
                { label: "Started checkout", value: data.cartEvents.checkoutStartedSessions.toLocaleString() },
                { label: "Abandoned", value: data.cartEvents.abandonedSessions.toLocaleString() },
                { label: "Abandonment rate", value: `${data.cartEvents.abandonmentRate}%` },
              ].map((s) => (
                <div key={s.label} className="a-panel">
                  <p className="text-xs font-medium text-[var(--a-muted)]">{s.label}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--a-ink)]">{s.value}</p>
                </div>
              ))}
            </div>
            {data.cartEvents.addToCartSessions === 0 && (
              <p className="mt-4 text-center text-sm text-[var(--a-muted)]">No cart activity yet in this period.</p>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
