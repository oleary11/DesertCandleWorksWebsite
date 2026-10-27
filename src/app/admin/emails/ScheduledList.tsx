"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, X } from "lucide-react";
import { useModal } from "@/hooks/useModal";
import type { ScheduledEmail } from "@/lib/scheduledEmails";

export const formatSendTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

/** Upcoming scheduled sends under the Send button, each with Cancel. */
export default function ScheduledList({ refreshKey }: { refreshKey: number }) {
  const { showAlert, showConfirm } = useModal();
  const [items, setItems] = useState<ScheduledEmail[]>([]);
  const [cancelling, setCancelling] = useState<string | null>(null);

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
    setCancelling(item.id);
    try {
      const res = await fetch(`/api/admin/scheduled-emails/${item.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't cancel it");
    } catch (err) {
      await showAlert(err instanceof Error ? err.message : "Couldn't cancel it", "Cancel failed");
    } finally {
      setCancelling(null);
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
          <li key={item.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
            <Clock className="h-4 w-4 shrink-0 text-[var(--a-muted)]" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-[var(--a-ink)]">{item.subject}</p>
              <p className="truncate text-xs text-[var(--a-muted)]">
                {formatSendTime(item.scheduledAt)} &middot; {item.recipientsLabel}
              </p>
            </div>
            <button
              type="button"
              className="a-btn h-8 px-2.5 text-xs"
              onClick={() => cancel(item)}
              disabled={cancelling === item.id}
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              {cancelling === item.id ? "Cancelling…" : "Cancel"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
