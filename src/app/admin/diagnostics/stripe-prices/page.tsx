"use client";

import { useState, useEffect } from "react";
import CandleSpinner from "@/components/CandleSpinner";

type PriceTestResult = {
  productName: string;
  productSlug: string;
  stripePriceId: string;
  websitePriceCents: number;
  isValid: boolean;
  error?: string;
  priceDetails?: {
    currency: string;
    unitAmount: number;
    active: boolean;
    mode: "test" | "live";
  };
};

type DiagnosticResponse = {
  mode: "test" | "live";
  summary: {
    total: number;
    valid: number;
    invalid: number;
    missing: number;
  };
  results: PriceTestResult[];
};

export default function StripePriceDiagnosticsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DiagnosticResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDiagnostics();
  }, []);

  async function loadDiagnostics() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/diagnostics/stripe-prices");
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to load diagnostics");
      }
      const diagnostics = await res.json();
      setData(diagnostics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load diagnostics");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="a-ui flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <CandleSpinner />
          <p className="text-sm font-medium text-[var(--a-ink)]">Loading…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="a-ui mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--a-ink)] sm:text-[2.125rem]">Stripe Price ID Diagnostics</h1>
        <div className="a-card p-6 bg-rose-50 border-rose-200">
          <p className="text-rose-700 font-medium">Error: {error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="a-ui mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--a-ink)] sm:text-[2.125rem]">Stripe Price ID Diagnostics</h1>
        <p className="mt-1.5 text-[15px] text-[var(--a-muted)]">No data available</p>
      </div>
    );
  }

  return (
    <div className="a-ui mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--a-ink)] sm:text-[2.125rem]">Stripe Price ID Diagnostics</h1>
        <div className="flex gap-3">
          <button
            onClick={loadDiagnostics}
            className="a-btn a-btn-primary"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Mode Warning */}
      <div className={`a-card mb-6 p-4 ${data.mode === "test" ? "bg-amber-50 border-amber-200" : "bg-[var(--a-canvas)] border-[var(--a-line)]"}`}>
        <p className={`font-medium ${data.mode === "test" ? "text-amber-700" : "text-[var(--a-ink)]"}`}>
          Current Mode: <strong className="uppercase">{data.mode}</strong>
        </p>
        <p className={`text-sm mt-1 ${data.mode === "test" ? "text-amber-600" : "text-[var(--a-muted)]"}`}>
          {data.mode === "test"
            ? "Using TEST mode Stripe API keys. All price IDs must exist in Stripe TEST mode."
            : "Using LIVE mode Stripe API keys. All price IDs must exist in Stripe LIVE mode."}
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="a-card p-5">
          <p className="text-sm text-[var(--a-muted)] mb-1">Total Products</p>
          <p className="text-2xl font-bold">{data.summary.total}</p>
        </div>
        <div className="a-card p-4 bg-green-50 border-green-200">
          <p className="text-sm text-green-700 mb-1">Valid Price IDs</p>
          <p className="text-2xl font-bold text-green-700">{data.summary.valid}</p>
        </div>
        <div className="a-card p-4 bg-rose-50 border-rose-200">
          <p className="text-sm text-rose-700 mb-1">Invalid Price IDs</p>
          <p className="text-2xl font-bold text-rose-700">{data.summary.invalid}</p>
        </div>
        <div className="a-card p-4 bg-amber-50 border-amber-200">
          <p className="text-sm text-amber-700 mb-1">Missing Price IDs</p>
          <p className="text-2xl font-bold text-amber-700">{data.summary.missing}</p>
        </div>
      </div>

      {/* Results Table */}
      <div className="a-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--a-line)] bg-[var(--a-canvas)]">
                <th className="text-left p-4 font-semibold text-sm">Product</th>
                <th className="text-left p-4 font-semibold text-sm">Price ID</th>
                <th className="text-left p-4 font-semibold text-sm">Website Price</th>
                <th className="text-left p-4 font-semibold text-sm">Stripe Price</th>
                <th className="text-left p-4 font-semibold text-sm">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((result, index) => {
                const pricesMatch = result.isValid && result.priceDetails
                  ? result.websitePriceCents === result.priceDetails.unitAmount
                  : false;

                return (
                  <tr
                    key={`${result.productSlug}-${index}`}
                    className="border-b border-[var(--a-line)] hover:bg-[var(--a-canvas)]"
                  >
                    <td className="p-4">
                      <div>
                        <p className="font-medium">{result.productName}</p>
                        <p className="text-xs text-[var(--a-muted)]">{result.productSlug}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <code className="text-xs bg-[var(--a-tint)] px-2 py-1 rounded">
                        {result.stripePriceId}
                      </code>
                    </td>
                    <td className="p-4">
                      <span className="text-sm font-medium">
                        ${(result.websitePriceCents / 100).toFixed(2)}
                      </span>
                    </td>
                    <td className="p-4">
                      {result.isValid && result.priceDetails ? (
                        <span className={`text-sm font-medium ${pricesMatch ? "" : "text-rose-600"}`}>
                          ${(result.priceDetails.unitAmount / 100).toFixed(2)}
                          {!pricesMatch && (
                            <span className="ml-2 text-xs bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">
                              MISMATCH
                            </span>
                          )}
                        </span>
                      ) : result.error ? (
                        <p className="text-xs text-rose-600">{result.error}</p>
                      ) : (
                        <p className="text-xs text-[var(--a-muted)]">-</p>
                      )}
                    </td>
                    <td className="p-4">
                      {result.isValid ? (
                        <div>
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded ${
                            pricesMatch
                              ? "text-green-700 bg-green-100"
                              : "text-amber-700 bg-amber-100"
                          }`}>
                            {pricesMatch ? "✓ Valid" : "⚠ Price Mismatch"}
                          </span>
                          {result.priceDetails && (
                            <p className="a-help">
                              {result.priceDetails.active ? "Active" : "Inactive"}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-700 bg-rose-100 px-2 py-1 rounded">
                          ✗ Invalid
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Help Section */}
      <div className="a-panel mt-6">
        <h2 className="font-semibold text-[var(--a-ink)] mb-2">How to Fix Invalid Price IDs</h2>
        <ol className="text-sm text-[var(--a-ink)] space-y-2 ml-4 list-decimal">
          <li>
            Check which Stripe mode you&apos;re in: <strong>{data.mode.toUpperCase()}</strong>
          </li>
          <li>
            Go to your Stripe Dashboard{" "}
            {data.mode === "test" ? (
              <a
                href="https://dashboard.stripe.com/test/products"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-medium"
              >
                (Test Mode)
              </a>
            ) : (
              <a
                href="https://dashboard.stripe.com/products"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-medium"
              >
                (Live Mode)
              </a>
            )}
          </li>
          <li>For each invalid price ID, either:
            <ul className="ml-4 mt-1 space-y-1">
              <li>• Create a new price in {data.mode} mode and update the product</li>
              <li>• Or switch your .env to use {data.mode === "test" ? "live" : "test"} mode keys</li>
            </ul>
          </li>
          <li>Update the price IDs in the Admin panel for each affected product</li>
        </ol>
      </div>
    </div>
  );
}
