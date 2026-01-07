"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type CatalogTestResult = {
  productName: string;
  productSlug: string;
  squareCatalogId: string;
  isValid: boolean;
  error?: string;
  catalogDetails?: {
    name: string;
    priceAmount?: number;
    priceCurrency?: string;
    active: boolean;
    mode: "sandbox" | "production";
  };
};

type DiagnosticResponse = {
  mode: "sandbox" | "production";
  summary: {
    total: number;
    valid: number;
    invalid: number;
    missing: number;
  };
  results: CatalogTestResult[];
};

type MappingDiagnostic = {
  productName: string;
  productSlug: string;
  squareCatalogId: string | undefined;
  hasVariantMapping: boolean;
  mappingCount: number;
  websiteVariantCount: number;
  status: "ready" | "missing_catalog_id" | "missing_mapping" | "partial_mapping";
};

type MappingDiagnosticResponse = {
  summary: {
    total: number;
    ready: number;
    missingCatalogId: number;
    missingMapping: number;
    partialMapping: number;
  };
  byStatus: {
    ready: MappingDiagnostic[];
    missingCatalogId: MappingDiagnostic[];
    missingMapping: MappingDiagnostic[];
    partialMapping: MappingDiagnostic[];
  };
};

export default function SquareCatalogDiagnosticsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DiagnosticResponse | null>(null);
  const [mappingData, setMappingData] = useState<MappingDiagnosticResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoMapping, setAutoMapping] = useState(false);
  const [autoMapResult, setAutoMapResult] = useState<string | null>(null);
  const [creatingAll, setCreatingAll] = useState(false);
  const [createAllResult, setCreateAllResult] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState(false);
  const [clearAllResult, setClearAllResult] = useState<string | null>(null);

  useEffect(() => {
    loadDiagnostics();
  }, []);

  async function loadDiagnostics() {
    setLoading(true);
    setError(null);
    setAutoMapResult(null);
    try {
      const [catalogRes, mappingRes] = await Promise.all([
        fetch("/api/admin/diagnostics/square-catalog"),
        fetch("/api/admin/diagnostics/square-mappings"),
      ]);

      if (!catalogRes.ok) {
        const errorData = await catalogRes.json();
        throw new Error(errorData.error || "Failed to load catalog diagnostics");
      }

      if (!mappingRes.ok) {
        const errorData = await mappingRes.json();
        throw new Error(errorData.error || "Failed to load mapping diagnostics");
      }

      const catalogDiagnostics = await catalogRes.json();
      const mappingDiagnostics = await mappingRes.json();

      setData(catalogDiagnostics);
      setMappingData(mappingDiagnostics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load diagnostics");
    } finally {
      setLoading(false);
    }
  }

  async function handleAutoMap() {
    setAutoMapping(true);
    setAutoMapResult(null);
    try {
      const res = await fetch("/api/admin/auto-map-square-variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: false }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to auto-map variants");
      }

      const result = await res.json();
      setAutoMapResult(result.message);

      // Reload diagnostics to show updated mappings
      await loadDiagnostics();
    } catch (err) {
      setAutoMapResult(err instanceof Error ? err.message : "Failed to auto-map variants");
    } finally {
      setAutoMapping(false);
    }
  }

  async function handleClearAll() {
    if (!confirm("This will CLEAR all Square catalog IDs from the database. You should bulk delete products from Square first. Continue?")) {
      return;
    }

    setClearingAll(true);
    setClearAllResult(null);
    try {
      const res = await fetch("/api/admin/clear-all-square-ids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to clear Square IDs");
      }

      const result = await res.json();
      setClearAllResult(result.message);

      // Reload diagnostics to show cleared IDs
      await loadDiagnostics();
    } catch (err) {
      setClearAllResult(err instanceof Error ? err.message : "Failed to clear Square IDs");
    } finally {
      setClearingAll(false);
    }
  }

  async function handleCreateAll() {
    if (!confirm("This will create NEW Square catalog items for ALL products that don't have catalog IDs. Continue?")) {
      return;
    }

    setCreatingAll(true);
    setCreateAllResult(null);
    try {
      const res = await fetch("/api/admin/create-all-square-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overwrite: false }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to create Square products");
      }

      const result = await res.json();
      setCreateAllResult(result.message);

      // Reload diagnostics to show updated catalog IDs
      await loadDiagnostics();
    } catch (err) {
      setCreateAllResult(err instanceof Error ? err.message : "Failed to create Square products");
    } finally {
      setCreatingAll(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6">Square Catalog ID Diagnostics</h1>
        <p className="text-[var(--color-muted)]">Loading diagnostics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6">Square Catalog ID Diagnostics</h1>
        <div className="card p-6 bg-rose-50 border-rose-200">
          <p className="text-rose-700 font-medium">Error: {error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6">Square Catalog ID Diagnostics</h1>
        <p className="text-[var(--color-muted)]">No data available</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Square Catalog ID Diagnostics</h1>
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
      <div className={`card p-4 mb-6 ${data.mode === "sandbox" ? "bg-amber-50 border-amber-200" : "bg-blue-50 border-blue-200"}`}>
        <p className={`font-medium ${data.mode === "sandbox" ? "text-amber-700" : "text-blue-700"}`}>
          Current Mode: <strong className="uppercase">{data.mode}</strong>
        </p>
        <p className={`text-sm mt-1 ${data.mode === "sandbox" ? "text-amber-600" : "text-blue-600"}`}>
          {data.mode === "sandbox"
            ? "Using SANDBOX mode Square API. All catalog IDs must exist in Square SANDBOX."
            : "Using PRODUCTION mode Square API. All catalog IDs must exist in Square PRODUCTION."}
        </p>
      </div>

      {/* Rebuild All Square Products */}
      <div className="mb-6">
        <div className="card p-4 bg-blue-50 border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-2">Rebuild All Square Products</h3>
          <p className="text-sm text-blue-800 mb-4">
            <strong>Step 1:</strong> Bulk delete all products from Square dashboard<br />
            <strong>Step 2:</strong> Clear all Square IDs from database<br />
            <strong>Step 3:</strong> Create fresh Square products with proper variations
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleClearAll}
              disabled={clearingAll || creatingAll}
              className="btn bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {clearingAll ? "Clearing..." : "Step 2: Clear Database IDs"}
            </button>
            <button
              onClick={handleCreateAll}
              disabled={creatingAll || clearingAll}
              className="btn bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creatingAll ? "Creating..." : "Step 3: Create All Square Products"}
            </button>
          </div>
          {clearAllResult && (
            <p className={`mt-3 text-sm ${clearAllResult.includes("error") ? "text-rose-700" : "text-green-700"}`}>
              Step 2: {clearAllResult}
            </p>
          )}
          {createAllResult && (
            <p className={`mt-3 text-sm ${createAllResult.includes("error") ? "text-rose-700" : "text-green-700"}`}>
              Step 3: {createAllResult}
            </p>
          )}
        </div>
      </div>

      {/* Catalog ID Summary Stats */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-3">Catalog ID Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card p-4">
            <p className="text-sm text-[var(--color-muted)] mb-1">Total Products</p>
            <p className="text-2xl font-bold">{data.summary.total}</p>
          </div>
          <div className="card p-4 bg-green-50 border-green-200">
            <p className="text-sm text-green-700 mb-1">Valid Catalog IDs</p>
            <p className="text-2xl font-bold text-green-700">{data.summary.valid}</p>
          </div>
          <div className="card p-4 bg-rose-50 border-rose-200">
            <p className="text-sm text-rose-700 mb-1">Invalid Catalog IDs</p>
            <p className="text-2xl font-bold text-rose-700">{data.summary.invalid}</p>
          </div>
          <div className="card p-4 bg-amber-50 border-amber-200">
            <p className="text-sm text-amber-700 mb-1">Missing Catalog IDs</p>
            <p className="text-2xl font-bold text-amber-700">{data.summary.missing}</p>
          </div>
        </div>
      </div>

      {/* Variant Mapping Summary Stats */}
      {mappingData && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold">Variant Mapping Status</h2>
            <button
              onClick={handleAutoMap}
              disabled={autoMapping || mappingData.summary.missingMapping === 0}
              className="btn bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {autoMapping ? "Auto-Mapping..." : `Auto-Map ${mappingData.summary.missingMapping} Products`}
            </button>
          </div>

          {autoMapResult && (
            <div className="card p-4 mb-4 bg-blue-50 border-blue-200">
              <p className="text-blue-800">{autoMapResult}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card p-4 bg-green-50 border-green-200">
              <p className="text-sm text-green-700 mb-1">Ready to Sync</p>
              <p className="text-2xl font-bold text-green-700">{mappingData.summary.ready}</p>
              <p className="text-xs text-green-600 mt-1">Has catalog ID & mapping</p>
            </div>
            <div className="card p-4 bg-rose-50 border-rose-200">
              <p className="text-sm text-rose-700 mb-1">Missing Mapping</p>
              <p className="text-2xl font-bold text-rose-700">{mappingData.summary.missingMapping}</p>
              <p className="text-xs text-rose-600 mt-1">Has catalog ID, needs mapping</p>
            </div>
            <div className="card p-4 bg-amber-50 border-amber-200">
              <p className="text-sm text-amber-700 mb-1">Partial Mapping</p>
              <p className="text-2xl font-bold text-amber-700">{mappingData.summary.partialMapping}</p>
              <p className="text-xs text-amber-600 mt-1">Some variants not mapped</p>
            </div>
            <div className="card p-4 bg-neutral-50 border-neutral-200">
              <p className="text-sm text-neutral-700 mb-1">No Catalog ID</p>
              <p className="text-2xl font-bold text-neutral-700">{mappingData.summary.missingCatalogId}</p>
              <p className="text-xs text-neutral-600 mt-1">Not connected to Square</p>
            </div>
          </div>

          {/* Variant Mapping Details */}
          {mappingData.summary.missingMapping > 0 && (
            <div className="card p-4 mt-4 bg-rose-50 border-rose-200">
              <h3 className="font-semibold text-rose-900 mb-2">Products Missing Variant Mappings</h3>
              <div className="space-y-1">
                {mappingData.byStatus.missingMapping.slice(0, 10).map((p) => (
                  <p key={p.productSlug} className="text-sm text-rose-800">
                    • {p.productName} <span className="text-rose-600">({p.websiteVariantCount} variants)</span>
                  </p>
                ))}
                {mappingData.byStatus.missingMapping.length > 10 && (
                  <p className="text-sm text-rose-600 italic">
                    ...and {mappingData.byStatus.missingMapping.length - 10} more
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-line)] bg-neutral-50">
                <th className="text-left p-4 font-semibold text-sm">Product</th>
                <th className="text-left p-4 font-semibold text-sm">Catalog ID</th>
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
                      {result.squareCatalogId}
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
                    {result.isValid && result.catalogDetails ? (
                      <div className="text-sm">
                        <p className="font-medium text-[var(--color-text)]">
                          {result.catalogDetails.name}
                        </p>
                        {result.catalogDetails.priceAmount !== undefined && (
                          <p className="text-xs text-[var(--color-muted)]">
                            {result.catalogDetails.priceCurrency} ${(result.catalogDetails.priceAmount / 100).toFixed(2)}
                          </p>
                        )}
                        <p className="text-xs text-[var(--color-muted)]">
                          {result.catalogDetails.active ? "Active" : "Inactive"}
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
        <h2 className="font-semibold text-blue-900 mb-2">How to Fix Invalid Catalog IDs</h2>
        <ol className="text-sm text-blue-800 space-y-2 ml-4 list-decimal">
          <li>
            Check which Square mode you&apos;re in: <strong className="uppercase">{data.mode}</strong>
          </li>
          <li>
            Go to your Square Dashboard{" "}
            {data.mode === "sandbox" ? (
              <a
                href="https://squareup.com/dashboard/items/library"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-medium"
              >
                (Items Library)
              </a>
            ) : (
              <a
                href="https://squareup.com/dashboard/items/library"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-medium"
              >
                (Items Library)
              </a>
            )}
          </li>
          <li>For each invalid catalog ID, either:
            <ul className="ml-4 mt-1 space-y-1">
              <li>• Create a new item in {data.mode} mode and update the product</li>
              <li>• Or switch your SQUARE_ENVIRONMENT to {data.mode === "sandbox" ? "production" : "sandbox"}</li>
            </ul>
          </li>
          <li>Update the catalog IDs in the Admin panel for each affected product</li>
        </ol>
      </div>
    </div>
  );
}
