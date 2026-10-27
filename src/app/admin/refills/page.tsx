"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import PageHeader from "../_components/PageHeader";
import { Badge, Segmented } from "../_components/ui";
import { useModal } from "@/hooks/useModal";
import type { RefillRequest, RefillStatus } from "@/lib/refills";

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const label = (r: RefillRequest) => `R-${1000 + r.number}`;

const STATUS: Record<RefillStatus, { text: string; tone: "neutral" | "amber" | "green" | "red" | "blue" }> = {
  requested: { text: "Waiting for bottle", tone: "amber" },
  awaiting_payment: { text: "Payment link sent", tone: "blue" },
  paid: { text: "Paid, ready to pour", tone: "green" },
  done: { text: "Returned", tone: "neutral" },
  broken: { text: "Arrived broken", tone: "red" },
  cancelled: { text: "Cancelled", tone: "neutral" },
};

export default function RefillsAdminPage() {
  const { showAlert, showConfirm, showPrompt } = useModal();
  const [refills, setRefills] = useState<RefillRequest[] | null>(null);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/refills")
      .then((res) => (res.ok ? res.json() : { refills: [] }))
      .then((data) => setRefills(data.refills))
      .catch(() => setRefills([]));
  }, []);
  useEffect(load, [load]);

  const act = async (r: RefillRequest, action: "received" | "broken" | "done" | "cancel") => {
    let note: string | undefined;
    if (action === "received") {
      const ok = await showConfirm(
        `Mark ${label(r)} as arrived in one piece? ${r.name} gets an email with a link to pay $20${r.returnMethod === "ship" ? " plus return shipping (quoted now)" : ""}.`,
        "Bottle received"
      );
      if (!ok) return;
    } else if (action === "broken") {
      const answer = await showPrompt(
        `${r.name} gets a "sorry, it arrived broken" email (nothing was charged). Add a note? Tip: issue store credit on the Gift Cards page and mention it here.`,
        "Arrived broken",
        ""
      );
      if (answer === null) return;
      note = answer;
    } else if (action === "cancel" && !(await showConfirm(`Cancel refill ${label(r)}?`, "Cancel refill"))) {
      return;
    }
    setBusy(r.id);
    try {
      const res = await fetch("/api/admin/refills", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id, action, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
    } catch (err) {
      await showAlert(err instanceof Error ? err.message : "Something went wrong", "Error");
    } finally {
      setBusy(null);
      load();
    }
  };

  const shown = (refills ?? []).filter((r) => filter === "all" || ["requested", "awaiting_payment", "paid"].includes(r.status));

  return (
    <div className="a-ui mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Refills"
        description="Bottle refill requests from /refills. Mark a bottle received when it arrives intact and they're emailed a payment link."
        actions={
          <Segmented
            label="Show"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "open", label: "Open" },
              { value: "all", label: "All" },
            ]}
          />
        }
      />

      {refills === null ? (
        <p className="py-16 text-center text-sm text-[var(--a-muted)]">Loading refills…</p>
      ) : shown.length === 0 ? (
        <div className="a-card flex flex-col items-center px-6 py-16 text-center">
          <span className="a-icon-tile mb-3 h-11 w-11">
            <RefreshCw className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </span>
          <p className="font-medium text-[var(--a-ink)]">{filter === "open" ? "No open refills" : "No refill requests yet"}</p>
          <p className="mt-1 text-sm text-[var(--a-muted)]">Requests from desertcandleworks.com/refills show up here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((r) => (
            <div key={r.id} className="a-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-[var(--a-ink)]">
                    <span className="font-mono">{label(r)}</span> · {r.name}
                  </p>
                  <p className="mt-0.5 text-sm text-[var(--a-muted)]">
                    {r.bottle} → {r.scent}
                  </p>
                </div>
                <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].text}</Badge>
              </div>
              <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                <div>
                  <dt className="inline text-[var(--a-muted)]">Contact: </dt>
                  <dd className="inline">
                    {r.email} · {r.phone}
                  </dd>
                </div>
                <div>
                  <dt className="inline text-[var(--a-muted)]">Sending: </dt>
                  <dd className="inline">{r.sendMethod === "mail" ? "By mail" : "Drop-off"}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="inline text-[var(--a-muted)]">Return: </dt>
                  <dd className="inline">
                    {r.returnMethod === "ship" && r.address
                      ? `Ship to ${[r.address.line1, r.address.line2, `${r.address.city}, ${r.address.state} ${r.address.postalCode}`].filter(Boolean).join(", ")}`
                      : "Local pickup"}
                    {r.shippingCents ? ` · shipping ${money(r.shippingCents)}${r.shippingService ? ` (${r.shippingService})` : ""}` : ""}
                    {r.paidCents ? ` · paid ${money(r.paidCents)}` : ""}
                  </dd>
                </div>
                {r.notes && (
                  <div className="sm:col-span-2">
                    <dt className="inline text-[var(--a-muted)]">Notes: </dt>
                    <dd className="inline">{r.notes}</dd>
                  </div>
                )}
                <div className="text-xs text-[var(--a-faint)] sm:col-span-2">Requested {new Date(r.createdAt).toLocaleString()}</div>
              </dl>
              <div className="mt-3 flex flex-wrap gap-2">
                {r.status === "requested" && (
                  <>
                    <button className="a-btn a-btn-primary a-btn-sm" disabled={busy === r.id} onClick={() => act(r, "received")}>
                      {busy === r.id ? "Working…" : "Received, send payment link"}
                    </button>
                    <button className="a-btn a-btn-sm" disabled={busy === r.id} onClick={() => act(r, "broken")}>
                      Arrived broken
                    </button>
                  </>
                )}
                {r.status === "paid" && (
                  <button className="a-btn a-btn-primary a-btn-sm" disabled={busy === r.id} onClick={() => act(r, "done")}>
                    Mark returned (shipped / picked up)
                  </button>
                )}
                {["requested", "awaiting_payment"].includes(r.status) && (
                  <button className="a-btn a-btn-sm" disabled={busy === r.id} onClick={() => act(r, "cancel")}>
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
