"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, Download, CheckCircle, AlertCircle } from "lucide-react";

type StripeSession = {
  id: string;
  customerEmail: string;
  amountTotal: number | null;
  created: string;
  inDatabase: boolean;
  orderStatus?: string;
};

export default function StripeSyncPage() {
  const [sessions, setSessions] = useState<StripeSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/stripe-sync");
      if (!res.ok) throw new Error("Failed to load Stripe sessions");
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (err) {
      setError("Failed to load Stripe sessions: " + String(err));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function syncSession(sessionId: string) {
    setSyncing(sessionId);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/admin/stripe-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to sync session");
      }

      if (data.skipped) {
        setSuccess(`Order ${sessionId.slice(0, 8)}... was already in the database`);
      } else {
        setSuccess(`Successfully synced order ${sessionId.slice(0, 8)}... from Stripe!`);
      }

      // Reload sessions to update status
      await loadSessions();
    } catch (err) {
      setError(String(err));
      console.error(err);
    } finally {
      setSyncing(null);
    }
  }

  const missingSessions = sessions.filter((s) => !s.inDatabase);

  if (loading) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-[var(--color-muted)]">Loading Stripe sessions...</p>
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Stripe Order Sync</h1>
              <p className="text-[var(--color-muted)] mt-1">
                Backfill missing orders from Stripe checkout sessions
              </p>
            </div>
            <button
              onClick={loadSessions}
              disabled={loading}
              className="btn bg-[var(--color-ink)] text-white hover:bg-opacity-90"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </button>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="card p-4 bg-rose-50 border border-rose-200 mb-6">
            <p className="text-rose-600 text-sm">{error}</p>
          </div>
        )}
        {success && (
          <div className="card p-4 bg-green-50 border border-green-200 mb-6">
            <p className="text-green-600 text-sm">{success}</p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card p-6 bg-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Download className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-[var(--color-muted)]">
                Total Stripe Sessions
              </span>
            </div>
            <p className="text-3xl font-bold">{sessions.length}</p>
          </div>

          <div className="card p-6 bg-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-sm font-medium text-[var(--color-muted)]">
                In Database
              </span>
            </div>
            <p className="text-3xl font-bold">{sessions.filter((s) => s.inDatabase).length}</p>
          </div>

          <div className="card p-6 bg-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-sm font-medium text-[var(--color-muted)]">
                Missing
              </span>
            </div>
            <p className="text-3xl font-bold text-amber-600">{missingSessions.length}</p>
          </div>
        </div>

        {/* Missing Sessions */}
        {missingSessions.length > 0 && (
          <div className="card p-6 bg-white mb-8">
            <h2 className="text-xl font-bold mb-4 text-amber-600">
              Missing Orders (Need Sync)
            </h2>
            <p className="text-sm text-[var(--color-muted)] mb-4">
              These Stripe sessions are not in your database. Click &quot;Sync&quot; to import them.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--color-line)]">
                    <th className="text-left py-3 text-sm font-semibold">Session ID</th>
                    <th className="text-left py-3 text-sm font-semibold">Customer</th>
                    <th className="text-right py-3 text-sm font-semibold">Amount</th>
                    <th className="text-left py-3 text-sm font-semibold">Date</th>
                    <th className="text-right py-3 text-sm font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {missingSessions.map((session) => (
                    <tr key={session.id} className="border-b border-[var(--color-line)]">
                      <td className="py-3 text-sm font-mono">
                        {session.id.slice(0, 20)}...
                      </td>
                      <td className="py-3 text-sm">{session.customerEmail}</td>
                      <td className="py-3 text-sm text-right font-medium">
                        ${((session.amountTotal || 0) / 100).toFixed(2)}
                      </td>
                      <td className="py-3 text-sm text-[var(--color-muted)]">
                        {new Date(session.created).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => syncSession(session.id)}
                          disabled={syncing === session.id}
                          className="btn bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          {syncing === session.id ? "Syncing..." : "Sync"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* All Sessions */}
        <div className="card p-6 bg-white">
          <h2 className="text-xl font-bold mb-4">All Stripe Sessions</h2>
          {sessions.length === 0 ? (
            <p className="text-center text-[var(--color-muted)] py-8">
              No Stripe sessions found
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--color-line)]">
                    <th className="text-left py-3 text-sm font-semibold">Session ID</th>
                    <th className="text-left py-3 text-sm font-semibold">Customer</th>
                    <th className="text-right py-3 text-sm font-semibold">Amount</th>
                    <th className="text-left py-3 text-sm font-semibold">Date</th>
                    <th className="text-center py-3 text-sm font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <tr key={session.id} className="border-b border-[var(--color-line)]">
                      <td className="py-3 text-sm font-mono">
                        {session.id.slice(0, 20)}...
                      </td>
                      <td className="py-3 text-sm">{session.customerEmail}</td>
                      <td className="py-3 text-sm text-right font-medium">
                        ${((session.amountTotal || 0) / 100).toFixed(2)}
                      </td>
                      <td className="py-3 text-sm text-[var(--color-muted)]">
                        {new Date(session.created).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-center">
                        {session.inDatabase ? (
                          <span className="inline-flex items-center gap-1 text-green-600">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-sm">
                              {session.orderStatus || "In DB"}
                            </span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-600">
                            <AlertCircle className="w-4 h-4" />
                            <span className="text-sm">Missing</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
