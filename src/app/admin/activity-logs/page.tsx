"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Activity, CheckCircle, XCircle, AlertCircle } from "lucide-react";

interface AdminLogEntry {
  timestamp: string;
  action: string;
  adminEmail?: string;
  ip: string;
  userAgent: string;
  details?: Record<string, unknown>;
  success: boolean;
}

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<AdminLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [filterSuccess, setFilterSuccess] = useState<string>("all");

  useEffect(() => {
    loadLogs();
  }, []);

  async function loadLogs() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/logs?limit=200");
      if (!res.ok) {
        throw new Error("Failed to load logs");
      }
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err) {
      setError("Failed to load activity logs");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const filteredLogs = logs.filter((log) => {
    if (filterAction !== "all" && log.action !== filterAction) return false;
    if (filterSuccess === "success" && !log.success) return false;
    if (filterSuccess === "failed" && log.success) return false;
    return true;
  });

  // Get unique actions for filter
  const uniqueActions = Array.from(new Set(logs.map((log) => log.action))).sort();

  function formatAction(action: string): string {
    return action
      .split(/[._-]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  function formatDate(timestamp: string): string {
    return new Date(timestamp).toLocaleString();
  }

  function getActionIcon(log: AdminLogEntry) {
    if (!log.success) {
      return <XCircle className="w-5 h-5 text-rose-600" />;
    }
    if (log.action.includes("login")) {
      return <CheckCircle className="w-5 h-5 text-green-600" />;
    }
    if (log.action.includes("delete")) {
      return <AlertCircle className="w-5 h-5 text-amber-600" />;
    }
    return <Activity className="w-5 h-5 text-blue-600" />;
  }

  if (loading) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-[var(--color-muted)]">Loading activity logs...</p>
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
          <h1 className="text-3xl font-bold">Activity Logs</h1>
          <p className="text-[var(--color-muted)] mt-1">
            Track all admin actions, logins, and changes
          </p>
        </div>

        {error && (
          <div className="card p-4 bg-rose-50 border border-rose-200 mb-6">
            <p className="text-rose-600 text-sm">{error}</p>
          </div>
        )}

        {/* Filters */}
        <div className="card p-4 bg-white mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Filter by Action</label>
              <select
                className="input w-full"
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
              >
                <option value="all">All Actions</option>
                {uniqueActions.map((action) => (
                  <option key={action} value={action}>
                    {formatAction(action)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Filter by Status</label>
              <select
                className="input w-full"
                value={filterSuccess}
                onChange={(e) => setFilterSuccess(e.target.value)}
              >
                <option value="all">All</option>
                <option value="success">Success Only</option>
                <option value="failed">Failed Only</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={loadLogs}
                className="btn w-full sm:w-auto"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Logs Table */}
        <div className="card p-6 bg-white">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">
              Recent Activity ({filteredLogs.length})
            </h2>
          </div>

          {filteredLogs.length === 0 ? (
            <p className="text-[var(--color-muted)] text-center py-8">
              No activity logs found
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--color-line)]">
                    <th className="text-left py-3 text-sm font-semibold">Status</th>
                    <th className="text-left py-3 text-sm font-semibold">Action</th>
                    <th className="text-left py-3 text-sm font-semibold">Admin</th>
                    <th className="text-left py-3 text-sm font-semibold">Time</th>
                    <th className="text-left py-3 text-sm font-semibold">IP</th>
                    <th className="text-left py-3 text-sm font-semibold">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log, idx) => (
                    <tr key={idx} className="border-b border-[var(--color-line)] hover:bg-neutral-50">
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          {getActionIcon(log)}
                        </div>
                      </td>
                      <td className="py-3">
                        <span className="font-medium">{formatAction(log.action)}</span>
                      </td>
                      <td className="py-3">
                        <span className="text-sm">{log.adminEmail || "—"}</span>
                      </td>
                      <td className="py-3">
                        <span className="text-sm text-[var(--color-muted)]">
                          {formatDate(log.timestamp)}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className="text-sm font-mono text-[var(--color-muted)]">
                          {log.ip}
                        </span>
                      </td>
                      <td className="py-3">
                        {log.details && Object.keys(log.details).length > 0 ? (
                          <details className="text-sm">
                            <summary className="cursor-pointer text-[var(--color-accent)] hover:underline">
                              View
                            </summary>
                            <pre className="mt-2 text-xs bg-neutral-100 p-2 rounded overflow-x-auto">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </details>
                        ) : (
                          <span className="text-sm text-[var(--color-muted)]">—</span>
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
