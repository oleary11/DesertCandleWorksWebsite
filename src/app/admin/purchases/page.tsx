"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart2, Check, ChevronRight, FileSpreadsheet, FileText, Pencil, Plus, Search, Trash2, Upload, X } from "lucide-react";
import PageHeader from "../_components/PageHeader";
import { Badge, FormSection, Modal, Stat } from "../_components/ui";
import { useModal } from "@/hooks/useModal";
import CandleSpinner from "@/components/CandleSpinner";

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
  "shipping",
  "equipment",
  "other",
];

type CSVPurchaseItem = {
  date: string;
  itemName: string;
  quantity: number;
  unitCostCents: number;
  category: string;
  vendor: string;
  shipping: string;
  tax: string;
  notes: string;
};

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
  const [itemInputStrs, setItemInputStrs] = useState<Record<number, string>>({});
  const [shippingCents, setShippingCents] = useState(0);
  const [shippingInputStr, setShippingInputStr] = useState("");
  const [taxCents, setTaxCents] = useState(0);
  const [taxInputStr, setTaxInputStr] = useState("");
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
      const orderGroups: Record<string, CSVPurchaseItem[]> = {};

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

  const money = (cents: number) =>
    `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const filtersActive = filterVendor !== "all" || filterCategory !== "all" || searchQuery.trim() !== "";

  function closeModal() {
    setShowModal(false);
    resetForm();
    setEditingId(null);
  }

  return (
    <div className="a-ui mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Cost of goods"
        description="Purchases and receipts, with shipping and tax spread across items to get the true cost per unit."
        actions={
          <>
            <Link href="/admin/purchases/analytics" className="a-btn">
              <BarChart2 className="h-4 w-4" aria-hidden />
              Analytics
            </Link>
            <label className="a-btn cursor-pointer focus-within:shadow-[var(--a-focus)]">
              <FileSpreadsheet className="h-4 w-4" aria-hidden />
              {uploadingCSV ? "Uploading…" : "Upload CSV"}
              <input type="file" className="sr-only" accept=".csv" onChange={handleCSVUpload} disabled={uploadingCSV} />
            </label>
            <button onClick={openNewPurchaseModal} className="a-btn a-btn-primary">
              <Plus className="h-4 w-4" aria-hidden />
              Add purchase
            </button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Spent" value={money(totalSpent)} hint={`${filteredPurchases.length} purchases${filtersActive ? " (filtered)" : ""}`} />
        <Stat label="Items" value={totalItems.toLocaleString()} hint="Units bought" />
        <Stat
          className="col-span-2 sm:col-span-1"
          label="Average purchase"
          value={filteredPurchases.length > 0 ? money(totalSpent / filteredPurchases.length) : "—"}
        />
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative block flex-1">
          <span className="sr-only">Search purchases</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--a-faint)]" aria-hidden />
          <input
            type="text"
            className="a-input pl-9"
            placeholder="Search vendors, items, notes…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </label>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <label className="block sm:w-44">
            <span className="sr-only">Vendor</span>
            <select
              className={`a-select ${filterVendor !== "all" ? "a-select-active" : ""}`}
              value={filterVendor}
              onChange={(e) => setFilterVendor(e.target.value)}
            >
              <option value="all">All vendors</option>
              {vendors.map((vendor) => (
                <option key={vendor} value={vendor}>
                  {vendor}
                </option>
              ))}
            </select>
          </label>
          <label className="block sm:w-44">
            <span className="sr-only">Category</span>
            <select
              className={`a-select ${filterCategory !== "all" ? "a-select-active" : ""}`}
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="all">All categories</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {capitalize(cat)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {filtersActive && (
          <button
            onClick={() => {
              setFilterVendor("all");
              setFilterCategory("all");
              setSearchQuery("");
            }}
            className="inline-flex h-10 items-center gap-1.5 self-start rounded-lg px-3 text-sm font-medium text-[var(--a-muted)] hover:bg-[var(--a-tint)] hover:text-[var(--a-ink)] sm:self-auto"
          >
            <X className="h-4 w-4" aria-hidden />
            Clear
          </button>
        )}
      </div>

      {/* Purchases */}
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-4 py-16">
          <CandleSpinner />
          <p className="text-sm font-medium text-[var(--a-muted)]">Loading purchases…</p>
        </div>
      ) : filteredPurchases.length === 0 ? (
        <div className="a-card px-6 py-16 text-center">
          <p className="font-medium text-[var(--a-ink)]">{filtersActive ? "No purchases match" : "No purchases yet"}</p>
          <p className="mt-1 text-sm text-[var(--a-muted)]">
            {filtersActive ? "Try a different search or filter." : "Add a purchase or upload a CSV to get started."}
          </p>
        </div>
      ) : (
        <ul className="a-card divide-y divide-[var(--a-line)]">
          {filteredPurchases.map((purchase) => {
            const allocations = calculateAllocations(purchase.items, purchase.shippingCents, purchase.taxCents);
            const units = purchase.items.reduce((sum, item) => sum + Math.floor(item.quantity), 0);

            return (
              <li key={purchase.id}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 hover:bg-[var(--a-canvas)] sm:px-5 [&::-webkit-details-marker]:hidden">
                    <ChevronRight className="h-4 w-4 shrink-0 text-[var(--a-faint)] transition-transform group-open:rotate-90" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium text-[var(--a-ink)]">{purchase.vendorName}</span>
                        {purchase.receiptImageUrl && <Badge>Receipt</Badge>}
                      </span>
                      <span className="mt-0.5 block truncate text-sm text-[var(--a-muted)]">
                        {formatDate(purchase.purchaseDate)} · {purchase.items.length} {purchase.items.length === 1 ? "item" : "items"} · {units} {units === 1 ? "unit" : "units"}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-semibold tabular-nums text-[var(--a-ink)]">{money(purchase.totalCents)}</span>
                      {purchase.shippingCents + purchase.taxCents > 0 && (
                        <span className="block text-xs tabular-nums text-[var(--a-muted)]">
                          incl. {money(purchase.shippingCents + purchase.taxCents)} ship + tax
                        </span>
                      )}
                    </span>
                  </summary>

                  <div className="border-t border-[var(--a-line)] bg-[color-mix(in_oklab,var(--a-canvas)_60%,white)] px-4 pb-4 pt-3 sm:px-5">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      {purchase.notes && <p className="mr-auto text-sm italic text-[var(--a-muted)]">{purchase.notes}</p>}
                      <div className="ml-auto flex gap-1">
                        {purchase.receiptImageUrl && (
                          <a href={purchase.receiptImageUrl} target="_blank" rel="noopener noreferrer" className="a-btn a-btn-sm">
                            <FileText className="h-3.5 w-3.5" aria-hidden />
                            Receipt
                          </a>
                        )}
                        <button onClick={() => editPurchase(purchase)} className="a-btn a-btn-sm">
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                          Edit
                        </button>
                        <button
                          onClick={() => void deletePurchase(purchase.id, purchase.vendorName)}
                          className="a-icon-btn a-icon-btn-danger h-8 w-8"
                          aria-label={`Delete purchase from ${purchase.vendorName}`}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-[var(--a-line)] bg-white">
                      <table className="a-table a-table-dense">
                        <thead>
                          <tr>
                            <th>Item</th>
                            <th className="text-right">Qty × cost</th>
                            <th className="text-right">Shipping</th>
                            <th className="text-right">Tax</th>
                            <th className="text-right">Landed total</th>
                            <th className="text-right">Per unit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allocations.map((item, idx) => (
                            <tr key={idx}>
                              <td>
                                <p className="font-medium text-[var(--a-ink)]">{item.name}</p>
                                <p className="text-xs text-[var(--a-muted)]">
                                  {capitalize(item.category)}
                                  {item.notes ? ` · ${item.notes}` : ""}
                                </p>
                              </td>
                              <td className="a-num whitespace-nowrap text-[var(--a-muted)]">
                                {item.quantity} × {money(item.unitCostCents)}
                              </td>
                              <td className="a-num">{money(item.allocatedShippingCents)}</td>
                              <td className="a-num">{money(item.allocatedTaxCents)}</td>
                              <td className="a-num">{money(item.fullyLoadedCostCents)}</td>
                              <td className="a-num font-semibold text-[var(--a-ink)]">{money(item.costPerUnitCents)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}

      {/* Add / edit purchase */}
      {showModal && (
        <Modal
          size="lg"
          title={editingId ? "Edit purchase" : "New purchase"}
          description="Shipping and tax are spread across items by cost."
          onClose={closeModal}
          footer={
            <>
              <p className="mr-auto text-sm">
                Total <span className="font-semibold tabular-nums">{money(total)}</span>
              </p>
              <button onClick={closeModal} className="a-btn">
                Cancel
              </button>
              <button onClick={savePurchase} className="a-btn a-btn-primary">
                <Check className="h-4 w-4" aria-hidden />
                {editingId ? "Save purchase" : "Add purchase"}
              </button>
            </>
          }
        >
          <FormSection title="Details">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="a-label">Vendor</span>
                <input
                  type="text"
                  className="a-input"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="e.g. CandleScience, Amazon"
                />
              </label>
              <label className="block">
                <span className="a-label">Purchase date</span>
                <input type="date" className="a-input" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
              </label>
            </div>
          </FormSection>

          <FormSection title="Items">
            {items.length === 0 && (
              <div className="rounded-lg border border-dashed border-[var(--a-line-strong)] px-4 py-8 text-center text-sm text-[var(--a-muted)]">
                No items yet.
              </div>
            )}

            <ol className="space-y-3">
              {items.map((item, index) => (
                <li key={index} className="rounded-xl border border-[var(--a-line)] p-4">
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-[2fr_1fr_1fr_1.3fr_auto]">
                    <label className="col-span-2 block md:col-span-1">
                      <span className="a-label">Item</span>
                      <input
                        type="text"
                        className="a-input"
                        value={item.name}
                        onChange={(e) => updateItem(index, "name", e.target.value)}
                        placeholder="e.g. Soy wax 464"
                      />
                    </label>
                    <label className="block">
                      <span className="a-label">Qty</span>
                      <input
                        type="number"
                        className="a-input tabular-nums"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 0)}
                        min="0"
                        step="1"
                      />
                    </label>
                    <label className="block">
                      <span className="a-label">Unit cost</span>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--a-faint)]">$</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="a-input pl-7 tabular-nums"
                          value={itemInputStrs[index] ?? (item.unitCostCents === 0 ? "" : (item.unitCostCents / 100).toString())}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "" || /^\d*\.?\d*$/.test(val)) {
                              setItemInputStrs({ ...itemInputStrs, [index]: val });
                            }
                          }}
                          onBlur={() => {
                            const val = itemInputStrs[index];
                            if (val !== undefined) {
                              const num = parseFloat(val);
                              if (!isNaN(num)) {
                                updateItem(index, "unitCostCents", Math.round(parseFloat(num.toFixed(2)) * 100));
                                setItemInputStrs({ ...itemInputStrs, [index]: num.toFixed(2) });
                              } else if (val === "") {
                                updateItem(index, "unitCostCents", 0);
                                const copy = { ...itemInputStrs };
                                delete copy[index];
                                setItemInputStrs(copy);
                              }
                            }
                          }}
                          onFocus={() => {
                            if (itemInputStrs[index] === undefined) {
                              setItemInputStrs({
                                ...itemInputStrs,
                                [index]: item.unitCostCents === 0 ? "" : (item.unitCostCents / 100).toString(),
                              });
                            }
                          }}
                          placeholder="0.00"
                        />
                      </div>
                    </label>
                    <label className="block">
                      <span className="a-label">Category</span>
                      <select className="a-select" value={item.category} onChange={(e) => updateItem(index, "category", e.target.value)}>
                        {CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {capitalize(cat)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="flex items-end">
                      <button
                        onClick={() => removeItem(index)}
                        className="a-icon-btn a-icon-btn-danger h-10 w-10"
                        aria-label={`Remove item ${index + 1}`}
                        title="Remove item"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </div>

                  <label className="mt-3 block">
                    <span className="sr-only">Item notes</span>
                    <input
                      type="text"
                      className="a-input"
                      value={item.notes || ""}
                      onChange={(e) => updateItem(index, "notes", e.target.value)}
                      placeholder="Notes (optional)"
                    />
                  </label>

                  {allocatedItems[index] && (
                    <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-[var(--a-line)] pt-3 text-xs text-[var(--a-muted)]">
                      <span>Items {money(allocatedItems[index].totalCostCents)}</span>
                      <span>+ shipping {money(allocatedItems[index].allocatedShippingCents)}</span>
                      <span>+ tax {money(allocatedItems[index].allocatedTaxCents)}</span>
                      <span className="ml-auto font-semibold text-[var(--a-ink)]">{money(allocatedItems[index].costPerUnitCents)} per unit</span>
                    </p>
                  )}
                </li>
              ))}
            </ol>

            <button onClick={addItem} className="a-btn a-btn-sm mt-3">
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add item
            </button>
          </FormSection>

          <FormSection title="Shipping and tax" description="Spread across items in proportion to their cost.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="a-label">Shipping</span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--a-faint)]">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="a-input pl-7 tabular-nums"
                    value={shippingInputStr}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "" || /^\d*\.?\d*$/.test(val)) {
                        setShippingInputStr(val);
                      }
                    }}
                    onBlur={() => {
                      const num = parseFloat(shippingInputStr);
                      if (!isNaN(num)) {
                        setShippingCents(Math.round(parseFloat(num.toFixed(2)) * 100));
                        setShippingInputStr(num.toFixed(2));
                      } else if (shippingInputStr === "") {
                        setShippingCents(0);
                        setShippingInputStr("");
                      }
                    }}
                    onFocus={() => {
                      setShippingInputStr(shippingCents === 0 ? "" : (shippingCents / 100).toString());
                    }}
                    placeholder="0.00"
                  />
                </div>
              </label>
              <label className="block">
                <span className="a-label">Tax</span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--a-faint)]">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="a-input pl-7 tabular-nums"
                    value={taxInputStr}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "" || /^\d*\.?\d*$/.test(val)) {
                        setTaxInputStr(val);
                      }
                    }}
                    onBlur={() => {
                      const num = parseFloat(taxInputStr);
                      if (!isNaN(num)) {
                        setTaxCents(Math.round(parseFloat(num.toFixed(2)) * 100));
                        setTaxInputStr(num.toFixed(2));
                      } else if (taxInputStr === "") {
                        setTaxCents(0);
                        setTaxInputStr("");
                      }
                    }}
                    onFocus={() => {
                      setTaxInputStr(taxCents === 0 ? "" : (taxCents / 100).toString());
                    }}
                    placeholder="0.00"
                  />
                </div>
              </label>
            </div>
            <dl className="a-panel mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs text-[var(--a-muted)]">Subtotal</dt>
                <dd className="font-medium tabular-nums">{money(subtotal)}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--a-muted)]">Shipping</dt>
                <dd className="font-medium tabular-nums">{money(shippingCents)}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--a-muted)]">Tax</dt>
                <dd className="font-medium tabular-nums">{money(taxCents)}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--a-muted)]">Total</dt>
                <dd className="text-lg font-semibold tabular-nums">{money(total)}</dd>
              </div>
            </dl>
          </FormSection>

          <FormSection title="Receipt and notes">
            <div className="flex flex-wrap items-center gap-3">
              <label className="a-btn cursor-pointer focus-within:shadow-[var(--a-focus)]">
                <Upload className="h-4 w-4" aria-hidden />
                {uploadingImage ? "Uploading…" : receiptImageUrl ? "Replace receipt" : "Upload image or PDF"}
                <input type="file" className="sr-only" accept="image/*,application/pdf" onChange={handleImageUpload} disabled={uploadingImage} />
              </label>
              {receiptImageUrl && (
                <>
                  <a href={receiptImageUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-[var(--a-accent-ink)] hover:underline">
                    View receipt
                  </a>
                  <button onClick={() => setReceiptImageUrl("")} className="text-sm font-medium text-[var(--a-bad)] hover:underline">
                    Remove
                  </button>
                </>
              )}
            </div>
            <label className="mt-4 block">
              <span className="a-label">
                Notes <span className="font-normal text-[var(--a-muted)]">(optional)</span>
              </span>
              <textarea
                className="a-textarea"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything worth remembering about this purchase"
              />
            </label>
          </FormSection>
        </Modal>
      )}
    </div>
  );
}
