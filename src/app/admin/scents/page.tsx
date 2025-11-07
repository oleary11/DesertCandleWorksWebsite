"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronUp, ChevronDown } from "lucide-react";

/* ---------- Types ---------- */
type GlobalScent = {
  id: string;
  name: string;
  experimental: boolean;
  enabledProducts?: string[];
  sortOrder?: number;
  notes?: string[];
  seasonal?: boolean;
};

type Product = {
  slug: string;
  name: string;
};

/* ---------- Component ---------- */
export default function AdminScentsPage() {
  const [scents, setScents] = useState<GlobalScent[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<GlobalScent | null>(null);
  const [notesInput, setNotesInput] = useState<string>(""); // Separate state for notes text input
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    Promise.all([loadScents(), loadProducts()]).finally(() => setLoading(false));
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
    const scentToSave = { ...editing, notes: notesArray };

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
    });
    setNotesInput("");
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

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="btn">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-2xl font-semibold">Global Scents</h1>
        </div>
        <button className="btn btn-primary" onClick={handleNew}>
          + New Scent
        </button>
      </div>

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
                  Lowercase letters, numbers, and hyphens only. Cannot be changed after creation.
                </p>
              </label>

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
                  value={editing.sortOrder ?? 0}
                  onChange={(e) => setEditing({ ...editing, sortOrder: Number(e.target.value) })}
                />
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  Lower numbers appear first. Leave at 0 for alphabetical sorting.
                </p>
              </label>

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
