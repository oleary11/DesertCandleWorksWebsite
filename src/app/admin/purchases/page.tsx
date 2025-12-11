"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Upload, DollarSign, Package, Calendar, FileText, X, Edit2, Check } from "lucide-react";
import { useModal } from "@/hooks/useModal";

type PurchaseItem = {
  name: string;
  quantity: number;
  unitCostCents: number;
  category: string;
  notes?: string;
};

type PurchaseItemWithAllocations = PurchaseItem & {
  totalCostCents: number;
  allocatedShippingCents: number;
  allocatedTaxCents: number;
  fullyLoadedCostCents: number;
  costPerUnitCents: number;
};

type Purchase = {
  id: string;
  vendorName: string;
  purchaseDate: string;
  items: PurchaseItem[];
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  receiptImageUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

const CATEGORIES = [
  "wax",
  "wicks",
  "bottles",
  "scents",
  "labels",
  "packaging",
  "equipment",
  "other",
];

// Helper function to format date without timezone issues
function formatDate(dateString: string): string {
  const [year, month, day] = dateString.split("-");
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day)).toLocaleDateString();
}

export default function AdminPurchasesPage() {
  const { showAlert, showConfirm } = useModal();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [vendorName, setVendorName] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split("T")[0]);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [shippingCents, setShippingCents] = useState(0);
  const [taxCents, setTaxCents] = useState(0);
  const [receiptImageUrl, setReceiptImageUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);

  // Filter state
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterVendor, setFilterVendor] = useState<string>("all");

  useEffect(() => {
    loadPurchases();
  }, []);

  async function loadPurchases() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/purchases");
      if (res.ok) {
        const data = await res.json();
        setPurchases(data);
      }
    } catch (err) {
      console.error("Failed to load purchases:", err);
    } finally {
      setLoading(false);
    }
  }

  function addItem() {
    setItems([...items, { name: "", quantity: 1, unitCostCents: 0, category: "other", notes: "" }]);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof PurchaseItem, value: string | number) {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  }

  function calculateAllocations(items: PurchaseItem[], shipping: number, tax: number): PurchaseItemWithAllocations[] {
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitCostCents, 0);

    if (subtotal === 0) {
      return items.map(item => ({
        ...item,
        totalCostCents: 0,
        allocatedShippingCents: 0,
        allocatedTaxCents: 0,
        fullyLoadedCostCents: 0,
        costPerUnitCents: 0,
      }));
    }

    return items.map(item => {
      const itemCost = item.quantity * item.unitCostCents;
      const costRatio = itemCost / subtotal;
      const allocatedShipping = Math.round(shipping * costRatio);
      const allocatedTax = Math.round(tax * costRatio);
      const fullyLoaded = itemCost + allocatedShipping + allocatedTax;
      const perUnit = item.quantity > 0 ? Math.round(fullyLoaded / item.quantity) : 0;

      return {
        ...item,
        totalCostCents: itemCost,
        allocatedShippingCents: allocatedShipping,
        allocatedTaxCents: allocatedTax,
        fullyLoadedCostCents: fullyLoaded,
        costPerUnitCents: perUnit,
      };
    });
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      await showAlert("Please upload an image or PDF file", "Invalid File");
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      await showAlert("File size must be less than 10MB", "File Too Large");
      return;
    }

    try {
      setUploadingImage(true);

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setReceiptImageUrl(data.url);
      } else {
        await showAlert("Failed to upload receipt image", "Upload Error");
      }
    } catch (err) {
      console.error("Image upload error:", err);
      await showAlert("Failed to upload receipt image", "Upload Error");
    } finally {
      setUploadingImage(false);
    }
  }

  async function savePurchase() {
    // Validation
    if (!vendorName.trim()) {
      await showAlert("Please enter a vendor name", "Validation Error");
      return;
    }

    if (!purchaseDate) {
      await showAlert("Please select a purchase date", "Validation Error");
      return;
    }

    if (items.length === 0) {
      await showAlert("Please add at least one item", "Validation Error");
      return;
    }

    // Validate all items
    for (const item of items) {
      if (!item.name.trim()) {
        await showAlert("All items must have a name", "Validation Error");
        return;
      }
      if (item.quantity <= 0) {
        await showAlert("All items must have a positive quantity", "Validation Error");
        return;
      }
      if (item.unitCostCents < 0) {
        await showAlert("All items must have a non-negative cost", "Validation Error");
        return;
      }
    }

    try {
      const payload = {
        vendorName: vendorName.trim(),
        purchaseDate,
        items,
        shippingCents,
        taxCents,
        receiptImageUrl: receiptImageUrl || undefined,
        notes: notes.trim() || undefined,
      };

      const url = editingId ? `/api/admin/purchases/${editingId}` : "/api/admin/purchases";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await showAlert(
          editingId ? "Purchase updated successfully" : "Purchase added successfully",
          "Success"
        );
        resetForm();
        setShowAddForm(false);
        setEditingId(null);
        await loadPurchases();
      } else {
        const data = await res.json();
        await showAlert(data.error || "Failed to save purchase", "Error");
      }
    } catch (err) {
      console.error("Save error:", err);
      await showAlert("Failed to save purchase", "Error");
    }
  }

  function resetForm() {
    setVendorName("");
    setPurchaseDate(new Date().toISOString().split("T")[0]);
    setItems([]);
    setShippingCents(0);
    setTaxCents(0);
    setReceiptImageUrl("");
    setNotes("");
  }

  function editPurchase(purchase: Purchase) {
    setVendorName(purchase.vendorName);
    setPurchaseDate(purchase.purchaseDate);
    setItems([...purchase.items]);
    setShippingCents(purchase.shippingCents);
    setTaxCents(purchase.taxCents);
    setReceiptImageUrl(purchase.receiptImageUrl || "");
    setNotes(purchase.notes || "");
    setEditingId(purchase.id);
    setShowAddForm(true);
  }

  async function deletePurchase(id: string, vendorName: string) {
    const confirmed = await showConfirm(
      `Are you sure you want to delete the purchase from ${vendorName}?`,
      "Confirm Delete"
    );

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/admin/purchases/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        await showAlert("Purchase deleted successfully", "Success");
        await loadPurchases();
      } else {
        await showAlert("Failed to delete purchase", "Error");
      }
    } catch (err) {
      console.error("Delete error:", err);
      await showAlert("Failed to delete purchase", "Error");
    }
  }

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitCostCents, 0);
  const total = subtotal + shippingCents + taxCents;
  const allocatedItems = calculateAllocations(items, shippingCents, taxCents);

  // Get unique vendors for filter
  const vendors = Array.from(new Set(purchases.map(p => p.vendorName))).sort();

  // Filter purchases
  const filteredPurchases = purchases.filter(purchase => {
    if (filterVendor !== "all" && purchase.vendorName !== filterVendor) return false;
    if (filterCategory !== "all" && !purchase.items.some(item => item.category === filterCategory)) return false;
    return true;
  });

  // Calculate totals
  const totalSpent = filteredPurchases.reduce((sum, p) => sum + p.totalCents, 0);
  const totalItems = filteredPurchases.reduce((sum, p) => sum + p.items.reduce((s, i) => s + i.quantity, 0), 0);

  return (
    <div className="min-h-screen p-6 bg-neutral-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)] mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Admin
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Cost of Goods Tracking</h1>
              <p className="text-[var(--color-muted)] mt-1">
                Track purchases, calculate fully-loaded costs, and manage receipts
              </p>
            </div>
            <button
              onClick={() => {
                resetForm();
                setEditingId(null);
                setShowAddForm(!showAddForm);
              }}
              className="btn bg-[var(--color-accent)] text-[var(--color-accent-ink)] flex items-center gap-2"
            >
              {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showAddForm ? "Cancel" : "Add Purchase"}
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card p-6 bg-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-sm font-medium text-[var(--color-muted)]">Total Spent</span>
            </div>
            <p className="text-3xl font-bold">${(totalSpent / 100).toFixed(2)}</p>
            <p className="text-xs text-[var(--color-muted)] mt-1">{filteredPurchases.length} purchases</p>
          </div>

          <div className="card p-6 bg-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-[var(--color-muted)]">Total Items</span>
            </div>
            <p className="text-3xl font-bold">{totalItems}</p>
            <p className="text-xs text-[var(--color-muted)] mt-1">Across all purchases</p>
          </div>

          <div className="card p-6 bg-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-sm font-medium text-[var(--color-muted)]">Avg Purchase</span>
            </div>
            <p className="text-3xl font-bold">
              ${filteredPurchases.length > 0 ? (totalSpent / filteredPurchases.length / 100).toFixed(2) : "0.00"}
            </p>
            <p className="text-xs text-[var(--color-muted)] mt-1">Per purchase order</p>
          </div>
        </div>

        {/* Add/Edit Form */}
        {showAddForm && (
          <div className="card p-6 bg-white mb-8">
            <h2 className="text-xl font-bold mb-4">{editingId ? "Edit Purchase" : "Add New Purchase"}</h2>

            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-1">Vendor Name *</label>
                <input
                  type="text"
                  className="input w-full"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="e.g., CandleScience, Amazon"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Purchase Date *</label>
                <input
                  type="date"
                  className="input w-full"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                />
              </div>
            </div>

            {/* Items */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium">Items *</label>
                <button
                  onClick={addItem}
                  className="text-sm text-[var(--color-accent)] hover:underline flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Add Item
                </button>
              </div>

              {items.length === 0 && (
                <div className="text-center py-8 text-[var(--color-muted)] text-sm">
                  No items added. Click &quot;Add Item&quot; to get started.
                </div>
              )}

              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={index} className="border border-[var(--color-line)] rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                      <div>
                        <label className="block text-xs font-medium mb-1">Item Name</label>
                        <input
                          type="text"
                          className="input w-full text-sm"
                          value={item.name}
                          onChange={(e) => updateItem(index, "name", e.target.value)}
                          placeholder="e.g., Soy Wax 464"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium mb-1">Quantity</label>
                        <input
                          type="number"
                          className="input w-full text-sm"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium mb-1">Unit Cost ($)</label>
                        <input
                          type="number"
                          className="input w-full text-sm"
                          value={item.unitCostCents / 100}
                          onChange={(e) => updateItem(index, "unitCostCents", Math.round((parseFloat(e.target.value) || 0) * 100))}
                          min="0"
                          step="0.01"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium mb-1">Category</label>
                        <select
                          className="input w-full text-sm"
                          value={item.category}
                          onChange={(e) => updateItem(index, "category", e.target.value)}
                        >
                          {CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat.charAt(0).toUpperCase() + cat.slice(1)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex items-end gap-3">
                      <div className="flex-1">
                        <label className="block text-xs font-medium mb-1">Notes (Optional)</label>
                        <input
                          type="text"
                          className="input w-full text-sm"
                          value={item.notes || ""}
                          onChange={(e) => updateItem(index, "notes", e.target.value)}
                          placeholder="Additional details..."
                        />
                      </div>
                      <button
                        onClick={() => removeItem(index)}
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded"
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {allocatedItems[index] && (
                      <div className="mt-3 pt-3 border-t border-[var(--color-line)] text-xs text-[var(--color-muted)] grid grid-cols-2 md:grid-cols-4 gap-2">
                        <div>
                          <span className="font-medium">Item Total:</span> ${(allocatedItems[index].totalCostCents / 100).toFixed(2)}
                        </div>
                        <div>
                          <span className="font-medium">+ Shipping:</span> ${(allocatedItems[index].allocatedShippingCents / 100).toFixed(2)}
                        </div>
                        <div>
                          <span className="font-medium">+ Tax:</span> ${(allocatedItems[index].allocatedTaxCents / 100).toFixed(2)}
                        </div>
                        <div className="text-green-600 font-medium">
                          Per Unit: ${(allocatedItems[index].costPerUnitCents / 100).toFixed(2)}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Shipping & Tax */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-1">Shipping Cost ($)</label>
                <input
                  type="number"
                  className="input w-full"
                  value={shippingCents / 100}
                  onChange={(e) => setShippingCents(Math.round((parseFloat(e.target.value) || 0) * 100))}
                  min="0"
                  step="0.01"
                />
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  Will be allocated proportionally across items
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Tax ($)</label>
                <input
                  type="number"
                  className="input w-full"
                  value={taxCents / 100}
                  onChange={(e) => setTaxCents(Math.round((parseFloat(e.target.value) || 0) * 100))}
                  min="0"
                  step="0.01"
                />
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  Will be allocated proportionally across items
                </p>
              </div>
            </div>

            {/* Totals Summary */}
            <div className="bg-neutral-50 rounded-lg p-4 mb-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-[var(--color-muted)]">Subtotal:</span>
                  <p className="font-medium">${(subtotal / 100).toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-[var(--color-muted)]">Shipping:</span>
                  <p className="font-medium">${(shippingCents / 100).toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-[var(--color-muted)]">Tax:</span>
                  <p className="font-medium">${(taxCents / 100).toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-[var(--color-muted)]">Total:</span>
                  <p className="font-bold text-lg text-green-600">${(total / 100).toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Receipt Upload */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-1">Receipt/Invoice (Optional)</label>
              <div className="flex items-center gap-4">
                <label className="btn border border-[var(--color-line)] cursor-pointer flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  {uploadingImage ? "Uploading..." : "Upload Image/PDF"}
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*,application/pdf"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                  />
                </label>
                {receiptImageUrl && (
                  <div className="flex items-center gap-2">
                    <a
                      href={receiptImageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[var(--color-accent)] hover:underline"
                    >
                      View Receipt
                    </a>
                    <button
                      onClick={() => setReceiptImageUrl("")}
                      className="text-sm text-rose-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-1">Notes (Optional)</label>
              <textarea
                className="textarea w-full"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes about this purchase..."
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={savePurchase}
                className="btn bg-[var(--color-accent)] text-[var(--color-accent-ink)] flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                {editingId ? "Update Purchase" : "Save Purchase"}
              </button>
              <button
                onClick={() => {
                  resetForm();
                  setShowAddForm(false);
                  setEditingId(null);
                }}
                className="btn border border-[var(--color-line)]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="card p-4 bg-white mb-6">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Filter by Vendor</label>
              <select
                className="input text-sm"
                value={filterVendor}
                onChange={(e) => setFilterVendor(e.target.value)}
              >
                <option value="all">All Vendors</option>
                {vendors.map((vendor) => (
                  <option key={vendor} value={vendor}>
                    {vendor}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Filter by Category</label>
              <select
                className="input text-sm"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                <option value="all">All Categories</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {(filterVendor !== "all" || filterCategory !== "all") && (
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setFilterVendor("all");
                    setFilterCategory("all");
                  }}
                  className="btn text-sm border border-[var(--color-line)]"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Purchases List */}
        <div className="card p-6 bg-white">
          <h2 className="text-xl font-bold mb-4">Purchases</h2>

          {loading && (
            <div className="text-center py-8 text-[var(--color-muted)]">
              Loading purchases...
            </div>
          )}

          {!loading && filteredPurchases.length === 0 && (
            <div className="text-center py-8 text-[var(--color-muted)]">
              No purchases found. Add your first purchase to get started.
            </div>
          )}

          {!loading && filteredPurchases.length > 0 && (
            <div className="space-y-4">
              {filteredPurchases.map((purchase) => {
                const allocations = calculateAllocations(purchase.items, purchase.shippingCents, purchase.taxCents);

                return (
                  <div key={purchase.id} className="border border-[var(--color-line)] rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-semibold text-lg">{purchase.vendorName}</h3>
                          <span className="text-sm text-[var(--color-muted)]">
                            {formatDate(purchase.purchaseDate)}
                          </span>
                        </div>
                        <p className="text-2xl font-bold text-green-600">
                          ${(purchase.totalCents / 100).toFixed(2)}
                        </p>
                        <p className="text-xs text-[var(--color-muted)] mt-1">
                          {purchase.items.length} item{purchase.items.length !== 1 ? "s" : ""}
                          {purchase.receiptImageUrl && " • Has receipt"}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        {purchase.receiptImageUrl && (
                          <a
                            href={purchase.receiptImageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 hover:bg-neutral-100 rounded"
                            title="View receipt"
                          >
                            <FileText className="w-4 h-4" />
                          </a>
                        )}
                        <button
                          onClick={() => editPurchase(purchase)}
                          className="p-2 hover:bg-neutral-100 rounded"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => void deletePurchase(purchase.id, purchase.vendorName)}
                          className="p-2 hover:bg-rose-50 text-rose-600 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3 text-sm">
                      <div>
                        <span className="text-[var(--color-muted)]">Subtotal:</span>
                        <p className="font-medium">${(purchase.subtotalCents / 100).toFixed(2)}</p>
                      </div>
                      <div>
                        <span className="text-[var(--color-muted)]">Shipping:</span>
                        <p className="font-medium">${(purchase.shippingCents / 100).toFixed(2)}</p>
                      </div>
                      <div>
                        <span className="text-[var(--color-muted)]">Tax:</span>
                        <p className="font-medium">${(purchase.taxCents / 100).toFixed(2)}</p>
                      </div>
                      <div>
                        <span className="text-[var(--color-muted)]">Items:</span>
                        <p className="font-medium">
                          {purchase.items.reduce((sum, item) => sum + item.quantity, 0)} units
                        </p>
                      </div>
                    </div>

                    {purchase.notes && (
                      <div className="mb-3 text-sm text-[var(--color-muted)] italic">
                        {purchase.notes}
                      </div>
                    )}

                    <details className="text-sm">
                      <summary className="cursor-pointer text-[var(--color-accent)] hover:underline">
                        View Items & Allocations
                      </summary>
                      <div className="mt-3 space-y-2">
                        {allocations.map((item, idx) => (
                          <div key={idx} className="bg-neutral-50 rounded p-3">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <p className="font-medium">{item.name}</p>
                                <p className="text-xs text-[var(--color-muted)]">
                                  {item.quantity} × ${(item.unitCostCents / 100).toFixed(2)} • {item.category}
                                </p>
                                {item.notes && (
                                  <p className="text-xs text-[var(--color-muted)] italic mt-1">{item.notes}</p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-green-600">
                                  ${(item.costPerUnitCents / 100).toFixed(2)}/unit
                                </p>
                                <p className="text-xs text-[var(--color-muted)]">
                                  fully loaded
                                </p>
                              </div>
                            </div>
                            <div className="grid grid-cols-4 gap-2 text-xs text-[var(--color-muted)]">
                              <div>
                                <span className="font-medium">Base:</span> ${(item.totalCostCents / 100).toFixed(2)}
                              </div>
                              <div>
                                <span className="font-medium">Shipping:</span> ${(item.allocatedShippingCents / 100).toFixed(2)}
                              </div>
                              <div>
                                <span className="font-medium">Tax:</span> ${(item.allocatedTaxCents / 100).toFixed(2)}
                              </div>
                              <div className="text-right">
                                <span className="font-medium">Total:</span> ${(item.fullyLoadedCostCents / 100).toFixed(2)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
