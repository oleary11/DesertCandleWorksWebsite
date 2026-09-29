"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Link2, Unlink, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import CandleSpinner from "@/components/CandleSpinner";

interface SyncResult {
  total: number;
  success: number;
  failed: number;
  errors: Array<{ slug: string; error: string }>;
}

export default function TikTokShopPage() {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    checkConnection();

    // Check for OAuth callback messages
    const params = new URLSearchParams(window.location.search);
    if (params.get("tiktok_success") === "true") {
      setConnected(true);
      setError("");
      // Clean URL
      window.history.replaceState({}, "", "/admin/tiktok-shop");
    } else if (params.get("tiktok_error")) {
      setError(`Connection failed: ${params.get("tiktok_error")}`);
      // Clean URL
      window.history.replaceState({}, "", "/admin/tiktok-shop");
    }
  }, []);

  async function checkConnection() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/tiktok/sync");
      if (!res.ok) {
        throw new Error("Failed to check connection");
      }
      const data = await res.json();
      setConnected(data.connected);
    } catch (err) {
      console.error("Failed to check TikTok Shop connection:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    try {
      setError("");
      const res = await fetch("/api/admin/tiktok/auth");
      if (!res.ok) {
        throw new Error("Failed to get authorization URL");
      }
      const data = await res.json();

      // Redirect to TikTok authorization page
      window.location.href = data.authUrl;
    } catch (err) {
      setError("Failed to initiate connection");
      console.error(err);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Are you sure you want to disconnect TikTok Shop?")) {
      return;
    }

    try {
      setError("");
      const res = await fetch("/api/admin/tiktok/disconnect", {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("Failed to disconnect");
      }

      setConnected(false);
      setSyncResult(null);
    } catch (err) {
      setError("Failed to disconnect TikTok Shop");
      console.error(err);
    }
  }

  async function handleSync() {
    try {
      setError("");
      setSyncing(true);
      setSyncResult(null);

      const res = await fetch("/api/admin/tiktok/sync", {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to sync products");
      }

      const data = await res.json();
      setSyncResult(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync products");
      console.error(err);
    } finally {
      setSyncing(false);
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

  return (
    <div className="a-ui mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div>
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-[var(--a-ink)] sm:text-[2.125rem]">TikTok Shop Integration</h1>
              <p className="mt-1.5 text-[15px] text-[var(--a-muted)]">
                Sync your products to TikTok Shop
              </p>
            </div>
            <div className="flex items-center gap-2">
              {connected ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm">
                  <CheckCircle className="w-4 h-4" />
                  Connected
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-200 text-[var(--a-muted)] rounded-lg text-sm">
                  <XCircle className="w-4 h-4" />
                  Not Connected
                </div>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-[#fdecea] p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <p className="text-rose-600 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Connection Card */}
        <div className="a-card p-5 mb-6">
          <h2 className="mb-4 text-base font-semibold text-[var(--a-ink)]">Connection Status</h2>

          {!connected ? (
            <div className="space-y-4">
              <p className="mt-1.5 text-[15px] text-[var(--a-muted)]">
                Connect your TikTok Shop account to sync products automatically.
              </p>
              <button
                onClick={handleConnect}
                className="a-btn a-btn-primary"
              >
                <Link2 className="w-4 h-4" />
                Connect TikTok Shop
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="mt-1.5 text-[15px] text-[var(--a-muted)]">
                Your TikTok Shop account is connected and ready to sync products.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="a-btn a-btn-primary"
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? "Syncing..." : "Sync All Products"}
                </button>
                <button
                  onClick={handleDisconnect}
                  className="a-btn btn-ghost inline-flex items-center gap-2"
                >
                  <Unlink className="w-4 h-4" />
                  Disconnect
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sync Results */}
        {syncResult && (
          <div className="a-card p-5 mb-6">
            <h2 className="mb-4 text-base font-semibold text-[var(--a-ink)]">Sync Results</h2>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="a-panel">
                <div className="text-2xl font-semibold tabular-nums text-[var(--a-ink)]">{syncResult.total}</div>
                <div className="text-sm text-[var(--a-ink)]">Total Products</div>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{syncResult.success}</div>
                <div className="text-sm text-green-900">Synced</div>
              </div>
              <div className="p-4 bg-rose-50 rounded-lg">
                <div className="text-2xl font-bold text-rose-600">{syncResult.failed}</div>
                <div className="text-sm text-rose-900">Failed</div>
              </div>
            </div>

            {syncResult.errors.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Errors:</h3>
                <div className="space-y-2">
                  {syncResult.errors.map((err, i) => (
                    <div key={i} className="p-3 bg-rose-50 border border-rose-200 rounded text-sm">
                      <div className="font-medium text-rose-900">{err.slug}</div>
                      <div className="text-rose-700">{err.error}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Info Card */}
        <div className="a-panel mt-6">
          <h3 className="font-semibold mb-2 text-[var(--a-ink)]">How it works</h3>
          <ul className="space-y-2 text-sm text-[var(--a-ink)]">
            <li>• Click &quot;Connect TikTok Shop&quot; to authorize access to your TikTok Shop account</li>
            <li>• Once connected, click &quot;Sync All Products&quot; to upload your entire catalog</li>
            <li>• Products will be created in TikTok Shop with your current pricing and inventory</li>
            <li>• You can sync products again at any time to update inventory and pricing</li>
            <li>• Note: Images, descriptions, and other details will be synced from your website</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
