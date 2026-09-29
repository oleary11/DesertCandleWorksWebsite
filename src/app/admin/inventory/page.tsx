"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  RefreshCw,
  Search,
  ChevronUp,
  ChevronDown,
  Archive,
  ArchiveRestore,
  Trash2,
  Plus,
  Minus,
  X,
  Flame,
  Upload,
  Settings2,
} from "lucide-react";
import PageHeader from "../_components/PageHeader";
import { Badge, Modal, Segmented, Stat } from "../_components/ui";
import { useModal } from "@/hooks/useModal";
import CandleSpinner from "@/components/CandleSpinner";

type BottleInventoryItem = {
  id: string;
  name: string;
  qtyUncut: number;
  qtyCutUnpolished: number;
  qtyCutPolished: number;
  qtyCutPoured: number;
  defaultPriceCents?: number;
  capacityWaterOz?: number;
  imageUrl?: string;
  alcoholType?: string;
  linkedCandleProductSlug?: string;
  linkedSizeId?: string;
  usableForHomeGoods: boolean;
  archived: boolean;
};

type AlcoholType = { id: string; name: string; sortOrder?: number };

type UnmatchedCandle = { slug: string; name: string };

const DEFAULT_SEARCH_TEMPLATE = "[name] bottle white background";
const SEARCH_TEMPLATE_STORAGE_KEY = "dcw-bottle-image-search-template";

function buildSearchQuery(template: string, bottleName: string): string {
  return template.includes("[name]")
    ? template.replace(/\[name\]/g, bottleName)
    : `${bottleName} ${template}`;
}

type SortKey = "image" | "name" | "alcoholType" | "capacityWaterOz" | "qtyUncut" | "qtyCutUnpolished" | "qtyCutPolished" | "qtyCutPoured";
type StatusFilter = "all" | "active" | "archived";

type NewBottleCounts = {
  qtyUncut: number;
  qtyCutUnpolished: number;
  qtyCutPolished: number;
  capacityWaterOz: number;
};

function getSortValue(item: BottleInventoryItem, key: SortKey): number | string {
  if (key === "image") return item.imageUrl ? 1 : 0;
  if (key === "capacityWaterOz") return item.capacityWaterOz ?? -1;
  if (key === "alcoholType") return item.alcoholType ?? "";
  return key === "name" ? item.name : item[key];
}

function Stepper({
  value,
  onChange,
  disabled,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <div className={`mx-auto flex w-fit items-center rounded-lg border border-[var(--a-line-strong)] bg-[var(--a-surface)] ${disabled ? "opacity-40" : ""}`}>
      <button
        type="button"
        className="flex h-8 w-7 items-center justify-center rounded-l-lg text-[var(--a-muted)] hover:bg-[var(--a-tint)] hover:text-[var(--a-ink)]"
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={disabled}
        aria-label={label ? `Decrease ${label}` : "Decrease"}
      >
        <Minus className="h-3 w-3" aria-hidden />
      </button>
      <input
        className="h-8 w-10 border-x border-[var(--a-line)] bg-transparent text-center text-sm tabular-nums outline-none focus:bg-[var(--a-canvas)]"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        aria-label={label}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^0-9]/g, "");
          onChange(digits === "" ? 0 : Math.max(0, Number(digits)));
        }}
        disabled={disabled}
      />
      <button
        type="button"
        className="flex h-8 w-7 items-center justify-center rounded-r-lg text-[var(--a-muted)] hover:bg-[var(--a-tint)] hover:text-[var(--a-ink)]"
        onClick={() => onChange(value + 1)}
        disabled={disabled}
        aria-label={label ? `Increase ${label}` : "Increase"}
      >
        <Plus className="h-3 w-3" aria-hidden />
      </button>
    </div>
  );
}

/**
 * Owns its own name/counts state so typing here only re-renders this small
 * form, not the full (often 100+ row) bottle table in the parent — that
 * colocation is what made typing feel laggy on slower devices like iPads.
 */
function AddBottleForm({
  onAdd,
}: {
  onAdd: (name: string, counts: NewBottleCounts) => Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [counts, setCounts] = useState<NewBottleCounts>({
    qtyUncut: 0,
    qtyCutUnpolished: 0,
    qtyCutPolished: 0,
    capacityWaterOz: 0,
  });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const n = name.trim();
    if (!n || submitting) return;
    setSubmitting(true);
    const ok = await onAdd(n, counts);
    setSubmitting(false);
    if (ok) {
      setName("");
      setCounts({ qtyUncut: 0, qtyCutUnpolished: 0, qtyCutPolished: 0, capacityWaterOz: 0 });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="block flex-1">
          <span className="sr-only">Bottle name</span>
          <input
            className="a-input"
            placeholder="e.g. Empty Jack Daniels 1L (never poured)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleSubmit(); }}
            autoFocus
          />
        </label>
        <button className="a-btn a-btn-primary" onClick={handleSubmit} disabled={submitting || !name.trim()}>
          <Plus className="h-4 w-4" aria-hidden /> Add bottle
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([
          ["qtyUncut", "Uncut"],
          ["qtyCutUnpolished", "Cut, unpolished"],
          ["qtyCutPolished", "Cut, polished"],
        ] as const).map(([key, label]) => (
          <div key={key}>
            <span className="a-label text-center text-xs text-[var(--a-muted)]">{label}</span>
            <Stepper
              label={label}
              value={counts[key]}
              onChange={(value) => setCounts((current) => ({ ...current, [key]: value }))}
            />
          </div>
        ))}
        <label className="block">
          <span className="a-label text-center text-xs text-[var(--a-muted)]">Water capacity (oz)</span>
          <input
            className="a-input mx-auto h-8 w-24 text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            type="number"
            min="0"
            step="0.1"
            value={counts.capacityWaterOz || ""}
            onChange={(e) => setCounts((current) => ({ ...current, capacityWaterOz: Math.max(0, Number(e.target.value) || 0) }))}
          />
        </label>
      </div>
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  align = "left",
  className,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: "asc" | "desc";
  onSort: (key: SortKey) => void;
  align?: "left" | "center";
  className?: string;
}) {
  const active = sortKey === activeKey;
  return (
    <th
      className={`${align === "center" ? "text-center" : ""} ${className ?? ""}`}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 whitespace-nowrap hover:text-[var(--a-ink)] ${active ? "text-[var(--a-ink)]" : ""}`}
      >
        {label}
        {active && (dir === "asc" ? <ChevronUp className="h-3 w-3" aria-hidden /> : <ChevronDown className="h-3 w-3" aria-hidden />)}
      </button>
    </th>
  );
}

export default function BottleInventoryAdminPage() {
  const { showAlert, showConfirm } = useModal();
  const [items, setItems] = useState<BottleInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [unmatched, setUnmatched] = useState<UnmatchedCandle[]>([]);
  const [alcoholTypes, setAlcoholTypes] = useState<AlcoholType[]>([]);

  // local editing copies + dirty tracking (staged, bulk-saved)
  const [edited, setEdited] = useState<Record<string, BottleInventoryItem>>({});
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // add-new form
  const [showAddForm, setShowAddForm] = useState(false);

  // search / filter / sort
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectAllRef = useRef<HTMLInputElement>(null);

  // per-row image upload
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetIdRef = useRef<string | null>(null);

  // default query template used to pre-fill the image search modal (persisted locally)
  const [searchTemplate, setSearchTemplate] = useState(DEFAULT_SEARCH_TEMPLATE);
  const [showSearchSettings, setShowSearchSettings] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(SEARCH_TEMPLATE_STORAGE_KEY);
    if (saved) setSearchTemplate(saved);
  }, []);

  function updateSearchTemplate(value: string) {
    setSearchTemplate(value);
    window.localStorage.setItem(SEARCH_TEMPLATE_STORAGE_KEY, value);
  }

  // per-row "search for an image online" modal
  const [imageSearchTarget, setImageSearchTarget] = useState<{ id: string; name: string } | null>(null);
  const [imageSearchQuery, setImageSearchQuery] = useState("");
  const [imageSearchResults, setImageSearchResults] = useState<
    Array<{ title: string; imageUrl: string; thumbnailUrl?: string; sourceUrl?: string }>
  >([]);
  const [imageSearchLoading, setImageSearchLoading] = useState(false);
  const [imageSearchError, setImageSearchError] = useState<string | null>(null);
  const [attachingUrl, setAttachingUrl] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/bottle-inventory", { cache: "no-store" });
    const j = await res.json();
    setItems(j.items || []);
    setEdited({});
    setDirtyIds(new Set());
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    fetch("/api/admin/alcohol-types?active=1", { cache: "no-store" })
      .then((res) => res.json())
      .then((j) => setAlcoholTypes(j.types || []))
      .catch(() => {});
  }, []);

  function markDirty(id: string, next: Partial<BottleInventoryItem>) {
    setEdited((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? items.find((t) => t.id === id)!), ...next },
    }));
    setDirtyIds((prev) => new Set(prev).add(id));
  }

  async function saveAll() {
    if (dirtyIds.size === 0) return;
    setSaving(true);
    const updates = Array.from(dirtyIds).map((id) => {
      const e = edited[id];
      return {
        id,
        name: e.name,
        qtyUncut: e.qtyUncut,
        qtyCutUnpolished: e.qtyCutUnpolished,
        qtyCutPolished: e.qtyCutPolished,
        capacityWaterOz: e.capacityWaterOz ?? null,
        alcoholType: e.alcoholType ?? null,
        usableForHomeGoods: e.usableForHomeGoods,
      };
    });
    const res = await fetch("/api/admin/bottle-inventory/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates }),
    });
    setSaving(false);
    if (res.ok) await load();
    else await showAlert("Save failed", "Error");
  }

  function discardAll() {
    setEdited({});
    setDirtyIds(new Set());
  }

  async function handleAddBottle(name: string, counts: NewBottleCounts): Promise<boolean> {
    const res = await fetch("/api/admin/bottle-inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, ...counts }),
    });
    if (res.ok) {
      setShowAddForm(false);
      await load();
      return true;
    }
    await showAlert("Create failed", "Error");
    return false;
  }

  async function toggleArchive(id: string, archived: boolean) {
    const res = await fetch(`/api/admin/bottle-inventory/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived }),
    });
    if (res.ok) await load();
    else await showAlert("Failed to update bottle type", "Error");
  }

  async function hardDelete(id: string) {
    const confirmed = await showConfirm(
      "Permanently delete this bottle type? This cannot be undone.",
      "Confirm Delete"
    );
    if (!confirmed) return;
    const res = await fetch(`/api/admin/bottle-inventory/${id}`, { method: "DELETE" });
    if (res.ok) await load();
    else await showAlert("Delete failed", "Error");
  }

  function triggerImageUpload(id: string) {
    uploadTargetIdRef.current = id;
    fileInputRef.current?.click();
  }

  async function handleImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const id = uploadTargetIdRef.current;
    e.target.value = ""; // allow re-selecting the same file next time
    if (!file || !id) return;

    setUploadingId(id);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const uploadRes = await fetch("/api/admin/upload", { method: "POST", body: fd });
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        await showAlert(`Upload failed: ${err.error || "Unknown error"}`, "Error");
        return;
      }
      const { url } = (await uploadRes.json()) as { url: string };

      const patchRes = await fetch(`/api/admin/bottle-inventory/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: url }),
      });
      if (patchRes.ok) await load();
      else await showAlert("Failed to save image", "Error");
    } finally {
      setUploadingId(null);
    }
  }

  async function runImageSearch(query: string) {
    setImageSearchLoading(true);
    setImageSearchError(null);
    try {
      const res = await fetch(`/api/admin/bottle-image-search?q=${encodeURIComponent(query)}`, { cache: "no-store" });
      const data = (await res.json()) as {
        results?: Array<{ title: string; imageUrl: string; thumbnailUrl?: string; sourceUrl?: string }>;
        error?: string;
      };
      if (!res.ok) {
        setImageSearchError(data.error || "Image search failed");
        setImageSearchResults([]);
        return;
      }
      setImageSearchResults(data.results || []);
    } catch {
      setImageSearchError("Image search failed");
      setImageSearchResults([]);
    } finally {
      setImageSearchLoading(false);
    }
  }

  function openImageSearch(bottle: BottleInventoryItem) {
    const query = buildSearchQuery(searchTemplate, bottle.name);
    setImageSearchTarget({ id: bottle.id, name: bottle.name });
    setImageSearchQuery(query);
    setImageSearchResults([]);
    setImageSearchError(null);
    void runImageSearch(query);
  }

  function closeImageSearch() {
    setImageSearchTarget(null);
    setImageSearchQuery("");
    setImageSearchResults([]);
    setImageSearchError(null);
    setAttachingUrl(null);
  }

  async function attachSearchResult(imageUrl: string) {
    if (!imageSearchTarget) return;
    setAttachingUrl(imageUrl);
    try {
      const fetchRes = await fetch("/api/admin/bottle-image-fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });
      const fetchData = (await fetchRes.json()) as { url?: string; error?: string };
      if (!fetchRes.ok || !fetchData.url) {
        await showAlert(`Couldn't use that image: ${fetchData.error || "Unknown error"}. Try another result.`, "Error");
        return;
      }

      const patchRes = await fetch(`/api/admin/bottle-inventory/${imageSearchTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: fetchData.url }),
      });
      if (!patchRes.ok) {
        await showAlert("Image saved but failed to attach to the bottle", "Error");
        return;
      }

      await load();
      closeImageSearch();
    } finally {
      setAttachingUrl(null);
    }
  }

  async function syncFromCandles() {
    setSyncing(true);
    const res = await fetch("/api/admin/bottle-inventory/sync", { method: "POST" });
    setSyncing(false);
    if (!res.ok) {
      await showAlert("Sync failed", "Error");
      return;
    }
    const j = await res.json();
    setUnmatched(j.unmatched || []);
    await load();
    await showAlert(
      `Added ${j.created.length} new bottle(s), linked ${j.linked.length} existing row(s) to candle stock.` +
        (j.unmatched.length ? ` ${j.unmatched.length} candle product name(s) need review (see below).` : ""),
      "Sync complete"
    );
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function bulkArchive(archived: boolean) {
    const updates = Array.from(selectedIds).map((id) => ({ id, archived }));
    await fetch("/api/admin/bottle-inventory/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates }),
    });
    setSelectedIds(new Set());
    await load();
  }

  async function bulkDelete() {
    const confirmed = await showConfirm(
      `Permanently delete ${selectedIds.size} bottle(s)? This cannot be undone.`,
      "Confirm Delete"
    );
    if (!confirmed) return;
    await Promise.all(
      Array.from(selectedIds).map((id) => fetch(`/api/admin/bottle-inventory/${id}`, { method: "DELETE" }))
    );
    setSelectedIds(new Set());
    await load();
  }

  const merged = useMemo(() => items.map((t) => edited[t.id] ?? t), [items, edited]);

  const stats = useMemo(() => {
    const totalBottles = merged.reduce(
      (sum, t) => sum + t.qtyUncut + t.qtyCutUnpolished + t.qtyCutPolished + t.qtyCutPoured,
      0
    );
    const totalUniqueBottles = merged.length;
    const archivedCount = merged.filter((t) => t.archived).length;
    const active = totalUniqueBottles - archivedCount;
    const totalPoured = merged.reduce((sum, t) => sum + t.qtyCutPoured, 0);
    return { totalBottles, totalUniqueBottles, active, totalPoured };
  }, [merged]);

  const filtered = useMemo(() => {
    let list = merged;
    if (statusFilter === "active") list = list.filter((t) => !t.archived);
    if (statusFilter === "archived") list = list.filter((t) => t.archived);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((t) => t.name.toLowerCase().includes(q));
    }
    return list;
  }, [merged, statusFilter, search]);

  const view = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = getSortValue(a, sortKey);
      const bv = getSortValue(b, sortKey);
      if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * dir;
      return ((av as number) - (bv as number)) * dir;
    });
  }, [filtered, sortKey, sortDir]);

  const allVisibleSelected = view.length > 0 && view.every((t) => selectedIds.has(t.id));
  const someVisibleSelected = view.some((t) => selectedIds.has(t.id));

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someVisibleSelected && !allVisibleSelected;
    }
  }, [someVisibleSelected, allVisibleSelected]);

  function toggleSelectAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const t of view) next.delete(t.id);
      } else {
        for (const t of view) next.add(t.id);
      }
      return next;
    });
  }

  return (
    <div className={`a-ui mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8 ${dirtyIds.size > 0 ? "pb-28" : ""}`}>
      <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden onChange={handleImageFileChange} />

      <PageHeader
        title="Bottle inventory"
        description="Raw bottles by stage, for Home Goods listings. Edit counts directly; save when you're done."
        actions={
          <>
            <button className="a-btn" onClick={syncFromCandles} disabled={syncing}>
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} aria-hidden />
              {syncing ? "Syncing…" : "Sync from candles"}
            </button>
            <button className="a-btn a-btn-primary" onClick={() => setShowAddForm((v) => !v)} aria-expanded={showAddForm}>
              <Plus className="h-4 w-4" aria-hidden />
              Add bottle
            </button>
          </>
        }
      />

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Bottles" value={stats.totalBottles} hint="All stages" />
        <Stat label="Unique bottles" value={stats.totalUniqueBottles} />
        <Stat label="Active" value={stats.active} />
        <Stat label="Poured" value={stats.totalPoured} hint="Linked to candle listings" />
      </div>

      {/* Add new */}
      {showAddForm && (
        <section className="a-card mb-4 p-4 sm:p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[var(--a-ink)]">Add a bottle</h2>
              <p className="mt-0.5 text-sm text-[var(--a-muted)]">For bottles not tied to any candle listing.</p>
            </div>
            <button className="a-icon-btn -mr-1 -mt-1" onClick={() => setShowAddForm(false)} aria-label="Close">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <AddBottleForm onAdd={handleAddBottle} />
        </section>
      )}

      {/* Image search template */}
      {showSearchSettings && (
        <section className="a-card mb-4 p-4 sm:p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[var(--a-ink)]">Default image search</h2>
              <p className="mt-0.5 text-sm text-[var(--a-muted)]">
                Pre-fills the search when you look up a bottle photo. <code className="rounded bg-[var(--a-tint)] px-1">[name]</code> is
                replaced with the bottle name.
              </p>
            </div>
            <button className="a-icon-btn -mr-1 -mt-1" onClick={() => setShowSearchSettings(false)} aria-label="Close">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="block flex-1">
              <span className="sr-only">Search template</span>
              <input
                className="a-input"
                value={searchTemplate}
                onChange={(e) => updateSearchTemplate(e.target.value)}
                placeholder={DEFAULT_SEARCH_TEMPLATE}
              />
            </label>
            {searchTemplate !== DEFAULT_SEARCH_TEMPLATE && (
              <button type="button" className="a-btn" onClick={() => updateSearchTemplate(DEFAULT_SEARCH_TEMPLATE)}>
                Reset to default
              </button>
            )}
          </div>
        </section>
      )}

      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative block w-full sm:max-w-xs">
          <span className="sr-only">Search bottles</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--a-faint)]" aria-hidden />
          <input className="a-input pl-9" placeholder="Search bottles…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <div className="flex items-center gap-2">
          <Segmented
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "all", label: "All" },
              { value: "active", label: "Active" },
              { value: "archived", label: "Archived" },
            ]}
          />
          <button
            className="a-icon-btn h-10 w-10 border border-[var(--a-line)] bg-[var(--a-surface)]"
            onClick={() => setShowSearchSettings((v) => !v)}
            aria-expanded={showSearchSettings}
            aria-label="Image search settings"
            title="Image search settings"
          >
            <Settings2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
        {!loading && (
          <p className="text-sm text-[var(--a-muted)] sm:ml-auto">
            {view.length} of {merged.length} bottles
          </p>
        )}
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-[var(--a-ink)] px-4 py-2.5 text-white shadow-lg">
          <span className="mr-auto text-sm font-medium">{selectedIds.size} selected</span>
          <button className="a-btn a-btn-sm border-white/20 bg-white/10 text-white hover:bg-white/20" onClick={() => bulkArchive(true)}>
            <Archive className="h-3.5 w-3.5" aria-hidden /> Archive
          </button>
          <button className="a-btn a-btn-sm border-white/20 bg-white/10 text-white hover:bg-white/20" onClick={() => bulkArchive(false)}>
            <ArchiveRestore className="h-3.5 w-3.5" aria-hidden /> Unarchive
          </button>
          <button className="a-btn a-btn-sm border-white/20 bg-white/10 text-[#ffb4ab] hover:bg-white/20" onClick={bulkDelete}>
            <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
          </button>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
            onClick={() => setSelectedIds(new Set())}
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}

      <div className="a-card overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16">
            <CandleSpinner />
            <p className="text-sm font-medium text-[var(--a-muted)]">Loading…</p>
          </div>
        ) : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="a-table a-table-dense">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="w-10 text-center">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      className="a-check"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      aria-label="Select all visible"
                    />
                  </th>
                  <SortHeader label="Image" sortKey="image" activeKey={sortKey} dir={sortDir} onSort={toggleSort} className="w-24" />
                  <SortHeader label="Bottle" sortKey="name" activeKey={sortKey} dir={sortDir} onSort={toggleSort} className="min-w-[14rem]" />
                  <SortHeader label="Type" sortKey="alcoholType" activeKey={sortKey} dir={sortDir} onSort={toggleSort} className="w-40" />
                  <SortHeader label="Water oz" sortKey="capacityWaterOz" activeKey={sortKey} dir={sortDir} onSort={toggleSort} align="center" className="w-24" />
                  <SortHeader label="Uncut" sortKey="qtyUncut" activeKey={sortKey} dir={sortDir} onSort={toggleSort} align="center" className="w-32" />
                  <SortHeader label="Cut, unpolished" sortKey="qtyCutUnpolished" activeKey={sortKey} dir={sortDir} onSort={toggleSort} align="center" className="w-32" />
                  <SortHeader label="Cut, polished" sortKey="qtyCutPolished" activeKey={sortKey} dir={sortDir} onSort={toggleSort} align="center" className="w-32" />
                  <SortHeader label="Poured" sortKey="qtyCutPoured" activeKey={sortKey} dir={sortDir} onSort={toggleSort} align="center" className="w-24" />
                  <th className="w-24 text-center">Home Goods</th>
                  <th className="w-24">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {view.map((t) => {
                  const dirty = dirtyIds.has(t.id);
                  const selected = selectedIds.has(t.id);
                  return (
                    <tr key={t.id} className={dirty ? "bg-[#fffaf0]" : selected ? "bg-[var(--a-tint)]" : undefined}>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          className="a-check"
                          checked={selected}
                          onChange={() => toggleSelect(t.id)}
                          aria-label={`Select ${t.name}`}
                        />
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--a-line)] bg-[var(--a-canvas)] transition-colors hover:border-[var(--a-line-strong)]"
                            onClick={() => triggerImageUpload(t.id)}
                            disabled={uploadingId === t.id}
                            title={t.imageUrl ? "Change image" : "Upload image"}
                            aria-label={t.imageUrl ? `Change image for ${t.name}` : `Upload image for ${t.name}`}
                          >
                            {uploadingId === t.id ? (
                              <RefreshCw className="h-4 w-4 animate-spin text-[var(--a-muted)]" aria-hidden />
                            ) : t.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={t.imageUrl} alt="" className="h-full w-full object-contain" />
                            ) : (
                              <Upload className="h-4 w-4 text-[var(--a-faint)]" aria-hidden />
                            )}
                          </button>
                          <button
                            type="button"
                            className="a-icon-btn h-8 w-8"
                            onClick={() => openImageSearch(t)}
                            title="Search for a bottle image online"
                            aria-label={`Search images for ${t.name}`}
                          >
                            <Search className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <input
                            className={`a-input h-9 min-w-[12rem] ${t.archived ? "text-[var(--a-muted)]" : ""}`}
                            value={t.name}
                            onChange={(e) => markDirty(t.id, { name: e.target.value })}
                            aria-label="Bottle name"
                          />
                          {t.archived && <Badge>Archived</Badge>}
                        </div>
                      </td>
                      <td>
                        <select
                          className="a-select h-9"
                          value={t.alcoholType || ""}
                          onChange={(e) => markDirty(t.id, { alcoholType: e.target.value || undefined })}
                          title="Groups this bottle in the Home Goods bottle picker"
                          aria-label="Alcohol type"
                        >
                          <option value="">None</option>
                          {alcoholTypes.map((at) => (
                            <option key={at.id} value={at.name}>
                              {at.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          className="a-input mx-auto h-9 w-20 px-2 text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          type="number"
                          min="0"
                          step="0.1"
                          value={t.capacityWaterOz ?? ""}
                          onChange={(e) =>
                            markDirty(t.id, { capacityWaterOz: e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)) })
                          }
                          placeholder="—"
                          aria-label="Water capacity in ounces"
                        />
                      </td>
                      <td>
                        <Stepper label="Uncut" value={t.qtyUncut} onChange={(v) => markDirty(t.id, { qtyUncut: v })} />
                      </td>
                      <td>
                        <Stepper label="Cut, unpolished" value={t.qtyCutUnpolished} onChange={(v) => markDirty(t.id, { qtyCutUnpolished: v })} />
                      </td>
                      <td>
                        <Stepper label="Cut, polished" value={t.qtyCutPolished} onChange={(v) => markDirty(t.id, { qtyCutPolished: v })} />
                      </td>
                      <td>
                        <div
                          className="flex items-center justify-center gap-1.5 text-[var(--a-muted)]"
                          title="Read-only; derived from candle products linked to this bottle"
                        >
                          <Flame className="h-3.5 w-3.5" aria-hidden />
                          <span className="tabular-nums">{t.qtyCutPoured}</span>
                        </div>
                      </td>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          className="a-check"
                          checked={t.usableForHomeGoods}
                          onChange={(e) => markDirty(t.id, { usableForHomeGoods: e.target.checked })}
                          title="Uncheck if this bottle should never be offered on any Home Goods product"
                          aria-label="Usable for Home Goods"
                        />
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            className="a-icon-btn h-8 w-8"
                            title={t.archived ? "Unarchive" : "Archive"}
                            aria-label={t.archived ? `Unarchive ${t.name}` : `Archive ${t.name}`}
                            onClick={() => toggleArchive(t.id, !t.archived)}
                          >
                            {t.archived ? <ArchiveRestore className="h-4 w-4" aria-hidden /> : <Archive className="h-4 w-4" aria-hidden />}
                          </button>
                          <button
                            className="a-icon-btn a-icon-btn-danger h-8 w-8"
                            title="Delete"
                            aria-label={`Delete ${t.name}`}
                            onClick={() => hardDelete(t.id)}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {view.length === 0 && (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-sm text-[var(--a-muted)]">
                      No bottles match your search or filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="a-help mt-3 max-w-3xl">
        Poured counts (the flame) come from the candle listing linked to that bottle, since a poured bottle can&apos;t be reused.
        Bottles without a linked candle can be edited like the other stages.
      </p>

      {unmatched.length > 0 && (
        <section className="mt-6 rounded-xl border border-amber-200 bg-[#fdf6e7] p-4">
          <h2 className="text-sm font-semibold text-[#6b4a0b]">Needs review</h2>
          <p className="mt-0.5 text-sm text-[#6b4a0b]">
            These candle products don&apos;t end in &quot;Candle&quot;, so they couldn&apos;t be matched to a bottle. Add them manually if they
            should be tracked.
          </p>
          <ul className="mt-2 space-y-0.5 text-sm">
            {unmatched.map((u) => (
              <li key={u.slug}>
                {u.name} <span className="text-[var(--a-muted)]">({u.slug})</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Image search */}
      {imageSearchTarget && (
        <Modal
          size="lg"
          title="Find a bottle image"
          description={imageSearchTarget.name}
          onClose={closeImageSearch}
          footer={
            <p className="mr-auto text-xs text-[var(--a-muted)]">
              Results come from Brave Image Search. Make sure it&apos;s the right bottle before saving.
            </p>
          }
        >
          <form
            className="mb-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void runImageSearch(imageSearchQuery);
            }}
          >
            <label className="block flex-1">
              <span className="sr-only">Search query</span>
              <input className="a-input" value={imageSearchQuery} onChange={(e) => setImageSearchQuery(e.target.value)} placeholder="Search query" />
            </label>
            <button type="submit" className="a-btn" disabled={imageSearchLoading}>
              <Search className="h-4 w-4" aria-hidden />
              Search
            </button>
          </form>

          {imageSearchLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <CandleSpinner />
              <p className="text-sm text-[var(--a-muted)]">Searching…</p>
            </div>
          ) : imageSearchError ? (
            <p role="alert" className="py-8 text-center text-sm text-[#b42318]">
              {imageSearchError}
            </p>
          ) : imageSearchResults.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--a-muted)]">No results. Try a different search.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {imageSearchResults.map((r) => (
                <button
                  key={r.imageUrl}
                  type="button"
                  className="relative overflow-hidden rounded-lg border border-[var(--a-line)] text-left transition-colors hover:border-[var(--a-ink)] disabled:opacity-50"
                  onClick={() => attachSearchResult(r.imageUrl)}
                  disabled={!!attachingUrl}
                  title={r.sourceUrl || r.title}
                >
                  <div className="flex aspect-square items-center justify-center bg-[var(--a-canvas)]">
                    {attachingUrl === r.imageUrl ? (
                      <RefreshCw className="h-5 w-5 animate-spin text-[var(--a-muted)]" aria-hidden />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.thumbnailUrl || r.imageUrl} alt={r.title} className="h-full w-full object-contain" loading="lazy" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* Unsaved changes */}
      {dirtyIds.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-amber-200 bg-[#fdf6e7]/95 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur lg:left-64">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 sm:px-2 lg:px-4">
            <span className="flex items-center gap-2 text-sm font-semibold text-[#6b4a0b]">
              <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />
              {dirtyIds.size} unsaved change{dirtyIds.size === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-2">
              <button className="a-btn" onClick={discardAll} disabled={saving}>
                Discard
              </button>
              <button className="a-btn a-btn-primary" onClick={saveAll} disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
