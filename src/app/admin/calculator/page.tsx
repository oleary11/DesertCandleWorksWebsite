"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useModal } from "@/hooks/useModal";

/* ---------- Types ---------- */
type Product = {
  slug: string;
  name: string;
  price: number;
  image?: string;
  images?: string[];
  sku: string;
  stripePriceId?: string;
  seoDescription: string;
  bestSeller?: boolean;
  youngDumb?: boolean;
  stock: number;
  variantConfig?: {
    wickTypes: Array<{ id: string; name: string }>;
    variantData: Record<string, { stock: number }>;
  };
  alcoholType?: string;
  materialCost?: number; // Cost to make the product
  visibleOnWebsite?: boolean; // Controls shop page visibility
  containerId?: string; // Reference to container used for this product
};

type Container = {
  id: string;
  name: string;
  capacityWaterOz: number;
  shape: string;
  supplier?: string;
  costPerUnit: number;
  notes?: string;
};

type BaseOil = {
  id: string;
  name: string;
  costPerOz: number;
};

type WickType = {
  id: string;
  name: string;
  costPerWick: number;
  appearAs?: string;
};

type CalculatorSettings = {
  waxCostPerOz: number;
  waterToWaxRatio: number;
  defaultFragranceLoad: number;
};

type GlobalScent = {
  id: string;
  name: string;
  costPerOz?: number;
  composition?: Array<{ baseOilId: string; percentage: number }>;
};

type AlcoholType = {
  id: string;
  name: string;
  sortOrder?: number;
};

type CalculationResult = {
  waxOz: number;
  fragranceOz: number;
  waxCost: number;
  fragranceCost: number;
  wickCost: number;
  containerCost: number;
  totalMaterialCost: number;
  costPerWaxOz: number;
};

type BatchItem = {
  containerId: string;
  containerName: string;
  waterOz: number;
  scentId: string;
  scentName: string;
  wickCounts: Record<string, number>;
  results: CalculationResult;
};

/* ---------- Helper Functions ---------- */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function parseSku(sku: string) {
  const m = sku.match(/^([A-Za-z]+-?)(\d+)$/);
  if (!m) return { prefix: "DCW-", num: 0, width: 4 };
  return { prefix: m[1], num: Number(m[2]), width: m[2].length };
}

function computeNextSku(allSkus: string[]): string {
  if (allSkus.length === 0) return "DCW-0001";
  let best = { prefix: "DCW-", num: 0, width: 4 };
  for (const s of allSkus) {
    const p = parseSku(s);
    if (p.num > best.num) best = p;
  }
  const next = best.num + 1;
  const padded = String(next).padStart(best.width, "0");
  return `${best.prefix}${padded}`;
}

function calculateCosts(
  waterOz: number,
  settings: CalculatorSettings,
  scentCostPerOz: number,
  wickCost: number,
  containerCost: number
): CalculationResult {
  const waxOz = waterOz * settings.waterToWaxRatio;
  const fragranceOz = waxOz * settings.defaultFragranceLoad;
  const waxCost = waxOz * settings.waxCostPerOz;
  const fragranceCost = fragranceOz * scentCostPerOz;
  const totalMaterialCost = waxCost + fragranceCost + wickCost + containerCost;
  const costPerWaxOz = waxOz > 0 ? totalMaterialCost / waxOz : 0;

  return {
    waxOz,
    fragranceOz,
    waxCost,
    fragranceCost,
    wickCost,
    containerCost,
    totalMaterialCost,
    costPerWaxOz,
  };
}

function calculateScentCost(scent: GlobalScent, baseOils: BaseOil[]): number {
  if (scent.costPerOz !== undefined) {
    return scent.costPerOz;
  }

  if (!scent.composition || scent.composition.length === 0) {
    return 0;
  }

  const oilsMap = new Map(baseOils.map((oil) => [oil.id, oil]));
  let totalCost = 0;

  for (const comp of scent.composition) {
    const baseOil = oilsMap.get(comp.baseOilId);
    if (baseOil) {
      totalCost += (comp.percentage / 100) * baseOil.costPerOz;
    }
  }

  return totalCost;
}

/* ---------- Component ---------- */
export default function CalculatorPage() {
  const { showAlert, showConfirm } = useModal();
  const [containers, setContainers] = useState<Container[]>([]);
  const [baseOils, setBaseOils] = useState<BaseOil[]>([]);
  const [wicks, setWicks] = useState<WickType[]>([]);
  const [scents, setScents] = useState<GlobalScent[]>([]);
  const [alcoholTypes, setAlcoholTypes] = useState<AlcoholType[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<CalculatorSettings>({
    waxCostPerOz: 157.64 / 720,
    waterToWaxRatio: 0.9,
    defaultFragranceLoad: 0.08,
  });
  const [loading, setLoading] = useState(true);

  // Tab state
  const [activeTab, setActiveTab] = useState<"calculator" | "containers" | "wicks" | "settings">("calculator");

  // Calculator state
  const [selectedContainerId, setSelectedContainerId] = useState<string>("");
  const [customWaterOz, setCustomWaterOz] = useState<number>(0);
  const [selectedScentId, setSelectedScentId] = useState<string>("");
  const [wickCounts, setWickCounts] = useState<Record<string, number>>({});

  // Product creation modal state
  const [showProductModal, setShowProductModal] = useState(false);
  const [newProduct, setNewProduct] = useState<Partial<Product> | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [initialStock, setInitialStock] = useState<number>(1);

  // Batch tracking state
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [showExistingProductModal, setShowExistingProductModal] = useState(false);

  // Load all data
  async function loadData() {
    setLoading(true);
    const [containersRes, oilsRes, wicksRes, scentsRes, settingsRes, typesRes, productsRes] = await Promise.all([
      fetch("/api/admin/containers"),
      fetch("/api/admin/base-oils"),
      fetch("/api/admin/wick-types"),
      fetch("/api/admin/scents"),
      fetch("/api/admin/calculator-settings"),
      fetch("/api/admin/alcohol-types?active=1"),
      fetch("/api/admin/products"),
    ]);

    const containersData = await containersRes.json();
    const oilsData = await oilsRes.json();
    const wicksData = await wicksRes.json();
    const scentsData = await scentsRes.json();
    const settingsData = await settingsRes.json();
    const typesData = await typesRes.json();
    const productsData = await productsRes.json();

    setContainers(containersData.containers || []);
    setBaseOils(oilsData.oils || []);
    setWicks(wicksData.wicks || []);
    setScents(scentsData.scents || []);
    setAlcoholTypes(typesData.types || []);
    setAllProducts(productsData.items || []);
    setSettings(settingsData.settings || settings);
    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  // Get water capacity from selected container or custom input
  const waterOz = selectedContainerId
    ? containers.find((c) => c.id === selectedContainerId)?.capacityWaterOz || 0
    : customWaterOz;

  // Get selected scent
  const selectedScent = scents.find((s) => s.id === selectedScentId);
  const scentCostPerOz = selectedScent ? calculateScentCost(selectedScent, baseOils) : 0;

  // Calculate total wick cost
  const totalWickCost = Object.entries(wickCounts).reduce((sum, [wickId, count]) => {
    const wick = wicks.find((w) => w.id === wickId);
    return sum + (wick ? wick.costPerWick * count : 0);
  }, 0);

  // Get container cost
  const containerCost = selectedContainerId
    ? containers.find((c) => c.id === selectedContainerId)?.costPerUnit || 0
    : 0;

  // Calculate results
  const results = waterOz > 0 && selectedScent
    ? calculateCosts(waterOz, settings, scentCostPerOz, totalWickCost, containerCost)
    : null;

  /* ---------- Container Management ---------- */
  const [editingContainer, setEditingContainer] = useState<Container | null>(null);
  const [newContainer, setNewContainer] = useState<Partial<Container>>({
    name: "",
    capacityWaterOz: 0,
    shape: "Round",
    costPerUnit: 0,
  });

  async function saveContainer(container: Container) {
    const res = await fetch("/api/admin/containers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(container),
    });

    if (res.ok) {
      await loadData();
      setEditingContainer(null);
      setNewContainer({
        name: "",
        capacityWaterOz: 0,
        shape: "Round",
        costPerUnit: 0,
      });
    } else {
      await showAlert("Failed to save container", "Error");
    }
  }

  async function deleteContainer(id: string) {
    const confirmed = await showConfirm("Delete this container?", "Confirm Delete");
    if (!confirmed) return;
    const res = await fetch(`/api/admin/containers?id=${id}`, { method: "DELETE" });
    if (res.ok) await loadData();
  }


  /* ---------- Wick Type Management ---------- */
  const [editingWick, setEditingWick] = useState<WickType | null>(null);
  const [newWick, setNewWick] = useState<Partial<WickType>>({ name: "", costPerWick: 0, appearAs: "" });

  async function saveWick(wick: WickType) {
    const res = await fetch("/api/admin/wick-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(wick),
    });

    if (res.ok) {
      await loadData();
      setEditingWick(null);
      setNewWick({ name: "", costPerWick: 0, appearAs: "" });
    } else {
      await showAlert("Failed to save wick type", "Error");
    }
  }

  async function deleteWick(id: string) {
    const confirmed = await showConfirm("Delete this wick type?", "Confirm Delete");
    if (!confirmed) return;
    const res = await fetch(`/api/admin/wick-types?id=${id}`, { method: "DELETE" });
    if (res.ok) await loadData();
  }

  /* ---------- Settings Management ---------- */
  async function saveSettings() {
    const res = await fetch("/api/admin/calculator-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });

    if (res.ok) {
      await showAlert("Settings saved successfully!", "Success");
    } else {
      await showAlert("Failed to save settings", "Error");
    }
  }

  /* ---------- Product Creation ---------- */
  function openProductModal() {
    if (!results || !selectedScent) return;

    const selectedContainer = containers.find((c) => c.id === selectedContainerId);
    const scentName = scents.find((s) => s.id === selectedScentId)?.name || "";

    // Calculate next SKU from existing products
    const allSkus = allProducts.map((p) => p.sku).filter(Boolean);
    console.log("All existing SKUs:", allSkus);
    const nextSku = computeNextSku(allSkus);
    console.log("Next SKU calculated:", nextSku);

    // Create product name suggestion
    const containerName = selectedContainer?.name || "Custom";
    const productName = `${containerName} - ${scentName}`;

    // Build wick types from selected wicks using their appearAs field
    const selectedWickTypes = Object.entries(wickCounts)
      .filter(([_, count]) => count > 0)
      .map(([wickId]) => {
        const wick = wicks.find((w) => w.id === wickId);
        if (!wick) return null;

        // Use the appearAs field if available, otherwise fall back to the name
        const displayName = wick.appearAs || wick.name;

        // Generate ID from appearAs or name for grouping
        const variantId = (wick.appearAs || wick.name)
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "");

        return {
          id: variantId,
          name: displayName
        };
      })
      .filter((w) => w !== null) as Array<{ id: string; name: string }>;

    // Remove duplicates (wicks with same appearAs → single entry)
    const uniqueWickTypes = Array.from(
      new Map(selectedWickTypes.map(w => [w.id, w])).values()
    );

    // Build variant data with selected scent and initial stock of 1 (user can change in modal)
    const variantData: Record<string, { stock: number }> = {};
    if (uniqueWickTypes.length > 0) {
      for (const wickType of uniqueWickTypes) {
        const variantId = `${wickType.id}-${selectedScentId}`;
        variantData[variantId] = { stock: 1 };
      }
    }

    setInitialStock(1); // Reset to 1 for the modal
    setNewProduct({
      name: productName,
      slug: slugify(productName),
      sku: nextSku,
      price: 0,
      images: [],
      seoDescription: `Hand-poured ${scentName} candle in ${containerName}`,
      stock: 0,
      alcoholType: "Other",
      materialCost: results.totalMaterialCost, // Save the calculated cost
      visibleOnWebsite: true, // Default to visible
      variantConfig: uniqueWickTypes.length > 0 ? {
        wickTypes: uniqueWickTypes,
        variantData,
      } : undefined,
    });

    setShowProductModal(true);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0 || !newProduct) return;

    try {
      const uploadedUrls: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fd = new FormData();
        fd.append("file", file);

        const res = await fetch("/api/admin/upload", { method: "POST", body: fd });

        if (!res.ok) {
          await showAlert(`Upload failed for ${file.name}`, "Upload Error");
          continue;
        }

        const { url } = (await res.json()) as { url: string };
        uploadedUrls.push(url);
      }

      if (uploadedUrls.length > 0) {
        setNewProduct({
          ...newProduct,
          images: [...(newProduct.images || []), ...uploadedUrls],
          image: newProduct.images?.length === 0 && uploadedUrls.length > 0 ? uploadedUrls[0] : newProduct.image,
        });
      }
    } catch (error) {
      await showAlert(`Upload failed: ${error instanceof Error ? error.message : "Network error"}`, "Upload Error");
    }
  }

  function removeProductImage(index: number) {
    if (!newProduct) return;
    const newImages = [...(newProduct.images || [])];
    newImages.splice(index, 1);
    setNewProduct({
      ...newProduct,
      images: newImages,
      image: newImages.length > 0 ? newImages[0] : undefined,
    });
  }

  async function saveProduct() {
    if (!newProduct || !newProduct.name || !newProduct.slug) {
      await showAlert("Please fill in name and slug", "Validation Error");
      return;
    }

    if (!newProduct.price || newProduct.price <= 0) {
      await showAlert("Please set a retail price greater than $0", "Validation Error");
      return;
    }

    setSavingProduct(true);

    const res = await fetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newProduct),
    });

    if (res.ok) {
      await showAlert("Product created successfully!", "Success");
      setShowProductModal(false);
      setNewProduct(null);
      // Optionally redirect to admin products page
      window.location.href = "/admin";
    } else {
      const error = await res.json();
      await showAlert(`Failed to create product: ${error.error || "Unknown error"}`, "Error");
    }

    setSavingProduct(false);
  }

  /* ---------- Batch Functions ---------- */
  async function addToBatch() {
    if (!results || !selectedScent) return;

    const selectedContainer = containers.find((c) => c.id === selectedContainerId);
    const containerName = selectedContainer?.name || `Custom (${waterOz}oz)`;
    const scentName = scents.find((s) => s.id === selectedScentId)?.name || "";

    const newItem: BatchItem = {
      containerId: selectedContainerId || `custom-${waterOz}`,
      containerName,
      waterOz,
      scentId: selectedScentId,
      scentName,
      wickCounts: { ...wickCounts },
      results: { ...results },
    };

    // Check if batch already has items with different scent
    if (batchItems.length > 0 && batchItems[0].scentId !== selectedScentId) {
      const shouldClear = await showConfirm(
        `Current batch contains ${batchItems[0].scentName}. Start a new batch with ${scentName}?`,
        "Different Scent Detected"
      );
      if (shouldClear) {
        // Clear batch and start fresh with just the new item
        setBatchItems([newItem]);
      }
      // If user clicked Cancel, don't add anything
      return;
    }

    // Same scent or empty batch - just append
    setBatchItems([...batchItems, newItem]);
  }

  async function clearBatch() {
    if (batchItems.length > 0) {
      const confirmed = await showConfirm('Clear all items from batch?', 'Confirm Clear');
      if (confirmed) {
        setBatchItems([]);
      }
    }
  }

  function removeBatchItem(index: number) {
    setBatchItems(batchItems.filter((_, i) => i !== index));
  }

  // Calculate batch totals
  const batchTotals = batchItems.reduce(
    (acc, item) => ({
      waxOz: acc.waxOz + item.results.waxOz,
      fragranceOz: acc.fragranceOz + item.results.fragranceOz,
      totalCost: acc.totalCost + item.results.totalMaterialCost,
    }),
    { waxOz: 0, fragranceOz: 0, totalCost: 0 }
  );

  // Calculate base oil totals for batch
  const batchBaseOilTotals = batchItems.reduce((acc, item) => {
    const scent = scents.find((s) => s.id === item.scentId);
    if (scent?.composition) {
      scent.composition.forEach((comp) => {
        const oilOz = item.results.fragranceOz * (comp.percentage / 100);
        acc[comp.baseOilId] = (acc[comp.baseOilId] || 0) + oilOz;
      });
    }
    return acc;
  }, {} as Record<string, number>);

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="btn">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-2xl font-semibold">Cost Calculator</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-[var(--color-line)] pb-2">
        {(["calculator", "containers", "wicks", "settings"] as const).map((tab) => (
          <button
            key={tab}
            className={`btn ${activeTab === tab ? "btn-primary" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "calculator" && "Calculator"}
            {tab === "containers" && "Containers"}
            {tab === "wicks" && "Wick Types"}
            {tab === "settings" && "Settings"}
          </button>
        ))}
      </div>

      {/* Calculator Tab */}
      {activeTab === "calculator" && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Batch Sidebar */}
          <div className="lg:col-span-1">
            <div className="card p-4 sticky top-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Current Batch</h3>
                {batchItems.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      void clearBatch();
                    }}
                    className="text-xs text-rose-600 hover:text-rose-700"
                    type="button"
                  >
                    Clear
                  </button>
                )}
              </div>

              {batchItems.length === 0 ? (
                <div className="text-sm text-[var(--color-muted)] text-center py-8">
                  No items in batch yet. Calculate a candle and add it to batch.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Batch Items List */}
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {batchItems.map((item, idx) => (
                      <div key={idx} className="bg-[var(--color-background)] p-2 rounded text-xs">
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{item.containerName}</div>
                            <div className="text-[var(--color-muted)] truncate">{item.scentName}</div>
                          </div>
                          <button
                            onClick={() => removeBatchItem(idx)}
                            className="text-rose-600 hover:text-rose-700 flex-shrink-0"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Batch Totals */}
                  <div className="border-t border-[var(--color-line)] pt-3">
                    <div className="text-sm font-semibold mb-2">Batch Totals</div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span>Candles:</span>
                        <span className="font-medium">{batchItems.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Wax:</span>
                        <span className="font-medium">{batchTotals.waxOz.toFixed(2)} oz</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Fragrance:</span>
                        <span className="font-medium">{batchTotals.fragranceOz.toFixed(2)} oz</span>
                      </div>

                      {/* Base Oil Breakdown */}
                      {Object.keys(batchBaseOilTotals).length > 0 && (
                        <div className="mt-2 pt-2 border-t border-[var(--color-line)]">
                          <div className="font-medium mb-1">Base Oils Needed:</div>
                          {Object.entries(batchBaseOilTotals).map(([oilId, oz]) => {
                            const oil = baseOils.find((o) => o.id === oilId);
                            return oil ? (
                              <div key={oilId} className="flex justify-between text-[var(--color-muted)]">
                                <span>{oil.name}:</span>
                                <span>{oz.toFixed(2)} oz</span>
                              </div>
                            ) : null;
                          })}
                        </div>
                      )}

                      <div className="flex justify-between border-t border-[var(--color-line)] pt-1 mt-1 font-semibold">
                        <span>Total Cost:</span>
                        <span>${batchTotals.totalCost.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Main Calculator */}
          <div className="lg:col-span-3 space-y-6">
            <div className="card p-6">
              <h2 className="text-xl font-semibold mb-4">Cost Calculator</h2>

            {/* Container Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Container</label>
              <select
                className="input"
                value={selectedContainerId}
                onChange={(e) => {
                  const value = e.target.value;
                  
                  setWickCounts({});

                  if (value === "__add__") {
                    setActiveTab("containers");
                    setSelectedContainerId("");
                  } else {
                    setSelectedContainerId(value);
                  }
                }}
              >
                <option value="">Custom / No Container</option>
                {containers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.capacityWaterOz}oz) - ${c.costPerUnit.toFixed(2)}
                  </option>
                ))}
                <option value="__add__">+ Add Container...</option>
              </select>
            </div>

            {/* Custom Water Oz (if no container selected) */}
            {!selectedContainerId && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Water Capacity (oz)</label>
                <input
                  type="number"
                  className="input"
                  value={customWaterOz || ""}
                  onChange={(e) => setCustomWaterOz(e.target.value === "" ? 0 : Number(e.target.value))}
                  step="0.1"
                  placeholder="0"
                />
              </div>
            )}

            {/* Scent Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Scent</label>
              <select
                className="input"
                value={selectedScentId}
                onChange={(e) => setSelectedScentId(e.target.value)}
              >
                <option value="">Select a scent...</option>
                {scents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {selectedScent && (
                <div className="mt-2">
                  <p className="text-sm text-[var(--color-muted)]">
                    Scent cost: ${scentCostPerOz.toFixed(2)}/oz
                  </p>
                  {selectedScent.composition && selectedScent.composition.length > 0 && waterOz > 0 && (
                    <div className="mt-2 p-3 bg-[var(--color-background)] rounded-lg border border-[var(--color-line)]">
                      <div className="text-xs font-medium text-[var(--color-muted)] mb-2">
                        Base Oil Recipe ({(settings.defaultFragranceLoad * 100).toFixed(1)}% fragrance load):
                      </div>
                      <div className="space-y-1.5">
                        {selectedScent.composition.map((comp, idx) => {
                          const baseOil = baseOils.find((o) => o.id === comp.baseOilId);
                          // Calculate exact ounces needed
                          const waxOz = waterOz * settings.waterToWaxRatio;
                          const totalFragranceOz = waxOz * settings.defaultFragranceLoad;
                          const baseOilOz = totalFragranceOz * (comp.percentage / 100);

                          return (
                            <div key={idx} className="flex justify-between items-center text-sm">
                              <span className="flex-1">{baseOil?.name || comp.baseOilId}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-[var(--color-muted)] text-xs">{comp.percentage}%</span>
                                <span className="font-medium min-w-[4rem] text-right">
                                  {baseOilOz.toFixed(3)} oz
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-2 pt-2 border-t border-[var(--color-line)] space-y-1">
                        <div className="flex justify-between text-xs font-medium">
                          <span>Total Fragrance:</span>
                          <span>
                            {(waterOz * settings.waterToWaxRatio * settings.defaultFragranceLoad).toFixed(3)} oz
                          </span>
                        </div>
                        <div className="flex justify-between text-xs font-medium">
                          <span>Total Wax:</span>
                          <span>{(waterOz * settings.waterToWaxRatio).toFixed(2)} oz</span>
                        </div>
                      </div>
                    </div>
                  )}
                  {selectedScent.composition && selectedScent.composition.length > 0 && waterOz === 0 && (
                    <div className="mt-2 p-3 bg-[var(--color-background)] rounded-lg border border-[var(--color-line)]">
                      <div className="text-xs font-medium text-[var(--color-muted)] mb-2">
                        Base Oil Composition:
                      </div>
                      <div className="space-y-1">
                        {selectedScent.composition.map((comp, idx) => {
                          const baseOil = baseOils.find((o) => o.id === comp.baseOilId);
                          return (
                            <div key={idx} className="flex justify-between text-sm">
                              <span>{baseOil?.name || comp.baseOilId}</span>
                              <span className="font-medium">{comp.percentage}%</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-2 pt-2 border-t border-[var(--color-line)] flex justify-between text-xs">
                        <span className="font-medium">Total:</span>
                        <span className="font-medium">
                          {selectedScent.composition.reduce((sum, c) => sum + c.percentage, 0)}%
                        </span>
                      </div>
                      <p className="text-xs text-[var(--color-muted)] mt-2 italic">
                        Select container to see exact ounces needed
                      </p>
                    </div>
                  )}
                  {selectedScent.costPerOz !== undefined && !selectedScent.composition && (
                    <p className="text-xs text-[var(--color-muted)] mt-1 italic">
                      Using direct cost (no composition)
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Wick Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Wicks</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {wicks.map((w) => (
                  <div key={w.id}>
                    <label className="block">
                      <div className="text-xs font-medium mb-1">{w.name}</div>
                      <input
                        type="number"
                        className="input text-sm w-full"
                        value={wickCounts[w.id] || 0}
                        onChange={(e) =>
                          setWickCounts({ ...wickCounts, [w.id]: Number(e.target.value) })
                        }
                        min="0"
                        step="1"
                      />
                    </label>
                  </div>
                ))}
              </div>
              {totalWickCost > 0 && (
                <p className="text-sm text-[var(--color-muted)] mt-2">
                  Total wick cost: ${totalWickCost.toFixed(2)}
                </p>
              )}
            </div>

            {/* Results */}
            {results ? (
              <div className="mt-6 border-t border-[var(--color-line)] pt-6">
                <h3 className="text-lg font-semibold mb-4">Results</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                  <div>
                    <div className="text-sm text-[var(--color-muted)]">Wax needed</div>
                    <div className="text-lg font-semibold">{results.waxOz.toFixed(2)} oz</div>
                  </div>
                  <div>
                    <div className="text-sm text-[var(--color-muted)]">Fragrance needed</div>
                    <div className="text-lg font-semibold">{results.fragranceOz.toFixed(2)} oz</div>
                  </div>
                  <div>
                    <div className="text-sm text-[var(--color-muted)]">Total cost</div>
                    <div className="text-lg font-semibold">${results.totalMaterialCost.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-[var(--color-muted)]">Cost/oz wax</div>
                    <div className="text-lg font-semibold">${results.costPerWaxOz.toFixed(2)}</div>
                  </div>
                </div>

                <div className="bg-[var(--color-background)] p-4 rounded-lg">
                  <h4 className="text-sm font-semibold mb-2">Cost Breakdown</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Wax ({results.waxOz.toFixed(2)} oz × ${settings.waxCostPerOz.toFixed(3)}/oz)</span>
                      <span className="font-medium">${results.waxCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Fragrance ({results.fragranceOz.toFixed(2)} oz × ${scentCostPerOz.toFixed(2)}/oz)</span>
                      <span className="font-medium">${results.fragranceCost.toFixed(2)}</span>
                    </div>
                    {selectedScent?.composition && selectedScent.composition.length > 0 && (
                      <div className="ml-4 space-y-1 text-xs text-[var(--color-muted)] border-l-2 border-[var(--color-line)] pl-2 mt-1">
                        {selectedScent.composition.map((comp) => {
                          const baseOil = baseOils.find((oil) => oil.id === comp.baseOilId);
                          const oilOz = results.fragranceOz * (comp.percentage / 100);
                          return baseOil ? (
                            <div key={comp.baseOilId} className="flex justify-between">
                              <span>↳ {baseOil.name} ({comp.percentage}%)</span>
                              <span>{oilOz.toFixed(2)} oz</span>
                            </div>
                          ) : null;
                        })}
                      </div>
                    )}
                    {results.wickCost > 0 && (
                      <div className="flex justify-between">
                        <span>Wicks</span>
                        <span className="font-medium">${results.wickCost.toFixed(2)}</span>
                      </div>
                    )}
                    {results.containerCost > 0 && (
                      <div className="flex justify-between">
                        <span>Container</span>
                        <span className="font-medium">${results.containerCost.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-[var(--color-line)] pt-1 mt-1">
                      <span className="font-semibold">Total</span>
                      <span className="font-semibold">${results.totalMaterialCost.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-6 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      className="btn btn-primary"
                      onClick={openProductModal}
                      disabled={!selectedScent || loading}
                    >
                      📦 New Product
                    </button>
                    <button
                      className="btn"
                      onClick={() => setShowExistingProductModal(true)}
                      disabled={!selectedScent || loading}
                    >
                      ➕ Add to Existing
                    </button>
                  </div>
                  <button
                    className="btn w-full bg-blue-50 hover:bg-blue-100 border-blue-200"
                    onClick={addToBatch}
                    disabled={!selectedScent || loading}
                  >
                    📋 Add to Batch
                  </button>
                  <p className="text-xs text-[var(--color-muted)] text-center">
                    Create new product, add to existing, or batch multiple candles
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-6 p-4 bg-[var(--color-background)] rounded-lg text-center text-[var(--color-muted)]">
                Select a container (or enter water capacity) and scent to see results
              </div>
            )}
          </div>
          </div>
        </div>
      )}

      {/* Containers Tab */}
      {activeTab === "containers" && (
        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="text-xl font-semibold mb-4">Add Container</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <label className="block">
                <div className="text-sm font-medium mb-2">Container Name</div>
                <input
                  className="input"
                  placeholder="e.g., 8oz Amber Jar"
                  value={newContainer.name}
                  onChange={(e) => setNewContainer({ ...newContainer, name: e.target.value })}
                />
              </label>
              <label className="block">
                <div className="text-sm font-medium mb-2">Water Capacity (oz)</div>
                <input
                  className="input"
                  type="number"
                  placeholder="e.g., 7.5"
                  value={newContainer.capacityWaterOz || ""}
                  onChange={(e) =>
                    setNewContainer({ ...newContainer, capacityWaterOz: e.target.value === "" ? 0 : Number(e.target.value) })
                  }
                  step="0.1"
                />
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  Fill jar to pour level and measure water weight in oz
                </p>
              </label>
              <label className="block">
                <div className="text-sm font-medium mb-2">Shape</div>
                <select
                  className="input"
                  value={newContainer.shape}
                  onChange={(e) => setNewContainer({ ...newContainer, shape: e.target.value })}
                >
                  <option>Round</option>
                  <option>Square</option>
                  <option>Hexagonal</option>
                  <option>Rectangular</option>
                  <option>Bottle</option>
                  <option>Other</option>
                </select>
              </label>
              <label className="block">
                <div className="text-sm font-medium mb-2">Cost per Unit ($)</div>
                <input
                  className="input"
                  type="number"
                  placeholder="e.g., 2.50"
                  value={newContainer.costPerUnit || ""}
                  onChange={(e) =>
                    setNewContainer({ ...newContainer, costPerUnit: e.target.value === "" ? 0 : Number(e.target.value) })
                  }
                  step="0.01"
                />
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  How much each container costs you
                </p>
              </label>
              <label className="block sm:col-span-2">
                <div className="text-sm font-medium mb-2">Supplier (optional)</div>
                <input
                  className="input"
                  placeholder="e.g., Candle Science"
                  value={newContainer.supplier || ""}
                  onChange={(e) => setNewContainer({ ...newContainer, supplier: e.target.value })}
                />
              </label>
            </div>
            <button
              className="btn btn-primary"
              onClick={async () => {
                if (!newContainer.name || !newContainer.capacityWaterOz) {
                  await showAlert("Please fill in name and capacity", "Validation Error");
                  return;
                }
                saveContainer({
                  id: slugify(newContainer.name),
                  name: newContainer.name,
                  capacityWaterOz: newContainer.capacityWaterOz,
                  shape: newContainer.shape || "Round",
                  costPerUnit: newContainer.costPerUnit || 0,
                  supplier: newContainer.supplier,
                });
              }}
            >
              Add Container
            </button>
          </div>

          <div className="card p-6">
            <h2 className="text-xl font-semibold mb-4">Existing Containers</h2>
            <div className="space-y-3">
              {containers.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-3 border border-[var(--color-line)] rounded">
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-sm text-[var(--color-muted)]">
                      {c.capacityWaterOz}oz • {c.shape} • ${c.costPerUnit.toFixed(2)}
                      {c.supplier && ` • ${c.supplier}`}
                    </div>
                  </div>
                  <button className="btn text-sm" onClick={() => deleteContainer(c.id)}>
                    Delete
                  </button>
                </div>
              ))}
              {containers.length === 0 && (
                <p className="text-[var(--color-muted)]">No containers yet</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Wicks Tab */}
      {activeTab === "wicks" && (
        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="text-xl font-semibold mb-4">Add Wick Type</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <label className="block">
                <div className="text-sm font-medium mb-2">Wick Type Name</div>
                <input
                  className="input"
                  placeholder="e.g., Wood 30mm"
                  value={newWick.name}
                  onChange={(e) => setNewWick({ ...newWick, name: e.target.value })}
                />
              </label>
              <label className="block">
                <div className="text-sm font-medium mb-2">Cost per Wick ($)</div>
                <input
                  className="input"
                  type="number"
                  placeholder="e.g., 1.47"
                  value={newWick.costPerWick || ""}
                  onChange={(e) => setNewWick({ ...newWick, costPerWick: e.target.value === "" ? 0 : Number(e.target.value) })}
                  step="0.01"
                />
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  Include your share of shipping costs
                </p>
              </label>
              <label className="block sm:col-span-2">
                <div className="text-sm font-medium mb-2">Appear As (for variants)</div>
                <input
                  className="input"
                  placeholder="e.g., Standard, Wavy Wood Wick"
                  value={newWick.appearAs || ""}
                  onChange={(e) => setNewWick({ ...newWick, appearAs: e.target.value })}
                />
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  How this wick type displays in product variant names
                </p>
              </label>
            </div>
            <button
              className="btn btn-primary"
              onClick={async () => {
                if (!newWick.name || newWick.costPerWick === undefined) {
                  await showAlert("Please fill in name and cost", "Validation Error");
                  return;
                }
                saveWick({
                  id: slugify(newWick.name),
                  name: newWick.name,
                  costPerWick: newWick.costPerWick,
                  appearAs: newWick.appearAs || undefined,
                });
              }}
            >
              Add Wick Type
            </button>
          </div>

          <div className="card p-6">
            <h2 className="text-xl font-semibold mb-4">Existing Wick Types</h2>
            <div className="space-y-3">
              {wicks.map((w) => (
                <div key={w.id}>
                  {editingWick?.id === w.id ? (
                    // Edit mode
                    <div className="p-3 border border-[var(--color-line)] rounded bg-[var(--color-background)]">
                      <div className="space-y-3">
                        <label className="block">
                          <div className="text-xs font-medium mb-1">Name</div>
                          <input
                            className="input text-sm"
                            value={editingWick.name}
                            onChange={(e) => setEditingWick({ ...editingWick, name: e.target.value })}
                          />
                        </label>
                        <label className="block">
                          <div className="text-xs font-medium mb-1">Cost per Wick ($)</div>
                          <input
                            className="input text-sm"
                            type="number"
                            step="0.01"
                            value={editingWick.costPerWick || ""}
                            onChange={(e) => setEditingWick({ ...editingWick, costPerWick: e.target.value === "" ? 0 : Number(e.target.value) })}
                          />
                        </label>
                        <label className="block">
                          <div className="text-xs font-medium mb-1">Appear As</div>
                          <input
                            className="input text-sm"
                            placeholder="e.g., Standard, Wavy Wood Wick"
                            value={editingWick.appearAs || ""}
                            onChange={(e) => setEditingWick({ ...editingWick, appearAs: e.target.value })}
                          />
                        </label>
                        <div className="flex gap-2">
                          <button
                            className="btn btn-primary text-sm"
                            onClick={() => {
                              if (editingWick.id && editingWick.name && editingWick.costPerWick !== undefined) {
                                saveWick(editingWick as WickType);
                              }
                            }}
                          >
                            Save
                          </button>
                          <button
                            className="btn text-sm"
                            onClick={() => setEditingWick(null)}
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
                        <div className="font-medium">{w.name}</div>
                        <div className="text-sm text-[var(--color-muted)]">
                          ${w.costPerWick.toFixed(2)}/wick
                          {w.appearAs ? (
                            <span className="ml-2">
                              • Appears as: <span className="font-medium">{w.appearAs}</span>
                            </span>
                          ) : (
                            <span className="ml-2 text-amber-600">
                              • No &quot;Appears As&quot; set
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button className="btn text-sm" onClick={() => setEditingWick(w)}>
                          Edit
                        </button>
                        <button className="btn text-sm" onClick={() => deleteWick(w.id)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {wicks.length === 0 && (
                <p className="text-[var(--color-muted)]">No wick types yet</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === "settings" && (
        <div className="card p-6">
          <h2 className="text-xl font-semibold mb-4">Calculator Settings</h2>
          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium mb-2">Wax Cost per Oz ($)</label>
              <input
                className="input"
                type="number"
                value={settings.waxCostPerOz || ""}
                onChange={(e) =>
                  setSettings({ ...settings, waxCostPerOz: e.target.value === "" ? 0 : Number(e.target.value) })
                }
                step="0.001"
                placeholder="0.219"
              />
              <p className="text-xs text-[var(--color-muted)] mt-1">
                Current: ${settings.waxCostPerOz.toFixed(3)}/oz (≈ ${(settings.waxCostPerOz * 720).toFixed(2)} for 45 lbs)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Water to Wax Ratio</label>
              <input
                className="input"
                type="number"
                value={settings.waterToWaxRatio || ""}
                onChange={(e) =>
                  setSettings({ ...settings, waterToWaxRatio: e.target.value === "" ? 0 : Number(e.target.value) })
                }
                step="0.01"
                placeholder="0.9"
              />
              <p className="text-xs text-[var(--color-muted)] mt-1">
                1 oz water = {settings.waterToWaxRatio.toFixed(2)} oz wax (typically 0.9)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Default Fragrance Load (%)</label>
              <input
                className="input"
                type="number"
                value={settings.defaultFragranceLoad ? settings.defaultFragranceLoad * 100 : ""}
                onChange={(e) =>
                  setSettings({ ...settings, defaultFragranceLoad: e.target.value === "" ? 0 : Number(e.target.value) / 100 })
                }
                step="1"
                min="0"
                max="100"
                placeholder="8"
              />
              <p className="text-xs text-[var(--color-muted)] mt-1">
                {(settings.defaultFragranceLoad * 100).toFixed(1)}% fragrance by weight of wax
              </p>
            </div>

            <button className="btn btn-primary" onClick={saveSettings}>
              Save Settings
            </button>
          </div>
        </div>
      )}

      {/* Product Creation Modal */}
      {showProductModal && newProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            onClick={() => {
              setShowProductModal(false);
              setNewProduct(null);
            }}
          />

          {/* Modal */}
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-gradient-to-r from-neutral-50 to-white">
              <div>
                <h2 className="text-xl font-semibold text-[var(--color-ink)]">Create Product from Calculation</h2>
                <p className="text-sm text-[var(--color-muted)] mt-0.5">
                  Product details auto-filled from cost calculation
                </p>
              </div>
              <button
                className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                onClick={() => {
                  setShowProductModal(false);
                  setNewProduct(null);
                }}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
              {/* Product Name */}
              <label className="block">
                <div className="text-sm font-medium mb-2">Product Name</div>
                <input
                  className="input"
                  value={newProduct.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    // Auto-generate slug from name
                    const autoSlug = name
                      .toLowerCase()
                      .trim()
                      .replace(/[^a-z0-9\s-]/g, "")
                      .replace(/\s+/g, "-")
                      .replace(/-+/g, "-");
                    setNewProduct({ ...newProduct, name, slug: autoSlug });
                  }}
                  placeholder="e.g., Woodford Reserve Candle"
                />
              </label>

              {/* Slug */}
              <label className="block">
                <div className="text-sm font-medium mb-2">Slug (URL)</div>
                <input
                  className="input"
                  value={newProduct.slug}
                  onChange={(e) => setNewProduct({ ...newProduct, slug: e.target.value })}
                  placeholder="e.g., woodford-reserve-candle"
                />
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  Lowercase letters, numbers, and hyphens only (auto-updates from name)
                </p>
              </label>

              {/* SKU and Price */}
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <div className="text-sm font-medium mb-2">SKU</div>
                  <input
                    className="input"
                    value={newProduct.sku}
                    onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                    placeholder="DCW-0001"
                  />
                </label>

                <label className="block">
                  <div className="text-sm font-medium mb-2">Retail Price ($) *</div>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={newProduct.price || ""}
                    onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value === "" ? 0 : Number(e.target.value) })}
                    placeholder="24.99"
                    required
                  />
                </label>
              </div>

              {/* Material Cost (readonly) */}
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-sm font-medium text-green-900">
                  Material Cost: ${newProduct.materialCost?.toFixed(2) || '0.00'}
                </div>
                {newProduct.price && newProduct.price > 0 && newProduct.materialCost && (
                  <div className="text-xs text-green-700 mt-1">
                    Profit: ${(newProduct.price - newProduct.materialCost).toFixed(2)} (
                    {(((newProduct.price - newProduct.materialCost) / newProduct.price) * 100).toFixed(1)}% margin)
                  </div>
                )}
              </div>

              {/* Images */}
              <div className="block">
                <div className="text-sm font-medium mb-2">Product Images</div>
                <label className="btn cursor-pointer w-full">
                  + Add Images
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </label>

                {newProduct.images && newProduct.images.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {newProduct.images.map((img, idx) => (
                      <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-white border border-[var(--color-line)]">
                        <Image src={img} alt={`Product ${idx + 1}`} fill className="object-contain" />
                        <button
                          type="button"
                          className="absolute top-1 right-1 btn text-xs px-2 py-1 bg-rose-500 text-white"
                          onClick={() => removeProductImage(idx)}
                        >
                          ✕
                        </button>
                        {idx === 0 && (
                          <div className="absolute bottom-1 left-1 text-xs font-medium bg-green-600 text-white px-2 py-0.5 rounded">
                            Primary
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Stripe Price ID */}
              <label className="block">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Stripe Price ID (optional)</span>
                  {!newProduct.stripePriceId && (
                    <button
                      type="button"
                      className="text-xs text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
                      onClick={async () => {
                        // Validate required fields
                        if (!newProduct.name || !newProduct.name.trim()) {
                          alert("Please enter a product name first");
                          return;
                        }
                        if (!newProduct.price || newProduct.price <= 0) {
                          alert("Please enter a valid price first");
                          return;
                        }

                        try {
                          setSavingProduct(true);
                          const res = await fetch("/api/admin/create-stripe-product", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              name: newProduct.name,
                              price: newProduct.price,
                              description: newProduct.seoDescription,
                              images: newProduct.images || [],
                            }),
                          });

                          const data = await res.json();

                          if (!res.ok) {
                            throw new Error(data.details || data.error || "Failed to create Stripe product");
                          }

                          // Update the product with the returned price ID
                          setNewProduct({ ...newProduct, stripePriceId: data.priceId });

                          alert(`Stripe product created successfully!\n\nProduct ID: ${data.productId}\nPrice ID: ${data.priceId}`);
                        } catch (error) {
                          console.error("[Create Stripe Product] Error:", error);
                          alert(error instanceof Error ? error.message : "Failed to create Stripe product");
                        } finally {
                          setSavingProduct(false);
                        }
                      }}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Create Stripe Product
                    </button>
                  )}
                </div>
                <input
                  className="input"
                  value={newProduct.stripePriceId || ""}
                  onChange={(e) => setNewProduct({ ...newProduct, stripePriceId: e.target.value })}
                  placeholder="Click 'Create Stripe Product' or paste manually"
                />
              </label>

              {/* Container Selection */}
              <label className="block">
                <div className="text-sm font-medium mb-2">Container (for description)</div>
                <select
                  className="input"
                  value={newProduct.containerId || ""}
                  onChange={(e) => setNewProduct({ ...newProduct, containerId: e.target.value || undefined })}
                >
                  <option value="">— Select container —</option>
                  {containers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.capacityWaterOz} oz water)
                    </option>
                  ))}
                </select>
              </label>

              {/* Description */}
              <label className="block">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">SEO Description</span>
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    onClick={() => {
                      const container = containers.find((c) => c.id === newProduct.containerId);
                      const bottleName = newProduct.name.replace(/\s+Candle$/i, "").trim();
                      let waxOzText = "[Select container to calculate]";
                      if (container) {
                        const waxOz = container.capacityWaterOz * settings.waterToWaxRatio;
                        waxOzText = `${Math.round(waxOz)} oz wax`;
                      }
                      const generatedDesc = `Hand-poured candle in an upcycled ${bottleName} bottle.\n\nGolden Brands 454 Coconut Soy Wax\n\nApprox. - ${waxOzText}`;
                      setNewProduct({ ...newProduct, seoDescription: generatedDesc });
                    }}
                  >
                    Auto-generate from name & container
                  </button>
                </div>
                <textarea
                  className="textarea"
                  rows={3}
                  value={newProduct.seoDescription}
                  onChange={(e) => setNewProduct({ ...newProduct, seoDescription: e.target.value })}
                  placeholder="Select a container and click 'Auto-generate' or type manually"
                />
              </label>

              {/* Alcohol Type */}
              <label className="block">
                <div className="text-sm font-medium mb-2">Alcohol Type</div>
                <select
                  className="input"
                  value={newProduct.alcoholType || "Other"}
                  onChange={(e) => setNewProduct({ ...newProduct, alcoholType: e.target.value })}
                >
                  {alcoholTypes.length === 0 ? (
                    <option value="Other">Other</option>
                  ) : (
                    alcoholTypes.map((type) => (
                      <option key={type.id} value={type.name}>
                        {type.name}
                      </option>
                    ))
                  )}
                </select>
              </label>

              {/* Flags */}
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newProduct.visibleOnWebsite !== false}
                    onChange={(e) => setNewProduct({ ...newProduct, visibleOnWebsite: e.target.checked })}
                  />
                  <span className="text-sm">Show on Website</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newProduct.bestSeller || false}
                    onChange={(e) => setNewProduct({ ...newProduct, bestSeller: e.target.checked })}
                  />
                  <span className="text-sm">Best Seller</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newProduct.youngDumb || false}
                    onChange={(e) => setNewProduct({ ...newProduct, youngDumb: e.target.checked })}
                  />
                  <span className="text-sm">Young & Dumb</span>
                </label>
              </div>

              {/* Initial Stock */}
              <label className="block">
                <div className="text-sm font-medium mb-2">Initial Stock Quantity</div>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="1"
                  value={initialStock || ""}
                  onChange={(e) => {
                    const qty = e.target.value === "" ? 0 : Number(e.target.value);
                    setInitialStock(qty);
                    // Update variant data with new stock
                    if (newProduct.variantConfig) {
                      const updatedVariantData = { ...newProduct.variantConfig.variantData };
                      for (const variantId in updatedVariantData) {
                        updatedVariantData[variantId] = { stock: qty };
                      }
                      setNewProduct({
                        ...newProduct,
                        variantConfig: {
                          ...newProduct.variantConfig,
                          variantData: updatedVariantData,
                        },
                      });
                    }
                  }}
                  placeholder="1"
                />
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  How many units you have in stock for each variant
                </p>
              </label>

              {/* Variant Info (readonly) */}
              {newProduct.variantConfig && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm font-medium text-blue-900 mb-1">Variants Configured</div>
                  <div className="text-xs text-blue-700">
                    This product will have variants for:{" "}
                    {newProduct.variantConfig.wickTypes.map((w) => w.name).join(", ")}
                  </div>
                  <div className="text-xs text-blue-700 mt-1">
                    Scent: {scents.find((s) => s.id === selectedScentId)?.name}
                  </div>
                  <div className="text-xs text-blue-700 mt-1">
                    Stock per variant: {initialStock} unit{initialStock !== 1 ? 's' : ''}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-200 bg-neutral-50">
              <button
                className="btn hover:bg-white transition-colors"
                onClick={() => {
                  setShowProductModal(false);
                  setNewProduct(null);
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={saveProduct}
                disabled={savingProduct || !newProduct.name || !newProduct.slug || !newProduct.price || newProduct.price <= 0}
              >
                {savingProduct ? "Creating..." : "Create Product"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add to Existing Product Modal */}
      {showExistingProductModal && results && selectedScent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setShowExistingProductModal(false)} />

          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-gradient-to-r from-neutral-50 to-white">
              <div>
                <h2 className="text-xl font-semibold text-[var(--color-ink)]">Add to Existing Product</h2>
                <p className="text-sm text-[var(--color-muted)] mt-0.5">
                  Select a product to add this scent/wick combination
                </p>
              </div>
              <button
                className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                onClick={() => setShowExistingProductModal(false)}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                <div className="font-medium text-blue-900">Adding:</div>
                <div className="text-blue-700">
                  Scent: {selectedScent.name}
                  {Object.entries(wickCounts).some(([_, count]) => count > 0) && (
                    <div className="mt-1">
                      Wicks: {Object.entries(wickCounts)
                        .filter(([_, count]) => count > 0)
                        .map(([wickId, count]) => {
                          const wick = wicks.find((w) => w.id === wickId);
                          return wick ? `${wick.name} (${count})` : '';
                        })
                        .filter(Boolean)
                        .join(', ')}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {allProducts.length === 0 ? (
                  <div className="text-center py-8 text-[var(--color-muted)]">
                    No products found. Create a new product first.
                  </div>
                ) : (
                  allProducts.map((product) => (
                    <button
                      key={product.slug}
                      onClick={async () => {
                        // Build variant data from current calculation
                        const selectedWickTypes = Object.entries(wickCounts)
                          .filter(([_, count]) => count > 0)
                          .map(([wickId]) => {
                            const wick = wicks.find((w) => w.id === wickId);
                            if (!wick) return null;
                            const displayName = wick.appearAs || wick.name;
                            const variantId = (wick.appearAs || wick.name)
                              .toLowerCase()
                              .replace(/\s+/g, "-")
                              .replace(/[^a-z0-9-]/g, "");
                            return { id: variantId, name: displayName };
                          })
                          .filter((w) => w !== null) as Array<{ id: string; name: string }>;

                        const uniqueWickTypes = Array.from(
                          new Map(selectedWickTypes.map(w => [w.id, w])).values()
                        );

                        // Update product with new variant
                        const updatedVariantConfig = product.variantConfig || { wickTypes: [], variantData: {} };

                        // Merge wick types
                        const existingWickIds = new Set(updatedVariantConfig.wickTypes.map(w => w.id));
                        uniqueWickTypes.forEach(wick => {
                          if (!existingWickIds.has(wick.id)) {
                            updatedVariantConfig.wickTypes.push(wick);
                          }
                        });

                        // Add variant data (increment stock by 1 for this scent+wick combo)
                        uniqueWickTypes.forEach(wickType => {
                          const variantId = `${wickType.id}-${selectedScentId}`;
                          if (updatedVariantConfig.variantData[variantId]) {
                            updatedVariantConfig.variantData[variantId].stock += 1;
                          } else {
                            updatedVariantConfig.variantData[variantId] = { stock: 1 };
                          }
                        });

                        // Save updated product
                        const res = await fetch(`/api/admin/products/${product.slug}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            variantConfig: updatedVariantConfig,
                          }),
                        });

                        if (res.ok) {
                          await showAlert(`Added ${selectedScent.name} variant to ${product.name}`, "Success");
                          setShowExistingProductModal(false);
                          void loadData(); // Refresh products
                        } else {
                          const error = await res.json();
                          await showAlert(`Failed: ${error.error || "Unknown error"}`, "Error");
                        }
                      }}
                      className="w-full text-left p-4 border-2 border-[var(--color-line)] rounded-xl hover:border-[var(--color-accent)] hover:bg-amber-50/30 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-base group-hover:text-[var(--color-accent)] transition-colors">{product.name}</div>
                          <div className="text-sm text-[var(--color-muted)] mt-1">
                            SKU: {product.sku} | Price: ${product.price.toFixed(2)}
                          </div>
                          {product.variantConfig && (
                            <div className="text-xs text-[var(--color-muted)] mt-1">
                              Wicks: {product.variantConfig.wickTypes.map(w => w.name).join(', ')}
                            </div>
                          )}
                        </div>
                        <div className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                          <svg className="w-5 h-5 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end px-6 py-4 border-t border-neutral-200 bg-neutral-50">
              <button
                onClick={() => setShowExistingProductModal(false)}
                className="btn hover:bg-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
