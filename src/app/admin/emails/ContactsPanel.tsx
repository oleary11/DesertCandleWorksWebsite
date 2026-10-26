"use client";

import { useEffect, useMemo, useState } from "react";
import { Mail, RefreshCw, Search } from "lucide-react";
import { Badge } from "../_components/ui";

export type Contact = {
  email: string;
  name: string | null;
  phone: string | null;
  location: string | null;
  sources: Array<"website" | "in_person" | "account" | "newsletter" | "square">;
  orders: number;
  spentCents: number;
  lastOrderAt: string | null;
  firstSeenAt: string | null;
  optedOut: boolean;
};

const SOURCES: { value: Contact["sources"][number]; label: string; tone: "neutral" | "amber" | "green" | "blue" }[] = [
  { value: "website", label: "Website order", tone: "blue" },
  { value: "in_person", label: "In person", tone: "amber" },
  { value: "newsletter", label: "Newsletter", tone: "green" },
  { value: "account", label: "Account", tone: "neutral" },
  { value: "square", label: "Square", tone: "neutral" },
];

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const day = (value: string | null) =>
  value ? new Date(value).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "—";

export default function ContactsPanel({ onEmail }: { onEmail: (contacts: Contact[]) => void }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/contacts", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load contacts");
      setContacts(data.contacts);
      setWarnings(data.warnings ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load contacts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts.filter(
      (c) =>
        (!source || (source === "opted_out" ? c.optedOut : c.sources.includes(source as Contact["sources"][number]))) &&
        (!q || [c.name, c.email, c.phone, c.location].some((v) => v?.toLowerCase().includes(q)))
    );
  }, [contacts, query, source]);

  const emailable = visible.filter((c) => !c.optedOut);
  const allVisibleSelected = emailable.length > 0 && emailable.every((c) => selected.has(c.email));
  const toggle = (email: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  const toggleAllVisible = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) emailable.forEach((c) => next.delete(c.email));
      else emailable.forEach((c) => next.add(c.email));
      return next;
    });

  const setSubscribed = async (contact: Contact, subscribed: boolean) => {
    await fetch("/api/admin/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: contact.email, subscribed }),
    });
    setContacts((prev) => prev.map((c) => (c.email === contact.email ? { ...c, optedOut: !subscribed } : c)));
    if (!subscribed) setSelected((prev) => new Set([...prev].filter((e) => e !== contact.email)));
  };

  const count = (value: string) =>
    value === "opted_out" ? contacts.filter((c) => c.optedOut).length : contacts.filter((c) => c.sources.includes(value as Contact["sources"][number])).length;
  const withOrders = contacts.filter((c) => c.orders > 0).length;
  const totalSpent = contacts.reduce((sum, c) => sum + c.spentCents, 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Contacts", value: contacts.length },
          { label: "Can receive mass email", value: contacts.filter((c) => !c.optedOut).length },
          { label: "Have ordered", value: withOrders },
          { label: "Lifetime spend", value: money(totalSpent) },
        ].map((s) => (
          <div key={s.label} className="a-card px-4 py-3">
            <p className="text-xs font-medium text-[var(--a-muted)]">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--a-ink)]">{loading ? "…" : s.value}</p>
          </div>
        ))}
      </div>

      {warnings.map((w) => (
        <p key={w} className="rounded-lg border border-amber-200 bg-[#fdf6e7] p-3 text-sm text-[#6b4a12]">
          {w}
        </p>
      ))}

      {/* Toolbar */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <label className="relative block flex-1">
          <span className="sr-only">Search contacts</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--a-faint)]" aria-hidden />
          <input
            type="search"
            className="a-input pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, phone or city…"
          />
        </label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by source">
          {[{ value: "", label: "All" }, ...SOURCES, { value: "opted_out", label: "Unsubscribed" }].map((s) => {
            const n = s.value ? count(s.value) : contacts.length;
            if (s.value && n === 0) return null;
            const active = source === s.value;
            return (
              <button
                key={s.value || "all"}
                type="button"
                aria-pressed={active}
                onClick={() => setSource(s.value)}
                className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm ${
                  active ? "border-[var(--a-ink)] bg-[var(--a-ink)] text-white" : "border-[var(--a-line)] bg-white text-[var(--a-muted)] hover:text-[var(--a-ink)]"
                }`}
              >
                {s.label}
                <span className={`text-xs tabular-nums ${active ? "text-white/70" : "text-[var(--a-faint)]"}`}>{n}</span>
              </button>
            );
          })}
        </div>
        <button className="a-icon-btn h-9 w-9" onClick={load} aria-label="Refresh" title="Refresh">
          <RefreshCw className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {/* Selection bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--a-line)] bg-white px-4 py-2.5">
        <p className="text-sm text-[var(--a-muted)]">
          {selected.size === 0 ? "Select people to email, or select everyone shown." : `${selected.size} selected`}
        </p>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <button className="a-btn a-btn-sm" onClick={() => setSelected(new Set())}>
              Clear
            </button>
          )}
          <button
            className="a-btn a-btn-primary a-btn-sm"
            disabled={selected.size === 0}
            onClick={() => onEmail(contacts.filter((c) => selected.has(c.email)))}
          >
            <Mail className="h-3.5 w-3.5" aria-hidden />
            Email {selected.size || ""} selected
          </button>
        </div>
      </div>

      <section className="a-card overflow-hidden">
        {error ? (
          <p className="px-4 py-14 text-center text-sm text-[var(--a-bad)]">{error}</p>
        ) : loading ? (
          <p className="px-4 py-14 text-center text-sm text-[var(--a-muted)]">Loading contacts…</p>
        ) : visible.length === 0 ? (
          <p className="px-4 py-14 text-center text-sm text-[var(--a-muted)]">No contacts match.</p>
        ) : (
          <>
            <table className="a-table hidden lg:table">
              <thead>
                <tr>
                  <th className="w-10">
                    <input type="checkbox" className="a-check" checked={allVisibleSelected} onChange={toggleAllVisible} aria-label="Select everyone shown" />
                  </th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Location</th>
                  <th>Source</th>
                  <th className="text-right">Orders</th>
                  <th className="text-right">Spent</th>
                  <th>Last order</th>
                  <th className="w-28" />
                </tr>
              </thead>
              <tbody>
                {visible.map((c) => (
                  <tr key={c.email} className={c.optedOut ? "opacity-60" : ""}>
                    <td>
                      <input
                        type="checkbox"
                        className="a-check"
                        checked={selected.has(c.email)}
                        disabled={c.optedOut}
                        onChange={() => toggle(c.email)}
                        aria-label={`Select ${c.email}`}
                      />
                    </td>
                    <td className="font-medium text-[var(--a-ink)]">{c.name || <span className="text-[var(--a-faint)]">—</span>}</td>
                    <td className="max-w-[240px] truncate" title={c.email}>
                      {c.email}
                    </td>
                    <td className="whitespace-nowrap">{c.phone || <span className="text-[var(--a-faint)]">—</span>}</td>
                    <td className="whitespace-nowrap">{c.location || <span className="text-[var(--a-faint)]">—</span>}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {c.sources.map((s) => {
                          const meta = SOURCES.find((x) => x.value === s)!;
                          return (
                            <Badge key={s} tone={meta.tone}>
                              {meta.label}
                            </Badge>
                          );
                        })}
                        {c.optedOut && <Badge tone="red">Unsubscribed</Badge>}
                      </div>
                    </td>
                    <td className="text-right tabular-nums">{c.orders || "—"}</td>
                    <td className="text-right tabular-nums">{c.spentCents ? money(c.spentCents) : "—"}</td>
                    <td className="whitespace-nowrap text-[var(--a-muted)]">{day(c.lastOrderAt)}</td>
                    <td className="text-right">
                      <button
                        className="text-xs text-[var(--a-muted)] hover:text-[var(--a-ink)] hover:underline"
                        onClick={() => setSubscribed(c, c.optedOut)}
                      >
                        {c.optedOut ? "Resubscribe" : "Unsubscribe"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="divide-y divide-[var(--a-line)] lg:hidden">
              <li className="flex items-center gap-3 bg-[var(--a-canvas)] px-4 py-2">
                <input type="checkbox" className="a-check" checked={allVisibleSelected} onChange={toggleAllVisible} aria-label="Select everyone shown" />
                <span className="text-sm text-[var(--a-muted)]">Select everyone shown</span>
              </li>
              {visible.map((c) => (
                <li key={c.email} className={`flex gap-3 px-4 py-3 ${c.optedOut ? "opacity-60" : ""}`}>
                  <input
                    type="checkbox"
                    className="a-check mt-1"
                    checked={selected.has(c.email)}
                    disabled={c.optedOut}
                    onChange={() => toggle(c.email)}
                    aria-label={`Select ${c.email}`}
                  />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="truncate font-medium text-[var(--a-ink)]">{c.name || c.email}</p>
                    {c.name && <p className="truncate text-[var(--a-muted)]">{c.email}</p>}
                    <p className="text-xs text-[var(--a-muted)]">
                      {[c.phone, c.location, c.orders ? `${c.orders} order${c.orders === 1 ? "" : "s"} · ${money(c.spentCents)}` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {c.sources.map((s) => (
                        <Badge key={s} tone={SOURCES.find((x) => x.value === s)!.tone}>
                          {SOURCES.find((x) => x.value === s)!.label}
                        </Badge>
                      ))}
                      {c.optedOut && <Badge tone="red">Unsubscribed</Badge>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
