"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useModal } from "@/hooks/useModal";

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
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="btn">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-2xl font-semibold">Alcohol Types</h1>
        </div>
      </div>

      {/* Add new */}
      <div className="card p-4 space-y-3">
        <h2 className="text-lg font-medium">Add new type</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            className="input"
            placeholder="e.g. Mezcal"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="input"
            type="number"
            placeholder="Sort order (optional)"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value === "" ? "" : Number(e.target.value))}
          />
          <button className="btn btn-primary" onClick={create}>Add type</button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <button className="btn" onClick={discardAll} disabled={dirtyIds.size === 0 || saving}>
          Discard changes
        </button>
        <button
          className="btn btn-primary"
          onClick={saveAll}
          disabled={dirtyIds.size === 0 || saving}
          title={dirtyIds.size ? `Save ${dirtyIds.size} change(s)` : "No changes"}
        >
          {saving ? "Saving…" : `Save changes${dirtyIds.size ? ` (${dirtyIds.size})` : ""}`}
        </button>
      </div>

      <div className="card p-4 overflow-x-auto">
        {loading ? (
          <p>Loading…</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-[var(--color-line)]">
                <th className="py-2 pr-3 w-32">Sort</th>
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3 hidden sm:table-cell">ID</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {view.map((t, i) => {
                const original = types.find(x => x.id === t.id)!;
                const dirty = isDirty(t.id);
                const total = view.length;
                return (
                  <tr key={t.id} className="border-b border-[var(--color-line)] align-middle">
                    {/* Sort order + arrows (staged) */}
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <input
                          className="input w-20"
                          type="number"
                          value={t.sortOrder ?? ""}
                          onChange={(e) => {
                            const val = e.target.value === "" ? undefined : Number(e.target.value);
                            markDirty(t.id, { sortOrder: val });
                          }}
                        />
                        <div className="flex flex-col">
                          <button
                            className="btn px-2 py-1"
                            title="Move up"
                            disabled={i === 0}
                            onClick={() => moveLocal(t.id, "up")}
                          >
                            ↑
                          </button>
                          <button
                            className="btn px-2 py-1 mt-1"
                            title="Move down"
                            disabled={i === total - 1}
                            onClick={() => moveLocal(t.id, "down")}
                          >
                            ↓
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Name (staged) */}
                    <td className="py-2 pr-3">
                      <input
                        className="input w-full"
                        value={t.name}
                        onChange={(e) => markDirty(t.id, { name: e.target.value })}
                      />
                    </td>

                    <td className="py-2 pr-3 hidden sm:table-cell">{t.id}</td>

                    <td className="py-2 pr-3">
                      {t.archived ? (
                        <span className="badge">Archived</span>
                      ) : (
                        <span className="text-xs text-[var(--color-muted)]">Active</span>
                      )}
                    </td>

                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap gap-2">
                        {t.archived ? (
                          <button className="btn" onClick={() => toggleArchive(t.id, false)}>
                            Unarchive
                          </button>
                        ) : (
                          <button className="btn" onClick={() => toggleArchive(t.id, true)}>
                            Archive
                          </button>
                        )}
                        <button className="btn btn-danger" onClick={() => hardDelete(t.id)}>
                          Delete
                        </button>
                        {dirty && <span className="text-xs text-amber-600 self-center">• unsaved</span>}
                        {!dirty &&
                          (t.name !== original.name || t.sortOrder !== original.sortOrder) && (
                            <span className="text-xs text-amber-600 self-center">• unsaved</span>
                          )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}