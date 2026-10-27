"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Archive, Check, Copy, Download, Link2, Plus, QrCode, RotateCcw, X } from "lucide-react";
import PageHeader from "../_components/PageHeader";
import { Badge, Modal, Segmented } from "../_components/ui";
import { SOURCE_PRESETS, sourceLabel } from "@/lib/attributionShared";

type LinkRow = {
  id: string;
  slug: string;
  name: string;
  destination: string;
  source: string;
  campaign: string | null;
  promoCode: string | null;
  clicks: number;
  lastClickAt: string | null;
  archived: boolean;
  createdAt: string;
  orders: number;
  revenueCents: number;
};

type SourceRow = { source: string; orders: number; revenueCents: number };

const SITE = "https://www.desertcandleworks.com";
const shortUrl = (slug: string) => `${SITE}/go/${slug}`;
const money = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const slugify = (v: string) =>
  v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

const DESTINATIONS = [
  { value: "/shop", label: "Shop" },
  { value: "/", label: "Home page" },
  { value: "/about", label: "About" },
  { value: "custom", label: "A specific page…" },
];

const EMPTY = { name: "", slug: "", slugEdited: false, source: "instagram", destination: "/shop", customPath: "", campaign: "", promoCode: "" };

export default function LinksPage() {
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [days, setDays] = useState<"30" | "90" | "365">("30");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [qrFor, setQrFor] = useState<LinkRow | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/links?days=${days}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load links");
      setLinks(data.links);
      setSources(data.sources);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load links");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(text);
    setTimeout(() => setCopied((c) => (c === text ? null : c)), 1500);
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch("/api/admin/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug || slugify(form.name),
          source: form.source,
          destination: form.destination === "custom" ? form.customPath : form.destination,
          campaign: form.campaign,
          promoCode: form.promoCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create link");
      setForm(null);
      await load();
      copy(shortUrl(data.link.slug));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create link");
    } finally {
      setSaving(false);
    }
  };

  const setArchived = async (link: LinkRow, archived: boolean) => {
    await fetch("/api/admin/links", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: link.id, archived }),
    });
    load();
  };

  const visible = links.filter((l) => l.archived === showArchived);
  const totalWebsite = sources.reduce((sum, s) => sum + s.revenueCents, 0);
  const totals = useMemo(
    () => ({
      clicks: links.reduce((s, l) => s + l.clicks, 0),
      orders: links.reduce((s, l) => s + l.orders, 0),
      revenue: links.reduce((s, l) => s + l.revenueCents, 0),
    }),
    [links]
  );

  return (
    <div className="a-ui mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Tracking links"
        description="Short links for posts, emails and QR codes, so you can see which ones bring visitors and sales."
        actions={
          <button className="a-btn a-btn-primary" onClick={() => setForm({ ...EMPTY })}>
            <Plus className="h-4 w-4" aria-hidden />
            New link
          </button>
        }
      />

      {error && <p className="mb-4 rounded-lg border border-red-200 bg-[#fdecea] p-3 text-sm text-[#7a1a12]">{error}</p>}

      {/* Where sales come from */}
      <section className="a-card mb-6 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--a-ink)]">Where website sales come from</h2>
            <p className="text-sm text-[var(--a-muted)]">
              Credited to the last link, tagged email or referring site before the purchase. Started tracking Oct 26, 2026, so older orders show as
              &ldquo;Not tracked&rdquo;.
            </p>
          </div>
          <Segmented
            label="Period"
            value={days}
            onChange={setDays}
            options={[
              { value: "30", label: "30 days" },
              { value: "90", label: "90 days" },
              { value: "365", label: "1 year" },
            ]}
          />
        </div>
        {loading ? (
          <p className="py-6 text-sm text-[var(--a-muted)]">Loading…</p>
        ) : sources.length === 0 ? (
          <p className="py-6 text-sm text-[var(--a-muted)]">No website orders in this period yet.</p>
        ) : (
          <ul className="space-y-2.5">
            {sources.map((s) => {
              const share = totalWebsite ? s.revenueCents / totalWebsite : 0;
              return (
                <li key={s.source} className="grid grid-cols-[minmax(0,140px)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[180px_1fr_200px]">
                  <span className="truncate font-medium text-[var(--a-ink)]">{s.source === "untracked" ? "Not tracked (before Oct 26)" : sourceLabel(s.source)}</span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-[var(--a-canvas)]">
                    <span className="block h-full rounded-full bg-[#b97835]" style={{ width: `${Math.max(2, share * 100)}%` }} />
                  </span>
                  <span className="text-right tabular-nums text-[var(--a-muted)]">
                    <span className="font-medium text-[var(--a-ink)]">{money(s.revenueCents)}</span> · {s.orders} order{s.orders === 1 ? "" : "s"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Links */}
      <section className="a-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--a-line)] px-5 py-3">
          <p className="text-sm text-[var(--a-muted)]">
            {totals.clicks.toLocaleString()} clicks · {totals.orders} orders · {money(totals.revenue)} from links
          </p>
          <button className="text-sm text-[var(--a-muted)] hover:text-[var(--a-ink)] hover:underline" onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? "Show active links" : "Show archived"}
          </button>
        </div>

        {loading ? (
          <p className="px-5 py-14 text-center text-sm text-[var(--a-muted)]">Loading…</p>
        ) : visible.length === 0 ? (
          <div className="px-5 py-14 text-center text-sm text-[var(--a-muted)]">
            <Link2 className="mx-auto mb-2 h-6 w-6 text-[var(--a-faint)]" aria-hidden />
            {showArchived ? "No archived links." : "No links yet. Make one for your next post, email or booth sign."}
          </div>
        ) : (
          <ul className="divide-y divide-[var(--a-line)]">
            {visible.map((link) => {
              const url = shortUrl(link.slug);
              const conversion = link.clicks ? (link.orders / link.clicks) * 100 : 0;
              return (
                <li key={link.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-[var(--a-ink)]">{link.name}</p>
                      <Badge tone="neutral">{sourceLabel(link.source)}</Badge>
                      {link.promoCode && <Badge tone="amber">Code {link.promoCode}</Badge>}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <button
                        className="inline-flex items-center gap-1.5 font-mono text-[13px] text-[var(--a-accent-ink)] hover:underline"
                        onClick={() => copy(url)}
                        title="Copy link"
                      >
                        {url.replace("https://", "")}
                        {copied === url ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
                      </button>
                      <span className="text-[var(--a-faint)]">→ {link.destination}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 lg:justify-end">
                    {[
                      ["Clicks", link.clicks.toLocaleString()],
                      ["Orders", String(link.orders)],
                      ["Revenue", money(link.revenueCents)],
                      ["Conversion", link.clicks ? `${conversion.toFixed(1)}%` : "—"],
                    ].map(([label, value]) => (
                      <div key={label} className="min-w-[64px]">
                        <p className="text-xs text-[var(--a-muted)]">{label}</p>
                        <p className="font-semibold tabular-nums text-[var(--a-ink)]">{value}</p>
                      </div>
                    ))}
                    <div className="flex gap-1">
                      <button className="a-icon-btn h-9 w-9" onClick={() => setQrFor(link)} aria-label="QR code" title="QR code">
                        <QrCode className="h-4 w-4" aria-hidden />
                      </button>
                      <button
                        className="a-icon-btn h-9 w-9"
                        onClick={() => setArchived(link, !link.archived)}
                        aria-label={link.archived ? "Restore link" : "Archive link"}
                        title={link.archived ? "Restore" : "Archive (the link will go to the home page)"}
                      >
                        {link.archived ? <RotateCcw className="h-4 w-4" aria-hidden /> : <Archive className="h-4 w-4" aria-hidden />}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {form && (
        <Modal
          title="New tracking link"
          description="Use a different link for each place you share it, so you can compare them."
          onClose={() => setForm(null)}
          busy={saving}
          footer={
            <>
              <button className="a-btn" onClick={() => setForm(null)} disabled={saving}>
                Cancel
              </button>
              <button className="a-btn a-btn-primary" onClick={save} disabled={saving || !form.name.trim()}>
                {saving ? "Creating…" : "Create and copy link"}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            {formError && <p className="rounded-lg border border-red-200 bg-[#fdecea] p-3 text-sm text-[#7a1a12]">{formError}</p>}
            <label className="block">
              <span className="a-label">Name</span>
              <input
                className="a-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value, slug: form.slugEdited ? form.slug : slugify(e.target.value) })}
                placeholder="Instagram bio, Fall reel, Booth QR code…"
                autoFocus
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="a-label">Where you&apos;ll share it</span>
                <select className="a-select" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                  {SOURCE_PRESETS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="a-label">Opens</span>
                <select className="a-select" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })}>
                  {DESTINATIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {form.destination === "custom" && (
              <label className="block">
                <span className="a-label">Page</span>
                <input
                  className="a-input font-mono text-[13px]"
                  value={form.customPath}
                  onChange={(e) => setForm({ ...form, customPath: e.target.value })}
                  placeholder="/shop/bulleit-95-rye-750ml-candle or paste a desertcandleworks.com link"
                />
              </label>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="a-label">Promo code (optional)</span>
                <input
                  className="a-input font-mono uppercase"
                  value={form.promoCode}
                  onChange={(e) => setForm({ ...form, promoCode: e.target.value.toUpperCase() })}
                  placeholder="GIFTEARLY"
                />
                <p className="a-help">Applied automatically in their cart.</p>
              </label>
              <label className="block">
                <span className="a-label">Campaign (optional)</span>
                <input className="a-input" value={form.campaign} onChange={(e) => setForm({ ...form, campaign: e.target.value })} placeholder="Fall sale" />
                <p className="a-help">Groups links for the same promotion.</p>
              </label>
            </div>
            <label className="block">
              <span className="a-label">Short link</span>
              <div className="flex items-center rounded-lg border border-[var(--a-line)] bg-[var(--a-canvas)] pl-3 text-sm">
                <span className="shrink-0 text-[var(--a-muted)]">desertcandleworks.com/go/</span>
                <input
                  className="min-w-0 flex-1 bg-transparent px-1 py-2 font-mono text-[13px] outline-none"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: slugify(e.target.value), slugEdited: true })}
                  placeholder="fall-reel"
                />
              </div>
            </label>
          </div>
        </Modal>
      )}

      {qrFor && <QrModal link={qrFor} onClose={() => setQrFor(null)} />}
    </div>
  );
}

function QrModal({ link, onClose }: { link: LinkRow; onClose: () => void }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const url = shortUrl(link.slug);

  useEffect(() => {
    QRCode.toDataURL(url, { width: 1024, margin: 2, color: { dark: "#2f2a25", light: "#ffffff" } })
      .then(setDataUrl)
      .catch(() => setDataUrl(null));
  }, [url]);

  return (
    <Modal
      size="sm"
      title={`QR code: ${link.name}`}
      description="Print it on booth signs, flyers or packaging. Scans count as clicks for this link."
      onClose={onClose}
      footer={
        <>
          <button className="a-btn" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden />
            Close
          </button>
          {dataUrl && (
            <a className="a-btn a-btn-primary" href={dataUrl} download={`dcw-${link.slug}-qr.png`}>
              <Download className="h-4 w-4" aria-hidden />
              Download PNG
            </a>
          )}
        </>
      }
    >
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={dataUrl} alt={`QR code for ${url}`} className="mx-auto w-64 rounded-lg border border-[var(--a-line)]" />
      ) : (
        <p className="py-10 text-center text-sm text-[var(--a-muted)]">Making QR code…</p>
      )}
      <p className="mt-3 text-center font-mono text-xs text-[var(--a-muted)]">{url.replace("https://", "")}</p>
    </Modal>
  );
}
