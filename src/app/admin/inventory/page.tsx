"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
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
} from "lucide-react";
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
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`flex items-center justify-center gap-1 ${disabled ? "opacity-40" : ""}`}>
      <button
        type="button"
        className="btn btn-ghost !min-h-0 !h-7 !w-7 !p-0 shrink-0"
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={disabled}
        aria-label="Decrease"
      >
        <Minus className="w-3 h-3" />
      </button>
      <input
        className="input text-center tabular-nums !w-14 !h-7 !py-0 !px-1"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^0-9]/g, "");
          onChange(digits === "" ? 0 : Math.max(0, Number(digits)));
        }}
        disabled={disabled}
      />
      <button
        type="button"
        className="btn btn-ghost !min-h-0 !h-7 !w-7 !p-0 shrink-0"
        onClick={() => onChange(value + 1)}
        disabled={disabled}
        aria-label="Increase"
      >
        <Plus className="w-3 h-3" />
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
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
        <input
          className="input"
          placeholder="e.g. Empty Jack Daniels 1L (never poured)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void handleSubmit(); }}
          autoFocus
        />
        <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
          <Plus className="w-4 h-4 mr-1" /> Add bottle
        </button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          ["qtyUncut", "Uncut"],
          ["qtyCutUnpolished", "Cut Unpolished"],
          ["qtyCutPolished", "Cut Polished"],
        ] as const).map(([key, label]) => (
          <label key={key} className="space-y-1">
            <span className="block text-xs text-center text-[var(--color-muted)]">{label}</span>
            <Stepper
              value={counts[key]}
              onChange={(value) => setCounts((current) => ({ ...current, [key]: value }))}
            />
          </label>
        ))}
        <label className="space-y-1">
          <span className="block text-xs text-center text-[var(--color-muted)]">Water Capacity (oz)</span>
          <input
            className="input text-center !h-7 !py-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
      className={`relative py-3 px-3 cursor-pointer select-none ${className ?? ""}`}
      onClick={() => onSort(sortKey)}
    >
      {/* Label is centered on its own — the arrow floats outside the flow so it can never skew the text off-center */}
      <span className={`block w-full ${align === "center" ? "text-center" : "text-left"}`}>{label}</span>
      {active && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2">
          {dir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </span>
      )}
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
    <div className={`mx-auto max-w-[1800px] p-6 space-y-5 ${dirtyIds.size > 0 ? "pb-24" : ""}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageFileChange}
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="btn">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-2xl font-semibold">Bottle Inventory</h1>
        </div>
        <button className="btn" onClick={syncFromCandles} disabled={syncing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing…" : "Sync from Candles"}
        </button>
      </div>

      <p className="text-sm text-[var(--color-muted)]">
        Uncut / Cut Unpolished / Cut Polished are the raw bottles available for Home Goods
        listings — edit any count directly with the +/- controls. Cut Poured shows a flame and
        locks once a bottle is linked to a candle listing (it&apos;s a live read of that listing&apos;s
        stock, since a poured bottle can&apos;t be reused) — otherwise it&apos;s editable like the rest.
      </p>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card card--mist p-4 flex items-center">
          <div className="text-2xl font-semibold">{stats.totalBottles} <span className="text-base font-normal text-[var(--color-muted)]">total bottles</span></div>
        </div>
        <div className="card card--sage p-4 flex items-center">
          <div className="text-2xl font-semibold">{stats.totalUniqueBottles} <span className="text-base font-normal text-[var(--color-muted)]">total unique bottles</span></div>
        </div>
        <div className="card card--rose p-4 flex items-center">
          <div className="text-2xl font-semibold">{stats.active} <span className="text-base font-normal text-[var(--color-muted)]">active</span></div>
        </div>
        <div className="card card--lilac p-4 flex items-center">
          <div className="text-2xl font-semibold">{stats.totalPoured} <span className="text-base font-normal text-[var(--color-muted)]">poured</span></div>
        </div>
      </div>

      {/* Add new (collapsible) */}
      <div className="card p-4 space-y-3">
        <button
          type="button"
          className="flex items-center justify-between w-full text-left"
          onClick={() => setShowAddForm((v) => !v)}
        >
          <h2 className="text-base font-medium">Add a bottle not tied to any candle</h2>
          {showAddForm ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showAddForm && <AddBottleForm onAdd={handleAddBottle} />}
      </div>

      {/* Default image search query (collapsible) */}
      <div className="card p-4 space-y-3">
        <button
          type="button"
          className="flex items-center justify-between w-full text-left"
          onClick={() => setShowSearchSettings((v) => !v)}
        >
          <h2 className="text-base font-medium">Default image search</h2>
          {showSearchSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showSearchSettings && (
          <div className="space-y-2">
            <input
              className="input"
              value={searchTemplate}
              onChange={(e) => updateSearchTemplate(e.target.value)}
              placeholder={DEFAULT_SEARCH_TEMPLATE}
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-[var(--color-muted)]">
                Used to pre-fill the search box when you click the search icon on a bottle. Use{" "}
                <code className="px-1 rounded bg-neutral-100">[name]</code> as a placeholder for the bottle name
                (e.g. &quot;{DEFAULT_SEARCH_TEMPLATE}&quot;). Still editable per-search in the search modal itself.
              </p>
              {searchTemplate !== DEFAULT_SEARCH_TEMPLATE && (
                <button
                  type="button"
                  className="text-xs text-[var(--color-accent)] hover:underline shrink-0"
                  onClick={() => updateSearchTemplate(DEFAULT_SEARCH_TEMPLATE)}
                >
                  Reset to default
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)] pointer-events-none" />
          <input
            className="input !pl-9"
            placeholder="Search bottles…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1">
          {(["all", "active", "archived"] as StatusFilter[]).map((f) => (
            <button
              key={f}
              className={`btn !min-h-0 !py-1.5 !px-3 text-xs capitalize ${statusFilter === f ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setStatusFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="card p-3 flex items-center justify-between gap-3 card--mist">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="flex items-center gap-2">
            <button className="btn !min-h-0 !py-1.5 !px-3 text-xs" onClick={() => bulkArchive(true)}>
              <Archive className="w-3.5 h-3.5 mr-1" /> Archive
            </button>
            <button className="btn !min-h-0 !py-1.5 !px-3 text-xs" onClick={() => bulkArchive(false)}>
              <ArchiveRestore className="w-3.5 h-3.5 mr-1" /> Unarchive
            </button>
            <button className="btn !min-h-0 !py-1.5 !px-3 text-xs text-rose-600" onClick={bulkDelete}>
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
            </button>
            <button
              className="btn btn-ghost !min-h-0 !h-7 !w-7 !p-0"
              onClick={() => setSelectedIds(new Set())}
              aria-label="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <CandleSpinner />
            <p className="text-sm font-medium text-[var(--color-muted)]">Loading…</p>
          </div>
        ) : (
          <div className="max-h-[65vh] overflow-y-auto overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-[var(--color-surface)] shadow-[0_1px_0_var(--color-line)]">
                <tr className="text-left divide-x divide-[var(--color-line)]">
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      aria-label="Select all visible"
                    />
                  </th>
                  <SortHeader label="Image" sortKey="image" activeKey={sortKey} dir={sortDir} onSort={toggleSort} align="center" className="w-28" />
                  <SortHeader label="Bottle" sortKey="name" activeKey={sortKey} dir={sortDir} onSort={toggleSort} className="min-w-[14rem]" />
                  <SortHeader label="Type" sortKey="alcoholType" activeKey={sortKey} dir={sortDir} onSort={toggleSort} align="center" className="w-36" />
                  <SortHeader label="Water Oz" sortKey="capacityWaterOz" activeKey={sortKey} dir={sortDir} onSort={toggleSort} align="center" className="w-28" />
                  <SortHeader label="Uncut" sortKey="qtyUncut" activeKey={sortKey} dir={sortDir} onSort={toggleSort} align="center" className="w-32" />
                  <SortHeader label="Cut Unpolished" sortKey="qtyCutUnpolished" activeKey={sortKey} dir={sortDir} onSort={toggleSort} align="center" className="w-36" />
                  <SortHeader label="Cut Polished" sortKey="qtyCutPolished" activeKey={sortKey} dir={sortDir} onSort={toggleSort} align="center" className="w-32" />
                  <SortHeader label="Cut Poured" sortKey="qtyCutPoured" activeKey={sortKey} dir={sortDir} onSort={toggleSort} align="center" className="w-32" />
                  <th className="py-3 px-3 w-28 text-center">Home Goods</th>
                  <th className="py-3 px-3 w-24 text-center">Status</th>
                  <th className="py-3 px-3 w-24 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {view.map((t, idx) => {
                  const dirty = dirtyIds.has(t.id);
                  return (
                    <tr
                      key={t.id}
                      className={`border-b border-[var(--color-line)] divide-x divide-[var(--color-line)] align-middle hover:bg-black/[0.03] ${
                        dirty ? "bg-amber-50" : idx % 2 === 1 ? "bg-black/[0.015]" : ""
                      }`}
                    >
                      <td className="py-2 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(t.id)}
                          onChange={() => toggleSelect(t.id)}
                          aria-label={`Select ${t.name}`}
                        />
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            className="relative w-10 h-10 rounded-lg overflow-hidden border border-[var(--color-line)] bg-neutral-50 flex items-center justify-center hover:border-[var(--color-accent)] transition shrink-0"
                            onClick={() => triggerImageUpload(t.id)}
                            disabled={uploadingId === t.id}
                            title={t.imageUrl ? "Change image" : "Upload image"}
                          >
                            {uploadingId === t.id ? (
                              <RefreshCw className="w-4 h-4 animate-spin text-[var(--color-muted)]" />
                            ) : t.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={t.imageUrl} alt="" className="w-full h-full object-contain" />
                            ) : (
                              <Upload className="w-4 h-4 text-[var(--color-muted)]" />
                            )}
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost !min-h-0 !h-8 !w-8 !p-0 shrink-0"
                            onClick={() => openImageSearch(t)}
                            title="Search for a bottle image online"
                          >
                            <Search className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <input
                          className="input w-full min-w-[12rem]"
                          value={t.name}
                          onChange={(e) => markDirty(t.id, { name: e.target.value })}
                        />
                      </td>
                      <td className="py-2 px-3">
                        <select
                          className="select w-full"
                          value={t.alcoholType || ""}
                          onChange={(e) => markDirty(t.id, { alcoholType: e.target.value || undefined })}
                          title="Groups this bottle in the Home Goods bottle picker"
                        >
                          <option value="">None</option>
                          {alcoholTypes.map((at) => (
                            <option key={at.id} value={at.name}>{at.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-3">
                        <input
                          className="input text-center tabular-nums !h-7 !py-0 !px-1 w-20 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          type="number"
                          min="0"
                          step="0.1"
                          value={t.capacityWaterOz ?? ""}
                          onChange={(e) => markDirty(t.id, { capacityWaterOz: e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)) })}
                          placeholder="—"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <Stepper value={t.qtyUncut} onChange={(v) => markDirty(t.id, { qtyUncut: v })} />
                      </td>
                      <td className="py-2 px-3">
                        <Stepper value={t.qtyCutUnpolished} onChange={(v) => markDirty(t.id, { qtyCutUnpolished: v })} />
                      </td>
                      <td className="py-2 px-3">
                        <Stepper value={t.qtyCutPolished} onChange={(v) => markDirty(t.id, { qtyCutPolished: v })} />
                      </td>
                      <td className="py-2 px-3">
                        <div
                          className="flex items-center justify-center gap-1.5 text-[var(--color-muted)]"
                          title="Read-only; derived from candle products linked to this bottle"
                        >
                          <Flame className="w-3.5 h-3.5" />
                          <span className="tabular-nums">{t.qtyCutPoured}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={t.usableForHomeGoods}
                          onChange={(e) => markDirty(t.id, { usableForHomeGoods: e.target.checked })}
                          title="Uncheck if this bottle should never be offered on any Home Goods product"
                        />
                      </td>
                      <td className="py-2 px-3 text-center">
                        {t.archived ? (
                          <span className="badge">Archived</span>
                        ) : (
                          <span className="text-xs font-medium text-emerald-700">Active</span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            className="btn btn-ghost !min-h-0 !h-8 !w-8 !p-0"
                            title={t.archived ? "Unarchive" : "Archive"}
                            onClick={() => toggleArchive(t.id, !t.archived)}
                          >
                            {t.archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                          </button>
                          <button
                            className="btn btn-ghost !min-h-0 !h-8 !w-8 !p-0 text-rose-600"
                            title="Delete"
                            onClick={() => hardDelete(t.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {view.length === 0 && (
                  <tr>
                    <td colSpan={11} className="py-10 text-center text-sm text-[var(--color-muted)]">
                      No bottles match your search/filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && (
        <p className="text-xs text-[var(--color-muted)]">
          Showing {view.length} of {merged.length} bottles
        </p>
      )}

      {unmatched.length > 0 && (
        <div className="card p-4 space-y-2 border-amber-300">
          <h2 className="text-lg font-medium">Needs review</h2>
          <p className="text-sm text-[var(--color-muted)]">
            These candle products don&apos;t end in &quot;Candle&quot;, so they couldn&apos;t be
            auto-matched to a bottle name. Add them above manually if they should be tracked.
          </p>
          <ul className="text-sm list-disc pl-5">
            {unmatched.map((u) => (
              <li key={u.slug}>{u.name} <span className="text-[var(--color-muted)]">({u.slug})</span></li>
            ))}
          </ul>
        </div>
      )}

      {/* Image search modal */}
      {imageSearchTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeImageSearch} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-line)] shrink-0">
              <div>
                <h3 className="text-base font-semibold">Search images</h3>
                <p className="text-xs text-[var(--color-muted)]">{imageSearchTarget.name}</p>
              </div>
              <button onClick={closeImageSearch} className="p-2 rounded-lg hover:bg-neutral-100 transition" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              className="p-4 border-b border-[var(--color-line)] shrink-0 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void runImageSearch(imageSearchQuery);
              }}
            >
              <input
                className="input flex-1"
                value={imageSearchQuery}
                onChange={(e) => setImageSearchQuery(e.target.value)}
                placeholder="Search query"
              />
              <button type="submit" className="btn !min-h-0" disabled={imageSearchLoading}>
                Search
              </button>
            </form>

            <div className="flex-1 overflow-y-auto p-4">
              {imageSearchLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <CandleSpinner />
                  <p className="text-sm text-[var(--color-muted)]">Searching…</p>
                </div>
              ) : imageSearchError ? (
                <p className="text-sm text-rose-600 text-center py-8">{imageSearchError}</p>
              ) : imageSearchResults.length === 0 ? (
                <p className="text-sm text-[var(--color-muted)] text-center py-8">No results. Try a different search.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {imageSearchResults.map((r) => (
                    <button
                      key={r.imageUrl}
                      type="button"
                      className="relative rounded-lg border border-[var(--color-line)] overflow-hidden hover:border-[var(--color-accent)] transition text-left disabled:opacity-50"
                      onClick={() => attachSearchResult(r.imageUrl)}
                      disabled={!!attachingUrl}
                      title={r.sourceUrl || r.title}
                    >
                      <div className="aspect-square bg-neutral-100 flex items-center justify-center">
                        {attachingUrl === r.imageUrl ? (
                          <RefreshCw className="w-5 h-5 animate-spin text-[var(--color-muted)]" />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={r.thumbnailUrl || r.imageUrl}
                            alt={r.title}
                            className="w-full h-full object-contain"
                            loading="lazy"
                          />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <p className="p-4 pt-0 text-xs text-[var(--color-muted)] shrink-0">
              Results come from Brave Image Search. Click one to use it — double-check it&apos;s actually the
              right bottle before saving.
            </p>
          </div>
        </div>
      )}

      {/* Sticky unsaved-changes bar */}
      {dirtyIds.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-line)] bg-white/95 backdrop-blur px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          <div className="mx-auto max-w-[1800px] flex items-center justify-between gap-3">
            <span className="text-sm font-medium">
              {dirtyIds.size} unsaved change{dirtyIds.size === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-2">
              <button className="btn" onClick={discardAll} disabled={saving}>
                Discard
              </button>
              <button className="btn btn-primary" onClick={saveAll} disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
