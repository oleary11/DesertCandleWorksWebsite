"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronUp, ChevronDown } from "lucide-react";

/* ---------- Types ---------- */
type ScentComposition = {
  baseOilId: string;
  percentage: number;
};

type GlobalScent = {
  id: string;
  name: string;
  experimental: boolean;
  enabledProducts?: string[];
  sortOrder?: number;
  notes?: string[];
  seasonal?: boolean;
  costPerOz?: number;
  composition?: ScentComposition[];
};

type BaseOil = {
  id: string;
  name: string;
  costPerOz: number;
};

type Product = {
  slug: string;
  name: string;
};

/* ---------- Component ---------- */
export default function AdminScentsPage() {
  const [scents, setScents] = useState<GlobalScent[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [baseOils, setBaseOils] = useState<BaseOil[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<GlobalScent | null>(null);
  const [notesInput, setNotesInput] = useState<string>(""); // Separate state for notes text input
  const [costMode, setCostMode] = useState<"direct" | "composition">("direct"); // direct cost vs composition
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Base Oils management
  const [editingOil, setEditingOil] = useState<BaseOil | null>(null);
  const [newOil, setNewOil] = useState<Partial<BaseOil>>({ name: "", costPerOz: 0 });

  // Tab state
  const [activeTab, setActiveTab] = useState<"scents" | "base-oils">("scents");

  async function loadScents() {
    try {
      const res = await fetch("/api/admin/scents", { cache: "no-store" });
      const data = await res.json();
      setScents(data.scents || []);
    } catch (err) {
      console.error("Failed to load scents:", err);
      setError("Failed to load scents");
    }
  }

  // Sort scents by sortOrder for display
  const sortedScents = useMemo(() => {
    return [...scents].sort((a, b) => {
      const orderA = a.sortOrder ?? 999;
      const orderB = b.sortOrder ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });
  }, [scents]);

  async function loadProducts() {
    try {
      const res = await fetch("/api/admin/products", { cache: "no-store" });
      const data = await res.json();
      setProducts(data.items || []);
    } catch (err) {
      console.error("Failed to load products:", err);
    }
  }

  async function loadBaseOils() {
    try {
      const res = await fetch("/api/admin/base-oils", { cache: "no-store" });
      const data = await res.json();
      setBaseOils(data.oils || []);
    } catch (err) {
      console.error("Failed to load base oils:", err);
    }
  }

  useEffect(() => {
    Promise.all([loadScents(), loadProducts(), loadBaseOils()]).finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!editing) return;

    // Validation
    if (!editing.id || !editing.name) {
      setError("ID and name are required");
      return;
    }

    if (!/^[a-z0-9-]+$/.test(editing.id)) {
      setError("ID must be lowercase alphanumeric with hyphens only");
      return;
    }

    setSaving(true);
    setError(null);

    // Convert notes input string to array before saving
    const notesArray = notesInput ? notesInput.split(",").map(n => n.trim()).filter(n => n) : [];

    // Clean up cost data based on mode
    const scentToSave = { ...editing, notes: notesArray };
    if (costMode === "direct") {
      // Keep costPerOz, remove composition
      scentToSave.composition = [];
    } else {
      // Keep composition, remove costPerOz
      scentToSave.costPerOz = undefined;
    }

    try {
      const res = await fetch("/api/admin/scents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scentToSave),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save scent");
        setSaving(false);
        return;
      }

      await loadScents();
      setEditing(null);
      setNotesInput("");
    } catch (err) {
      console.error("Save error:", err);
      setError("Failed to save scent");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(`Delete scent "${id}"? This will affect all products using this scent.`)) return;

    try {
      const res = await fetch(`/api/admin/scents?id=${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to delete scent");
        return;
      }

      await loadScents();
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to delete scent");
    }
  }

  function handleNew() {
    // Find highest sort order and add 1
    const maxSortOrder = scents.reduce((max, s) => Math.max(max, s.sortOrder ?? 0), 0);

    setEditing({
      id: "",
      name: "",
      experimental: false,
      enabledProducts: [],
      sortOrder: maxSortOrder + 1,
      notes: [],
      seasonal: false,
      costPerOz: undefined,
      composition: [],
    });
    setNotesInput("");
    setCostMode("direct");
    setError(null);
  }

  function toggleProductForScent(productSlug: string) {
    if (!editing) return;

    const enabledProducts = editing.enabledProducts || [];
    const isEnabled = enabledProducts.includes(productSlug);

    setEditing({
      ...editing,
      enabledProducts: isEnabled
        ? enabledProducts.filter(p => p !== productSlug)
        : [...enabledProducts, productSlug],
    });
  }

  async function moveScent(scentId: string, direction: "up" | "down") {
    // Sort scents by sortOrder
    const sortedScents = [...scents].sort((a, b) => {
      const orderA = a.sortOrder ?? 999;
      const orderB = b.sortOrder ?? 999;
      return orderA - orderB;
    });

    const currentIndex = sortedScents.findIndex(s => s.id === scentId);
    if (currentIndex === -1) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sortedScents.length) return;

    const currentScent = sortedScents[currentIndex];
    const targetScent = sortedScents[targetIndex];

    // Swap sort orders
    const tempOrder = currentScent.sortOrder;
    const updatedCurrent = { ...currentScent, sortOrder: targetScent.sortOrder };
    const updatedTarget = { ...targetScent, sortOrder: tempOrder };

    // Update both scents
    try {
      await Promise.all([
        fetch("/api/admin/scents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedCurrent),
        }),
        fetch("/api/admin/scents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedTarget),
        }),
      ]);

      await loadScents();
    } catch (err) {
      console.error("Failed to reorder scents:", err);
      alert("Failed to reorder scents");
    }
  }

  // Base Oil management functions
  function slugify(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  }

  async function saveOil(oil: BaseOil) {
    const res = await fetch("/api/admin/base-oils", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(oil),
    });

    if (res.ok) {
      await loadBaseOils();
      setEditingOil(null);
      setNewOil({ name: "", costPerOz: 0 });
    } else {
      alert("Failed to save base oil");
    }
  }

  async function deleteOil(id: string) {
    if (!confirm("Delete this base oil?")) return;
    const res = await fetch(`/api/admin/base-oils?id=${id}`, { method: "DELETE" });
    if (res.ok) await loadBaseOils();
  }

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="btn">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-2xl font-semibold">Global Scents & Base Oils</h1>
        </div>
        {activeTab === "scents" && (
          <button className="btn btn-primary" onClick={handleNew}>
            + New Scent
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-[var(--color-line)] pb-2">
        {(["scents", "base-oils"] as const).map((tab) => (
          <button
            key={tab}
            className={`btn ${activeTab === tab ? "btn-primary" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "scents" && "Scents"}
            {tab === "base-oils" && "Base Oils"}
          </button>
        ))}
      </div>

      {/* Scents Tab */}
      {activeTab === "scents" && (
        <>
          {/* Info Banner */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              <strong>Global scents</strong> are automatically available for all candles. Mark a scent as <strong>experimental</strong> to limit it to specific products only.
            </p>
          </div>

          {/* Content */}
      {loading ? (
        <p>Loading scents...</p>
      ) : scents.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-[var(--color-muted)] mb-4">No scents yet. Create your first scent to get started.</p>
          <button className="btn btn-primary" onClick={handleNew}>
            + Create First Scent
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedScents.map((scent, index) => (
            <div key={scent.id} className="card p-4 flex items-center justify-between gap-4">
              {/* Reorder Controls */}
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => moveScent(scent.id, "up")}
                  disabled={index === 0}
                  className="p-1 rounded hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
                  title="Move up"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => moveScent(scent.id, "down")}
                  disabled={index === sortedScents.length - 1}
                  className="p-1 rounded hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
                  title="Move down"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium">{scent.name}</h3>
                  {scent.experimental && (
                    <span className="badge bg-amber-100 text-amber-800 text-xs">Experimental</span>
                  )}
                  {scent.seasonal && (
                    <span className="badge bg-blue-100 text-blue-800 text-xs">Seasonal</span>
                  )}
                </div>
                <p className="text-sm text-[var(--color-muted)]">
                  ID: <code className="text-xs bg-neutral-100 px-1 py-0.5 rounded">{scent.id}</code>
                  {scent.experimental && scent.enabledProducts && scent.enabledProducts.length > 0 && (
                    <span className="ml-2">
                      · Enabled on {scent.enabledProducts.length} product{scent.enabledProducts.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {!scent.experimental && (
                    <span className="ml-2">· Available on all products</span>
                  )}
                </p>
                {scent.notes && scent.notes.length > 0 && (
                  <p className="text-sm text-[var(--color-muted)] italic mt-1">
                    Notes: {scent.notes.join(", ")}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button className="btn" onClick={() => {
                  setEditing(scent);
                  setNotesInput(scent.notes?.join(", ") || "");
                  setCostMode(scent.composition && scent.composition.length > 0 ? "composition" : "direct");
                }}>
                  Edit
                </button>
                <button className="btn" onClick={() => handleDelete(scent.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
        </>
      )}

      {/* Base Oils Tab */}
      {activeTab === "base-oils" && (
        <div>
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              Base oils are the raw fragrance oils you use to create scent compositions. Add the oils you buy and their costs here.
            </p>
          </div>

        <div className="space-y-6">
          {/* Add New Base Oil */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4">Add Base Oil</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <label className="block">
                <div className="text-sm font-medium mb-2">Fragrance Oil Name</div>
                <input
                  className="input"
                  placeholder="e.g., Bonfire Embers"
                  value={newOil.name}
                  onChange={(e) => setNewOil({ ...newOil, name: e.target.value })}
                />
              </label>
              <label className="block">
                <div className="text-sm font-medium mb-2">Cost per Oz ($)</div>
                <input
                  className="input"
                  type="number"
                  placeholder="e.g., 2.43"
                  value={newOil.costPerOz || ""}
                  onChange={(e) => setNewOil({ ...newOil, costPerOz: e.target.value === "" ? 0 : Number(e.target.value) })}
                  step="0.01"
                />
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  Total cost ÷ bottle size (include shipping if desired)
                </p>
              </label>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => {
                if (!newOil.name || !newOil.costPerOz) {
                  alert("Please fill in name and cost");
                  return;
                }
                saveOil({
                  id: slugify(newOil.name),
                  name: newOil.name,
                  costPerOz: newOil.costPerOz,
                });
              }}
            >
              Add Base Oil
            </button>
          </div>

          {/* Existing Base Oils */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4">Existing Base Oils</h3>
            <div className="space-y-3">
              {baseOils.map((o) => (
                <div key={o.id}>
                  {editingOil?.id === o.id ? (
                    // Edit mode
                    <div className="p-3 border border-[var(--color-line)] rounded bg-[var(--color-background)]">
                      <div className="space-y-3">
                        <label className="block">
                          <div className="text-xs font-medium mb-1">Name</div>
                          <input
                            className="input text-sm"
                            value={editingOil.name}
                            onChange={(e) => setEditingOil({ ...editingOil, name: e.target.value })}
                          />
                        </label>
                        <label className="block">
                          <div className="text-xs font-medium mb-1">Cost per Oz ($)</div>
                          <input
                            className="input text-sm"
                            type="number"
                            step="0.01"
                            value={editingOil.costPerOz || ""}
                            onChange={(e) => setEditingOil({ ...editingOil, costPerOz: e.target.value === "" ? 0 : Number(e.target.value) })}
                          />
                        </label>
                        <div className="flex gap-2">
                          <button
                            className="btn btn-primary text-sm"
                            onClick={() => {
                              if (editingOil.id && editingOil.name && editingOil.costPerOz !== undefined) {
                                saveOil(editingOil as BaseOil);
                              }
                            }}
                          >
                            Save
                          </button>
                          <button
                            className="btn text-sm"
                            onClick={() => setEditingOil(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // View mode
                    <div className="flex items-center justify-between p-3 border border-[var(--color-line)] rounded">
                      <div>
                        <div className="font-medium">{o.name}</div>
                        <div className="text-sm text-[var(--color-muted)]">${o.costPerOz.toFixed(2)}/oz</div>
                      </div>
                      <div className="flex gap-2">
                        <button className="btn text-sm" onClick={() => setEditingOil(o)}>
                          Edit
                        </button>
                        <button className="btn text-sm" onClick={() => deleteOil(o.id)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {baseOils.length === 0 && (
                <p className="text-[var(--color-muted)]">No base oils yet</p>
              )}
            </div>
          </div>
        </div>
        </div>
      )}

      {/* Edit/Create Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              setEditing(null);
              setNotesInput("");
              setError(null);
            }}
          />

          {/* Modal */}
          <div className="relative card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">
                {scents.find(s => s.id === editing.id) ? "Edit Scent" : "New Scent"}
              </h2>
              <button
                className="btn"
                onClick={() => {
                  setEditing(null);
                  setNotesInput("");
                  setError(null);
                }}
              >
                Close
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg">
                <p className="text-sm text-rose-900">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              {/* Name */}
              <label className="block">
                <div className="text-sm font-medium mb-1">Display Name</div>
                <input
                  className="input"
                  value={editing.name}
                  onChange={(e) => {
                    const newName = e.target.value;
                    const updates: Partial<GlobalScent> = { name: newName };

                    // Auto-generate ID from name if this is a new scent (not found in existing scents)
                    if (!scents.find(s => s.id === editing.id)) {
                      const autoId = newName
                        .toLowerCase()
                        .replace(/[^a-z0-9\s-]/g, '') // Remove special chars except spaces and hyphens
                        .trim()
                        .replace(/\s+/g, '-') // Replace spaces with hyphens
                        .replace(/-+/g, '-'); // Replace multiple hyphens with single
                      updates.id = autoId;
                    }

                    setEditing({ ...editing, ...updates });
                  }}
                  placeholder="e.g., Vanilla, Lavender, Cinnamon"
                />
              </label>

              {/* ID */}
              <label className="block">
                <div className="text-sm font-medium mb-1">ID</div>
                <input
                  className="input"
                  value={editing.id}
                  onChange={(e) => setEditing({ ...editing, id: e.target.value.toLowerCase() })}
                  placeholder="e.g., vanilla, lavender, cinnamon"
                  disabled={!!scents.find(s => s.id === editing.id)} // Don't allow changing ID after creation
                />
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  Lowercase letters, numbers, and hyphens only. Auto-generated from name. Cannot be changed after creation.
                </p>
              </label>

              {/* Scent Notes */}
              <label className="block">
                <div className="text-sm font-medium mb-1">Scent Notes</div>
                <input
                  className="input"
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  placeholder="e.g., Leather, Bonfire Embers"
                />
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  Enter scent notes separated by commas (e.g., &quot;Leather, Bonfire Embers&quot;). These will be displayed on product pages.
                </p>
              </label>

              {/* Sort Order */}
              <label className="block">
                <div className="text-sm font-medium mb-1">Sort Order</div>
                <input
                  className="input"
                  type="number"
                  value={editing.sortOrder ?? ""}
                  onChange={(e) => setEditing({ ...editing, sortOrder: e.target.value === "" ? 0 : Number(e.target.value) })}
                  placeholder="0"
                />
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  Lower numbers appear first. Leave at 0 for alphabetical sorting.
                </p>
              </label>

              {/* Cost Calculation */}
              <div className="border border-[var(--color-line)] rounded-lg p-4">
                <h3 className="text-sm font-medium mb-3">Cost Calculation (Admin Only)</h3>

                {/* Cost Mode Selector */}
                <div className="mb-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={`btn text-sm ${costMode === "direct" ? "btn-primary" : ""}`}
                      onClick={() => {
                        setCostMode("direct");
                        setEditing({ ...editing, composition: [] });
                      }}
                    >
                      Direct Cost
                    </button>
                    <button
                      type="button"
                      className={`btn text-sm ${costMode === "composition" ? "btn-primary" : ""}`}
                      onClick={() => {
                        setCostMode("composition");
                        setEditing({ ...editing, costPerOz: undefined, composition: editing.composition || [] });
                      }}
                    >
                      Base Oil Composition
                    </button>
                  </div>
                </div>

                {/* Direct Cost Mode */}
                {costMode === "direct" && (
                  <div>
                    <label className="block">
                      <div className="text-xs font-medium mb-1">Cost per Oz ($)</div>
                      <input
                        className="input text-sm"
                        type="number"
                        step="0.01"
                        value={editing.costPerOz ?? ""}
                        onChange={(e) => setEditing({ ...editing, costPerOz: e.target.value === "" ? undefined : Number(e.target.value) })}
                        placeholder="e.g., 2.43"
                      />
                    </label>
                  </div>
                )}

                {/* Composition Mode */}
                {costMode === "composition" && (
                  <div>
                    {baseOils.length === 0 ? (
                      <p className="text-sm text-[var(--color-muted)]">
                        No base oils available. Switch to the "Base Oils" tab to add base oils first.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-xs text-[var(--color-muted)]">
                          Build this scent from base fragrance oils. Percentages must total 100%.
                        </p>

                        {(editing.composition || []).map((comp, idx) => (
                          <div key={idx} className="border border-[var(--color-line)] rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="text-xs font-medium text-[var(--color-muted)]">
                                Component {idx + 1}
                              </div>
                              <button
                                type="button"
                                className="btn text-xs px-2 py-1"
                                onClick={() => {
                                  const newComp = [...(editing.composition || [])];
                                  newComp.splice(idx, 1);
                                  setEditing({ ...editing, composition: newComp });
                                }}
                              >
                                Remove
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <label className="block">
                                <div className="text-xs font-medium mb-1">Base Oil</div>
                                <select
                                  className="input text-sm w-full"
                                  value={comp.baseOilId}
                                  onChange={(e) => {
                                    const newComp = [...(editing.composition || [])];
                                    newComp[idx] = { ...comp, baseOilId: e.target.value };
                                    setEditing({ ...editing, composition: newComp });
                                  }}
                                >
                                  <option value="">Select base oil...</option>
                                  {baseOils.map((oil) => (
                                    <option key={oil.id} value={oil.id}>
                                      {oil.name} (${oil.costPerOz.toFixed(2)}/oz)
                                    </option>
                                  ))}
                                </select>
                              </label>

                              <label className="block">
                                <div className="text-xs font-medium mb-1">Percentage (%)</div>
                                <input
                                  className="input text-sm w-full"
                                  type="number"
                                  step="1"
                                  min="0"
                                  max="100"
                                  value={comp.percentage || ""}
                                  onChange={(e) => {
                                    const newComp = [...(editing.composition || [])];
                                    newComp[idx] = { ...comp, percentage: e.target.value === "" ? 0 : Number(e.target.value) };
                                    setEditing({ ...editing, composition: newComp });
                                  }}
                                  placeholder="e.g., 60"
                                />
                              </label>
                            </div>
                          </div>
                        ))}

                        <button
                          type="button"
                          className="btn text-sm w-full"
                          onClick={() => {
                            setEditing({
                              ...editing,
                              composition: [...(editing.composition || []), { baseOilId: "", percentage: 0 }],
                            });
                          }}
                        >
                          + Add Base Oil Component
                        </button>

                        {/* Show total percentage */}
                        {editing.composition && editing.composition.length > 0 && (
                          <div className="p-3 bg-neutral-50 rounded-lg">
                            <div className="text-sm font-medium">
                              Total: {editing.composition.reduce((sum, c) => sum + c.percentage, 0)}%
                              {Math.abs(editing.composition.reduce((sum, c) => sum + c.percentage, 0) - 100) > 0.01 ? (
                                <span className="text-amber-600 ml-2">⚠ Must total 100%</span>
                              ) : (
                                <span className="text-green-600 ml-2">✓ Valid</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Experimental Toggle */}
              <label className="flex items-start gap-3 p-3 border border-[var(--color-line)] rounded-lg">
                <input
                  type="checkbox"
                  checked={editing.experimental}
                  onChange={(e) => setEditing({
                    ...editing,
                    experimental: e.target.checked,
                    enabledProducts: e.target.checked ? editing.enabledProducts : []
                  })}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium">Experimental Scent</div>
                  <p className="text-xs text-[var(--color-muted)] mt-1">
                    When checked, this scent will only appear on selected products. When unchecked, it will be available for all products.
                  </p>
                </div>
              </label>

              {/* Seasonal Toggle */}
              <label className="flex items-start gap-3 p-3 border border-[var(--color-line)] rounded-lg">
                <input
                  type="checkbox"
                  checked={editing.seasonal ?? false}
                  onChange={(e) => setEditing({
                    ...editing,
                    seasonal: e.target.checked
                  })}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium">Seasonal Scent</div>
                  <p className="text-xs text-[var(--color-muted)] mt-1">
                    When checked, this scent will be marked as seasonal and can be filtered separately in the shop.
                  </p>
                </div>
              </label>

              {/* Product Selection (only if experimental) */}
              {editing.experimental && (
                <div className="border border-[var(--color-line)] rounded-lg p-4">
                  <h3 className="text-sm font-medium mb-3">Enabled Products</h3>
                  {products.length === 0 ? (
                    <p className="text-sm text-[var(--color-muted)]">No products available</p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {products.map((product) => {
                        const isEnabled = editing.enabledProducts?.includes(product.slug) ?? false;
                        return (
                          <label
                            key={product.slug}
                            className="flex items-center gap-2 p-2 hover:bg-neutral-50 rounded cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={isEnabled}
                              onChange={() => toggleProductForScent(product.slug)}
                            />
                            <span className="text-sm">{product.name}</span>
                            <code className="text-xs text-[var(--color-muted)] ml-auto">{product.slug}</code>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  <p className="text-xs text-[var(--color-muted)] mt-3">
                    Selected: {editing.enabledProducts?.length ?? 0} product{editing.enabledProducts?.length !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-[var(--color-line)]">
              <button
                className="btn"
                onClick={() => {
                  setEditing(null);
                  setNotesInput("");
                  setError(null);
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Scent"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
