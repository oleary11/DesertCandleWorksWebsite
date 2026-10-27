"use client";

import { useCallback, useEffect, useState } from "react";
import { Gift, Plus } from "lucide-react";
import PageHeader from "../_components/PageHeader";
import { Badge, Modal, Stat } from "../_components/ui";
import { useModal } from "@/hooks/useModal";
import type { GiftCard } from "@/lib/giftCards";

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default function GiftCardsAdminPage() {
  const { showAlert, showConfirm } = useModal();
  const [cards, setCards] = useState<GiftCard[] | null>(null);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ amount: "", recipientEmail: "", recipientName: "", message: "", sendEmail: true });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch("/api/admin/gift-cards")
      .then((res) => (res.ok ? res.json() : { giftCards: [] }))
      .then((data) => setCards(data.giftCards))
      .catch(() => setCards([]));
  }, []);
  useEffect(load, [load]);

  const act = async (card: GiftCard, action: "resend" | "void") => {
    if (action === "void" && !(await showConfirm(`Cancel ${card.code}? Its ${money(card.balanceCents)} balance can't be used anymore.`, "Cancel gift card")))
      return;
    const res = await fetch("/api/admin/gift-cards", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: card.id, action }),
    });
    const data = await res.json();
    if (!res.ok) await showAlert(data.error || "Something went wrong", "Error");
    else if (action === "resend") await showAlert(`Sent ${card.code} to ${card.recipientEmail} again.`, "Email sent");
    load();
  };

  const create = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/gift-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't create the gift card");
      setCreating(false);
      setForm({ amount: "", recipientEmail: "", recipientName: "", message: "", sendEmail: true });
      await showAlert(
        `${data.giftCard.code} for ${money(data.giftCard.initialCents)}${form.sendEmail ? ` was emailed to ${data.giftCard.recipientEmail}` : " is ready"}.`,
        "Gift card created"
      );
      load();
    } catch (err) {
      await showAlert(err instanceof Error ? err.message : "Couldn't create the gift card", "Error");
    } finally {
      setBusy(false);
    }
  };

  const shown = (cards ?? []).filter((c) =>
    [c.code, c.recipientEmail, c.recipientName, c.purchaserName, c.purchaserEmail]
      .filter(Boolean)
      .some((v) => v!.toLowerCase().includes(query.trim().toLowerCase()))
  );
  const active = (cards ?? []).filter((c) => c.status === "active");

  return (
    <div className="a-ui mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Gift Cards"
        description="Gift cards bought on the site, and store credit you've issued."
        actions={
          <button onClick={() => setCreating(true)} className="a-btn a-btn-primary">
            <Plus className="h-4 w-4" aria-hidden />
            Issue store credit
          </button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Sold" value={money((cards ?? []).filter((c) => c.source === "purchase").reduce((n, c) => n + c.initialCents, 0))} />
        <Stat label="Outstanding balance" value={money(active.reduce((n, c) => n + c.balanceCents, 0))} hint="Owed in candles" />
        <Stat label="Spent" value={money((cards ?? []).reduce((n, c) => n + c.initialCents - c.balanceCents, 0))} />
        <Stat label="Cards" value={(cards ?? []).length} />
      </div>

      <input
        className="a-input mb-4 max-w-sm"
        placeholder="Search code, name or email"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search gift cards"
      />

      {cards === null ? (
        <p className="py-16 text-center text-sm text-[var(--a-muted)]">Loading gift cards…</p>
      ) : shown.length === 0 ? (
        <div className="a-card flex flex-col items-center px-6 py-16 text-center">
          <span className="a-icon-tile mb-3 h-11 w-11">
            <Gift className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </span>
          <p className="font-medium text-[var(--a-ink)]">{cards.length ? "No matches" : "No gift cards yet"}</p>
          <p className="mt-1 text-sm text-[var(--a-muted)]">Gift cards bought on /gift-cards show up here.</p>
        </div>
      ) : (
        <div className="a-card divide-y divide-[var(--a-line)]">
          {shown.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-sm">
              <div className="min-w-[160px]">
                <p className="font-mono font-semibold text-[var(--a-ink)]">{c.code}</p>
                <p className="text-xs text-[var(--a-muted)]">
                  {c.source === "admin" ? "Store credit" : `From ${c.purchaserName || c.purchaserEmail || "?"}`} ·{" "}
                  {new Date(c.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[var(--a-ink)]">{c.recipientName || c.recipientEmail}</p>
                <p className="truncate text-xs text-[var(--a-muted)]">
                  {c.recipientEmail}
                  {c.emailedAt
                    ? ` · ${new Date(c.emailedAt).getTime() > Date.now() ? "sends" : "emailed"} ${new Date(c.emailedAt).toLocaleDateString()}`
                    : ""}
                </p>
              </div>
              <div className="text-right tabular-nums">
                <p className="font-medium text-[var(--a-ink)]">{money(c.balanceCents)}</p>
                <p className="text-xs text-[var(--a-muted)]">of {money(c.initialCents)}</p>
              </div>
              <div className="flex items-center gap-2">
                {c.status === "void" ? (
                  <Badge tone="red">Cancelled</Badge>
                ) : c.balanceCents === 0 ? (
                  <Badge>Used up</Badge>
                ) : (
                  <Badge tone="green">Active</Badge>
                )}
                {c.status === "active" && (
                  <>
                    <button className="a-btn a-btn-sm" onClick={() => act(c, "resend")}>
                      Resend
                    </button>
                    <button className="a-btn a-btn-sm" onClick={() => act(c, "void")}>
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {creating && (
        <Modal
          title="Issue store credit"
          description="A gift card from you, for example to make up for a broken bottle. Emailed to them with the code."
          onClose={() => setCreating(false)}
          busy={busy}
          footer={
            <>
              <button className="a-btn" onClick={() => setCreating(false)} disabled={busy}>
                Back
              </button>
              <button className="a-btn a-btn-primary" onClick={create} disabled={busy || !form.amount || !form.recipientEmail}>
                {busy ? "Creating…" : "Create gift card"}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <label className="block">
              <span className="a-label">Amount ($)</span>
              <input
                className="a-input"
                type="number"
                min={1}
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="a-label">Their email</span>
              <input className="a-input" type="email" value={form.recipientEmail} onChange={(e) => setForm({ ...form, recipientEmail: e.target.value })} />
            </label>
            <label className="block">
              <span className="a-label">Their name (optional)</span>
              <input className="a-input" value={form.recipientName} onChange={(e) => setForm({ ...form, recipientName: e.target.value })} />
            </label>
            <label className="block">
              <span className="a-label">Note (optional)</span>
              <textarea
                className="a-textarea"
                rows={3}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Sorry your bottle didn't make it. Here's credit toward a new candle."
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.sendEmail} onChange={(e) => setForm({ ...form, sendEmail: e.target.checked })} />
              Email it to them now
            </label>
          </div>
        </Modal>
      )}
    </div>
  );
}
