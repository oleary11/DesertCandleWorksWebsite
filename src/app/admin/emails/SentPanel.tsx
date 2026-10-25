"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { History, RefreshCw, Search, X } from "lucide-react";
import { Badge, Modal } from "../_components/ui";

type LoggedEmail = {
  resendId: string;
  toEmail: string;
  fromEmail: string;
  subject: string;
  category: string;
  orderId: string | null;
  lastEvent: string | null;
  sentAt: string;
};

type OpenedEmail = LoggedEmail & { replyTo: string[]; html: string | null; text: string | null };

const CATEGORIES: { value: string; label: string }[] = [
  { value: "order", label: "Order confirmations" },
  { value: "shipping", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "refund", label: "Refunds" },
  { value: "review", label: "Review requests" },
  { value: "message", label: "Sent from here" },
  { value: "personal", label: "From inbox" },
  { value: "account", label: "Account" },
  { value: "notification", label: "Alerts to us" },
  { value: "other", label: "Other" },
];
const categoryLabel = (value: string) => CATEGORIES.find((c) => c.value === value)?.label ?? value;

const STATUS_OPTIONS = [
  { value: "", label: "Any status" },
  { value: "delivered", label: "Delivered" },
  { value: "opened", label: "Opened" },
  { value: "clicked", label: "Clicked" },
  { value: "sent", label: "Sent (not yet delivered)" },
  { value: "problem", label: "Problems (bounced, delayed…)" },
];

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <Badge>Unknown</Badge>;
  const tone =
    status === "delivered" || status === "opened" || status === "clicked"
      ? "green"
      : status === "delivery_delayed"
        ? "amber"
        : ["bounced", "complained", "failed", "suppressed", "canceled"].includes(status)
          ? "red"
          : "neutral";
  return <Badge tone={tone}>{status.replace(/_/g, " ")}</Badge>;
}

function when(value: string) {
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", year: "2-digit", hour: "numeric", minute: "2-digit" });
}

export default function SentPanel({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [search, setSearch] = useState(initialQuery); // debounced copy of `query`
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");

  const [emails, setEmails] = useState<LoggedEmail[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);

  const [opened, setOpened] = useState<OpenedEmail | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(
    async (offset: number) => {
      const id = ++requestId.current;
      if (offset === 0) setLoading(true);
      else setLoadingMore(true);
      try {
        const params = new URLSearchParams({ offset: String(offset) });
        if (category) params.set("category", category);
        if (status) params.set("status", status);
        if (search.trim()) params.set("q", search.trim());
        const res = await fetch(`/api/admin/email-log?${params}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load sent emails");
        if (id !== requestId.current) return; // a newer filter change is in flight
        setEmails((prev) => (offset === 0 ? data.emails : [...prev, ...data.emails]));
        setTotal(data.total);
        setCounts(data.counts);
        setError(null);
      } catch (err) {
        if (id === requestId.current) setError(err instanceof Error ? err.message : "Failed to load sent emails");
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [category, status, search]
  );

  useEffect(() => {
    load(0);
  }, [load]);

  const syncHistory = async () => {
    setSyncing(true);
    setSyncNote(null);
    try {
      const res = await fetch("/api/admin/email-log", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      setSyncNote(`Checked ${data.pages} page${data.pages === 1 ? "" : "s"} of Resend history; ${data.seen} Desert Candle Works emails found.`);
      await load(0);
    } catch (err) {
      setSyncNote(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const openEmail = async (email: LoggedEmail) => {
    setOpeningId(email.resendId);
    setOpenError(null);
    setOpened({ ...email, replyTo: [], html: null, text: null });
    try {
      const res = await fetch(`/api/admin/email-log/${email.resendId}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load this email");
      setOpened(data.email);
      setEmails((prev) => prev.map((e) => (e.resendId === email.resendId ? { ...e, lastEvent: data.email.lastEvent } : e)));
    } catch (err) {
      setOpenError(err instanceof Error ? err.message : "Could not load this email");
    } finally {
      setOpeningId(null);
    }
  };

  const allCount = Object.values(counts).reduce((sum, n) => sum + n, 0);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative block flex-1">
          <span className="sr-only">Search sent emails</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--a-faint)]" aria-hidden />
          <input
            type="search"
            className="a-input pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search order #, email address or subject…"
          />
        </label>
        <select className="a-select sm:w-56" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button className="a-btn" onClick={syncHistory} disabled={syncing} title="Pull older emails and latest statuses from Resend">
          <History className="h-4 w-4" aria-hidden />
          {syncing ? "Syncing…" : "Sync history"}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Email type">
        {[{ value: "", label: "All" }, ...CATEGORIES].map((c) => {
          const n = c.value ? counts[c.value] ?? 0 : allCount;
          if (c.value && n === 0 && category !== c.value) return null;
          const active = category === c.value;
          return (
            <button
              key={c.value || "all"}
              type="button"
              aria-pressed={active}
              onClick={() => setCategory(c.value)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors ${
                active
                  ? "border-[var(--a-ink)] bg-[var(--a-ink)] text-white"
                  : "border-[var(--a-line)] bg-white text-[var(--a-muted)] hover:text-[var(--a-ink)]"
              }`}
            >
              {c.label}
              <span className={`tabular-nums text-xs ${active ? "text-white/70" : "text-[var(--a-faint)]"}`}>{n}</span>
            </button>
          );
        })}
      </div>

      {syncNote && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-[var(--a-line)] bg-[var(--a-canvas)] p-3 text-sm text-[var(--a-ink)]">
          {syncNote}
          <button className="shrink-0 opacity-70 hover:opacity-100" onClick={() => setSyncNote(null)} aria-label="Dismiss">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}

      {/* List */}
      <section className="a-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--a-line)] px-4 py-3">
          <p className="text-sm text-[var(--a-muted)]">
            {loading ? "Loading…" : `${total.toLocaleString()} ${total === 1 ? "email" : "emails"}`}
          </p>
          <button className="a-icon-btn h-8 w-8" onClick={() => load(0)} aria-label="Refresh" title="Refresh">
            <RefreshCw className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {error ? (
          <p className="px-4 py-14 text-center text-sm text-[var(--a-bad)]">{error}</p>
        ) : !loading && emails.length === 0 ? (
          <p className="px-4 py-14 text-center text-sm text-[var(--a-muted)]">
            No emails match.{" "}
            {!search && !category && !status && "Use “Sync history” to pull past emails from Resend."}
          </p>
        ) : (
          <>
            {/* Desktop table */}
            <table className="a-table hidden md:table">
              <thead>
                <tr>
                  <th className="w-36">Sent</th>
                  <th>To</th>
                  <th>Subject</th>
                  <th className="w-40">Type</th>
                  <th className="w-28">Order</th>
                  <th className="w-28">Status</th>
                </tr>
              </thead>
              <tbody>
                {emails.map((email) => (
                  <tr key={email.resendId} className="cursor-pointer" onClick={() => openEmail(email)}>
                    <td className="whitespace-nowrap text-[var(--a-muted)]">{when(email.sentAt)}</td>
                    <td className="max-w-[200px] truncate" title={email.toEmail}>
                      {email.toEmail}
                    </td>
                    <td className="max-w-[320px]">
                      <button
                        type="button"
                        className="block max-w-full truncate text-left font-medium text-[var(--a-ink)] hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEmail(email);
                        }}
                        title={email.subject}
                      >
                        {email.subject || "(no subject)"}
                      </button>
                    </td>
                    <td className="text-[var(--a-muted)]">{categoryLabel(email.category)}</td>
                    <td>
                      {email.orderId ? (
                        <button
                          type="button"
                          className="font-mono text-xs text-[var(--a-ink)] hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setQuery(email.orderId!);
                            setCategory("");
                          }}
                          title="Show all emails for this order"
                        >
                          {email.orderId}
                        </button>
                      ) : (
                        <span className="text-[var(--a-faint)]">—</span>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={email.lastEvent} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile cards */}
            <ul className="divide-y divide-[var(--a-line)] md:hidden">
              {emails.map((email) => (
                <li key={email.resendId}>
                  <button type="button" className="block w-full px-4 py-3 text-left hover:bg-[var(--a-canvas)]" onClick={() => openEmail(email)}>
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--a-ink)]">{email.subject || "(no subject)"}</span>
                      <StatusBadge status={email.lastEvent} />
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-[var(--a-muted)]">
                      {email.toEmail} · {when(email.sentAt)}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-[var(--a-faint)]">
                      {categoryLabel(email.category)}
                      {email.orderId && ` · ${email.orderId}`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {emails.length < total && (
              <div className="border-t border-[var(--a-line)] p-3 text-center">
                <button className="a-btn" onClick={() => load(emails.length)} disabled={loadingMore}>
                  {loadingMore ? "Loading…" : `Load more (${(total - emails.length).toLocaleString()} left)`}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {opened && (
        <Modal size="full" title={opened.subject || "(no subject)"} onClose={() => setOpened(null)}>
          <dl className="mb-4 flex shrink-0 flex-wrap gap-x-6 gap-y-2 text-sm">
            <div className="min-w-0">
              <dt className="text-xs text-[var(--a-muted)]">To</dt>
              <dd className="break-words">{opened.toEmail}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-[var(--a-muted)]">From</dt>
              <dd className="break-words">{opened.fromEmail}</dd>
            </div>
            {opened.replyTo.length > 0 && (
              <div className="min-w-0">
                <dt className="text-xs text-[var(--a-muted)]">Reply-To</dt>
                <dd className="break-all">{opened.replyTo.join(", ")}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-[var(--a-muted)]">Sent</dt>
              <dd>{new Date(opened.sentAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--a-muted)]">Type</dt>
              <dd>
                {categoryLabel(opened.category)}
                {opened.orderId && <span className="font-mono"> · {opened.orderId}</span>}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--a-muted)]">Status</dt>
              <dd>
                <StatusBadge status={opened.lastEvent} />
              </dd>
            </div>
          </dl>

          {openingId === opened.resendId ? (
            <p className="py-16 text-center text-sm text-[var(--a-muted)]">Loading email…</p>
          ) : openError ? (
            <p className="py-16 text-center text-sm text-[var(--a-bad)]">{openError}</p>
          ) : opened.html ? (
            <iframe
              srcDoc={opened.html}
              sandbox="allow-popups allow-popups-to-escape-sandbox"
              className="block min-h-0 w-full flex-1 rounded-lg border border-[var(--a-line)] bg-white"
              title="Email content"
            />
          ) : (
            <pre className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-[var(--a-canvas)] p-4 text-sm text-[var(--a-ink)]">
              {opened.text || "No content stored for this email."}
            </pre>
          )}
        </Modal>
      )}
    </div>
  );
}
