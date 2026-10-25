"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Inbox, RefreshCw, Send } from "lucide-react";
import { Badge, Switch } from "../_components/ui";

type ThreadSummary = {
  id: string;
  customerEmail: string;
  customerName: string | null;
  subject: string;
  personal: boolean;
  unreadCount: number;
  lastMessageAt: string;
  messageCount: number;
  lastSnippet: string;
  lastDirection: "in" | "out" | null;
};

type ThreadMessage = {
  id: string;
  direction: "in" | "out";
  fromEmail: string;
  subject: string;
  bodyText: string;
  createdAt: string;
};

function when(value: string) {
  const date = new Date(value);
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function ConversationsPanel({
  openThreadId,
  onOpenThread,
  onUnreadChange,
}: {
  openThreadId: string | null;
  onOpenThread: (id: string | null) => void;
  onUnreadChange: (unread: number) => void;
}) {
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [repliesConfigured, setRepliesConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [reply, setReply] = useState("");
  const [personal, setPersonal] = useState(true);
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const loadThreads = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/email-threads", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load conversations");
      const data = await res.json();
      setThreads(data.threads);
      setRepliesConfigured(data.repliesConfigured);
      onUnreadChange(data.unread);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load conversations");
    } finally {
      setLoading(false);
    }
  }, [onUnreadChange]);

  useEffect(() => {
    loadThreads();
    const timer = setInterval(loadThreads, 30_000);
    return () => clearInterval(timer);
  }, [loadThreads]);

  useEffect(() => {
    if (!openThreadId) return;
    let cancelled = false;
    setLoadingThread(true);
    setReply("");
    setReplyError(null);
    fetch(`/api/admin/email-threads/${openThreadId}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Conversation not found"))))
      .then((data) => {
        if (cancelled) return;
        setMessages(data.messages);
        setPersonal(data.thread.personal);
        loadThreads(); // refresh unread counts
      })
      .catch((err) => !cancelled && setReplyError(err.message))
      .finally(() => !cancelled && setLoadingThread(false));
    return () => {
      cancelled = true;
    };
  }, [openThreadId, loadThreads]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const sendReply = async () => {
    if (!openThreadId || !reply.trim()) return;
    setSending(true);
    setReplyError(null);
    try {
      const res = await fetch(`/api/admin/email-threads/${openThreadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: reply, personal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send reply");
      setMessages(data.messages);
      setReply("");
      loadThreads();
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : "Failed to send reply");
    } finally {
      setSending(false);
    }
  };

  const open = threads.find((t) => t.id === openThreadId) ?? null;

  return (
    <div className="space-y-4">
      {!repliesConfigured && (
        <div className="rounded-lg border border-amber-200 bg-[#fdf6e7] p-4 text-sm text-[#6b4a12]">
          Replies aren&apos;t being collected yet. Set <code className="font-mono">EMAIL_REPLY_DOMAIN</code> and the Resend inbound webhook
          (see <code className="font-mono">/api/email/inbound</code>) — until then, customer replies go to contact@.
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* Thread list */}
        <section className={`a-card overflow-hidden ${openThreadId ? "hidden lg:block" : ""}`}>
          <div className="flex items-center justify-between border-b border-[var(--a-line)] px-4 py-3">
            <p className="text-sm font-medium text-[var(--a-ink)]">Conversations</p>
            <button className="a-icon-btn h-8 w-8" onClick={loadThreads} aria-label="Refresh" title="Refresh">
              <RefreshCw className="h-4 w-4" aria-hidden />
            </button>
          </div>
          {loading ? (
            <p className="px-4 py-14 text-center text-sm text-[var(--a-muted)]">Loading…</p>
          ) : error ? (
            <p className="px-4 py-14 text-center text-sm text-[var(--a-bad)]">{error}</p>
          ) : threads.length === 0 ? (
            <div className="px-4 py-14 text-center text-sm text-[var(--a-muted)]">
              <Inbox className="mx-auto mb-2 h-6 w-6 text-[var(--a-faint)]" aria-hidden />
              No conversations yet. Emails sent to a single customer show up here with their replies.
            </div>
          ) : (
            <ul className="max-h-[640px] divide-y divide-[var(--a-line)] overflow-y-auto">
              {threads.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => onOpenThread(t.id)}
                    className={`block w-full px-4 py-3 text-left ${t.id === openThreadId ? "bg-[var(--a-tint)]" : "hover:bg-[var(--a-canvas)]"}`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`min-w-0 flex-1 truncate text-sm ${t.unreadCount ? "font-semibold" : "font-medium"} text-[var(--a-ink)]`}>
                        {t.customerName || t.customerEmail}
                      </span>
                      {t.unreadCount > 0 && <Badge tone="amber">{t.unreadCount} new</Badge>}
                      <span className="shrink-0 text-xs text-[var(--a-faint)]">{when(t.lastMessageAt)}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-sm text-[var(--a-ink)]">{t.subject}</span>
                    <span className="mt-0.5 block truncate text-xs text-[var(--a-muted)]">
                      {t.lastDirection === "out" ? "You: " : ""}
                      {t.lastSnippet}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Open thread */}
        <section className={`a-card overflow-hidden ${openThreadId ? "" : "hidden lg:block"}`}>
          {!openThreadId ? (
            <p className="px-4 py-24 text-center text-sm text-[var(--a-muted)]">Choose a conversation to read it.</p>
          ) : (
            <>
              <div className="flex items-start gap-2 border-b border-[var(--a-line)] px-4 py-3">
                <button className="a-icon-btn h-8 w-8 shrink-0 lg:hidden" onClick={() => onOpenThread(null)} aria-label="Back to conversations">
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                </button>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--a-ink)]">{open?.subject ?? "Conversation"}</p>
                  <p className="truncate text-xs text-[var(--a-muted)]">
                    {open?.customerName ? `${open.customerName} · ` : ""}
                    {open?.customerEmail}
                  </p>
                </div>
              </div>

              <div className="max-h-[520px] min-h-[240px] space-y-3 overflow-y-auto bg-[var(--a-canvas)] px-4 py-4">
                {loadingThread ? (
                  <p className="py-10 text-center text-sm text-[var(--a-muted)]">Loading…</p>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[85%] rounded-xl border px-3.5 py-2.5 text-sm ${
                          m.direction === "out"
                            ? "border-[#eadfce] bg-[#f7f2eb] text-[var(--a-ink)]"
                            : "border-[var(--a-line)] bg-white text-[var(--a-ink)]"
                        }`}
                      >
                        <p className="mb-1 text-xs text-[var(--a-muted)]">
                          {m.direction === "out" ? "You" : open?.customerName || m.fromEmail} ·{" "}
                          {new Date(m.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </p>
                        <p className="whitespace-pre-wrap break-words">{m.bodyText}</p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={endRef} />
              </div>

              <div className="space-y-3 border-t border-[var(--a-line)] p-4">
                <label className="block">
                  <span className="sr-only">Reply</span>
                  <textarea
                    className="a-textarea"
                    rows={4}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder={`Reply to ${open?.customerName || open?.customerEmail || "customer"}…`}
                  />
                </label>
                {replyError && <p className="text-sm text-[var(--a-bad)]">{replyError}</p>}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm text-[var(--a-ink)]">
                    <Switch checked={personal} onChange={() => setPersonal(!personal)} label="Personal email" />
                    Personal email
                  </label>
                  <button className="a-btn a-btn-primary" onClick={sendReply} disabled={sending || !reply.trim()}>
                    <Send className="h-4 w-4" aria-hidden />
                    {sending ? "Sending…" : "Send reply"}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
