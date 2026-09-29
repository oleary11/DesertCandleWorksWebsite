"use client";

import { useEffect, useState, useMemo } from "react";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "lucide-react";
import PageHeader from "../_components/PageHeader";
import { Badge, FormSection, Modal, Segmented, Tabs } from "../_components/ui";
import { useModal } from "@/hooks/useModal";
import CandleSpinner from "@/components/CandleSpinner";

/* ---------- Types ---------- */
type ScentComposition = {
  baseOilId: string;
  percentage: number;
};

type GlobalScent = {
  id: string;
  name: string;
  limited: boolean;
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
  const { showAlert, showConfirm } = useModal();
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
    const confirmed = await showConfirm(`Delete scent "${id}"? This will affect all products using this scent.`, "Confirm Delete");
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/admin/scents?id=${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        await showAlert(data.error || "Failed to delete scent", "Error");
        return;
      }

      await loadScents();
    } catch (err) {
      console.error("Delete error:", err);
      await showAlert("Failed to delete scent", "Error");
    }
  }

  function handleNew() {
    // Find highest sort order and add 1
    const maxSortOrder = scents.reduce((max, s) => Math.max(max, s.sortOrder ?? 0), 0);

    setEditing({
      id: "",
      name: "",
      limited: false,
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
      await showAlert("Failed to reorder scents", "Error");
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
      await showAlert("Failed to save base oil", "Error");
    }
  }

  async function deleteOil(id: string) {
    const confirmed = await showConfirm("Delete this base oil?", "Confirm Delete");
    if (!confirmed) return;
    const res = await fetch(`/api/admin/base-oils?id=${id}`, { method: "DELETE" });
    if (res.ok) await loadBaseOils();
  }

  function closeEditor() {
    setEditing(null);
    setNotesInput("");
    setError(null);
  }

  function openEditor(scent: GlobalScent) {
    setEditing(scent);
    setNotesInput(scent.notes?.join(", ") || "");
    setCostMode(scent.composition && scent.composition.length > 0 ? "composition" : "direct");
  }

  const isExisting = editing ? !!scents.find((s) => s.id === editing.id) : false;
  const compositionTotal = editing?.composition?.reduce((sum, c) => sum + c.percentage, 0) ?? 0;

  return (
    <div className="a-ui mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Scents"
        description="Every scent is offered on all candles unless you mark it Limited."
        actions={
          activeTab === "scents" ? (
            <button className="a-btn a-btn-primary" onClick={handleNew}>
              <Plus className="h-4 w-4" aria-hidden />
              New scent
            </button>
          ) : undefined
        }
      />

      <Tabs
        label="Scent sections"
        value={activeTab}
        onChange={setActiveTab}
        tabs={[
          { value: "scents", label: "Scents" },
          { value: "base-oils", label: "Base oils" },
        ]}
      />

      {/* Scents */}
      {activeTab === "scents" &&
        (loading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16">
            <CandleSpinner />
            <p className="text-sm font-medium text-[var(--a-muted)]">Loading scents…</p>
          </div>
        ) : scents.length === 0 ? (
          <div className="a-card px-6 py-16 text-center">
            <p className="font-medium text-[var(--a-ink)]">No scents yet</p>
            <p className="mt-1 text-sm text-[var(--a-muted)]">Create your first scent to get started.</p>
            <button className="a-btn a-btn-primary mt-4" onClick={handleNew}>
              <Plus className="h-4 w-4" aria-hidden />
              New scent
            </button>
          </div>
        ) : (
          <ol className="a-card divide-y divide-[var(--a-line)]">
            {sortedScents.map((scent, index) => (
              <li key={scent.id} className="flex items-center gap-3 px-3 py-3 sm:px-4">
                <div className="flex shrink-0 flex-col">
                  <button
                    onClick={() => moveScent(scent.id, "up")}
                    disabled={index === 0}
                    className="a-icon-btn h-6 w-7 disabled:opacity-30"
                    aria-label={`Move ${scent.name} up`}
                    title="Move up"
                  >
                    <ChevronUp className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    onClick={() => moveScent(scent.id, "down")}
                    disabled={index === sortedScents.length - 1}
                    className="a-icon-btn h-6 w-7 disabled:opacity-30"
                    aria-label={`Move ${scent.name} down`}
                    title="Move down"
                  >
                    <ChevronDown className="h-4 w-4" aria-hidden />
                  </button>
                </div>

                <button type="button" onClick={() => openEditor(scent)} className="group min-w-0 flex-1 text-left">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-[var(--a-ink)] group-hover:underline">{scent.name}</span>
                    {scent.limited ? (
                      <Badge tone="amber">
                        Limited · {scent.enabledProducts?.length ?? 0} product{(scent.enabledProducts?.length ?? 0) === 1 ? "" : "s"}
                      </Badge>
                    ) : (
                      <Badge>All candles</Badge>
                    )}
                    {scent.seasonal && <Badge tone="blue">Seasonal</Badge>}
                  </span>
                  {scent.notes && scent.notes.length > 0 && (
                    <span className="mt-0.5 block truncate text-sm text-[var(--a-muted)]">{scent.notes.join(" · ")}</span>
                  )}
                </button>

                <div className="flex shrink-0 gap-1">
                  <button className="a-icon-btn" onClick={() => openEditor(scent)} aria-label={`Edit ${scent.name}`} title="Edit">
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    className="a-icon-btn a-icon-btn-danger"
                    onClick={() => handleDelete(scent.id)}
                    aria-label={`Delete ${scent.name}`}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        ))}

      {/* Base oils */}
      {activeTab === "base-oils" && (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <section className="a-card p-5">
            <h2 className="text-base font-semibold text-[var(--a-ink)]">Add a base oil</h2>
            <p className="mb-4 mt-0.5 text-sm text-[var(--a-muted)]">The raw fragrance oils you buy. Scents can be built from them.</p>
            <div className="space-y-4">
              <label className="block">
                <span className="a-label">Fragrance oil name</span>
                <input
                  className="a-input"
                  placeholder="e.g. Bonfire Embers"
                  value={newOil.name}
                  onChange={(e) => setNewOil({ ...newOil, name: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="a-label">Cost per oz</span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--a-faint)]">$</span>
                  <input
                    className="a-input pl-7 tabular-nums"
                    type="number"
                    placeholder="2.43"
                    value={newOil.costPerOz || ""}
                    onChange={(e) => setNewOil({ ...newOil, costPerOz: e.target.value === "" ? 0 : Number(e.target.value) })}
                    step="0.01"
                  />
                </div>
                <p className="a-help">Total cost ÷ bottle size. Include shipping if you like.</p>
              </label>
              <button
                className="a-btn a-btn-primary w-full"
                onClick={async () => {
                  if (!newOil.name || !newOil.costPerOz) {
                    await showAlert("Please fill in name and cost", "Validation Error");
                    return;
                  }
                  saveOil({
                    id: slugify(newOil.name),
                    name: newOil.name,
                    costPerOz: newOil.costPerOz,
                  });
                }}
              >
                <Plus className="h-4 w-4" aria-hidden />
                Add base oil
              </button>
            </div>
          </section>

          <section className="a-card overflow-hidden">
            <div className="border-b border-[var(--a-line)] px-5 py-3.5">
              <h2 className="text-base font-semibold text-[var(--a-ink)]">Base oils</h2>
            </div>
            {baseOils.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-[var(--a-muted)]">No base oils yet.</p>
            ) : (
              <ul className="divide-y divide-[var(--a-line)]">
                {baseOils.map((o) => (
                  <li key={o.id} className="px-5 py-3">
                    {editingOil?.id === o.id ? (
                      <div className="flex flex-wrap items-end gap-3">
                        <label className="block min-w-40 flex-1">
                          <span className="a-label">Name</span>
                          <input
                            className="a-input"
                            value={editingOil.name}
                            onChange={(e) => setEditingOil({ ...editingOil, name: e.target.value })}
                          />
                        </label>
                        <label className="block w-32">
                          <span className="a-label">Cost per oz</span>
                          <input
                            className="a-input tabular-nums"
                            type="number"
                            step="0.01"
                            value={editingOil.costPerOz || ""}
                            onChange={(e) => setEditingOil({ ...editingOil, costPerOz: e.target.value === "" ? 0 : Number(e.target.value) })}
                          />
                        </label>
                        <div className="flex gap-2">
                          <button className="a-btn" onClick={() => setEditingOil(null)}>
                            Cancel
                          </button>
                          <button
                            className="a-btn a-btn-primary"
                            onClick={() => {
                              if (editingOil.id && editingOil.name && editingOil.costPerOz !== undefined) {
                                saveOil(editingOil as BaseOil);
                              }
                            }}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[var(--a-ink)]">{o.name}</p>
                          <p className="text-sm tabular-nums text-[var(--a-muted)]">${o.costPerOz.toFixed(2)} / oz</p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button className="a-icon-btn" onClick={() => setEditingOil(o)} aria-label={`Edit ${o.name}`} title="Edit">
                            <Pencil className="h-4 w-4" aria-hidden />
                          </button>
                          <button
                            className="a-icon-btn a-icon-btn-danger"
                            onClick={() => deleteOil(o.id)}
                            aria-label={`Delete ${o.name}`}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {/* Scent editor */}
      {editing && (
        <Modal
          size="lg"
          title={isExisting ? `Edit ${editing.name || "scent"}` : "New scent"}
          description="Details, cost and which candles offer it."
          onClose={closeEditor}
          busy={saving}
          footer={
            <>
              <button className="a-btn" onClick={closeEditor} disabled={saving}>
                Cancel
              </button>
              <button className="a-btn a-btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save scent"}
              </button>
            </>
          }
        >
          {error && (
            <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-[#fdecea] p-3 text-sm text-[#7a1a12]">
              {error}
            </div>
          )}

          <FormSection title="Details">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="a-label">Display name</span>
                <input
                  className="a-input"
                  value={editing.name}
                  onChange={(e) => {
                    const newName = e.target.value;
                    const updates: Partial<GlobalScent> = { name: newName };

                    // Auto-generate ID from name if this is a new scent (not found in existing scents)
                    if (!scents.find((s) => s.id === editing.id)) {
                      const autoId = newName
                        .toLowerCase()
                        .replace(/[^a-z0-9\s-]/g, "") // Remove special chars except spaces and hyphens
                        .trim()
                        .replace(/\s+/g, "-") // Replace spaces with hyphens
                        .replace(/-+/g, "-"); // Replace multiple hyphens with single
                      updates.id = autoId;
                    }

                    setEditing({ ...editing, ...updates });
                  }}
                  placeholder="e.g. Vanilla, Lavender, Cinnamon"
                />
              </label>

              <label className="block">
                <span className="a-label">ID</span>
                <input
                  className="a-input font-mono"
                  value={editing.id}
                  onChange={(e) => setEditing({ ...editing, id: e.target.value.toLowerCase() })}
                  placeholder="e.g. vanilla"
                  disabled={isExisting} // Don't allow changing ID after creation
                />
                <p className="a-help">Made from the name. Can&apos;t be changed after the scent is created.</p>
              </label>

              <label className="block">
                <span className="a-label">Scent notes</span>
                <input
                  className="a-input"
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  placeholder="e.g. Leather, Bonfire Embers"
                />
                <p className="a-help">Separate with commas. Shown on product pages.</p>
              </label>

              <label className="block">
                <span className="a-label">Sort order</span>
                <input
                  className="a-input tabular-nums"
                  type="number"
                  value={editing.sortOrder ?? ""}
                  onChange={(e) => setEditing({ ...editing, sortOrder: e.target.value === "" ? 0 : Number(e.target.value) })}
                  placeholder="0"
                />
                <p className="a-help">Lower numbers come first. Leave at 0 for alphabetical.</p>
              </label>
            </div>
          </FormSection>

          <FormSection title="Cost" description="Only used for your cost calculations.">
            <Segmented
              label="Cost mode"
              value={costMode}
              onChange={(mode) => {
                setCostMode(mode);
                if (mode === "direct") setEditing({ ...editing, composition: [] });
                else setEditing({ ...editing, costPerOz: undefined, composition: editing.composition || [] });
              }}
              options={[
                { value: "direct", label: "Direct cost" },
                { value: "composition", label: "Blend of base oils" },
              ]}
            />

            {costMode === "direct" && (
              <label className="mt-4 block max-w-xs">
                <span className="a-label">Cost per oz</span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--a-faint)]">$</span>
                  <input
                    className="a-input pl-7 tabular-nums"
                    type="number"
                    step="0.01"
                    value={editing.costPerOz ?? ""}
                    onChange={(e) => setEditing({ ...editing, costPerOz: e.target.value === "" ? undefined : Number(e.target.value) })}
                    placeholder="2.43"
                  />
                </div>
              </label>
            )}

            {costMode === "composition" && (
              <div className="mt-4">
                {baseOils.length === 0 ? (
                  <p className="text-sm text-[var(--a-muted)]">No base oils yet. Add some in the Base oils tab first.</p>
                ) : (
                  <div className="space-y-3">
                    {(editing.composition || []).map((comp, idx) => (
                      <div key={idx} className="flex items-end gap-2">
                        <label className="block min-w-0 flex-1">
                          <span className={idx === 0 ? "a-label" : "sr-only"}>Base oil</span>
                          <select
                            className="a-select"
                            value={comp.baseOilId}
                            onChange={(e) => {
                              const newComp = [...(editing.composition || [])];
                              newComp[idx] = { ...comp, baseOilId: e.target.value };
                              setEditing({ ...editing, composition: newComp });
                            }}
                          >
                            <option value="">Select…</option>
                            {baseOils.map((oil) => (
                              <option key={oil.id} value={oil.id}>
                                {oil.name} (${oil.costPerOz.toFixed(2)}/oz)
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block w-24">
                          <span className={idx === 0 ? "a-label" : "sr-only"}>Percent</span>
                          <div className="relative">
                            <input
                              className="a-input pr-7 text-right tabular-nums"
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
                              placeholder="60"
                            />
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--a-faint)]">%</span>
                          </div>
                        </label>
                        <button
                          type="button"
                          className="a-icon-btn a-icon-btn-danger h-10 w-10"
                          aria-label={`Remove component ${idx + 1}`}
                          onClick={() => {
                            const newComp = [...(editing.composition || [])];
                            newComp.splice(idx, 1);
                            setEditing({ ...editing, composition: newComp });
                          }}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    ))}

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <button
                        type="button"
                        className="a-btn a-btn-sm"
                        onClick={() => {
                          setEditing({
                            ...editing,
                            composition: [...(editing.composition || []), { baseOilId: "", percentage: 0 }],
                          });
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden />
                        Add base oil
                      </button>
                      {editing.composition && editing.composition.length > 0 && (
                        <p className="text-sm">
                          Total <span className="font-semibold tabular-nums">{compositionTotal}%</span>{" "}
                          {Math.abs(compositionTotal - 100) > 0.01 ? (
                            <Badge tone="amber">Must equal 100%</Badge>
                          ) : (
                            <Badge tone="green">Good</Badge>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </FormSection>

          <FormSection title="Availability">
            <div className="space-y-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--a-line)] p-3 transition-colors hover:border-[var(--a-line-strong)]">
                <input
                  type="checkbox"
                  className="a-check mt-0.5"
                  checked={editing.limited}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      limited: e.target.checked,
                      enabledProducts: e.target.checked ? editing.enabledProducts : [],
                    })
                  }
                />
                <span>
                  <span className="block text-sm font-medium text-[var(--a-ink)]">Limited</span>
                  <span className="mt-0.5 block text-xs text-[var(--a-muted)]">
                    Only offer this scent on the candles you pick below. Otherwise it&apos;s on every candle.
                  </span>
                </span>
              </label>

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--a-line)] p-3 transition-colors hover:border-[var(--a-line-strong)]">
                <input
                  type="checkbox"
                  className="a-check mt-0.5"
                  checked={editing.seasonal ?? false}
                  onChange={(e) => setEditing({ ...editing, seasonal: e.target.checked })}
                />
                <span>
                  <span className="block text-sm font-medium text-[var(--a-ink)]">Seasonal</span>
                  <span className="mt-0.5 block text-xs text-[var(--a-muted)]">Can be filtered separately in the shop.</span>
                </span>
              </label>
            </div>

            {editing.limited && (
              <div className="mt-4">
                <p className="a-label">
                  Offered on{" "}
                  <span className="font-normal text-[var(--a-muted)]">({editing.enabledProducts?.length ?? 0} selected)</span>
                </p>
                {products.length === 0 ? (
                  <p className="text-sm text-[var(--a-muted)]">No products available.</p>
                ) : (
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-[var(--a-line)] p-1">
                    {products.map((product) => {
                      const isEnabled = editing.enabledProducts?.includes(product.slug) ?? false;
                      return (
                        <label key={product.slug} className="a-menu-item font-normal">
                          <input
                            type="checkbox"
                            className="a-check"
                            checked={isEnabled}
                            onChange={() => toggleProductForScent(product.slug)}
                          />
                          <span className="flex-1">{product.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </FormSection>
        </Modal>
      )}
    </div>
  );
}
