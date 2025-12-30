"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
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
  squareCatalogId?: string; // Square Catalog Item ID for POS integration
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
  if (scent.costPerOz !== undefined) return scent.costPerOz;

  if (!scent.composition || scent.composition.length === 0) return 0;

  const oilsMap = new Map(baseOils.map((oil) => [oil.id, oil]));
  let totalCost = 0;

  for (const comp of scent.composition) {
    const baseOil = oilsMap.get(comp.baseOilId);
    if (baseOil) totalCost += (comp.percentage / 100) * baseOil.costPerOz;
  }

  return totalCost;
}

/* ---------- Searchable ComboBox (filters as you type, mobile-friendly) ---------- */
type ComboItem<TValue extends string> = {
  value: TValue;
  label: string;
  sublabel?: string;
  disabled?: boolean;
};

function ComboBox<TValue extends string>(props: {
  id: string;
  label: string;
  placeholder?: string;
  value: TValue;
  items: Array<ComboItem<TValue>>;
  onChange: (value: TValue) => void;
  emptyMessage?: string;
  className?: string;
  alwaysShowItem?: ComboItem<TValue>; // Item that always appears at bottom
}) {
  const {
    id,
    label,
    placeholder = "Search...",
    value,
    items,
    onChange,
    emptyMessage = "No results.",
    className = "",
    alwaysShowItem,
  } = props;

  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selected = items.find((i) => i.value === value);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(""); // ONLY the search query
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;

    return items.filter((i) => {
      const hay = `${i.label} ${i.sublabel || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, query]);

  useEffect(() => {
    if (activeIndex >= filtered.length) setActiveIndex(0);
  }, [filtered.length, activeIndex]);

  // Close on outside click / escape
  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setOpen(false);
    }
    function onDocKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onDocKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onDocKeyDown);
    };
  }, []);

  function openAndFocus({ clearSearch }: { clearSearch: boolean }) {
    setOpen(true);
    setActiveIndex(0);
    if (clearSearch) setQuery(""); // key fix: start with empty search
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function commitSelection(idx: number) {
    const item = filtered[idx];
    if (!item || item.disabled) return;
    onChange(item.value);
    setOpen(false);
    setQuery(""); // after selecting, clear search so next open starts clean
  }

  // Show selected label when closed, but NEVER force it into the query
  const inputDisplayValue = open ? query : selected?.label || "";

  return (
    <div ref={rootRef} className={`w-full ${className}`}>
      <label htmlFor={id} className="block text-sm font-medium mb-2">
        {label}
      </label>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-muted)] pointer-events-none" />

        <input
          id={id}
          ref={inputRef}
          className="input w-full !pl-10 !pr-10" // key fix: important padding
          placeholder={open ? placeholder : selected ? "" : placeholder}
          value={inputDisplayValue}
          onFocus={() => openAndFocus({ clearSearch: true })}
          onClick={() => openAndFocus({ clearSearch: true })}
          onChange={(e) => {
            if (!open) setOpen(true);
            setQuery(e.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={(e) => {
            if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
              e.preventDefault();
              openAndFocus({ clearSearch: true });
              return;
            }

            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setOpen(true);
              setActiveIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (!open) return;
              commitSelection(activeIndex);
            }
          }}
          aria-expanded={open}
          aria-controls={`${id}-listbox`}
          aria-autocomplete="list"
          autoComplete="off"
          inputMode="search"
        />

        {/* Clear search (only when open + has query) */}
        {open && query && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-md hover:bg-neutral-100"
            onClick={() => {
              setQuery("");
              setActiveIndex(0);
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
          >
            <span className="text-[var(--color-muted)]">✕</span>
          </button>
        )}

        {open && (
          <div
            id={`${id}-listbox`}
            role="listbox"
            className="absolute z-30 mt-2 w-full rounded-xl border border-[var(--color-line)] bg-white shadow-lg overflow-hidden"
          >
            <div className="max-h-72 overflow-y-auto overscroll-contain">
              {filtered.length === 0 && !alwaysShowItem ? (
                <div className="px-4 py-3 text-sm text-[var(--color-muted)]">
                  {emptyMessage}
                </div>
              ) : (
                <>
                  {filtered.length === 0 && alwaysShowItem && (
                    <div className="px-4 py-3 text-sm text-[var(--color-muted)]">
                      {emptyMessage}
                    </div>
                  )}

                  {filtered.map((item, idx) => {
                    const isActive = idx === activeIndex;
                    const isSelected = item.value === value;

                    return (
                      <button
                        key={`${item.value}-${idx}`}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        disabled={item.disabled}
                        className={[
                          "w-full text-left px-4 py-3",
                          "transition-colors",
                          item.disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                          isActive ? "bg-amber-50" : "bg-white",
                          "hover:bg-amber-50",
                        ].join(" ")}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => commitSelection(idx)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">
                              {item.label}
                            </div>
                            {item.sublabel ? (
                              <div className="text-xs text-[var(--color-muted)] truncate mt-0.5">
                                {item.sublabel}
                              </div>
                            ) : null}
                          </div>
                          {isSelected ? (
                            <div className="text-xs font-semibold text-green-700 mt-0.5">
                              Selected
                            </div>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}

                  {/* Always show this item at the bottom */}
                  {alwaysShowItem && (
                    <button
                      type="button"
                      role="option"
                      className={[
                        "w-full text-left px-4 py-3",
                        "border-t-2 border-[var(--color-line)]",
                        "transition-colors cursor-pointer",
                        "bg-blue-50 hover:bg-blue-100",
                        "font-medium text-blue-700",
                      ].join(" ")}
                      onClick={() => {
                        onChange(alwaysShowItem.value);
                        setOpen(false);
                        setQuery("");
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">
                            {alwaysShowItem.label}
                          </div>
                          {alwaysShowItem.sublabel ? (
                            <div className="text-xs text-blue-600 truncate mt-0.5">
                              {alwaysShowItem.sublabel}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-[var(--color-muted)] mt-2">
        Type to filter, then tap an option.
      </p>
    </div>
  );
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
  const [activeTab, setActiveTab] = useState<
    "calculator" | "containers" | "wicks" | "settings"
  >("calculator");

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
  const [addToBatchAfterCreate, setAddToBatchAfterCreate] = useState<boolean>(true);

  // Batch tracking state - persisted to localStorage
  const [batchItems, setBatchItems] = useState<BatchItem[]>(() => {
    if (typeof window === "undefined") return [];
    const saved = localStorage.getItem("calculator-batch");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });
  const [showExistingProductModal, setShowExistingProductModal] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductForSize, setSelectedProductForSize] = useState<Product | null>(null);
  const [selectedSizeId, setSelectedSizeId] = useState<string>("");

  // Persist batch to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("calculator-batch", JSON.stringify(batchItems));
    }
  }, [batchItems]);

  // Load all data
  async function loadData() {
    setLoading(true);
    const [
      containersRes,
      oilsRes,
      wicksRes,
      scentsRes,
      settingsRes,
      typesRes,
      productsRes,
    ] = await Promise.all([
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const results =
    waterOz > 0 && selectedScent
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
  const [newWick, setNewWick] = useState<Partial<WickType>>({
    name: "",
    costPerWick: 0,
    appearAs: "",
  });

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
    const nextSku = computeNextSku(allSkus);

    // Create product name suggestion following "Bottle Type Alcohol Type Candle" convention
    // For now, just use container name + "Candle" since we don't have alcohol type at this stage
    const containerName = selectedContainer?.name || "Custom";
    const productName = `${containerName} Candle`;

    // Build wick types from selected wicks using their appearAs field
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

    // Remove duplicates (wicks with same appearAs → single entry)
    const uniqueWickTypes = Array.from(
      new Map(selectedWickTypes.map((w) => [w.id, w])).values()
    );

    // Build variant data with selected scent and initial stock of 1 (user can change in modal)
    const variantData: Record<string, { stock: number }> = {};
    if (uniqueWickTypes.length > 0) {
      for (const wickType of uniqueWickTypes) {
        const variantId = `${wickType.id}-${selectedScentId}`;
        variantData[variantId] = { stock: 1 };
      }
    }

    setInitialStock(1);
    setAddToBatchAfterCreate(true); // Reset to default (checked)
    setNewProduct({
      name: productName,
      slug: slugify(productName),
      sku: nextSku,
      price: 0,
      images: [],
      seoDescription: `Hand-poured candle in an upcycled ${containerName} bottle.`,
      stock: 0,
      alcoholType: "Other",
      materialCost: results.totalMaterialCost,
      visibleOnWebsite: true,
      containerId: selectedContainerId || undefined, // Auto-fill container from calculator
      variantConfig:
        uniqueWickTypes.length > 0
          ? { wickTypes: uniqueWickTypes, variantData }
          : undefined,
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
          image:
            newProduct.images?.length === 0 && uploadedUrls.length > 0
              ? uploadedUrls[0]
              : newProduct.image,
        });
      }
    } catch (error) {
      await showAlert(
        `Upload failed: ${error instanceof Error ? error.message : "Network error"}`,
        "Upload Error"
      );
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

      // Add to batch if checkbox is checked
      if (addToBatchAfterCreate && results && selectedScent) {
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

        // Check if batch has different scent
        if (batchItems.length > 0 && batchItems[0].scentId !== selectedScentId) {
          const shouldClear = await showConfirm(
            `Current batch contains ${batchItems[0].scentName}. Start a new batch with ${scentName}?`,
            "Different Scent Detected"
          );
          if (shouldClear) {
            setBatchItems([newItem]);
          }
        } else {
          setBatchItems([...batchItems, newItem]);
        }
      }

      setShowProductModal(false);
      setNewProduct(null);
      setAddToBatchAfterCreate(true); // Reset to default
      // Reload products list to show the new product
      await loadData();
    } else {
      const error = await res.json();
      await showAlert(
        `Failed to create product: ${error.error || "Unknown error"}`,
        "Error"
      );
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

    if (batchItems.length > 0 && batchItems[0].scentId !== selectedScentId) {
      const shouldClear = await showConfirm(
        `Current batch contains ${batchItems[0].scentName}. Start a new batch with ${scentName}?`,
        "Different Scent Detected"
      );
      if (shouldClear) setBatchItems([newItem]);
      return;
    }

    setBatchItems([...batchItems, newItem]);
  }

  async function clearBatch() {
    if (batchItems.length > 0) {
      const confirmed = await showConfirm("Clear all items from batch?", "Confirm Clear");
      if (confirmed) setBatchItems([]);
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

  // Build combo items
  const containerItems = useMemo(() => {
    const base: Array<ComboItem<string>> = [
      {
        value: "",
        label: "Custom / No Container",
        sublabel: "Type your own water capacity below",
      },
      ...containers.map((c) => ({
        value: c.id,
        label: `${c.name}`,
        sublabel: `${c.capacityWaterOz}oz • ${c.shape}${
          c.supplier ? ` • ${c.supplier}` : ""
        } • $${c.costPerUnit.toFixed(2)}`,
      })),
    ];

    return base;
  }, [containers]);

  const addContainerItem: ComboItem<string> = {
    value: "__add__",
    label: "+ Add Container",
    sublabel: "Jump to Containers tab",
  };

  const scentItems = useMemo(() => {
    return scents.map((s) => ({
      value: s.id,
      label: s.name,
      sublabel: `ID: ${s.id}`,
    }));
  }, [scents]);

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
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {batchItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-[var(--color-background)] p-2 rounded text-xs"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{item.containerName}</div>
                            <div className="text-[var(--color-muted)] truncate">
                              {item.scentName}
                            </div>
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
                        <span className="font-medium">
                          {batchTotals.fragranceOz.toFixed(2)} oz
                        </span>
                      </div>

                      {Object.keys(batchBaseOilTotals).length > 0 && (
                        <div className="mt-2 pt-2 border-t border-[var(--color-line)]">
                          <div className="font-medium mb-1">Base Oils Needed:</div>
                          {Object.entries(batchBaseOilTotals).map(([oilId, oz]) => {
                            const oil = baseOils.find((o) => o.id === oilId);
                            return oil ? (
                              <div
                                key={oilId}
                                className="flex justify-between text-[var(--color-muted)]"
                              >
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

              {/* Container ComboBox */}
              <div className="mb-6">
                <ComboBox
                  id="container-combobox"
                  label="Container"
                  placeholder="Search containers..."
                  value={selectedContainerId}
                  items={containerItems}
                  emptyMessage="No containers match your search."
                  alwaysShowItem={addContainerItem}
                  onChange={(val) => {
                    setWickCounts({});
                    if (val === "__add__") {
                      setActiveTab("containers");
                      setSelectedContainerId("");
                      return;
                    }
                    setSelectedContainerId(val);
                  }}
                />
              </div>

              {/* Custom Water Oz (if no container selected) */}
              {!selectedContainerId && (
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2">Water Capacity (oz)</label>
                  <input
                    type="number"
                    className="input"
                    value={customWaterOz || ""}
                    onChange={(e) =>
                      setCustomWaterOz(e.target.value === "" ? 0 : Number(e.target.value))
                    }
                    step="0.1"
                    placeholder="0"
                    inputMode="decimal"
                  />
                </div>
              )}

              {/* Scent ComboBox */}
              <div className="mb-6">
                <ComboBox
                  id="scent-combobox"
                  label="Scent"
                  placeholder="Search scents..."
                  value={selectedScentId}
                  items={[
                    { value: "", label: "Select a scent…", sublabel: "Required to calculate" },
                    ...scentItems,
                  ]}
                  emptyMessage="No scents match your search."
                  onChange={(val) => setSelectedScentId(val)}
                />

                {selectedScent && (
                  <div className="mt-3">
                    <p className="text-sm text-[var(--color-muted)]">
                      Scent cost: ${scentCostPerOz.toFixed(2)}/oz
                    </p>

                    {selectedScent.composition &&
                      selectedScent.composition.length > 0 &&
                      waterOz > 0 && (
                        <div className="mt-2 p-3 bg-[var(--color-background)] rounded-lg border border-[var(--color-line)]">
                          <div className="text-xs font-medium text-[var(--color-muted)] mb-2">
                            Base Oil Recipe ({(settings.defaultFragranceLoad * 100).toFixed(1)}%
                            fragrance load):
                          </div>
                          <div className="space-y-1.5">
                            {selectedScent.composition.map((comp, idx) => {
                              const baseOil = baseOils.find((o) => o.id === comp.baseOilId);
                              const waxOzCalc = waterOz * settings.waterToWaxRatio;
                              const totalFragranceOz = waxOzCalc * settings.defaultFragranceLoad;
                              const baseOilOz = totalFragranceOz * (comp.percentage / 100);

                              return (
                                <div key={idx} className="flex justify-between items-center text-sm">
                                  <span className="flex-1">
                                    {baseOil?.name || comp.baseOilId}
                                  </span>
                                  <div className="flex items-center gap-3">
                                    <span className="text-[var(--color-muted)] text-xs">
                                      {comp.percentage}%
                                    </span>
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
                                {(
                                  waterOz *
                                  settings.waterToWaxRatio *
                                  settings.defaultFragranceLoad
                                ).toFixed(3)}{" "}
                                oz
                              </span>
                            </div>
                            <div className="flex justify-between text-xs font-medium">
                              <span>Total Wax:</span>
                              <span>{(waterOz * settings.waterToWaxRatio).toFixed(2)} oz</span>
                            </div>
                          </div>
                        </div>
                      )}

                    {selectedScent.composition &&
                      selectedScent.composition.length > 0 &&
                      waterOz === 0 && (
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

                    {selectedScent.costPerOz !== undefined &&
                      !selectedScent.composition && (
                        <p className="text-xs text-[var(--color-muted)] mt-1 italic">
                          Using direct cost (no composition)
                        </p>
                      )}
                  </div>
                )}
              </div>

              {/* Wick Selection */}
              <div className="mb-6">
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
                          inputMode="numeric"
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
                      <div className="text-lg font-semibold">
                        {results.fragranceOz.toFixed(2)} oz
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-[var(--color-muted)]">Total cost</div>
                      <div className="text-lg font-semibold">
                        ${results.totalMaterialCost.toFixed(2)}
                      </div>
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
                        <span>
                          Wax ({results.waxOz.toFixed(2)} oz × $
                          {settings.waxCostPerOz.toFixed(3)}/oz)
                        </span>
                        <span className="font-medium">${results.waxCost.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>
                          Fragrance ({results.fragranceOz.toFixed(2)} oz × $
                          {scentCostPerOz.toFixed(2)}/oz)
                        </span>
                        <span className="font-medium">${results.fragranceCost.toFixed(2)}</span>
                      </div>

                      {selectedScent?.composition && selectedScent.composition.length > 0 && (
                        <div className="ml-4 space-y-1 text-xs text-[var(--color-muted)] border-l-2 border-[var(--color-line)] pl-2 mt-1">
                          {selectedScent.composition.map((comp) => {
                            const baseOil = baseOils.find((oil) => oil.id === comp.baseOilId);
                            const oilOz = results.fragranceOz * (comp.percentage / 100);
                            return baseOil ? (
                              <div key={comp.baseOilId} className="flex justify-between">
                                <span>
                                  ↳ {baseOil.name} ({comp.percentage}%)
                                </span>
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
                        onClick={() => {
                          setAddToBatchAfterCreate(true); // Reset to default (checked)
                          setShowExistingProductModal(true);
                        }}
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
                    setNewContainer({
                      ...newContainer,
                      capacityWaterOz: e.target.value === "" ? 0 : Number(e.target.value),
                    })
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
                    setNewContainer({
                      ...newContainer,
                      costPerUnit: e.target.value === "" ? 0 : Number(e.target.value),
                    })
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
                void saveContainer({
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
                <div
                  key={c.id}
                  className="flex items-center justify-between p-3 border border-[var(--color-line)] rounded"
                >
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-sm text-[var(--color-muted)]">
                      {c.capacityWaterOz}oz • {c.shape} • ${c.costPerUnit.toFixed(2)}
                      {c.supplier && ` • ${c.supplier}`}
                    </div>
                  </div>
                  <button className="btn text-sm" onClick={() => void deleteContainer(c.id)}>
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
                  onChange={(e) =>
                    setNewWick({
                      ...newWick,
                      costPerWick: e.target.value === "" ? 0 : Number(e.target.value),
                    })
                  }
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
                void saveWick({
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
                    <div className="p-3 border border-[var(--color-line)] rounded bg-[var(--color-background)]">
                      <div className="space-y-3">
                        <label className="block">
                          <div className="text-xs font-medium mb-1">Name</div>
                          <input
                            className="input text-sm"
                            value={editingWick.name}
                            onChange={(e) =>
                              setEditingWick({ ...editingWick, name: e.target.value })
                            }
                          />
                        </label>
                        <label className="block">
                          <div className="text-xs font-medium mb-1">Cost per Wick ($)</div>
                          <input
                            className="input text-sm"
                            type="number"
                            step="0.01"
                            value={editingWick.costPerWick || ""}
                            onChange={(e) =>
                              setEditingWick({
                                ...editingWick,
                                costPerWick: e.target.value === "" ? 0 : Number(e.target.value),
                              })
                            }
                          />
                        </label>
                        <label className="block">
                          <div className="text-xs font-medium mb-1">Appear As</div>
                          <input
                            className="input text-sm"
                            placeholder="e.g., Standard, Wavy Wood Wick"
                            value={editingWick.appearAs || ""}
                            onChange={(e) =>
                              setEditingWick({ ...editingWick, appearAs: e.target.value })
                            }
                          />
                        </label>
                        <div className="flex gap-2">
                          <button
                            className="btn btn-primary text-sm"
                            onClick={() => {
                              if (
                                editingWick.id &&
                                editingWick.name &&
                                editingWick.costPerWick !== undefined
                              ) {
                                void saveWick(editingWick as WickType);
                              }
                            }}
                          >
                            Save
                          </button>
                          <button className="btn text-sm" onClick={() => setEditingWick(null)}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 border border-[var(--color-line)] rounded">
                      <div>
                        <div className="font-medium">{w.name}</div>
                        <div className="text-sm text-[var(--color-muted)]">
                          ${w.costPerWick.toFixed(2)}/wick
                          {w.appearAs ? (
                            <span className="ml-2">
                              • Appears as:{" "}
                              <span className="font-medium">{w.appearAs}</span>
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
                        <button className="btn text-sm" onClick={() => void deleteWick(w.id)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {wicks.length === 0 && <p className="text-[var(--color-muted)]">No wick types yet</p>}
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
                  setSettings({
                    ...settings,
                    waxCostPerOz: e.target.value === "" ? 0 : Number(e.target.value),
                  })
                }
                step="0.001"
                placeholder="0.219"
                inputMode="decimal"
              />
              <p className="text-xs text-[var(--color-muted)] mt-1">
                Current: ${settings.waxCostPerOz.toFixed(3)}/oz (≈ $
                {(settings.waxCostPerOz * 720).toFixed(2)} for 45 lbs)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Water to Wax Ratio</label>
              <input
                className="input"
                type="number"
                value={settings.waterToWaxRatio || ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    waterToWaxRatio: e.target.value === "" ? 0 : Number(e.target.value),
                  })
                }
                step="0.01"
                placeholder="0.9"
                inputMode="decimal"
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
                  setSettings({
                    ...settings,
                    defaultFragranceLoad: e.target.value === "" ? 0 : Number(e.target.value) / 100,
                  })
                }
                step="1"
                min="0"
                max="100"
                placeholder="8"
                inputMode="numeric"
              />
              <p className="text-xs text-[var(--color-muted)] mt-1">
                {(settings.defaultFragranceLoad * 100).toFixed(1)}% fragrance by weight of wax
              </p>
            </div>

            <button className="btn btn-primary" onClick={() => void saveSettings()}>
              Save Settings
            </button>
          </div>
        </div>
      )}

      {/* Product Creation Modal */}
      {showProductModal && newProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div
            className="absolute inset-0"
            onClick={() => {
              setShowProductModal(false);
              setNewProduct(null);
            }}
          />

          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-gradient-to-r from-neutral-50 to-white">
              <div>
                <h2 className="text-xl font-semibold text-[var(--color-ink)]">
                  Create Product from Calculation
                </h2>
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

            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 min-h-0">
              <label className="block">
                <div className="text-sm font-medium mb-2">Product Name</div>
                <input
                  className="input"
                  value={newProduct.name}
                  onChange={(e) => {
                    const name = e.target.value;
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
                    onChange={(e) =>
                      setNewProduct({
                        ...newProduct,
                        price: e.target.value === "" ? 0 : Number(e.target.value),
                      })
                    }
                    placeholder="24.99"
                    required
                    inputMode="decimal"
                  />
                </label>
              </div>

              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-sm font-medium text-green-900">
                  Material Cost: ${newProduct.materialCost?.toFixed(2) || "0.00"}
                </div>
                {newProduct.price && newProduct.price > 0 && newProduct.materialCost && (
                  <div className="text-xs text-green-700 mt-1">
                    Profit: ${(newProduct.price - newProduct.materialCost).toFixed(2)} (
                    {(((newProduct.price - newProduct.materialCost) / newProduct.price) * 100).toFixed(1)}% margin)
                  </div>
                )}
              </div>

              <div className="block">
                <div className="text-sm font-medium mb-2">Product Images</div>
                <label className="btn cursor-pointer w-full">
                  + Add Images
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                </label>

                {newProduct.images && newProduct.images.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {newProduct.images.map((img, idx) => (
                      <div
                        key={idx}
                        className="relative aspect-square rounded-lg overflow-hidden bg-white border border-[var(--color-line)]"
                      >
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

              <label className="block">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Stripe Price ID (optional)</span>
                  {!newProduct.stripePriceId && (
                    <button
                      type="button"
                      className="text-xs text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
                      onClick={async () => {
                        if (!newProduct.name || !newProduct.name.trim()) {
                          await showAlert("Please enter a product name first", "Validation Error");
                          return;
                        }
                        if (!newProduct.price || newProduct.price <= 0) {
                          await showAlert("Please enter a valid price first", "Validation Error");
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

                          setNewProduct({ ...newProduct, stripePriceId: data.priceId });

                          await showAlert(
                            `Stripe product created successfully!\n\nProduct ID: ${data.productId}\nPrice ID: ${data.priceId}`,
                            "Success"
                          );
                        } catch (error) {
                          console.error("[Create Stripe Product] Error:", error);
                          await showAlert(
                            error instanceof Error ? error.message : "Failed to create Stripe product",
                            "Error"
                          );
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

              <label className="block">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Square Catalog ID (optional)</span>
                  {!newProduct.squareCatalogId && (
                    <button
                      type="button"
                      className="text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
                      onClick={async () => {
                        if (!newProduct.name || !newProduct.name.trim()) {
                          await showAlert("Please enter a product name first", "Validation Error");
                          return;
                        }
                        if (!newProduct.price || newProduct.price <= 0) {
                          await showAlert("Please enter a valid price first", "Validation Error");
                          return;
                        }

                        try {
                          setSavingProduct(true);
                          const res = await fetch("/api/admin/create-square-product", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              name: newProduct.name,
                              price: newProduct.price,
                              description: newProduct.seoDescription,
                            }),
                          });

                          const data = await res.json();

                          if (!res.ok) {
                            throw new Error(data.details || data.error || "Failed to create Square product");
                          }

                          // API returns catalogItemId, not catalogId
                          setNewProduct({ ...newProduct, squareCatalogId: data.catalogItemId });

                          await showAlert(
                            `Square product created successfully!\n\nCatalog ID: ${data.catalogItemId}`,
                            "Success"
                          );
                        } catch (error) {
                          console.error("[Create Square Product] Error:", error);
                          await showAlert(
                            error instanceof Error ? error.message : "Failed to create Square product",
                            "Error"
                          );
                        } finally {
                          setSavingProduct(false);
                        }
                      }}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Create Square Product
                    </button>
                  )}
                </div>
                <input
                  className="input"
                  value={newProduct.squareCatalogId || ""}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, squareCatalogId: e.target.value || undefined })
                  }
                  placeholder="Click 'Create Square Product' or paste manually"
                />
              </label>

              <div className="block">
                <ComboBox
                  id="product-container-combobox"
                  label="Container (for description)"
                  placeholder="Search containers..."
                  value={newProduct.containerId || ""}
                  items={[
                    { value: "", label: "— Select container —", sublabel: "Optional" },
                    ...containers.map((c) => ({
                      value: c.id,
                      label: c.name,
                      sublabel: `${c.capacityWaterOz} oz water • ${c.shape}`,
                    })),
                  ]}
                  emptyMessage="No containers match your search."
                  onChange={(val) =>
                    setNewProduct({ ...newProduct, containerId: val || undefined })
                  }
                />
              </div>

              <label className="block">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">SEO Description</span>
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    onClick={() => {
                      if (!newProduct.name) return;
                      const container = containers.find((c) => c.id === newProduct.containerId);
                      const bottleName = newProduct.name.replace(/\s+Candle$/i, "").trim();
                      let waxOzText = "[Select container to calculate]";
                      if (container) {
                        const waxOzCalc = container.capacityWaterOz * settings.waterToWaxRatio;
                        waxOzText = `${Math.round(waxOzCalc)} oz wax`;
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

              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newProduct.visibleOnWebsite !== false}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, visibleOnWebsite: e.target.checked })
                    }
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
                  inputMode="numeric"
                />
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  How many units you have in stock for each variant
                </p>
              </label>

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
                    Stock per variant: {initialStock} unit{initialStock !== 1 ? "s" : ""}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-200 bg-neutral-50">
              <button
                className="btn hover:bg-white transition-colors"
                onClick={() => {
                  setShowProductModal(false);
                  setNewProduct(null);
                  setAddToBatchAfterCreate(true); // Reset to default
                }}
              >
                Cancel
              </button>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addToBatchAfterCreate}
                    onChange={(e) => setAddToBatchAfterCreate(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span>Add to batch after creating</span>
                </label>
                <button
                  className="btn btn-primary"
                  onClick={() => void saveProduct()}
                  disabled={
                    savingProduct ||
                    !newProduct.name ||
                    !newProduct.slug ||
                    !newProduct.price ||
                    newProduct.price <= 0
                  }
                >
                  {savingProduct ? "Creating..." : "Create Product"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add to Existing Product Modal */}
      {showExistingProductModal && results && selectedScent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div
            className="absolute inset-0"
            onClick={() => {
              setShowExistingProductModal(false);
              setProductSearch("");
            }}
          />

          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-gradient-to-r from-neutral-50 to-white">
              <div>
                <h2 className="text-xl font-semibold text-[var(--color-ink)]">
                  Add to Existing Product
                </h2>
                <p className="text-sm text-[var(--color-muted)] mt-0.5">
                  Select a product to add this scent/wick combination
                </p>
              </div>
              <button
                className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                onClick={() => {
                  setShowExistingProductModal(false);
                  setProductSearch("");
                }}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 min-h-0">
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                <div className="font-medium text-blue-900">Adding:</div>
                <div className="text-blue-700">
                  Scent: {selectedScent.name}
                  {Object.entries(wickCounts).some(([_, count]) => count > 0) && (
                    <div className="mt-1">
                      Wicks:{" "}
                      {Object.entries(wickCounts)
                        .filter(([_, count]) => count > 0)
                        .map(([wickId, count]) => {
                          const wick = wicks.find((w) => w.id === wickId);
                          return wick ? `${wick.name} (${count})` : "";
                        })
                        .filter(Boolean)
                        .join(", ")}
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-muted)]" />
                  <input
                    type="text"
                    className="input w-full !pl-10"
                    placeholder="Search products by name or SKU..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    inputMode="search"
                  />
                </div>
              </div>

              <div className="space-y-2">
                {(() => {
                  const filteredProducts = allProducts.filter(
                    (product) =>
                      product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                      product.sku.toLowerCase().includes(productSearch.toLowerCase())
                  );

                  if (filteredProducts.length === 0) {
                    return (
                      <div className="text-center py-8 text-[var(--color-muted)]">
                        {allProducts.length === 0
                          ? "No products found. Create a new product first."
                          : "No products match your search."}
                      </div>
                    );
                  }

                  return filteredProducts.map((product) => (
                    <button
                      key={product.slug}
                      onClick={async () => {
                        // Check if product has sizes
                        const hasSizes = product.variantConfig?.sizes && product.variantConfig.sizes.length > 0;

                        if (hasSizes) {
                          // Show size selector
                          setSelectedProductForSize(product);
                          setSelectedSizeId(product.variantConfig!.sizes![0].id); // Default to first size
                          return;
                        }

                        // No sizes - proceed with adding variant
                        const selectedWickTypes = Object.entries(wickCounts)
                          .filter(([_, count]) => count > 0)
                          .map(([wickId, count]) => {
                            const wick = wicks.find((w) => w.id === wickId);
                            if (!wick) return null;
                            const displayName = wick.appearAs || wick.name;
                            const variantId = (wick.appearAs || wick.name)
                              .toLowerCase()
                              .replace(/\s+/g, "-")
                              .replace(/[^a-z0-9-]/g, "");
                            return { id: variantId, name: displayName, count };
                          })
                          .filter((w) => w !== null) as Array<{ id: string; name: string; count: number }>;

                        const uniqueWickTypes = Array.from(
                          new Map(selectedWickTypes.map((w) => [w.id, w])).values()
                        );

                        const updatedVariantConfig =
                          product.variantConfig || { wickTypes: [], variantData: {} };

                        const existingWickIds = new Set(
                          updatedVariantConfig.wickTypes.map((w) => w.id)
                        );
                        uniqueWickTypes.forEach((wick) => {
                          if (!existingWickIds.has(wick.id)) {
                            updatedVariantConfig.wickTypes.push({ id: wick.id, name: wick.name });
                          }
                        });

                        uniqueWickTypes.forEach((wickType) => {
                          const variantId = `${wickType.id}-${selectedScentId}`;
                          if (updatedVariantConfig.variantData[variantId]) {
                            updatedVariantConfig.variantData[variantId].stock += wickType.count;
                          } else {
                            updatedVariantConfig.variantData[variantId] = { stock: wickType.count };
                          }
                        });

                        const res = await fetch(`/api/admin/products/${product.slug}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ variantConfig: updatedVariantConfig }),
                        });

                        if (res.ok) {
                          await showAlert(
                            `Added ${selectedScent.name} variant to ${product.name}`,
                            "Success"
                          );

                          // Add to batch if checkbox is checked
                          if (addToBatchAfterCreate && results && selectedScent) {
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

                            // Check if batch has different scent
                            if (batchItems.length > 0 && batchItems[0].scentId !== selectedScentId) {
                              const shouldClear = await showConfirm(
                                `Current batch contains ${batchItems[0].scentName}. Start a new batch with ${scentName}?`,
                                "Different Scent Detected"
                              );
                              if (shouldClear) {
                                setBatchItems([newItem]);
                              }
                            } else {
                              setBatchItems([...batchItems, newItem]);
                            }
                          }

                          setShowExistingProductModal(false);
                          setProductSearch("");
                          setAddToBatchAfterCreate(true); // Reset to default
                          void loadData();
                        } else {
                          const error = await res.json();
                          await showAlert(`Failed: ${error.error || "Unknown error"}`, "Error");
                        }
                      }}
                      className="w-full text-left p-4 border-2 border-[var(--color-line)] rounded-xl hover:border-[var(--color-accent)] hover:bg-amber-50/30 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-base group-hover:text-[var(--color-accent)] transition-colors">
                            {product.name}
                          </div>
                          <div className="text-sm text-[var(--color-muted)] mt-1">
                            SKU: {product.sku} | Price: ${product.price.toFixed(2)}
                          </div>
                          {product.variantConfig && (
                            <div className="text-xs text-[var(--color-muted)] mt-1">
                              Wicks: {product.variantConfig.wickTypes.map((w) => w.name).join(", ")}
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
                  ));
                })()}
              </div>
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-200 bg-neutral-50">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={addToBatchAfterCreate}
                  onChange={(e) => setAddToBatchAfterCreate(e.target.checked)}
                  className="w-4 h-4"
                />
                <span>Add to batch after adding variant</span>
              </label>
              <button
                onClick={() => {
                  setShowExistingProductModal(false);
                  setProductSearch("");
                  setAddToBatchAfterCreate(true); // Reset to default
                }}
                className="btn hover:bg-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Size Selector Modal (for products with multiple sizes) */}
      {selectedProductForSize && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div
            className="absolute inset-0"
            onClick={() => {
              setSelectedProductForSize(null);
              setSelectedSizeId("");
            }}
          />

          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl p-6">
            <h3 className="text-lg font-semibold mb-4">Select Size</h3>
            <p className="text-sm text-[var(--color-muted)] mb-4">
              {selectedProductForSize.name} has multiple sizes. Please select which size to add stock to:
            </p>

            <div className="space-y-2 mb-6">
              {selectedProductForSize.variantConfig?.sizes?.map((size) => (
                <button
                  key={size.id}
                  onClick={() => setSelectedSizeId(size.id)}
                  className={`w-full px-4 py-3 rounded-lg border-2 text-left transition ${
                    selectedSizeId === size.id
                      ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-ink)]"
                      : "border-[var(--color-line)] hover:border-[var(--color-accent)]"
                  }`}
                >
                  <div className="font-semibold">{size.name}</div>
                  <div className="text-xs mt-0.5">${(size.priceCents / 100).toFixed(2)}</div>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSelectedProductForSize(null);
                  setSelectedSizeId("");
                }}
                className="flex-1 btn hover:bg-white"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!selectedSizeId || !selectedProductForSize) return;

                  const product = selectedProductForSize;

                  // Build wick types with counts
                  const selectedWickTypes = Object.entries(wickCounts)
                    .filter(([_, count]) => count > 0)
                    .map(([wickId, count]) => {
                      const wick = wicks.find((w) => w.id === wickId);
                      if (!wick) return null;
                      const displayName = wick.appearAs || wick.name;
                      const variantId = (wick.appearAs || wick.name)
                        .toLowerCase()
                        .replace(/\s+/g, "-")
                        .replace(/[^a-z0-9-]/g, "");
                      return { id: variantId, name: displayName, count };
                    })
                    .filter((w) => w !== null) as Array<{ id: string; name: string; count: number }>;

                  const uniqueWickTypes = Array.from(
                    new Map(selectedWickTypes.map((w) => [w.id, w])).values()
                  );

                  const updatedVariantConfig =
                    product.variantConfig || { wickTypes: [], variantData: {} };

                  // Add wick types if they don't exist
                  const existingWickIds = new Set(
                    updatedVariantConfig.wickTypes.map((w) => w.id)
                  );
                  uniqueWickTypes.forEach((wick) => {
                    if (!existingWickIds.has(wick.id)) {
                      updatedVariantConfig.wickTypes.push({ id: wick.id, name: wick.name });
                    }
                  });

                  // Add or update variant data WITH SIZE
                  uniqueWickTypes.forEach((wickType) => {
                    const variantId = `${selectedSizeId}-${wickType.id}-${selectedScentId}`;
                    if (updatedVariantConfig.variantData[variantId]) {
                      updatedVariantConfig.variantData[variantId].stock += wickType.count;
                    } else {
                      updatedVariantConfig.variantData[variantId] = { stock: wickType.count };
                    }
                  });

                  const res = await fetch(`/api/admin/products/${product.slug}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ variantConfig: updatedVariantConfig }),
                  });

                  if (res.ok) {
                    const sizeName = product.variantConfig?.sizes?.find(s => s.id === selectedSizeId)?.name || selectedSizeId;
                    await showAlert(
                      `Added ${selectedScent?.name} (${sizeName}) variant to ${product.name}`,
                      "Success"
                    );

                    // Add to batch if checkbox is checked
                    if (addToBatchAfterCreate && results && selectedScent) {
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

                      // Check if batch has different scent
                      if (batchItems.length > 0 && batchItems[0].scentId !== selectedScentId) {
                        const shouldClear = await showConfirm(
                          `Current batch contains ${batchItems[0].scentName}. Start a new batch with ${scentName}?`,
                          "Different Scent Detected"
                        );
                        if (shouldClear) {
                          setBatchItems([newItem]);
                        }
                      } else {
                        setBatchItems([...batchItems, newItem]);
                      }
                    }

                    setSelectedProductForSize(null);
                    setSelectedSizeId("");
                    setShowExistingProductModal(false);
                    setProductSearch("");
                    setAddToBatchAfterCreate(true);
                    void loadData();
                  } else {
                    const error = await res.json();
                    await showAlert(`Failed: ${error.error || "Unknown error"}`, "Error");
                  }
                }}
                disabled={!selectedSizeId}
                className="flex-1 btn btn-primary"
              >
                Add to Product
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}