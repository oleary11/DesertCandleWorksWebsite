"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, Link2, Unlink, CheckCircle, XCircle, AlertCircle } from "lucide-react";

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
      <div className="min-h-screen p-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-[var(--color-muted)]">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 bg-neutral-50">
      <div className="max-w-4xl mx-auto">
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
              <h1 className="text-3xl font-bold">TikTok Shop Integration</h1>
              <p className="text-[var(--color-muted)] mt-1">
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
                <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-200 text-neutral-600 rounded-lg text-sm">
                  <XCircle className="w-4 h-4" />
                  Not Connected
                </div>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="card p-4 bg-rose-50 border border-rose-200 mb-6">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <p className="text-rose-600 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Connection Card */}
        <div className="card p-6 bg-white mb-6">
          <h2 className="text-xl font-bold mb-4">Connection Status</h2>

          {!connected ? (
            <div className="space-y-4">
              <p className="text-[var(--color-muted)]">
                Connect your TikTok Shop account to sync products automatically.
              </p>
              <button
                onClick={handleConnect}
                className="btn btn-primary inline-flex items-center gap-2"
              >
                <Link2 className="w-4 h-4" />
                Connect TikTok Shop
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-[var(--color-muted)]">
                Your TikTok Shop account is connected and ready to sync products.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="btn btn-primary inline-flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? "Syncing..." : "Sync All Products"}
                </button>
                <button
                  onClick={handleDisconnect}
                  className="btn btn-ghost inline-flex items-center gap-2"
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
          <div className="card p-6 bg-white mb-6">
            <h2 className="text-xl font-bold mb-4">Sync Results</h2>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{syncResult.total}</div>
                <div className="text-sm text-blue-900">Total Products</div>
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
        <div className="card p-6 bg-blue-50 border border-blue-200">
          <h3 className="font-semibold mb-2 text-blue-900">How it works</h3>
          <ul className="space-y-2 text-sm text-blue-800">
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
