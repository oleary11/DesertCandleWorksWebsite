"use client";

import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { Stat } from "../_components/ui";

type WelcomeStats = {
  shown: number;
  since: string | null;
  signups: number;
  signupsThisWeek: number;
  used: number;
  salesCents: number;
  offerOn: boolean;
};

const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "–");

/**
 * Results of the 10%-off welcome popup. Each signup's single-use code is a promotion of
 * its own; they're summed up here instead of listed one by one.
 */
export default function WelcomeResults() {
  const [stats, setStats] = useState<WelcomeStats | null>(null);

  useEffect(() => {
    fetch("/api/admin/welcome-stats")
      .then((res) => (res.ok ? res.json() : null))
      .then(setStats)
      .catch(() => {});
  }, []);

  if (!stats) return null;

  return (
    <section className="a-card mb-6 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="a-icon-tile h-9 w-9">
            <Mail className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </span>
          <div>
            <p className="font-medium text-[var(--a-ink)]">Welcome popup: 10% off for signing up</p>
            <p className="text-xs text-[var(--a-muted)]">
              {stats.offerOn ? "On" : "Off"}
              {stats.since ? ` · counting since ${new Date(stats.since).toLocaleDateString()}` : ""} · each signup gets
              its own single-use code by email
            </p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Popup shown" value={stats.shown.toLocaleString()} />
        <Stat
          label="Signups"
          value={stats.signups.toLocaleString()}
          hint={`${pct(stats.signups, stats.shown)} of views · ${stats.signupsThisWeek} this week`}
        />
        <Stat label="Codes used" value={stats.used.toLocaleString()} hint={`${pct(stats.used, stats.signups)} of signups`} />
        <Stat label="Sales from codes" value={`$${(stats.salesCents / 100).toFixed(2)}`} hint="Order totals" />
      </div>
    </section>
  );
}
