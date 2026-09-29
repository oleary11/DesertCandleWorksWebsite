"use client";

import { useEffect, useMemo, useState } from "react";
import { Archive, ArchiveRestore, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import PageHeader from "../_components/PageHeader";
import { Badge } from "../_components/ui";
import { useModal } from "@/hooks/useModal";
import CandleSpinner from "@/components/CandleSpinner";

type AlcoholType = { id: string; name: string; sortOrder?: number; archived?: boolean };

export default function AlcoholTypesAdminPage() {
  const { showAlert, showConfirm } = useModal();
  const [types, setTypes] = useState<AlcoholType[]>([]);
  const [loading, setLoading] = useState(true);

  // local editing copies + dirty tracking
  const [edited, setEdited] = useState<Record<string, AlcoholType>>({});
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // add-new form
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState<number | "">("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/alcohol-types", { cache: "no-store" });
    const j = await res.json();
    setTypes(j.types || []);
    setEdited({});
    setDirtyIds(new Set());
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  function markDirty(id: string, next: Partial<AlcoholType>) {
    setEdited((prev) => ({ ...prev, [id]: { ...(prev[id] ?? types.find(t => t.id === id)!), ...next } }));
    setDirtyIds((prev) => new Set(prev).add(id));
  }

  function isDirty(id: string) {
    return dirtyIds.has(id);
  }

  // Save only the dirty rows via bulk PATCH
  async function saveAll() {
    if (dirtyIds.size === 0) return;
    setSaving(true);
    const updates = Array.from(dirtyIds).map((id) => {
      const e = edited[id];
      return { id, name: e.name, sortOrder: e.sortOrder, archived: e.archived };
    });
    const res = await fetch("/api/admin/alcohol-types/bulk", {
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

  // create new type (still immediate POST; simpler UX)
  async function create() {
    const n = name.trim();
    if (!n) return;
    const res = await fetch("/api/admin/alcohol-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: n,
        sortOrder: sortOrder === "" ? undefined : Number(sortOrder),
      }),
    });
    if (res.ok) {
      setName("");
      setSortOrder("");
      await load();
    } else {
      await showAlert("Create failed", "Error");
    }
  }

  async function toggleArchive(id: string, archived: boolean) {
    // archive/unarchive is explicit action (immediate), not staged
    const res = await fetch(`/api/admin/alcohol-types/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived }),
    });
    if (res.ok) await load();
    else await showAlert("Failed to update alcohol type", "Error");
  }

  async function hardDelete(id: string) {
    const confirmed = await showConfirm("Permanently delete this type? This cannot be undone.", "Confirm Delete");
    if (!confirmed) return;
    const res = await fetch(`/api/admin/alcohol-types/${id}`, { method: "DELETE" });
    if (res.ok) await load();
    else await showAlert("Delete failed", "Error");
  }

  // local move up/down (staged only)
  function moveLocal(id: string, direction: "up" | "down") {
    const sortedNow = [...types].sort(
      (a, b) =>
        (edited[a.id]?.sortOrder ?? a.sortOrder ?? 9999) -
        (edited[b.id]?.sortOrder ?? b.sortOrder ?? 9999) ||
        a.name.localeCompare(b.name)
    );
    const idx = sortedNow.findIndex((t) => t.id === id);
    const nei = direction === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || nei < 0 || nei >= sortedNow.length) return;

    const a = sortedNow[idx];
    const b = sortedNow[nei];
    const aSort = edited[a.id]?.sortOrder ?? a.sortOrder ?? 9999;
    const bSort = edited[b.id]?.sortOrder ?? b.sortOrder ?? 9999;

    markDirty(a.id, { sortOrder: bSort });
    markDirty(b.id, { sortOrder: aSort });
  }

  const view = useMemo(() => {
    const merged = types.map((t) => edited[t.id] ?? t);
    return merged.sort(
      (a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999) || a.name.localeCompare(b.name)
    );
  }, [types, edited]);

  return (
    <div className="a-ui mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader title="Alcohol types" description="The bottle categories used to group and filter products." />

      {/* Add new */}
      <form
        className="a-card mb-4 flex flex-col gap-2 p-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <label className="block flex-1">
          <span className="sr-only">New type name</span>
          <input className="a-input" placeholder="New type, e.g. Mezcal" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block sm:w-32">
          <span className="sr-only">Sort order (optional)</span>
          <input
            className="a-input tabular-nums"
            type="number"
            placeholder="Sort #"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value === "" ? "" : Number(e.target.value))}
          />
        </label>
        <button type="submit" className="a-btn a-btn-primary" disabled={!name.trim()}>
          <Plus className="h-4 w-4" aria-hidden />
          Add type
        </button>
      </form>

      {/* Unsaved changes */}
      {dirtyIds.size > 0 && (
        <div className="sticky top-16 z-20 mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-[#fdf6e7] px-4 py-3 shadow-sm">
          <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden />
          <p className="min-w-0 flex-1 text-sm font-semibold text-[#6b4a0b]">
            {dirtyIds.size} unsaved {dirtyIds.size === 1 ? "change" : "changes"}
          </p>
          <div className="flex gap-2">
            <button className="a-btn a-btn-sm" onClick={discardAll} disabled={saving}>
              Discard
            </button>
            <button className="a-btn a-btn-primary a-btn-sm" onClick={saveAll} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-4 py-16">
          <CandleSpinner />
          <p className="text-sm font-medium text-[var(--a-muted)]">Loading…</p>
        </div>
      ) : view.length === 0 ? (
        <div className="a-card px-6 py-12 text-center text-sm text-[var(--a-muted)]">No alcohol types yet. Add one above.</div>
      ) : (
        <ol className="a-card divide-y divide-[var(--a-line)]">
          {view.map((t, i) => {
            const dirty = isDirty(t.id);
            return (
              <li key={t.id} className={`flex items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 ${dirty ? "bg-[#fffaf0]" : ""}`}>
                <div className="flex shrink-0 flex-col">
                  <button
                    className="a-icon-btn h-6 w-7 disabled:opacity-30"
                    aria-label={`Move ${t.name} up`}
                    title="Move up"
                    disabled={i === 0}
                    onClick={() => moveLocal(t.id, "up")}
                  >
                    <ChevronUp className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    className="a-icon-btn h-6 w-7 disabled:opacity-30"
                    aria-label={`Move ${t.name} down`}
                    title="Move down"
                    disabled={i === view.length - 1}
                    onClick={() => moveLocal(t.id, "down")}
                  >
                    <ChevronDown className="h-4 w-4" aria-hidden />
                  </button>
                </div>

                <label className="block w-16 shrink-0">
                  <span className="sr-only">Sort order for {t.name}</span>
                  <input
                    className="a-input h-9 px-2 text-center tabular-nums"
                    type="number"
                    value={t.sortOrder ?? ""}
                    onChange={(e) => {
                      const val = e.target.value === "" ? undefined : Number(e.target.value);
                      markDirty(t.id, { sortOrder: val });
                    }}
                  />
                </label>

                <label className="block min-w-0 flex-1">
                  <span className="sr-only">Name</span>
                  <input
                    className={`a-input h-9 ${t.archived ? "text-[var(--a-muted)] line-through" : ""}`}
                    value={t.name}
                    onChange={(e) => markDirty(t.id, { name: e.target.value })}
                  />
                </label>

                {t.archived && (
                  <span className="hidden sm:inline">
                    <Badge>Archived</Badge>
                  </span>
                )}

                <div className="flex shrink-0 gap-1">
                  <button
                    className="a-icon-btn"
                    onClick={() => toggleArchive(t.id, !t.archived)}
                    aria-label={t.archived ? `Unarchive ${t.name}` : `Archive ${t.name}`}
                    title={t.archived ? "Unarchive" : "Archive (hide from pickers, keep on existing products)"}
                  >
                    {t.archived ? <ArchiveRestore className="h-4 w-4" aria-hidden /> : <Archive className="h-4 w-4" aria-hidden />}
                  </button>
                  <button
                    className="a-icon-btn a-icon-btn-danger"
                    onClick={() => hardDelete(t.id)}
                    aria-label={`Delete ${t.name}`}
                    title="Delete permanently"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <p className="a-help mt-3">Archived types are hidden from pickers but stay on products that already use them.</p>
    </div>
  );
}
