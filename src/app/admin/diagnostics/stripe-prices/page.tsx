"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type PriceTestResult = {
  productName: string;
  productSlug: string;
  stripePriceId: string;
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
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6">Stripe Price ID Diagnostics</h1>
        <p className="text-[var(--color-muted)]">Loading diagnostics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6">Stripe Price ID Diagnostics</h1>
        <div className="card p-6 bg-rose-50 border-rose-200">
          <p className="text-rose-700 font-medium">Error: {error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6">Stripe Price ID Diagnostics</h1>
        <p className="text-[var(--color-muted)]">No data available</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Stripe Price ID Diagnostics</h1>
        <div className="flex gap-3">
          <button
            onClick={loadDiagnostics}
            className="btn btn-primary text-sm"
          >
            Refresh
          </button>
          <Link href="/admin" className="btn text-sm">
            Back to Admin
          </Link>
        </div>
      </div>

      {/* Mode Warning */}
      <div className={`card p-4 mb-6 ${data.mode === "test" ? "bg-amber-50 border-amber-200" : "bg-blue-50 border-blue-200"}`}>
        <p className={`font-medium ${data.mode === "test" ? "text-amber-700" : "text-blue-700"}`}>
          Current Mode: <strong className="uppercase">{data.mode}</strong>
        </p>
        <p className={`text-sm mt-1 ${data.mode === "test" ? "text-amber-600" : "text-blue-600"}`}>
          {data.mode === "test"
            ? "Using TEST mode Stripe API keys. All price IDs must exist in Stripe TEST mode."
            : "Using LIVE mode Stripe API keys. All price IDs must exist in Stripe LIVE mode."}
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="card p-4">
          <p className="text-sm text-[var(--color-muted)] mb-1">Total Products</p>
          <p className="text-2xl font-bold">{data.summary.total}</p>
        </div>
        <div className="card p-4 bg-green-50 border-green-200">
          <p className="text-sm text-green-700 mb-1">Valid Price IDs</p>
          <p className="text-2xl font-bold text-green-700">{data.summary.valid}</p>
        </div>
        <div className="card p-4 bg-rose-50 border-rose-200">
          <p className="text-sm text-rose-700 mb-1">Invalid Price IDs</p>
          <p className="text-2xl font-bold text-rose-700">{data.summary.invalid}</p>
        </div>
        <div className="card p-4 bg-amber-50 border-amber-200">
          <p className="text-sm text-amber-700 mb-1">Missing Price IDs</p>
          <p className="text-2xl font-bold text-amber-700">{data.summary.missing}</p>
        </div>
      </div>

      {/* Results Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-line)] bg-neutral-50">
                <th className="text-left p-4 font-semibold text-sm">Product</th>
                <th className="text-left p-4 font-semibold text-sm">Price ID</th>
                <th className="text-left p-4 font-semibold text-sm">Status</th>
                <th className="text-left p-4 font-semibold text-sm">Details</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((result, index) => (
                <tr
                  key={`${result.productSlug}-${index}`}
                  className="border-b border-[var(--color-line)] hover:bg-neutral-50"
                >
                  <td className="p-4">
                    <div>
                      <p className="font-medium">{result.productName}</p>
                      <p className="text-xs text-[var(--color-muted)]">{result.productSlug}</p>
                    </div>
                  </td>
                  <td className="p-4">
                    <code className="text-xs bg-neutral-100 px-2 py-1 rounded">
                      {result.stripePriceId}
                    </code>
                  </td>
                  <td className="p-4">
                    {result.isValid ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded">
                        ✓ Valid
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-700 bg-rose-100 px-2 py-1 rounded">
                        ✗ Invalid
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    {result.isValid && result.priceDetails ? (
                      <div className="text-sm">
                        <p className="text-[var(--color-muted)]">
                          {result.priceDetails.currency.toUpperCase()} ${(result.priceDetails.unitAmount / 100).toFixed(2)}
                        </p>
                        <p className="text-xs text-[var(--color-muted)]">
                          {result.priceDetails.active ? "Active" : "Inactive"}
                        </p>
                      </div>
                    ) : result.error ? (
                      <p className="text-xs text-rose-600">{result.error}</p>
                    ) : (
                      <p className="text-xs text-[var(--color-muted)]">-</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Help Section */}
      <div className="card p-6 mt-6 bg-blue-50 border-blue-200">
        <h2 className="font-semibold text-blue-900 mb-2">How to Fix Invalid Price IDs</h2>
        <ol className="text-sm text-blue-800 space-y-2 ml-4 list-decimal">
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
