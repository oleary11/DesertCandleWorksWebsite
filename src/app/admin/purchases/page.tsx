"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Upload, DollarSign, Package, Calendar, FileText, X, Edit2, Check, FileSpreadsheet, Search } from "lucide-react";
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
  const [showModal, setShowModal] = useState(false);
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
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [uploadingCSV, setUploadingCSV] = useState(false);

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

  async function handleCSVUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      await showAlert("Please upload a CSV file", "Invalid File");
      return;
    }

    try {
      setUploadingCSV(true);

      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        await showAlert("CSV file is empty or missing data", "Invalid File");
        return;
      }

      // Parse header
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const dateIdx = headers.findIndex(h => h.includes('date'));
      const itemNameIdx = headers.findIndex(h => h.includes('item') || h.includes('name') || h.includes('description'));
      const qtyIdx = headers.findIndex(h => h.includes('quantity') || h.includes('qty'));
      const costIdx = headers.findIndex(h => h.includes('cost') || h.includes('price'));
      const categoryIdx = headers.findIndex(h => h.includes('category'));
      const vendorIdx = headers.findIndex(h => h.includes('vendor'));
      const orderNumIdx = headers.findIndex(h => h.includes('order'));
      const shippingIdx = headers.findIndex(h => h.includes('shipping'));
      const taxIdx = headers.findIndex(h => h.includes('tax'));
      const notesIdx = headers.findIndex(h => h.includes('note'));

      if (dateIdx === -1 || itemNameIdx === -1 || costIdx === -1 || vendorIdx === -1 || orderNumIdx === -1) {
        await showAlert("CSV must have Date, Item Name, Cost, Vendor Name, and Order Number columns", "Missing Columns");
        return;
      }

      // Group by order number
      const orderGroups: Record<string, any[]> = {};

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        const values = line.split(',').map(v => v.trim());
        const orderNum = values[orderNumIdx];

        if (!orderGroups[orderNum]) {
          orderGroups[orderNum] = [];
        }

        const costStr = values[costIdx].replace('$', '').trim();
        const cost = parseFloat(costStr);
        const qty = qtyIdx !== -1 ? parseFloat(values[qtyIdx]) : 1;

        orderGroups[orderNum].push({
          date: values[dateIdx],
          itemName: values[itemNameIdx],
          quantity: qty,
          unitCostCents: Math.round(cost * 100),
          category: categoryIdx !== -1 ? values[categoryIdx].toLowerCase() : 'other',
          vendor: values[vendorIdx],
          shipping: shippingIdx !== -1 ? values[shippingIdx] : '',
          tax: taxIdx !== -1 ? values[taxIdx] : '',
          notes: notesIdx !== -1 ? values[notesIdx] : ''
        });
      }

      // Create purchases
      let successCount = 0;
      let errorCount = 0;

      for (const [orderNum, items] of Object.entries(orderGroups)) {
        if (items.length === 0) continue;

        const firstItem = items[0];

        // Parse date from MM/D/YYYY to YYYY-MM-DD
        const dateParts = firstItem.date.split('/');
        const month = dateParts[0].padStart(2, '0');
        const day = dateParts[1].padStart(2, '0');
        const year = dateParts[2];
        const isoDate = `${year}-${month}-${day}`;

        // Get shipping and tax from first item that has them
        let shippingCents = 0;
        let taxCents = 0;

        for (const item of items) {
          if (item.shipping && !shippingCents) {
            const shippingStr = item.shipping.replace('$', '').trim();
            shippingCents = Math.round(parseFloat(shippingStr || '0') * 100);
          }
          if (item.tax && !taxCents) {
            const taxStr = item.tax.replace('$', '').trim();
            taxCents = Math.round(parseFloat(taxStr || '0') * 100);
          }
        }

        const purchaseItems = items.map(item => ({
          name: item.itemName,
          quantity: item.quantity,
          unitCostCents: item.unitCostCents,
          category: item.category,
          notes: item.notes || undefined
        }));

        try {
          const res = await fetch("/api/admin/purchases", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              vendorName: firstItem.vendor,
              purchaseDate: isoDate,
              items: purchaseItems,
              shippingCents,
              taxCents
            })
          });

          if (res.ok) {
            successCount++;
          } else {
            errorCount++;
            console.error(`Failed to create purchase for order ${orderNum}`);
          }
        } catch (err) {
          errorCount++;
          console.error(`Error creating purchase for order ${orderNum}:`, err);
        }
      }

      await showAlert(
        `Successfully imported ${successCount} purchase(s). ${errorCount > 0 ? `${errorCount} failed.` : ''}`,
        "Import Complete"
      );

      await loadPurchases();
    } catch (err) {
      console.error("CSV upload error:", err);
      await showAlert("Failed to process CSV file", "Upload Error");
    } finally {
      setUploadingCSV(false);
      // Reset file input
      e.target.value = '';
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
        setShowModal(false);
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
    setShowModal(true);
  }

  function openNewPurchaseModal() {
    resetForm();
    setEditingId(null);
    setShowModal(true);
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
    // Vendor filter
    if (filterVendor !== "all" && purchase.vendorName !== filterVendor) return false;

    // Category filter
    if (filterCategory !== "all" && !purchase.items.some(item => item.category === filterCategory)) return false;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesVendor = purchase.vendorName.toLowerCase().includes(query);
      const matchesNotes = purchase.notes?.toLowerCase().includes(query);
      const matchesItem = purchase.items.some(item =>
        item.name.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        item.notes?.toLowerCase().includes(query)
      );
      const matchesDate = purchase.purchaseDate.includes(query);

      if (!matchesVendor && !matchesNotes && !matchesItem && !matchesDate) return false;
    }

    return true;
  });

  // Calculate totals
  const totalSpent = filteredPurchases.reduce((sum, p) => sum + p.totalCents, 0);
  const totalItems = filteredPurchases.reduce((sum, p) => sum + p.items.reduce((s, i) => s + Math.floor(i.quantity), 0), 0);

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
            <div className="flex gap-3">
              <label className="btn border border-[var(--color-line)] cursor-pointer flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                {uploadingCSV ? "Uploading..." : "Upload CSV"}
                <input
                  type="file"
                  className="hidden"
                  accept=".csv"
                  onChange={handleCSVUpload}
                  disabled={uploadingCSV}
                />
              </label>
              <button
                onClick={openNewPurchaseModal}
                className="btn bg-[var(--color-accent)] text-[var(--color-accent-ink)] flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Purchase
              </button>
            </div>
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


        {/* Search and Filters */}
        <div className="card p-4 bg-white mb-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[250px]">
              <label className="block text-xs font-medium mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--color-muted)]" />
                <input
                  type="text"
                  className="input text-sm !pl-11 w-full"
                  placeholder="Search vendors, items, notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

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

            {(filterVendor !== "all" || filterCategory !== "all" || searchQuery.trim()) && (
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setFilterVendor("all");
                    setFilterCategory("all");
                    setSearchQuery("");
                  }}
                  className="btn text-sm border border-[var(--color-line)]"
                >
                  Clear All
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
                          {purchase.items.reduce((sum, item) => sum + Math.floor(item.quantity), 0)} units
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

        {/* Add/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            {/* Backdrop */}
            <div
              className="absolute inset-0"
              onClick={() => {
                setShowModal(false);
                resetForm();
                setEditingId(null);
              }}
            />

            {/* Modal */}
            <div className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-gradient-to-r from-neutral-50 to-white">
                <div>
                  <h2 className="text-xl font-semibold text-[var(--color-ink)]">
                    {editingId ? "Edit Purchase" : "New Purchase"}
                  </h2>
                  <p className="text-sm text-[var(--color-muted)] mt-0.5">
                    Track item costs with proportional shipping and tax allocation
                  </p>
                </div>
                <button
                  className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                    setEditingId(null);
                  }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto px-6 py-6">
                {/* ---------- Basic Information Section ---------- */}
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <DollarSign className="w-5 h-5 text-[var(--color-accent)]" />
                    <h3 className="text-base font-semibold text-[var(--color-ink)]">Basic Information</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                </div>

                {/* ---------- Items Section ---------- */}
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Package className="w-5 h-5 text-[var(--color-accent)]" />
                      <h3 className="text-base font-semibold text-[var(--color-ink)]">Purchase Items</h3>
                    </div>
                    <button
                      onClick={addItem}
                      className="btn btn-primary text-sm flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      Add Item
                    </button>
                  </div>

                  {items.length === 0 && (
                    <div className="text-center py-12 text-[var(--color-muted)] bg-neutral-50 rounded-lg border border-dashed border-neutral-300">
                      <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No items added. Click &quot;Add Item&quot; to get started.</p>
                    </div>
                  )}

                  <div className="space-y-3">
                    {items.map((item, index) => (
                      <div key={index} className="border border-[var(--color-line)] rounded-lg p-4 bg-neutral-50">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                          <div>
                            <label className="block text-xs font-medium mb-1">Item Name *</label>
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
                              onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 0)}
                              min="0"
                              step="1"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium mb-1">Unit Cost ($)</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              className="input w-full text-sm"
                              value={item.unitCostCents === 0 ? "" : (item.unitCostCents / 100).toString()}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value === "" || value === ".") {
                                  updateItem(index, "unitCostCents", 0);
                                } else {
                                  const parsed = parseFloat(value);
                                  if (!isNaN(parsed)) {
                                    updateItem(index, "unitCostCents", Math.round(parsed * 100));
                                  }
                                }
                              }}
                              placeholder="0.00"
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

                        <div className="flex items-end gap-3 mb-3">
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
                            className="p-2 text-rose-600 hover:bg-rose-100 rounded transition-colors"
                            aria-label="Remove item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {allocatedItems[index] && (
                          <div className="pt-3 border-t border-neutral-300 text-xs grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="text-[var(--color-muted)]">
                              <span className="font-medium">Item Total:</span>
                              <p className="text-sm text-[var(--color-ink)] font-medium mt-0.5">
                                ${(allocatedItems[index].totalCostCents / 100).toFixed(2)}
                              </p>
                            </div>
                            <div className="text-[var(--color-muted)]">
                              <span className="font-medium">+ Shipping:</span>
                              <p className="text-sm text-[var(--color-ink)] font-medium mt-0.5">
                                ${(allocatedItems[index].allocatedShippingCents / 100).toFixed(2)}
                              </p>
                            </div>
                            <div className="text-[var(--color-muted)]">
                              <span className="font-medium">+ Tax:</span>
                              <p className="text-sm text-[var(--color-ink)] font-medium mt-0.5">
                                ${(allocatedItems[index].allocatedTaxCents / 100).toFixed(2)}
                              </p>
                            </div>
                            <div className="text-[var(--color-muted)]">
                              <span className="font-medium">Per Unit:</span>
                              <p className="text-sm text-green-600 font-bold mt-0.5">
                                ${(allocatedItems[index].costPerUnitCents / 100).toFixed(2)}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* ---------- Shipping & Tax Section ---------- */}
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <DollarSign className="w-5 h-5 text-[var(--color-accent)]" />
                    <h3 className="text-base font-semibold text-[var(--color-ink)]">Shipping & Tax</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Shipping Cost ($)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="input w-full"
                        value={shippingCents === 0 ? "" : (shippingCents / 100).toString()}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === "" || value === ".") {
                            setShippingCents(0);
                          } else {
                            const parsed = parseFloat(value);
                            if (!isNaN(parsed)) {
                              setShippingCents(Math.round(parsed * 100));
                            }
                          }
                        }}
                        placeholder="0.00"
                      />
                      <p className="text-xs text-[var(--color-muted)] mt-1">
                        Allocated proportionally across items
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Tax ($)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="input w-full"
                        value={taxCents === 0 ? "" : (taxCents / 100).toString()}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === "" || value === ".") {
                            setTaxCents(0);
                          } else {
                            const parsed = parseFloat(value);
                            if (!isNaN(parsed)) {
                              setTaxCents(Math.round(parsed * 100));
                            }
                          }
                        }}
                        placeholder="0.00"
                      />
                      <p className="text-xs text-[var(--color-muted)] mt-1">
                        Allocated proportionally across items
                      </p>
                    </div>
                  </div>

                  {/* Totals Summary */}
                  <div className="mt-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-green-700 text-xs font-medium">Subtotal</span>
                        <p className="text-lg font-bold text-green-900">${(subtotal / 100).toFixed(2)}</p>
                      </div>
                      <div>
                        <span className="text-green-700 text-xs font-medium">Shipping</span>
                        <p className="text-lg font-bold text-green-900">${(shippingCents / 100).toFixed(2)}</p>
                      </div>
                      <div>
                        <span className="text-green-700 text-xs font-medium">Tax</span>
                        <p className="text-lg font-bold text-green-900">${(taxCents / 100).toFixed(2)}</p>
                      </div>
                      <div>
                        <span className="text-green-700 text-xs font-medium">Total</span>
                        <p className="text-2xl font-bold text-green-600">${(total / 100).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ---------- Additional Details Section ---------- */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <FileText className="w-5 h-5 text-[var(--color-accent)]" />
                    <h3 className="text-base font-semibold text-[var(--color-ink)]">Additional Details</h3>
                  </div>

                  {/* Receipt Upload */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Receipt/Invoice (Optional)</label>
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
                  <div>
                    <label className="block text-sm font-medium mb-2">Notes (Optional)</label>
                    <textarea
                      className="textarea w-full"
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Additional notes about this purchase..."
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-200 bg-neutral-50">
                <button
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                    setEditingId(null);
                  }}
                  className="btn border border-[var(--color-line)]"
                >
                  Cancel
                </button>
                <button
                  onClick={savePurchase}
                  className="btn bg-[var(--color-accent)] text-[var(--color-accent-ink)] flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {editingId ? "Update Purchase" : "Save Purchase"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
