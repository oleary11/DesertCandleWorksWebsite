"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Clock, Eye, X } from "lucide-react";
import { useModal } from "@/hooks/useModal";
import { Modal } from "../_components/ui";
import type { ScheduledEmail } from "@/lib/scheduledEmails";

export const formatSendTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

/** A date as the datetime-local input wants it, in this computer's time zone. */
export const toLocalInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Upcoming scheduled sends under the Send button: preview, change the time, or cancel. */
export default function ScheduledList({ refreshKey }: { refreshKey: number }) {
  const { showAlert, showConfirm } = useModal();
  const [items, setItems] = useState<ScheduledEmail[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<{ item: ScheduledEmail; html: string | null; error?: string } | null>(null);
  const [moving, setMoving] = useState<{ item: ScheduledEmail; at: string } | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/scheduled-emails")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setItems(data.scheduled))
      .catch(() => {});
  }, []);

  useEffect(load, [load, refreshKey]);

  const upcoming = items.filter((item) => item.status === "scheduled");
  if (upcoming.length === 0) return null;

  const cancel = async (item: ScheduledEmail) => {
    const ok = await showConfirm(
      `Cancel "${item.subject}" to ${item.recipientsLabel}, scheduled for ${formatSendTime(item.scheduledAt)}?`,
      "Cancel scheduled email"
    );
    if (!ok) return;
    setBusy(item.id);
    try {
      const res = await fetch(`/api/admin/scheduled-emails/${item.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't cancel it");
    } catch (err) {
      await showAlert(err instanceof Error ? err.message : "Couldn't cancel it", "Cancel failed");
    } finally {
      setBusy(null);
      load();
    }
  };

  const preview = async (item: ScheduledEmail) => {
    setPreviewing({ item, html: null });
    try {
      const res = await fetch(`/api/admin/scheduled-emails/${item.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't load the email");
      setPreviewing({ item, html: data.html });
    } catch (err) {
      setPreviewing({ item, html: null, error: err instanceof Error ? err.message : "Couldn't load the email" });
    }
  };

  const saveTime = async () => {
    if (!moving) return;
    setBusy(moving.item.id);
    try {
      const res = await fetch(`/api/admin/scheduled-emails/${moving.item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleAt: new Date(moving.at).toISOString() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't change the time");
      setMoving(null);
    } catch (err) {
      await showAlert(err instanceof Error ? err.message : "Couldn't change the time", "Change time failed");
    } finally {
      setBusy(null);
      load();
    }
  };

  return (
    <div className="rounded-lg border border-[var(--a-line)]">
      <p className="a-section-label border-b border-[var(--a-line)] px-3 py-2 text-[var(--a-faint)]">
        Scheduled ({upcoming.length})
      </p>
      <ul className="divide-y divide-[var(--a-line)]">
        {upcoming.map((item) => (
          <li key={item.id} className="px-3 py-2.5 text-sm">
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 shrink-0 text-[var(--a-muted)]" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-[var(--a-ink)]">{item.subject}</p>
                <p className="truncate text-xs text-[var(--a-muted)]">
                  {formatSendTime(item.scheduledAt)} &middot; {item.recipientsLabel}
                </p>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 pl-7">
              <button type="button" className="a-btn h-8 px-2.5 text-xs" onClick={() => preview(item)}>
                <Eye className="h-3.5 w-3.5" aria-hidden />
                Preview
              </button>
              <button
                type="button"
                className="a-btn h-8 px-2.5 text-xs"
                onClick={() => setMoving({ item, at: toLocalInput(new Date(item.scheduledAt)) })}
                disabled={busy === item.id}
              >
                <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                Change time
              </button>
              <button type="button" className="a-btn h-8 px-2.5 text-xs" onClick={() => cancel(item)} disabled={busy === item.id}>
                <X className="h-3.5 w-3.5" aria-hidden />
                {busy === item.id && !moving ? "Cancelling…" : "Cancel"}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {previewing && (
        <Modal
          size="full"
          title={previewing.item.subject}
          description={`${formatSendTime(previewing.item.scheduledAt)} · ${previewing.item.recipientsLabel}`}
          onClose={() => setPreviewing(null)}
        >
          {previewing.html ? (
            <iframe
              srcDoc={previewing.html}
              sandbox="allow-popups allow-popups-to-escape-sandbox"
              className="block min-h-0 w-full flex-1 rounded-lg border border-[var(--a-line)] bg-white"
              title="Scheduled email"
            />
          ) : (
            <p className="py-16 text-center text-sm text-[var(--a-muted)]">{previewing.error ?? "Loading email…"}</p>
          )}
        </Modal>
      )}

      {moving && (
        <Modal
          size="sm"
          title="Change send time"
          description={moving.item.subject}
          onClose={() => setMoving(null)}
          busy={busy === moving.item.id}
          footer={
            <>
              <button type="button" className="a-btn" onClick={() => setMoving(null)} disabled={busy === moving.item.id}>
                Back
              </button>
              <button type="button" className="a-btn a-btn-primary" onClick={saveTime} disabled={!moving.at || busy === moving.item.id}>
                {busy === moving.item.id ? "Saving…" : "Save new time"}
              </button>
            </>
          }
        >
          <input
            type="datetime-local"
            className="a-input"
            value={moving.at}
            min={toLocalInput(new Date(Date.now() + 2 * 60_000))}
            max={toLocalInput(new Date(Date.now() + 30 * 86_400_000))}
            onChange={(e) => setMoving({ ...moving, at: e.target.value })}
            aria-label="New send time"
          />
        </Modal>
      )}
    </div>
  );
}
