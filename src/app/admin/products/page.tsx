"use client";

import { useEffect, useMemo, useState, useRef, useCallback, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { useModal } from "@/hooks/useModal";
import QRCode from "qrcode";
import * as XLSX from "xlsx";

/* ---------- Types ---------- */
type AlcoholType = { id: string; name: string; sortOrder?: number };

type Container = {
  id: string;
  name: string;
  capacityWaterOz: number;
  shape: string;
  supplier?: string;
  costPerUnit: number;
  notes?: string;
};

type CalculatorSettings = {
  waxCostPerOz: number;
  waterToWaxRatio: number;
  defaultFragranceLoad: number;
};

type WickType = {
  id: string;
  name: string;
};

type GlobalScent = {
  id: string;
  name: string;
  limited: boolean;
  enabledProducts?: string[];
  sortOrder?: number;
};

type ProductSize = {
  id: string;
  name: string;
  ozs: number;
  priceCents: number;
  stripePriceId?: string;
};

type VariantConfig = {
  sizes?: ProductSize[];
  wickTypes: WickType[];
  // scents are now global - not stored per product
  variantData: Record<string, { stock: number }>;
};

type Product = {
  slug: string;
  name: string;
  price: number;
  image?: string;
  images?: string[]; // Multiple images support
  sku: string;
  stripePriceId?: string;
  squareCatalogId?: string; // Square Catalog Item ID for POS integration
  squareVariantMapping?: Record<string, string>; // Maps website variantId to Square variation ID
  seoDescription: string;
  bestSeller?: boolean;
  youngDumb?: boolean;
  stock: number;
  variantConfig?: VariantConfig;
  alcoholType?: string;
  materialCost?: number; // Cost to make the product (from calculator)
  visibleOnWebsite?: boolean; // Controls shop page visibility
  containerId?: string; // Reference to container used for this product
  weight?: { value: number; units: "ounces" | "pounds" }; // Product weight for shipping
  dimensions?: { length: number; width: number; height: number; units: "inches" }; // Package dimensions for shipping
};

type SquareSyncResult = {
  productSlug: string;
  success: boolean;
  error?: string;
};

type SyncSquareStockResponse = {
  message: string;
  successCount: number;
  errorCount: number;
  results?: SquareSyncResult[];
};

/* ---------- Helpers ---------- */
function emptyProduct(): Product {
  return {
    slug: "",
    name: "",
    price: 0,
    image: "",
    images: [],
    sku: "",
    stripePriceId: "",
    squareCatalogId: "",
    seoDescription: "",
    bestSeller: false,
    youngDumb: false,
    stock: 0,
    alcoholType: "Other", // NEW default
    visibleOnWebsite: true, // Default to visible
    variantConfig: {
      wickTypes: [{ id: "standard", name: "Standard Wick" }],
      variantData: {},
    },
  };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** parse "DCW-0015" -> { prefix: "DCW-", num: 15, width: 4 } */
function parseSku(sku: string) {
  const m = sku.match(/^([A-Za-z]+-?)(\d+)$/);
  if (!m) return { prefix: "DCW-", num: 0, width: 4 };
  return { prefix: m[1], num: Number(m[2]), width: m[2].length };
}

/** From existing items + staged drafts, compute next SKU like DCW-0016 */
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

function getTotalStock(p: Product): number {
  if (p.variantConfig) {
    const { variantData } = p.variantConfig;
    let total = 0;
    for (const data of Object.values(variantData)) {
      total += data.stock ?? 0;
    }
    return total;
  }
  return p.stock ?? 0;
}

function generateVariantsForDisplay(p: Product, globalScents: GlobalScent[]) {
  if (!p.variantConfig) return [];

  const { sizes, wickTypes, variantData } = p.variantConfig;
  const variants: Array<{
    id: string;
    sizeName?: string;
    wickName: string;
    scentName: string;
    stock: number;
  }> = [];

  // Filter scents based on limited flag and enabled products
  const availableScents = globalScents.filter((scent) => {
    if (!scent.limited) return true;
    return scent.enabledProducts?.includes(p.slug) ?? false;
  });

  const hasSizes = sizes && sizes.length > 0;

  if (hasSizes) {
    // Generate variants including sizes: size × wick × scent
    for (const size of sizes) {
      for (const wick of wickTypes) {
        for (const scent of availableScents) {
          const variantId = `${size.id}-${wick.id}-${scent.id}`;
          const data = variantData[variantId] || { stock: 0 };
          variants.push({
            id: variantId,
            sizeName: size.name,
            wickName: wick.name,
            scentName: scent.name,
            stock: data.stock,
          });
        }
      }
    }
  } else {
    // No sizes: wick × scent only
    for (const wick of wickTypes) {
      for (const scent of availableScents) {
        const variantId = `${wick.id}-${scent.id}`;
        const data = variantData[variantId] || { stock: 0 };
        variants.push({
          id: variantId,
          wickName: wick.name,
          scentName: scent.name,
          stock: data.stock,
        });
      }
    }
  }

  return variants;
}

/**
 * Auto-generate product description based on product name and container
 */
function generateDescription(
  productName: string,
  container: Container | undefined,
  waterToWaxRatio: number
): string {
  // Extract bottle name by removing " Candle" suffix
  const bottleName = productName.replace(/\s+Candle$/i, "").trim();

  // Calculate wax ounces if container is selected
  let waxOzText = "[Select container to calculate]";
  if (container) {
    const waxOz = container.capacityWaterOz * waterToWaxRatio;
    waxOzText = `${Math.round(waxOz)} oz wax`;
  }

  return `Hand-poured candle in an upcycled ${bottleName} bottle.

coco apricot creme™ candle wax

Approx. - ${waxOzText}`;
}

/* ---------- Searchable ComboBox Component ---------- */
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
  } = props;

  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selected = items.find((i) => i.value === value);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
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
    if (clearSearch) setQuery("");
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function commitSelection(idx: number) {
    const item = filtered[idx];
    if (!item || item.disabled) return;
    onChange(item.value);
    setOpen(false);
    setQuery("");
  }

  const inputDisplayValue = open ? query : selected?.label || "";

  return (
    <div ref={rootRef} className={`w-full ${className}`}>
      <label htmlFor={id} className="block text-xs mb-1">
        {label}
      </label>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-muted)] pointer-events-none" />

        <input
          id={id}
          ref={inputRef}
          className="input w-full !pl-10 !pr-10"
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
              {filtered.length === 0 ? (
                <div className="px-4 py-3 text-sm text-[var(--color-muted)]">
                  {emptyMessage}
                </div>
              ) : (
                filtered.map((item, idx) => {
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
                        isActive ? "bg-[var(--color-accent-light)]" : "",
                        isSelected ? "font-medium" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => commitSelection(idx)}
                      onMouseEnter={() => setActiveIndex(idx)}
                    >
                      <div className="text-sm">{item.label}</div>
                      {item.sublabel && (
                        <div className="text-xs text-[var(--color-muted)] mt-0.5">
                          {item.sublabel}
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Component ---------- */
export default function AdminProductsPage() {
  const { showAlert, showConfirm, showPrompt } = useModal();
  const [items, setItems] = useState<Product[]>([]);
  const [globalScents, setGlobalScents] = useState<GlobalScent[]>([]);
  const [alcoholTypes, setAlcoholTypes] = useState<AlcoholType[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  const [settings, setSettings] = useState<CalculatorSettings>({
    waxCostPerOz: 0,
    waterToWaxRatio: 0.9,
    defaultFragranceLoad: 0.1,
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [priceInputStr, setPriceInputStr] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New filter and sort states
  const [visibleFilter, setVisibleFilter] = useState<"all" | "visible" | "hidden">("all");
  const [typeFilter, setTypeFilter] = useState<string[]>([]); // Changed to array for multi-select
  const [stockFilter, setStockFilter] = useState<"all" | "in-stock" | "out-of-stock">("all");
  const [bestFilter, setBestFilter] = useState<"all" | "best" | "not-best">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [sortBy, setSortBy] = useState<"name" | "price" | "cost" | "stock" | "best" | "status" | "none">("none");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);

  // Staged local drafts keyed by slug (full product objects)
  const [staged, setStaged] = useState<Record<string, Product>>({});
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);

  // QR code upload state
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrDataURL, setQRDataURL] = useState<string | null>(null);
  const [uploadToken, setUploadToken] = useState<string | null>(null);
  const [uploadedCount, setUploadedCount] = useState(0);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Avoid using `window` in render (client components can still prerender)
  const [origin, setOrigin] = useState<string>("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [productsRes, scentsRes, typesRes, containersRes, settingsRes] = await Promise.all([
        fetch("/api/admin/products", { cache: "no-store" }),
        fetch("/api/admin/scents", { cache: "no-store" }),
        fetch("/api/admin/alcohol-types?active=1", { cache: "no-store" }),
        fetch("/api/admin/containers", { cache: "no-store" }),
        fetch("/api/admin/calculator-settings", { cache: "no-store" }),
      ]);

      if (productsRes.ok) {
        const productsData = (await productsRes.json()) as { items?: Product[] };
        setItems(productsData.items || []);
      }

      if (scentsRes.ok) {
        const scentsData = (await scentsRes.json()) as { scents?: GlobalScent[] };
        setGlobalScents(scentsData.scents || []);
      }

      if (typesRes.ok) {
        const typesData = (await typesRes.json()) as { types?: AlcoholType[] };
        setAlcoholTypes(typesData.types || []);
      }

      if (containersRes.ok) {
        const containersData = (await containersRes.json()) as { containers?: Container[] };
        // eslint-disable-next-line no-console
        console.log("[Products] Loaded containers:", containersData.containers);
        setContainers(containersData.containers || []);
      } else {
        // eslint-disable-next-line no-console
        console.error("[Products] Failed to load containers:", await containersRes.text());
      }

      if (settingsRes.ok) {
        const settingsData = (await settingsRes.json()) as CalculatorSettings | { settings?: CalculatorSettings };
        // Handle settings response (could be direct object or wrapped)
        if ("waterToWaxRatio" in settingsData) {
          setSettings(settingsData as CalculatorSettings);
        } else if ("settings" in settingsData && settingsData.settings) {
          setSettings(settingsData.settings);
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[Products] Load error:", err);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  // Close type dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (typeDropdownOpen && !target.closest(".type-filter-dropdown")) {
        setTypeDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [typeDropdownOpen]);

  const isServerItem = useCallback((slug: string) => items.some((x) => x.slug === slug), [items]);
  const hasDraft = useCallback((slug: string) => staged[slug] !== undefined, [staged]);

  // merged view = server items overlayed with staged changes/new items
  const merged = useMemo(() => {
    const bySlug = new Map<string, Product>();
    for (const p of items) bySlug.set(p.slug, p);
    for (const [slug, p] of Object.entries(staged)) bySlug.set(slug, p);
    return Array.from(bySlug.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [items, staged]);

  const filtered = useMemo(() => {
    let result = [...merged];

    // Text search filter
    const q = filter.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (p) =>
          p.slug.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q)
      );
    }

    // Visible filter
    if (visibleFilter === "visible") {
      result = result.filter((p) => p.visibleOnWebsite !== false);
    } else if (visibleFilter === "hidden") {
      result = result.filter((p) => p.visibleOnWebsite === false);
    }

    // Type filter (multi-select)
    if (typeFilter.length > 0) {
      result = result.filter((p) => {
        const productType = p.alcoholType || "Other";
        return typeFilter.includes(productType);
      });
    }

    // Stock filter
    if (stockFilter === "in-stock") {
      result = result.filter((p) => getTotalStock(p) > 0);
    } else if (stockFilter === "out-of-stock") {
      result = result.filter((p) => getTotalStock(p) === 0);
    }

    // Best seller filter
    if (bestFilter === "best") {
      result = result.filter((p) => p.bestSeller === true);
    } else if (bestFilter === "not-best") {
      result = result.filter((p) => p.bestSeller !== true);
    }

    // Status filter
    if (statusFilter === "published") {
      result = result.filter((p) => !hasDraft(p.slug));
    } else if (statusFilter === "draft") {
      result = result.filter((p) => hasDraft(p.slug));
    }

    // Sorting
    if (sortBy !== "none") {
      result.sort((a, b) => {
        let comparison = 0;

        switch (sortBy) {
          case "name":
            comparison = a.name.localeCompare(b.name);
            break;
          case "price":
            comparison = a.price - b.price;
            break;
          case "cost":
            comparison = (a.materialCost || 0) - (b.materialCost || 0);
            break;
          case "stock":
            comparison = getTotalStock(a) - getTotalStock(b);
            break;
          case "best":
            comparison = (a.bestSeller ? 1 : 0) - (b.bestSeller ? 1 : 0);
            break;
          case "status":
            comparison = (hasDraft(a.slug) ? 1 : 0) - (hasDraft(b.slug) ? 1 : 0);
            break;
        }

        return sortDirection === "asc" ? comparison : -comparison;
      });
    }

    return result;
  }, [merged, filter, visibleFilter, typeFilter, stockFilter, bestFilter, statusFilter, sortBy, sortDirection, hasDraft]);

  /* ---------- Sorting Helper ---------- */

  function handleSort(column: typeof sortBy) {
    if (column === "none") return;

    if (sortBy === column) {
      // Toggle direction if clicking the same column
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // New column, default to ascending
      setSortBy(column);
      setSortDirection("asc");
    }
  }

  function SortableHeader({
    column,
    children,
    className = "",
  }: {
    column: typeof sortBy;
    children: ReactNode;
    className?: string;
  }) {
    if (column === "none") {
      return (
        <th className={`py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wide ${className}`}>
          {children}
        </th>
      );
    }

    const isActive = sortBy === column;
    const arrow = isActive ? (sortDirection === "asc" ? " ↑" : " ↓") : "";

    return (
      <th className={`py-3 ${className}`}>
        <button
          className="w-full text-xs font-semibold text-neutral-600 uppercase tracking-wide hover:text-[var(--color-accent)] transition-colors whitespace-nowrap"
          onClick={() => handleSort(column)}
        >
          {children}
          {arrow}
        </button>
      </th>
    );
  }

  /* ---------- CSV Export ---------- */

  function exportToCSV() {
    const headers = [
      "Name",
      "Slug",
      "SKU",
      "Price",
      "Material Cost",
      "Alcohol Type",
      "Stock (Total)",
      "Base Stock",
      "Visible on Website",
      "Best Seller",
      "Young & Dumb",
      "Status",
      "Stripe Price ID",
      "Description",
      "Has Variants",
      "Wick Types",
      "Variant Stock Details",
      "Weight (oz)",
      "Photo URLs",
    ];

    const rows = filtered.map((p) => {
      // Get wick types if product has variants
      const wickTypes = p.variantConfig?.wickTypes ? p.variantConfig.wickTypes.map((w) => w.name).join("; ") : "";

      // Get variant stock details
      let variantStockDetails = "";
      if (p.variantConfig) {
        const variants = generateVariantsForDisplay(p, globalScents);
        variantStockDetails = variants
          .filter((v) => v.stock > 0)
          .map((v) => `${v.wickName}/${v.scentName}: ${v.stock}`)
          .join("; ");
      }

      // Get weight in ounces
      const weightOz = p.weight ? (p.weight.units === "pounds" ? p.weight.value * 16 : p.weight.value).toString() : "";

      // Get photo URLs (semicolon-separated for multiple)
      const photoUrls = p.images && p.images.length > 0 ? p.images.join("; ") : (p.image || "");

      return [
        p.name,
        p.slug,
        p.sku || "",
        p.price.toFixed(2),
        p.materialCost ? p.materialCost.toFixed(2) : "",
        p.alcoholType || "Other",
        getTotalStock(p).toString(),
        p.stock.toString(),
        p.visibleOnWebsite !== false ? "Yes" : "No",
        p.bestSeller ? "Yes" : "No",
        p.youngDumb ? "Yes" : "No",
        hasDraft(p.slug) ? "Draft" : "Published",
        p.stripePriceId || "",
        p.seoDescription || "",
        p.variantConfig ? "Yes" : "No",
        wickTypes,
        variantStockDetails,
        weightOz,
        photoUrls,
      ];
    });

    const csvContent = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join(
      "\n"
    );

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `products-export-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /* ---------- TikTok Shop XLSX Export ---------- */

  function exportToTikTok() {
    // Define headers (row 1) - matching TikTok template column names
    const headers = [
      "category", "brand", "product_name", "product_description", "main_image",
      "image_2", "image_3", "image_4", "image_5", "image_6", "image_7", "image_8", "image_9",
      "gtin_type", "gtin_code",
      "property_name_1", "property_value_1",
      "property_1_image", "property_1_image_2", "property_1_image_3", "property_1_image_4",
      "property_1_image_5", "property_1_image_6", "property_1_image_7", "property_1_image_8", "property_1_image_9",
      "property_name_2", "property_value_2",
      "parcel_weight", "parcel_length", "parcel_width", "parcel_height",
      "delivery", "price", "list_price", "quantity", "seller_sku",
      "size_chart", "special_product_listing_type",
      "product_property/100198", "product_property/100392", "product_property/100398",
      "product_property/100443", "product_property/100548", "product_property/100628",
      "product_property/100701", "product_property/100779", "product_property/100875",
      "product_property/100903", "product_property/101619",
      "product_property/101395", "product_property/101398", "product_property/101400", "product_property/101397",
      "qualification/8647636475739801353", "aimed_product_status"
    ];

    // Helper: sanitize string for SKU
    const sanitize = (str: string): string => {
      return str
        .toLowerCase()
        .replace(/[\s/]+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
    };

    // Build data rows
    const rows: (string | number)[][] = [];

    for (const product of filtered) {
      // Get wicks from variantConfig or default
      const wicks: string[] =
        product.variantConfig?.wickTypes && product.variantConfig.wickTypes.length > 0
          ? product.variantConfig.wickTypes.map((w) => w.name)
          : ["Standard Wick"];

      // Get scents from variantData keys - extract unique scent IDs and look up names
      const scents: string[] = [];
      if (product.variantConfig?.variantData) {
        const scentIds = new Set<string>();
        for (const key of Object.keys(product.variantConfig.variantData)) {
          // Key format is "wickId-scentId" or "sizeId-wickId-scentId"
          const parts = key.split("-");
          const scentId = parts[parts.length - 1]; // Last part is always scent
          if (scentId) scentIds.add(scentId);
        }
        // Look up scent names from globalScents
        for (const scentId of scentIds) {
          const scent = globalScents.find((s) => s.id === scentId);
          if (scent) scents.push(scent.name);
        }
      }

      // If no scents, use empty string array (still generates rows for each wick)
      const effectiveScents = scents.length > 0 ? scents : [""];

      // Photo URLs
      const photoUrls = product.images && product.images.length > 0 ? product.images : product.image ? [product.image] : [];

      // Weight in pounds (convert from oz or default to 2.29)
      const weightLb = product.weight
        ? product.weight.units === "pounds"
          ? product.weight.value
          : Math.round((product.weight.value / 16) * 100) / 100
        : 2.29;

      // SKU base
      const skuBase = product.sku || sanitize(product.name);

      // Calculate total combinations for quantity distribution
      const comboCount = wicks.length * effectiveScents.length;

      // Build variant stock lookup if available
      const variantStock: Record<string, number> = {};
      if (product.variantConfig?.variantData) {
        // Map variantData keys to "wickName|scentName" format
        for (const [key, data] of Object.entries(product.variantConfig.variantData)) {
          const parts = key.split("-");
          const scentId = parts[parts.length - 1];
          const wickId = parts.length === 2 ? parts[0] : parts[1]; // Handle both "wick-scent" and "size-wick-scent"

          const wickType = product.variantConfig.wickTypes.find((w) => w.id === wickId);
          const scent = globalScents.find((s) => s.id === scentId);

          if (wickType && scent) {
            variantStock[`${wickType.name}|${scent.name}`] = data.stock;
          } else if (wickType && !scentId) {
            variantStock[`${wickType.name}|`] = data.stock;
          }
        }
      }

      // Calculate quantity distribution if no variant stock
      const totalStock = getTotalStock(product);
      const baseQty = Math.floor(totalStock / comboCount);
      const remainder = totalStock - baseQty * comboCount;
      let comboIndex = 0;

      // Generate one row per wick × scent combination
      for (const wick of wicks) {
        for (const scent of effectiveScents) {
          // Determine quantity
          let qty: number;
          const stockKey = `${wick}|${scent}`;
          if (variantStock[stockKey] !== undefined) {
            qty = variantStock[stockKey];
          } else {
            // Distribute evenly, first <remainder> rows get +1
            qty = baseQty + (comboIndex < remainder ? 1 : 0);
          }
          comboIndex++;

          // Generate SKU suffix
          const suffix = scent ? `${sanitize(wick)}-${sanitize(scent)}` : sanitize(wick);
          const sellerSku = `${skuBase}-${suffix}`;

          // Build row array matching header positions
          const row: (string | number)[] = new Array(headers.length).fill("");

          row[0] = "Home Decor/Candles";           // category
          row[1] = "Desert Candle Works";          // brand
          row[2] = product.name;                   // product_name
          row[3] = product.seoDescription || product.name; // product_description
          row[4] = photoUrls[0] || "";             // main_image
          row[5] = photoUrls[1] || "";             // image_2
          row[6] = photoUrls[2] || "";             // image_3
          // 7-12: image_4 through image_9 (empty)
          // 13-14: gtin_type, gtin_code (empty)
          row[15] = "Wick Type";                   // property_name_1
          row[16] = wick;                          // property_value_1
          // 17-25: property_1_image through property_1_image_9 (empty)
          row[26] = "Scent";                       // property_name_2
          row[27] = scent;                         // property_value_2
          row[28] = weightLb;                      // parcel_weight
          row[29] = 10;                            // parcel_length
          row[30] = 7;                             // parcel_width
          row[31] = 5;                             // parcel_height
          // 32: delivery (empty)
          row[33] = product.price;                 // price
          // 34: list_price (empty)
          row[35] = qty;                           // quantity
          row[36] = sellerSku;                     // seller_sku
          // 37-49: various fields (empty)
          row[50] = "No";                          // product_property/101395 (Prop 65)
          // 51: product_property/101398 (empty)
          row[52] = "No";                          // product_property/101400 (Prop 65)
          // 53-55: remaining fields (empty)

          rows.push(row);
        }
      }
    }

    // Create workbook and worksheet
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");

    // Generate and download the file
    const outputBuffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const blob = new Blob([outputBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `tiktok-shop-export-${new Date().toISOString().split("T")[0]}.xlsx`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /* ---------- Drafting & Publishing ---------- */

  // Stage (no network): create/replace a draft for slug
  function stageProduct(p: Product) {
    const slug = (p.slug || "").trim();
    if (!slug) {
      setSlugError("Slug is required");
      return;
    }
    if (!SLUG_REGEX.test(slug)) {
      setSlugError("Use lowercase letters/numbers with single hyphens");
      return;
    }
    setSlugError(null);
    setStaged((prev) => ({ ...prev, [slug]: { ...p, slug } }));
  }

  // Remove a staged draft (undo)
  function discardDraft(slug: string) {
    setStaged((prev) => {
      const copy = { ...prev };
      delete copy[slug];
      return copy;
    });
  }

  // Publish a single product: POST (new) or PATCH (existing)
  async function publishOne(slug: string) {
    const draft = staged[slug];
    if (!draft) return;

    // eslint-disable-next-line no-console
    console.log("[Admin] Publishing product:", slug, draft);

    setSaving(true);
    setError(null);

    const isNew = !isServerItem(slug);
    // eslint-disable-next-line no-console
    console.log(`[Admin] ${isNew ? "Creating new" : "Updating existing"} product`);

    const res = await fetch(isNew ? "/api/admin/products" : `/api/admin/products/${slug}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });

    // eslint-disable-next-line no-console
    console.log("[Admin] Response status:", res.status);

    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      // eslint-disable-next-line no-console
      console.error("[Admin] Publish failed:", j);
      const errorMsg = j.error || `Publish failed (${res.status})`;
      setError(errorMsg);
      await showAlert(`Failed to publish product:\n\n${errorMsg}`, "Error");
    } else {
      // eslint-disable-next-line no-console
      console.log("[Admin] Publish successful");
      discardDraft(slug);
      await load();
    }
    setSaving(false);
  }

  // Publish all drafts
  async function publishAll() {
    const slugs = Object.keys(staged);
    setSaving(true);
    setError(null);
    for (const slug of slugs) {
      const isNew = !isServerItem(slug);
      const res = await fetch(isNew ? "/api/admin/products" : `/api/admin/products/${slug}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(staged[slug]),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        const errorMsg = j.error || `Publish failed for ${slug}`;
        setError(errorMsg);
        await showAlert(`Failed to publish product "${slug}":\n\n${errorMsg}`, "Error");
        setSaving(false);
        return; // stop on first failure
      }
    }
    setStaged({});
    await load();
    setSaving(false);
  }

  // Delete (server)
  async function deleteProduct(slug: string) {
    const confirmed = await showConfirm(`Delete ${slug}?`, "Confirm Delete");
    if (!confirmed) return;
    discardDraft(slug);
    const res = await fetch(`/api/admin/products/${slug}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  // Image upload (supports multiple images)
  async function handleImagePick(
    e: React.ChangeEvent<HTMLInputElement>,
    editingLocal: Product | null,
    setEditingLocal: (v: Product) => void
  ) {
    const files = e.target.files;
    if (!files || files.length === 0 || !editingLocal) return;

    // eslint-disable-next-line no-console
    console.log(`[Admin] Starting upload of ${files.length} image(s)`);

    try {
      const uploadedUrls: string[] = [];

      // Upload each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // eslint-disable-next-line no-console
        console.log(`[Admin] Uploading image ${i + 1}/${files.length}:`, {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
        });

        const fd = new FormData();
        fd.append("file", file);

        const res = await fetch("/api/admin/upload", { method: "POST", body: fd });

        if (!res.ok) {
          const errorData = (await res.json().catch(() => ({ error: "Unknown error" }))) as {
            error?: string;
            details?: string;
          };
          // eslint-disable-next-line no-console
          console.error("[Admin] Upload failed:", errorData);
          await showAlert(
            `Upload failed for ${file.name}: ${errorData.error || "Unknown error"}\n${errorData.details || ""}`,
            "Upload Error"
          );
          continue; // Continue with other files
        }

        const { url } = (await res.json()) as { url: string };
        // eslint-disable-next-line no-console
        console.log(`[Admin] Upload ${i + 1} successful, URL:`, url);
        uploadedUrls.push(url);
      }

      if (uploadedUrls.length > 0) {
        // Append to existing images array
        const currentImages = editingLocal.images || [];
        setEditingLocal({
          ...editingLocal,
          images: [...currentImages, ...uploadedUrls],
          // Keep legacy image field pointing to first image for backward compatibility
          image: currentImages.length === 0 && uploadedUrls.length > 0 ? uploadedUrls[0] : editingLocal.image,
        });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[Admin] Upload error:", err);
      await showAlert(`Upload failed: ${err instanceof Error ? err.message : "Network error"}`, "Upload Error");
    }
  }

  // Remove image from array
  function removeImage(index: number, editingLocal: Product | null, setEditingLocal: (v: Product) => void) {
    if (!editingLocal) return;
    const newImages = [...(editingLocal.images || [])];
    newImages.splice(index, 1);
    setEditingLocal({
      ...editingLocal,
      images: newImages,
      // Update legacy image field
      image: newImages.length > 0 ? newImages[0] : undefined,
    });
  }

  // Reorder images (move up)
  function moveImageUp(index: number, editingLocal: Product | null, setEditingLocal: (v: Product) => void) {
    if (!editingLocal || index === 0) return;
    const newImages = [...(editingLocal.images || [])];
    [newImages[index - 1], newImages[index]] = [newImages[index], newImages[index - 1]];
    setEditingLocal({
      ...editingLocal,
      images: newImages,
      image: newImages[0],
    });
  }

  // Reorder images (move down)
  function moveImageDown(index: number, editingLocal: Product | null, setEditingLocal: (v: Product) => void) {
    if (!editingLocal || !editingLocal.images || index === editingLocal.images.length - 1) return;
    const newImages = [...editingLocal.images];
    [newImages[index], newImages[index + 1]] = [newImages[index + 1], newImages[index]];
    setEditingLocal({
      ...editingLocal,
      images: newImages,
      image: newImages[0],
    });
  }

  // QR code upload functions
  async function startQRUpload() {
    try {
      // Create upload session
      const res = await fetch("/api/admin/create-upload-session", {
        method: "POST",
      });

      if (!res.ok) {
        await showAlert("Failed to create upload session", "Error");
        return;
      }

      const { token } = (await res.json()) as { token: string };
      setUploadToken(token);
      setUploadedCount(0);

      // Generate QR code
      const originLocal = window.location.origin;
      const uploadUrl = `${originLocal}/mobile-upload?token=${token}`;
      const qrData = await QRCode.toDataURL(uploadUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });

      setQRDataURL(qrData);
      setShowQRModal(true);

      // Start polling for uploaded images
      startPolling(token);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[QR Upload] Error:", err);
      await showAlert("Failed to generate QR code", "Error");
    }
  }

  function startPolling(token: string) {
    // Clear existing interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    // Poll every 2 seconds
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/mobile-upload/status?token=${token}`);
        if (!res.ok) return;

        const data = (await res.json()) as { valid?: boolean; uploadedCount?: number };
        if (data.valid && (data.uploadedCount ?? 0) > uploadedCount) {
          setUploadedCount(data.uploadedCount ?? 0);

          // Fetch the full session to get image URLs
          const sessionRes = await fetch(`/api/admin/get-upload-session?token=${token}`);
          if (!sessionRes.ok) return;

          const sessionData = (await sessionRes.json()) as { uploadedImages?: string[] };
          if (sessionData.uploadedImages && editing) {
            const currentImages = editing.images || [];
            const newImages = sessionData.uploadedImages.filter((url) => !currentImages.includes(url));

            if (newImages.length > 0) {
              setEditing({
                ...editing,
                images: [...currentImages, ...newImages],
                image: currentImages.length === 0 ? newImages[0] : editing.image,
              });
            }
          }
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[QR Upload] Polling error:", err);
      }
    }, 2000);
  }

  function stopPolling() {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }

  function closeQRModal() {
    stopPolling();
    setShowQRModal(false);
    setQRDataURL(null);
    setUploadToken(null);
    setUploadedCount(0);
  }

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  // Next SKU for new product modal
  const nextSku = useMemo(() => {
    const allSkus = [...items.map((i) => i.sku), ...Object.values(staged).map((d) => d.sku)].filter(Boolean);
    return computeNextSku(allSkus);
  }, [items, staged]);

  /* ---------- UI ---------- */
  return (
    <div className="mx-auto max-w-[1800px] p-4 sm:p-6">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="btn">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-2xl font-semibold">Products</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {Object.keys(staged).length > 0 && (
            <>
              <button className="btn" onClick={() => setStaged({})} disabled={saving}>
                Discard all
              </button>
              <button className="btn btn-primary" onClick={publishAll} disabled={saving}>
                {saving ? "Publishing…" : `Publish all (${Object.keys(staged).length})`}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filter + New */}
      {/* Search and Controls */}
      <div className="mt-4 space-y-4">
        {/* Search and Primary Actions */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <input
            className="input flex-1 sm:max-w-md"
            placeholder="Search by name, slug, or SKU…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <button
            className="btn bg-green-600 text-white hover:bg-green-700 w-full sm:w-auto"
            onClick={exportToCSV}
            disabled={filtered.length === 0}
          >
            Export to CSV ({filtered.length})
          </button>
          <button
            className="btn bg-pink-600 text-white hover:bg-pink-700 w-full sm:w-auto"
            onClick={exportToTikTok}
            disabled={filtered.length === 0}
          >
            TikTok Shop Export ({filtered.length})
          </button>
          <Link
            href="/admin/stripe-product-sync"
            className="btn bg-blue-600 !text-black hover:bg-blue-700 w-full sm:w-auto flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Sync Images to Stripe
          </Link>
          <button
            className="btn bg-purple-600 text-white hover:bg-purple-700 w-full sm:w-auto flex items-center gap-2"
            onClick={async () => {
              if (saving) return;

              // Debug: Log all products with Square info
              // eslint-disable-next-line no-console
              console.log("[Sync All] Total products:", merged.length);
              const productsWithCatalogId = merged.filter((p) => p.squareCatalogId);
              const productsWithMapping = merged.filter((p) => p.squareVariantMapping);
              const squareProducts = merged.filter((p) => p.squareCatalogId && p.squareVariantMapping);

              // eslint-disable-next-line no-console
              console.log(
                "[Sync All] Products with squareCatalogId:",
                productsWithCatalogId.length,
                productsWithCatalogId.map((p) => ({ slug: p.slug, id: p.squareCatalogId }))
              );
              // eslint-disable-next-line no-console
              console.log(
                "[Sync All] Products with squareVariantMapping:",
                productsWithMapping.length,
                productsWithMapping.map((p) => ({ slug: p.slug, keys: Object.keys(p.squareVariantMapping || {}).length }))
              );
              // eslint-disable-next-line no-console
              console.log(
                "[Sync All] Products with both:",
                squareProducts.length,
                squareProducts.map((p) => ({
                  slug: p.slug,
                  id: p.squareCatalogId,
                  mappings: Object.keys(p.squareVariantMapping || {}).length,
                }))
              );

              // Check if any products need variant mappings created
              const productsNeedingMappings = productsWithCatalogId.filter((p) => !p.squareVariantMapping);

              if (squareProducts.length === 0) {
                if (productsNeedingMappings.length > 0) {
                  const autoMap = await showConfirm(
                    `${productsNeedingMappings.length} products have Square Catalog IDs but no variant mappings.\n\nWould you like to auto-generate variant mappings now?`,
                    "Auto-Generate Mappings"
                  );

                  if (autoMap) {
                    setSaving(true);
                    try {
                      const mapRes = await fetch("/api/admin/auto-map-square-variants", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ dryRun: false }),
                      });

                      if (!mapRes.ok) {
                        throw new Error("Failed to auto-generate mappings");
                      }

                      const mapData = await mapRes.json();
                      await showAlert(
                        `${mapData.message}\n\nPlease try syncing again.`,
                        "Mappings Created"
                      );

                      // Refresh products to show new mappings
                      await load();
                    } catch (err) {
                      await showAlert(
                        err instanceof Error ? err.message : "Failed to auto-generate mappings",
                        "Error"
                      );
                    } finally {
                      setSaving(false);
                    }
                  }
                } else {
                  await showAlert(
                    `No products are connected to Square.\n\nProducts with catalog ID: ${productsWithCatalogId.length}\nProducts with variant mapping: ${productsWithMapping.length}`,
                    "Info"
                  );
                }
                return;
              }

              // Auto-map any products that need it first
              if (productsNeedingMappings.length > 0) {
                const autoMap = await showConfirm(
                  `${productsNeedingMappings.length} products need variant mappings before syncing.\n\nAuto-generate mappings now?`,
                  "Auto-Map First"
                );

                if (autoMap) {
                  setSaving(true);
                  try {
                    const mapRes = await fetch("/api/admin/auto-map-square-variants", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ dryRun: false }),
                    });

                    const mapData = await mapRes.json();

                    if (!mapRes.ok) {
                      throw new Error(mapData.error || "Failed to auto-generate mappings");
                    }

                    await showAlert(`${mapData.message}`, "Mappings Created");
                    await load(); // Reload products
                  } catch (err) {
                    await showAlert(
                      err instanceof Error ? err.message : "Failed to auto-generate mappings",
                      "Error"
                    );
                    setSaving(false);
                    return;
                  } finally {
                    setSaving(false);
                  }
                }
              }

              const confirmed = await showConfirm(
                `Sync all ${squareProducts.length} Square products? This will update inventory, names, descriptions, and images.`,
                "Sync All to Square"
              );

              if (!confirmed) return;

              setSaving(true);
              try {
                // Step 1: Sync stock
                const stockRes = await fetch("/api/admin/sync-square-stock", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({}),
                });
                if (!stockRes.ok) {
                  const error = (await stockRes.json()) as { error?: string };
                  throw new Error(error.error || "Failed to sync stock");
                }
                const stockData = (await stockRes.json()) as SyncSquareStockResponse;

                // Step 2: Sync product details (name/description only — skip images to avoid timeout)
                // Use per-product "Sync Details" button to upload images individually
                const detailsRes = await fetch("/api/admin/sync-square-details", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ skipImages: true }),
                });
                let detailsData: {
                  message?: string;
                  successCount?: number;
                  errorCount?: number;
                  error?: string;
                } = {};
                if (detailsRes.ok) {
                  detailsData = (await detailsRes.json()) as typeof detailsData;
                } else {
                  const text = await detailsRes.text();
                  // eslint-disable-next-line no-console
                  console.error("[Sync All] Details sync non-OK response:", detailsRes.status, text.slice(0, 200));
                  detailsData = { error: `Details sync failed (${detailsRes.status})` };
                }

                const stockErrors =
                  stockData.results
                    ?.filter((r) => !r.success)
                    .map((r) => `${r.productSlug}: ${r.error ?? "Unknown error"}`)
                    .join("\n") ?? "";

                await showAlert(
                  `Sync complete!\n\nStock: ${stockData.successCount} synced, ${stockData.errorCount} errors\nDetails: ${detailsData.successCount ?? 0} synced, ${detailsData.errorCount ?? 0} errors${
                    detailsData.error ? `\n\nDetails error: ${detailsData.error}` : ""
                  }${stockErrors ? "\n\nStock errors:\n" + stockErrors : ""}`,
                  "Sync Complete"
                );
              } catch (err) {
                // eslint-disable-next-line no-console
                console.error("[Sync All Square] Error:", err);
                await showAlert(err instanceof Error ? err.message : "Failed to sync all products to Square", "Error");
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {saving ? "Syncing..." : "Sync All to Square"}
          </button>
          <button
            className="btn btn-primary w-full sm:w-auto"
            onClick={() => {
              const p = emptyProduct();
              p.sku = nextSku; // default auto-increment
              setEditing(p);
              setSlugTouched(false);
              setSlugError(null);
              setError(null);
            }}
          >
            + New product
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Visible Filter */}
          <div>
            <label className="block text-xs font-medium mb-1 text-[var(--color-muted)]">Visibility</label>
            <select
              className="input w-full text-sm"
              value={visibleFilter}
              onChange={(e) => setVisibleFilter(e.target.value as typeof visibleFilter)}
            >
              <option value="all">All</option>
              <option value="visible">Visible</option>
              <option value="hidden">Hidden</option>
            </select>
          </div>

          {/* Type Filter - Multi-select */}
          <div className="relative type-filter-dropdown">
            <label className="block text-xs font-medium mb-1 text-[var(--color-muted)]">Type</label>
            <button
              type="button"
              className="input w-full text-sm text-left flex items-center justify-between"
              onClick={() => setTypeDropdownOpen(!typeDropdownOpen)}
            >
              <span>
                {typeFilter.length === 0 ? "All Types" : typeFilter.length === 1 ? typeFilter[0] : `${typeFilter.length} selected`}
              </span>
              <span className="ml-2">▼</span>
            </button>
            {typeDropdownOpen && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-[var(--color-line)] rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {/* Get unique types from active alcohol types */}
                {(() => {
                  const uniqueTypes = new Set<string>();
                  alcoholTypes.forEach((type) => uniqueTypes.add(type.name));
                  // Add "Other" only once if any products have it
                  if (merged.some((p) => !p.alcoholType || p.alcoholType === "Other")) {
                    uniqueTypes.add("Other");
                  }

                  return Array.from(uniqueTypes)
                    .sort()
                    .map((typeName) => (
                      <label key={typeName} className="flex items-center gap-2 px-3 py-2 hover:bg-neutral-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={typeFilter.includes(typeName)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setTypeFilter([...typeFilter, typeName]);
                            } else {
                              setTypeFilter(typeFilter.filter((t) => t !== typeName));
                            }
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">{typeName}</span>
                      </label>
                    ));
                })()}
              </div>
            )}
          </div>

          {/* Stock Filter */}
          <div>
            <label className="block text-xs font-medium mb-1 text-[var(--color-muted)]">Stock</label>
            <select className="input w-full text-sm" value={stockFilter} onChange={(e) => setStockFilter(e.target.value as typeof stockFilter)}>
              <option value="all">All</option>
              <option value="in-stock">In Stock</option>
              <option value="out-of-stock">Out of Stock</option>
            </select>
          </div>

          {/* Best Seller Filter */}
          <div>
            <label className="block text-xs font-medium mb-1 text-[var(--color-muted)]">Best Seller</label>
            <select className="input w-full text-sm" value={bestFilter} onChange={(e) => setBestFilter(e.target.value as typeof bestFilter)}>
              <option value="all">All</option>
              <option value="best">Best Sellers</option>
              <option value="not-best">Not Best Sellers</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-xs font-medium mb-1 text-[var(--color-muted)]">Status</label>
            <select className="input w-full text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
              <option value="all">All</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>

        {/* Clear Filters */}
        <div className="flex justify-end">
          <button
            className="btn w-full sm:w-auto text-sm"
            onClick={() => {
              setFilter("");
              setVisibleFilter("all");
              setTypeFilter([]);
              setStockFilter("all");
              setBestFilter("all");
              setStatusFilter("all");
              setSortBy("none");
              setSortDirection("asc");
            }}
          >
            Clear All Filters
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="mt-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-[var(--color-muted)]">Loading products…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[var(--color-muted)]">No products found</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block">
              <div className="overflow-hidden rounded-xl border border-[var(--color-line)] bg-white shadow-sm">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-neutral-50 to-neutral-100 border-b border-[var(--color-line)]">
                    <tr>
                      <SortableHeader column="none" className="w-20 text-center border-r border-[var(--color-line)]">
                        Visible
                      </SortableHeader>
                      <SortableHeader column="none" className="w-24 text-center border-r border-[var(--color-line)]">
                        Image
                      </SortableHeader>
                      <SortableHeader column="name" className="text-center border-r border-[var(--color-line)]">
                        Name
                      </SortableHeader>
                      <SortableHeader column="price" className="w-28 text-center border-r border-[var(--color-line)]">
                        Price
                      </SortableHeader>
                      <SortableHeader column="cost" className="w-36 text-center border-r border-[var(--color-line)]">
                        Cost
                      </SortableHeader>
                      <SortableHeader column="none" className="w-36 text-center border-r border-[var(--color-line)]">
                        Type
                      </SortableHeader>
                      <SortableHeader column="stock" className="w-28 text-center border-r border-[var(--color-line)]">
                        Stock
                      </SortableHeader>
                      <SortableHeader column="best" className="w-20 text-center border-r border-[var(--color-line)]">
                        Best
                      </SortableHeader>
                      <SortableHeader column="status" className="w-32 text-center border-r border-[var(--color-line)]">
                        Status
                      </SortableHeader>
                      <SortableHeader column="none" className="text-center">
                        Actions
                      </SortableHeader>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-line)]">
                    {filtered.map((p) => {
                      const isDraft = hasDraft(p.slug);
                      const profitMargin =
                        p.materialCost && p.price > 0 ? (((p.price - p.materialCost) / p.price) * 100).toFixed(0) : null;

                      return (
                        <tr key={p.slug} className="group hover:bg-neutral-50/50 transition-colors">
                          <td className="py-5 text-center border-r border-[var(--color-line)]">
                            <input
                              type="checkbox"
                              checked={p.visibleOnWebsite !== false}
                              onChange={(e) => {
                                const updated = { ...p, visibleOnWebsite: e.target.checked };
                                stageProduct(updated);
                              }}
                              className="w-4 h-4 text-[var(--color-accent)] rounded border-neutral-300 focus:ring-2 focus:ring-[var(--color-accent)]"
                              title={p.visibleOnWebsite !== false ? "Visible on shop" : "Hidden from shop"}
                            />
                          </td>
                          <td className="py-5 border-r border-[var(--color-line)]">
                            <div className="flex justify-center">
                              {(() => {
                                const img = p.images?.[0] ?? p.image;
                                return img ? (
                                  <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-neutral-100">
                                    <Image src={img} alt={p.name} fill sizes="64px" className="object-contain p-1" />
                                  </div>
                                ) : (
                                  <div className="w-16 h-16 rounded-lg bg-neutral-100 flex items-center justify-center">
                                    <svg className="w-8 h-8 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={1.5}
                                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                      />
                                    </svg>
                                  </div>
                                );
                              })()}
                            </div>
                          </td>
                          <td className="py-5 px-4 text-center border-r border-[var(--color-line)]">
                            <div className="font-medium text-[var(--color-ink)] text-sm">{p.name}</div>
                            <div className="text-xs text-[var(--color-muted)] mt-1">{p.slug}</div>
                          </td>
                          <td className="py-5 text-center border-r border-[var(--color-line)]">
                            <div className="font-semibold text-[var(--color-ink)] text-sm">${p.price.toFixed(2)}</div>
                          </td>
                          <td className="py-5 text-center border-r border-[var(--color-line)]">
                            {p.materialCost ? (
                              <div>
                                <div className="font-medium text-[var(--color-ink)] text-sm">${p.materialCost.toFixed(2)}</div>
                                {profitMargin && <div className="text-xs text-green-600 font-medium mt-0.5">+{profitMargin}%</div>}
                              </div>
                            ) : (
                              <span className="text-[var(--color-muted)]">—</span>
                            )}
                          </td>
                          <td className="py-5 text-center border-r border-[var(--color-line)]">
                            <span className="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium bg-neutral-100 text-neutral-700">
                              {p.alcoholType ?? "Other"}
                            </span>
                          </td>
                          <td className="py-5 text-center border-r border-[var(--color-line)]">
                            <div className="font-semibold text-[var(--color-ink)] text-sm">{getTotalStock(p)}</div>
                          </td>
                          <td className="py-5 text-center border-r border-[var(--color-line)]">
                            {p.bestSeller ? (
                              <span className="text-amber-500" title="Best Seller">
                                <svg className="w-5 h-5 inline" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                              </span>
                            ) : (
                              <span className="text-neutral-300">—</span>
                            )}
                          </td>
                          <td className="py-5 text-center border-r border-[var(--color-line)]">
                            {isDraft ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-blue-100 text-blue-800">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                  />
                                </svg>
                                Draft
                              </span>
                            ) : (
                              <span className="text-xs text-[var(--color-muted)]">Published</span>
                            )}
                          </td>
                          <td className="py-5 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                className="btn text-sm px-4 py-2"
                                onClick={() => {
                                  setEditing(p);
                                  setSlugTouched(true);
                                  setSlugError(null);
                                  setError(null);
                                }}
                              >
                                Edit
                              </button>

                              {isDraft && (
                                <>
                                  <button className="btn btn-primary text-sm px-4 py-2" disabled={saving} onClick={() => publishOne(p.slug)}>
                                    {saving ? "…" : "Publish"}
                                  </button>
                                  <button className="btn text-sm px-4 py-2" onClick={() => discardDraft(p.slug)}>
                                    Discard
                                  </button>
                                </>
                              )}

                              <button className="btn text-sm px-4 py-2 text-red-600 hover:bg-red-50" onClick={() => void deleteProduct(p.slug)}>
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile/Tablet card list */}
            <div className="lg:hidden space-y-3">
              {filtered.map((p) => {
                const isDraft = hasDraft(p.slug);
                return (
                  <div key={p.slug} className="card p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <input
                        type="checkbox"
                        checked={p.visibleOnWebsite !== false}
                        onChange={(e) => {
                          const updated = { ...p, visibleOnWebsite: e.target.checked };
                          stageProduct(updated);
                        }}
                        className="mt-1 w-4 h-4 text-[var(--color-accent)] rounded"
                        title={p.visibleOnWebsite !== false ? "Visible" : "Hidden"}
                      />
                      <div className="relative h-16 w-16 flex-shrink-0 rounded-xl overflow-hidden bg-neutral-100">
                        {(() => {
                          const img = p.images?.[0] ?? p.image;
                          return img ? <Image src={img} alt="" fill sizes="64px" className="object-contain" /> : null;
                        })()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-[var(--color-ink)] truncate">{p.name}</h3>
                          {p.bestSeller && <span className="text-amber-500">★</span>}
                        </div>
                        <div className="text-xs text-[var(--color-muted)]">{p.slug}</div>
                        <div className="flex items-center gap-3 mt-2 text-sm">
                          <span className="font-semibold">${p.price.toFixed(2)}</span>
                          <span className="text-[var(--color-muted)]">·</span>
                          <span>Stock: {getTotalStock(p)}</span>
                          {isDraft && <span className="badge">Draft</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-3 border-t border-[var(--color-line)]">
                      <button
                        className="btn text-xs px-3 py-2 flex-1"
                        onClick={() => {
                          setEditing(p);
                          setSlugTouched(true);
                          setSlugError(null);
                          setError(null);
                        }}
                      >
                        Edit
                      </button>

                      {isDraft && (
                        <>
                          <button className="btn btn-primary text-xs px-3 py-2" disabled={saving} onClick={() => publishOne(p.slug)}>
                            {saving ? "…" : "Publish"}
                          </button>
                          <button className="btn text-xs px-3 py-2" onClick={() => discardDraft(p.slug)}>
                            Discard
                          </button>
                        </>
                      )}

                      <button className="btn text-xs px-3 py-2 text-red-600" onClick={() => void deleteProduct(p.slug)}>
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ---------- Edit/Create Modal (scrollable on mobile) ---------- */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          {/* backdrop */}
          <div
            className="absolute inset-0"
            onClick={() => {
              setEditing(null);
              setSlugTouched(false);
              setSlugError(null);
              setError(null);
            }}
          />
          {/* panel */}
          <div className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-gradient-to-r from-neutral-50 to-white">
              <div>
                <h2 className="text-xl font-semibold text-[var(--color-ink)]">{isServerItem(editing.slug) ? "Edit Product" : "New Product"}</h2>
                <p className="text-sm text-[var(--color-muted)] mt-0.5">
                  {isServerItem(editing.slug) ? "Changes are staged until published" : "Configure product details and variants"}
                </p>
              </div>
              <button
                className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                onClick={() => {
                  setEditing(null);
                  setSlugTouched(false);
                  setSlugError(null);
                  setError(null);
                }}
                aria-label="Close"
              >
                <svg className="w-5 h-5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Basic Information Section */}
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-[var(--color-ink)] mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Basic Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Name */}
                  <label className="block">
                    <div className="text-xs font-medium text-neutral-700 mb-2">Product Name</div>
                    <input
                      className="input"
                      value={editing.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        setEditing((prev) => {
                          if (!prev) return prev;
                          const next = { ...prev, name };
                          if (!slugTouched && !isServerItem(prev.slug)) {
                            next.slug = slugify(name);
                            setSlugError(next.slug && SLUG_REGEX.test(next.slug) ? null : "Use lowercase letters/numbers with single hyphens");
                          }
                          return next;
                        });
                      }}
                    />
                  </label>

                  {/* Slug */}
                  <label className="block">
                    <div className="text-xs font-medium text-neutral-700 mb-2">URL Slug</div>
                    <input
                      className="input"
                      value={editing.slug}
                      disabled={isServerItem(editing.slug)} // keep URLs stable once published
                      onChange={(e) => {
                        const v = e.target.value.trim();
                        setSlugTouched(true);
                        setEditing({ ...editing, slug: v });
                        setSlugError(v && SLUG_REGEX.test(v) ? null : "Use lowercase letters/numbers with single hyphens");
                      }}
                      onBlur={(e) => {
                        const cleaned = slugify(e.target.value);
                        setEditing((prev) => (prev ? { ...prev, slug: cleaned } : prev));
                        setSlugError(cleaned && SLUG_REGEX.test(cleaned) ? null : "Use lowercase letters/numbers with single hyphens");
                      }}
                      placeholder="e.g. woodford-reserve-candle"
                    />
                    {slugError && <p className="text-rose-600 text-xs mt-1">{slugError}</p>}
                  </label>

                  <label className="block">
                    <div className="text-xs mb-1">Price</div>
                    <input
                      className="input"
                      type="text"
                      inputMode="decimal"
                      value={priceInputStr}
                      onChange={(e) => {
                        const val = e.target.value;
                        // Allow empty, numbers, and decimal point
                        if (val === "" || /^\d*\.?\d*$/.test(val)) {
                          setPriceInputStr(val);
                        }
                      }}
                      onBlur={() => {
                        // Parse and update price on blur
                        const num = parseFloat(priceInputStr);
                        if (!isNaN(num)) {
                          setEditing({ ...editing, price: parseFloat(num.toFixed(2)) });
                          setPriceInputStr(num.toFixed(2));
                        } else if (priceInputStr === "") {
                          setEditing({ ...editing, price: 0 });
                          setPriceInputStr("");
                        }
                      }}
                      onFocus={() => {
                        // Initialize input string from current price
                        setPriceInputStr(editing.price === 0 ? "" : editing.price.toString());
                      }}
                    />
                  </label>

                  {/* Weight */}
                  <label className="block">
                    <div className="text-xs mb-1">Candle Weight (ounces)</div>
                    <input
                      className="input"
                      type="number"
                      step="0.1"
                      value={editing.weight?.value || ""}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        setEditing({
                          ...editing,
                          weight: isNaN(value) ? undefined : { value, units: "ounces" },
                        });
                      }}
                      placeholder="e.g. 12 (jar + wax only)"
                    />
                    <div className="text-xs text-neutral-500 mt-1">
                      Weight of jar + wax only. Packaging (~16oz) added automatically for shipping.
                    </div>
                  </label>

                  {/* SKU */}
                  <label className="block">
                    <div className="text-xs mb-1">SKU</div>
                    <div className="flex gap-2">
                      <input
                        className="input flex-1"
                        value={editing.sku}
                        onChange={(e) => setEditing({ ...editing, sku: e.target.value })}
                        placeholder="DCW-0001"
                      />
                      <button
                        type="button"
                        className="btn"
                        onClick={() =>
                          setEditing((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  sku: computeNextSku([...items.map((i) => i.sku), ...Object.values(staged).map((d) => d.sku)]),
                                }
                              : prev
                          )
                        }
                        title="Use next available SKU"
                      >
                        Auto
                      </button>
                    </div>
                  </label>

                  {/* Alcohol Type — NEW */}
                  <label className="block">
                    <div className="text-xs mb-1">Alcohol Type</div>
                    <div className="flex gap-2">
                      <select
                        className="input flex-1"
                        value={editing.alcoholType || ""}
                        onChange={async (e) => {
                          const v = e.target.value;
                          if (v === "__new__") {
                            const name = await showPrompt("Enter new alcohol type (e.g., Tequila):", "New Alcohol Type");
                            if (name && name.trim()) {
                              const res = await fetch("/api/admin/alcohol-types", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ name: name.trim() }),
                              });
                              if (res.ok) {
                                await load();
                                setEditing((prev) => (prev ? { ...prev, alcoholType: name.trim() } : prev));
                              } else {
                                await showAlert("Failed to create type", "Error");
                              }
                            }
                            return;
                          }
                          setEditing({ ...editing, alcoholType: v || undefined });
                        }}
                      >
                        <option value="">— Select type —</option>
                        {/* Active types only */}
                        {alcoholTypes.map((t) => (
                          <option key={t.id} value={t.name}>
                            {t.name}
                          </option>
                        ))}
                        {/* If the current product has an archived type, show it as disabled but visible */}
                        {editing.alcoholType && !alcoholTypes.some((t) => t.name === editing.alcoholType) && (
                          <option value={editing.alcoholType} disabled>
                            {editing.alcoholType} (archived)
                          </option>
                        )}
                        <option value="__new__">+ Add new type…</option>
                      </select>
                    </div>
                  </label>

                  {/* Images - Multiple Upload */}
                  <div className="block sm:col-span-2">
                    <div className="text-xs mb-1">Product Images</div>
                    <div className="flex gap-2">
                      <label className="btn cursor-pointer flex-1">
                        + Add Images
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) => handleImagePick(e, editing, (v) => setEditing(v))}
                        />
                      </label>
                      <button
                        type="button"
                        className="btn bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2"
                        onClick={startQRUpload}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                          />
                        </svg>
                        Upload from Phone
                      </button>
                    </div>

                    {/* Display current images */}
                    {editing.images && editing.images.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {editing.images.map((img, idx) => (
                          <div key={idx} className="card p-3 flex items-center gap-3">
                            <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-white">
                              <Image src={img} alt={`Product image ${idx + 1}`} fill className="object-contain" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-[var(--color-muted)] truncate">{img}</div>
                              {idx === 0 && <span className="text-xs font-medium text-green-600">Primary</span>}
                            </div>
                            <div className="flex gap-1">
                              {idx > 0 && (
                                <button
                                  type="button"
                                  className="btn text-xs px-2 py-1"
                                  onClick={() => moveImageUp(idx, editing, (v) => setEditing(v))}
                                  title="Move up"
                                >
                                  ↑
                                </button>
                              )}
                              {editing.images && idx < editing.images.length - 1 && (
                                <button
                                  type="button"
                                  className="btn text-xs px-2 py-1"
                                  onClick={() => moveImageDown(idx, editing, (v) => setEditing(v))}
                                  title="Move down"
                                >
                                  ↓
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn text-xs px-2 py-1"
                                onClick={() => removeImage(idx, editing, (v) => setEditing(v))}
                                title="Remove"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-[var(--color-muted)]">No images yet. Click &quot;Add Images&quot; to upload.</p>
                    )}
                  </div>

                  {/* Stripe Price ID */}
                  <label className="block sm:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs">Stripe Price ID</span>
                      {!editing.stripePriceId && (
                        <button
                          type="button"
                          className="text-xs text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
                          onClick={async () => {
                            // Validate required fields
                            if (!editing.name.trim()) {
                              await showAlert("Please enter a product name first", "Missing Information");
                              return;
                            }
                            if (!editing.price || editing.price <= 0) {
                              await showAlert("Please enter a valid price first", "Missing Information");
                              return;
                            }

                            try {
                              setSaving(true);
                              const res = await fetch("/api/admin/create-stripe-product", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  name: editing.name,
                                  price: editing.price,
                                  description: editing.seoDescription,
                                  images: editing.images || [],
                                }),
                              });

                              const data = (await res.json()) as { productId?: string; priceId?: string; error?: string; details?: string };

                              if (!res.ok) {
                                throw new Error(data.details || data.error || "Failed to create Stripe product");
                              }

                              // Update the product with the returned price ID
                              setEditing({ ...editing, stripePriceId: data.priceId });

                              await showAlert(
                                `Stripe product created successfully!\n\nProduct ID: ${data.productId}\nPrice ID: ${data.priceId}`,
                                "Success"
                              );
                            } catch (err) {
                              // eslint-disable-next-line no-console
                              console.error("[Create Stripe Product] Error:", err);
                              await showAlert(err instanceof Error ? err.message : "Failed to create Stripe product", "Error");
                            } finally {
                              setSaving(false);
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
                      value={editing.stripePriceId || ""}
                      onChange={(e) => setEditing({ ...editing, stripePriceId: e.target.value })}
                      placeholder="Click 'Create Stripe Product' or paste manually"
                    />
                  </label>

                  {/* Square Catalog ID */}
                  <label className="block sm:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs">Square Catalog ID</span>
                      <div className="flex gap-2">
                        {editing.squareCatalogId && (
                          <button
                            type="button"
                            className="text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
                            onClick={async () => {
                              // Sync stock to Square (auto-map first if needed)
                              try {
                                setSaving(true);

                                // Check if variant mapping exists, if not auto-map first
                                if (!editing.squareVariantMapping || Object.keys(editing.squareVariantMapping).length === 0) {
                                  // eslint-disable-next-line no-console
                                  console.log("[Sync Square Stock] No variant mapping found, running auto-map first");

                                  const mapRes = await fetch("/api/admin/auto-map-square-variants", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ productSlug: editing.slug, dryRun: false }),
                                  });

                                  const mapData = (await mapRes.json()) as { error?: string; results?: Array<{ success?: boolean; error?: string }> };

                                  if (!mapRes.ok || !mapData.results?.[0]?.success) {
                                    throw new Error(mapData.error || mapData.results?.[0]?.error || "Failed to auto-map variants before syncing");
                                  }

                                  // eslint-disable-next-line no-console
                                  console.log("[Sync Square Stock] Auto-mapping successful, proceeding with sync");
                                  await load(); // Reload to get updated mapping
                                }

                                const res = await fetch("/api/admin/sync-square-stock", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ productSlug: editing.slug }),
                                });

                                const data = (await res.json()) as { error?: string; message?: string };

                                if (!res.ok) {
                                  throw new Error(data.error || "Failed to sync stock");
                                }

                                await showAlert(`Stock synced to Square successfully!\n\n${data.message}`, "Success");
                              } catch (err) {
                                // eslint-disable-next-line no-console
                                console.error("[Sync Square Stock] Error:", err);
                                await showAlert(err instanceof Error ? err.message : "Failed to sync stock to Square", "Error");
                              } finally {
                                setSaving(false);
                              }
                            }}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                              />
                            </svg>
                            Sync Stock to Square
                          </button>
                        )}
                        {editing.squareCatalogId && (
                          <button
                            type="button"
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                            onClick={async () => {
                              try {
                                setSaving(true);
                                const res = await fetch("/api/admin/sync-square-details", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ productSlug: editing.slug }),
                                });
                                const data = (await res.json()) as {
                                  error?: string;
                                  message?: string;
                                  results?: Array<{ imagesUploaded?: number; totalImages?: number }>;
                                };
                                if (!res.ok) throw new Error(data.error || "Failed to sync details");
                                const r = data.results?.[0];
                                await showAlert(
                                  `Product details synced to Square!\n\nImages uploaded: ${r?.imagesUploaded ?? 0} / ${r?.totalImages ?? 0}`,
                                  "Success"
                                );
                              } catch (err) {
                                await showAlert(err instanceof Error ? err.message : "Failed to sync details to Square", "Error");
                              } finally {
                                setSaving(false);
                              }
                            }}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Sync Details to Square
                          </button>
                        )}
                        {editing.squareCatalogId && (
                          <button
                            type="button"
                            className="text-xs text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1"
                            onClick={async () => {
                              const confirmed = await showConfirm(
                                `This will recreate "${editing.name}" on Square with all current website variants.\n\nUse this when you've added new scents or wick types that aren't on Square yet.\n\nContinue?`,
                                "Remap Variants"
                              );

                              if (!confirmed) return;

                              try {
                                setSaving(true);

                                // Force remap variants
                                const mapRes = await fetch("/api/admin/auto-map-square-variants", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    productSlug: editing.slug,
                                    dryRun: false,
                                    forceRemap: true,
                                  }),
                                });

                                const mapData = (await mapRes.json()) as {
                                  error?: string;
                                  results?: Array<{ success?: boolean; error?: string; recreated?: boolean }>;
                                };

                                if (!mapRes.ok || !mapData.results?.[0]?.success) {
                                  throw new Error(mapData.error || mapData.results?.[0]?.error || "Failed to remap variants");
                                }

                                await load(); // Reload to get updated mapping

                                // Ask if they want to sync stock now
                                const syncNow = await showConfirm(
                                  "Variants remapped successfully!\n\nWould you like to sync stock levels to Square now?",
                                  "Sync Stock?"
                                );

                                if (syncNow) {
                                  const res = await fetch("/api/admin/sync-square-stock", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ productSlug: editing.slug }),
                                  });

                                  const data = (await res.json()) as { error?: string; message?: string };

                                  if (!res.ok) {
                                    throw new Error(data.error || "Failed to sync stock");
                                  }

                                  await showAlert(
                                    `Variants remapped and stock synced successfully!\n\n${data.message}`,
                                    "Success"
                                  );
                                } else {
                                  await showAlert("Variants remapped successfully!", "Success");
                                }
                              } catch (err) {
                                // eslint-disable-next-line no-console
                                console.error("[Remap Variants] Error:", err);
                                await showAlert(
                                  err instanceof Error ? err.message : "Failed to remap variants",
                                  "Error"
                                );
                              } finally {
                                setSaving(false);
                              }
                            }}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                              />
                            </svg>
                            Remap Variants
                          </button>
                        )}
                        {!editing.squareCatalogId && (
                          <button
                            type="button"
                            className="text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
                            onClick={async () => {
                              // Validate required fields
                              if (!editing.name.trim()) {
                                await showAlert("Please enter a product name first", "Missing Information");
                                return;
                              }
                              if (!editing.price || editing.price <= 0) {
                                await showAlert("Please enter a valid price first", "Missing Information");
                                return;
                              }

                              try {
                                setSaving(true);

                                // Get scents for this product (filter by limited flag)
                                const productScents = globalScents.filter((scent) => {
                                  if (!scent.limited) return true;
                                  return scent.enabledProducts?.includes(editing.slug);
                                });

                                const squareImages = editing.images?.length
                                  ? editing.images
                                  : editing.image ? [editing.image] : [];

                                const res = await fetch("/api/admin/create-square-product", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    name: editing.name,
                                    price: editing.price,
                                    description: editing.seoDescription,
                                    sku: editing.sku,
                                    images: squareImages,
                                    variantConfig: editing.variantConfig,
                                    scents: productScents.map((s) => ({ id: s.id, name: s.name })),
                                  }),
                                });

                                const data = (await res.json()) as {
                                  catalogItemId?: string;
                                  variantMapping?: Record<string, string>;
                                  variationCount?: number;
                                  imageCount?: number;
                                  error?: string;
                                  details?: string;
                                };

                                if (!res.ok) {
                                  throw new Error(data.details || data.error || "Failed to create Square product");
                                }

                                // Update the product with the returned catalog ID and variant mapping
                                const updatedProduct = {
                                  ...editing,
                                  squareCatalogId: data.catalogItemId,
                                  squareVariantMapping: data.variantMapping || {},
                                };

                                setEditing(updatedProduct);

                                // Save the Square fields to the database immediately
                                const saveRes = await fetch(`/api/admin/products/${editing.slug}`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    squareCatalogId: data.catalogItemId,
                                    squareVariantMapping: data.variantMapping || {},
                                  }),
                                });

                                if (!saveRes.ok) {
                                  const saveError = (await saveRes.json()) as { error?: string };
                                  // eslint-disable-next-line no-console
                                  console.error("[Create Square Product] Failed to save:", saveError);
                                  await showAlert(
                                    `Square product created but failed to save to database: ${saveError.error || "Unknown error"}`,
                                    "Warning"
                                  );
                                  return;
                                }

                                // Reload products to get updated data
                                await load();

                                await showAlert(
                                  `Square catalog item created and saved successfully!\n\nCatalog Item ID: ${data.catalogItemId}\nVariations: ${data.variationCount}\nImages: ${data.imageCount}`,
                                  "Success"
                                );
                              } catch (err) {
                                // eslint-disable-next-line no-console
                                console.error("[Create Square Product] Error:", err);
                                await showAlert(err instanceof Error ? err.message : "Failed to create Square product", "Error");
                              } finally {
                                setSaving(false);
                              }
                            }}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            Create Square Product
                          </button>
                        )}
                        {editing.squareCatalogId && (
                          <button
                            type="button"
                            className="text-xs text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1"
                            onClick={async () => {
                              const confirmed = confirm(
                                "This will re-create the Square product with the current configuration (including any new sizes). The old Square product will remain in your catalog. Continue?"
                              );
                              if (!confirmed) return;

                              // Validate required fields
                              if (!editing.name.trim()) {
                                await showAlert("Please enter a product name first", "Missing Information");
                                return;
                              }
                              if (!editing.price || editing.price <= 0) {
                                await showAlert("Please enter a valid price first", "Missing Information");
                                return;
                              }

                              try {
                                setSaving(true);

                                // Get scents for this product (filter by limited flag)
                                const productScents = globalScents.filter((scent) => {
                                  if (!scent.limited) return true;
                                  return scent.enabledProducts?.includes(editing.slug);
                                });

                                const squareImages = editing.images?.length
                                  ? editing.images
                                  : editing.image ? [editing.image] : [];

                                const res = await fetch("/api/admin/create-square-product", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    name: editing.name,
                                    price: editing.price,
                                    description: editing.seoDescription,
                                    sku: editing.sku,
                                    images: squareImages,
                                    variantConfig: editing.variantConfig,
                                    scents: productScents.map((s) => ({ id: s.id, name: s.name })),
                                  }),
                                });

                                const data = (await res.json()) as {
                                  catalogItemId?: string;
                                  variantMapping?: Record<string, string>;
                                  variationCount?: number;
                                  imageCount?: number;
                                  error?: string;
                                  details?: string;
                                };

                                if (!res.ok) {
                                  throw new Error(data.details || data.error || "Failed to re-create Square product");
                                }

                                // Update the product with the new catalog ID and variant mapping
                                const updatedProduct = {
                                  ...editing,
                                  squareCatalogId: data.catalogItemId,
                                  squareVariantMapping: data.variantMapping || {},
                                };

                                setEditing(updatedProduct);

                                // Save the Square fields to the database immediately
                                const saveRes = await fetch(`/api/admin/products/${editing.slug}`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    squareCatalogId: data.catalogItemId,
                                    squareVariantMapping: data.variantMapping || {},
                                  }),
                                });

                                if (!saveRes.ok) {
                                  const saveError = (await saveRes.json()) as { error?: string };
                                  console.error("[Re-create Square Product] Failed to save:", saveError);
                                  await showAlert(
                                    `Square product created but failed to save to database: ${saveError.error || "Unknown error"}`,
                                    "Warning"
                                  );
                                } else {
                                  await showAlert(
                                    `Square product re-created successfully!\n\nCatalog ID: ${data.catalogItemId}\nVariations: ${data.variationCount}\nImages: ${data.imageCount}\n\nThe old Square product (if any) remains in your catalog and should be manually deleted.`,
                                    "Success"
                                  );
                                }
                              } catch (err) {
                                console.error("[Re-create Square Product] Error:", err);
                                await showAlert(err instanceof Error ? err.message : "Failed to re-create Square product", "Error");
                              } finally {
                                setSaving(false);
                              }
                            }}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                              />
                            </svg>
                            Re-create with Sizes
                          </button>
                        )}
                      </div>
                    </div>
                    <input
                      className="input"
                      value={editing.squareCatalogId || ""}
                      onChange={(e) => setEditing({ ...editing, squareCatalogId: e.target.value })}
                      placeholder="Click 'Create Square Product' or paste manually"
                    />
                  </label>

                  {/* Container Selection */}
                  <div className="block">
                    <ComboBox
                      id="edit-product-container"
                      label="Container (for description)"
                      placeholder="Search containers..."
                      value={editing.containerId || ""}
                      items={[
                        { value: "", label: "— Select container —", sublabel: "Optional" },
                        ...containers.map((c) => ({
                          value: c.id,
                          label: c.name,
                          sublabel: `${c.capacityWaterOz} oz water • ${c.shape}`,
                        })),
                      ]}
                      emptyMessage="No containers match your search."
                      onChange={(val) => setEditing({ ...editing, containerId: val || undefined })}
                    />
                  </div>

                  {/* Description */}
                  <label className="block sm:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs">Description</span>
                      <button
                        type="button"
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                        onClick={() => {
                          const container = containers.find((c) => c.id === editing.containerId);
                          const generatedDesc = generateDescription(editing.name, container, settings.waterToWaxRatio);
                          setEditing({ ...editing, seoDescription: generatedDesc });
                        }}
                      >
                        Auto-generate from name & container
                      </button>
                    </div>
                    <textarea
                      className="textarea"
                      rows={4}
                      value={editing.seoDescription}
                      onChange={(e) => setEditing({ ...editing, seoDescription: e.target.value })}
                      placeholder="Select a container and click 'Auto-generate' or type manually"
                    />
                  </label>

                  {/* Visible on Website */}
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editing.visibleOnWebsite !== false}
                      onChange={(e) => setEditing({ ...editing, visibleOnWebsite: e.target.checked })}
                    />
                    <span className="text-sm">Show on Website</span>
                  </label>

                  {/* Best Seller */}
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={!!editing.bestSeller} onChange={(e) => setEditing({ ...editing, bestSeller: e.target.checked })} />
                    <span className="text-sm">Best Seller</span>
                  </label>

                  {/* Young & Dumb */}
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={!!editing.youngDumb} onChange={(e) => setEditing({ ...editing, youngDumb: e.target.checked })} />
                    <span className="text-sm">Young & Dumb</span>
                  </label>

                  {/* Base Stock */}
                  <label className="block">
                    <div className="text-xs mb-1">
                      Stock (base)
                      {editing.variantConfig && (
                        <span className="text-[var(--color-muted)] ml-1">
                          • Variant stock managed separately below
                        </span>
                      )}
                    </div>
                    <input
                      className="input"
                      type="number"
                      value={editing.stock}
                      onChange={(e) => setEditing({ ...editing, stock: e.target.value === "" ? 0 : Number(e.target.value) })}
                      onBlur={(e) => {
                        const val = e.target.value === "" ? 0 : Number(e.target.value);
                        setEditing({ ...editing, stock: Math.max(0, val) });
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* ---------- Variants Section ---------- */}
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-[var(--color-ink)] mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                    />
                  </svg>
                  Product Variants
                </h3>

                {(() => {
                  // Auto-initialize variantConfig if it doesn't exist
                  if (!editing.variantConfig) {
                    setEditing({
                      ...editing,
                      variantConfig: {
                        wickTypes: [{ id: "standard", name: "Standard Wick" }],
                        variantData: {},
                      },
                    });
                    return null;
                  }

                  const availableScents = globalScents.filter((scent) => {
                    if (!scent.limited) return true;
                    return scent.enabledProducts?.includes(editing.slug) ?? false;
                  });
                  const variantsForDisplay = generateVariantsForDisplay(editing, globalScents);

                  return (
                    <div className="space-y-6">
                      {/* Size Configuration (Optional) */}
                      <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="text-sm font-medium text-neutral-900">Sizes (Optional)</h4>
                            <p className="text-xs text-neutral-600 mt-0.5">Add multiple sizes with different prices</p>
                          </div>
                          <button
                            type="button"
                            className="btn btn-primary text-xs px-3 py-1.5"
                            onClick={() => {
                              const newId = `size-${Date.now()}`;
                              const sizes = editing.variantConfig?.sizes || [];
                              setEditing({
                                ...editing,
                                variantConfig: {
                                  ...editing.variantConfig!,
                                  sizes: [...sizes, { id: newId, name: "New Size", ozs: 8, priceCents: Math.round(editing.price * 100) }],
                                },
                              });
                            }}
                          >
                            <svg className="w-3 h-3 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add Size
                          </button>
                        </div>
                        {editing.variantConfig?.sizes && editing.variantConfig.sizes.length > 0 ? (
                          <div className="space-y-3">
                            {editing.variantConfig.sizes.map((size, idx) => (
                              <div key={size.id} className="bg-white rounded-lg p-3 border border-neutral-200">
                                <div className="grid grid-cols-1 gap-3">
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                      <label className="text-xs text-neutral-600 block mb-1">Size Name</label>
                                      <input
                                        className="input text-sm w-full"
                                        value={size.name}
                                        onChange={(e) => {
                                          const newSizes = [...(editing.variantConfig?.sizes || [])];
                                          newSizes[idx] = { ...size, name: e.target.value };
                                          setEditing({
                                            ...editing,
                                            variantConfig: {
                                              ...editing.variantConfig!,
                                              sizes: newSizes,
                                            },
                                          });
                                        }}
                                        placeholder="e.g., 8 oz"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs text-neutral-600 block mb-1">Ounces</label>
                                      <input
                                        className="input text-sm w-full"
                                        type="number"
                                        step="0.1"
                                        value={size.ozs}
                                        onChange={(e) => {
                                          const newSizes = [...(editing.variantConfig?.sizes || [])];
                                          newSizes[idx] = { ...size, ozs: parseFloat(e.target.value) || 0 };
                                          setEditing({
                                            ...editing,
                                            variantConfig: {
                                              ...editing.variantConfig!,
                                              sizes: newSizes,
                                            },
                                          });
                                        }}
                                        placeholder="8"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs text-neutral-600 block mb-1">Price ($)</label>
                                      <input
                                        className="input text-sm w-full"
                                        type="number"
                                        step="0.01"
                                        value={(size.priceCents / 100).toFixed(2)}
                                        onChange={(e) => {
                                          const newSizes = [...(editing.variantConfig?.sizes || [])];
                                          newSizes[idx] = { ...size, priceCents: Math.round(parseFloat(e.target.value) * 100) || 0 };
                                          setEditing({
                                            ...editing,
                                            variantConfig: {
                                              ...editing.variantConfig!,
                                              sizes: newSizes,
                                            },
                                          });
                                        }}
                                        placeholder="0.00"
                                      />
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
                                    <div>
                                      <div className="flex items-center justify-between mb-1">
                                        <label className="text-xs text-neutral-600">Stripe Price ID (Optional)</label>
                                        {!size.stripePriceId && (
                                          <button
                                            type="button"
                                            className="text-xs text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
                                            onClick={async () => {
                                              // Validate required fields
                                              if (!editing.name.trim()) {
                                                await showAlert("Please enter a product name first", "Missing Information");
                                                return;
                                              }
                                              if (!size.name.trim()) {
                                                await showAlert("Please enter a size name first", "Missing Information");
                                                return;
                                              }
                                              if (!size.priceCents || size.priceCents <= 0) {
                                                await showAlert("Please enter a valid price for this size first", "Missing Information");
                                                return;
                                              }

                                              try {
                                                setSaving(true);
                                                const res = await fetch("/api/admin/create-stripe-product", {
                                                  method: "POST",
                                                  headers: { "Content-Type": "application/json" },
                                                  body: JSON.stringify({
                                                    name: `${editing.name} - ${size.name}`,
                                                    price: size.priceCents / 100,
                                                    description: editing.seoDescription,
                                                    images: editing.images || [],
                                                  }),
                                                });

                                                const data = (await res.json()) as { productId?: string; priceId?: string; error?: string; details?: string };

                                                if (!res.ok) {
                                                  throw new Error(data.details || data.error || "Failed to create Stripe product");
                                                }

                                                // Update the size with the returned price ID
                                                const newSizes = [...(editing.variantConfig?.sizes || [])];
                                                newSizes[idx] = { ...size, stripePriceId: data.priceId };
                                                setEditing({
                                                  ...editing,
                                                  variantConfig: {
                                                    ...editing.variantConfig!,
                                                    sizes: newSizes,
                                                  },
                                                });

                                                await showAlert(
                                                  `Stripe product created for ${size.name}!\n\nProduct ID: ${data.productId}\nPrice ID: ${data.priceId}`,
                                                  "Success"
                                                );
                                              } catch (err) {
                                                console.error("[Create Stripe Product for Size] Error:", err);
                                                await showAlert(err instanceof Error ? err.message : "Failed to create Stripe product", "Error");
                                              } finally {
                                                setSaving(false);
                                              }
                                            }}
                                          >
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                            </svg>
                                            Create
                                          </button>
                                        )}
                                      </div>
                                      <input
                                        className="input text-sm w-full font-mono"
                                        value={size.stripePriceId || ""}
                                        onChange={(e) => {
                                          const newSizes = [...(editing.variantConfig?.sizes || [])];
                                          newSizes[idx] = { ...size, stripePriceId: e.target.value || undefined };
                                          setEditing({
                                            ...editing,
                                            variantConfig: {
                                              ...editing.variantConfig!,
                                              sizes: newSizes,
                                            },
                                          });
                                        }}
                                        placeholder="price_xxxxx (falls back to product's Stripe Price ID)"
                                      />
                                    </div>
                                    <div className="flex items-end">
                                      <button
                                        type="button"
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors w-full"
                                        onClick={() => {
                                          setEditing({
                                            ...editing,
                                            variantConfig: {
                                              ...editing.variantConfig!,
                                              sizes: editing.variantConfig!.sizes!.filter((_, i) => i !== idx),
                                            },
                                          });
                                        }}
                                        title="Remove size"
                                      >
                                        <svg className="w-4 h-4 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-sm text-neutral-500">
                            No sizes configured. This product will use the base price.
                          </div>
                        )}
                      </div>

                      {/* Wick Types Configuration */}
                      <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-medium text-neutral-900">Wick Types</h4>
                          <button
                            type="button"
                            className="btn btn-primary text-xs px-3 py-1.5"
                            onClick={() => {
                              const newId = `wick-${Date.now()}`;
                              setEditing({
                                ...editing,
                                variantConfig: {
                                  ...editing.variantConfig!,
                                  wickTypes: [...editing.variantConfig!.wickTypes, { id: newId, name: "New Wick Type" }],
                                },
                              });
                            }}
                          >
                            <svg className="w-3 h-3 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add Wick
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {editing.variantConfig.wickTypes.map((wick, idx) => (
                            <div key={wick.id} className="flex items-center gap-2 bg-white rounded-lg p-3 border border-neutral-200">
                              <input
                                className="input text-sm flex-1"
                                value={wick.name}
                                onChange={(e) => {
                                  const newWicks = [...editing.variantConfig!.wickTypes];
                                  newWicks[idx] = { ...wick, name: e.target.value };
                                  setEditing({
                                    ...editing,
                                    variantConfig: {
                                      ...editing.variantConfig!,
                                      wickTypes: newWicks,
                                    },
                                  });
                                }}
                                placeholder="e.g., Wood Wick"
                              />
                              <button
                                type="button"
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                onClick={() => {
                                  setEditing({
                                    ...editing,
                                    variantConfig: {
                                      ...editing.variantConfig!,
                                      wickTypes: editing.variantConfig!.wickTypes.filter((_, i) => i !== idx),
                                    },
                                  });
                                }}
                                title="Remove wick type"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Scents Info Banner */}
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                        <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-blue-900 mb-1">Global Scents System</p>
                          <p className="text-xs text-blue-800">
                            Scents are managed globally and automatically appear as variants.{" "}
                            <a href="/admin/scents" className="font-medium underline hover:text-blue-900">
                              Manage scents →
                            </a>
                          </p>
                        </div>
                      </div>

                      {/* Variant Stock Grid */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-sm font-medium text-neutral-900">Inventory ({variantsForDisplay.length} variants)</h4>
                          <div className="text-xs text-neutral-500">
                            {editing.variantConfig.sizes && editing.variantConfig.sizes.length > 0
                              ? `${editing.variantConfig.sizes.length} size × ${editing.variantConfig.wickTypes.length} wick × ${availableScents.length} scents`
                              : `${editing.variantConfig.wickTypes.length} wick × ${availableScents.length} scents`
                            }
                          </div>
                        </div>

                        {availableScents.length === 0 ? (
                          <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl text-center">
                            <svg className="w-8 h-8 text-amber-600 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                              />
                            </svg>
                            <p className="text-sm font-medium text-amber-900 mb-1">No scents available</p>
                            <p className="text-xs text-amber-800">
                              <a href="/admin/scents" className="underline font-medium">
                                Add scents
                              </a>{" "}
                              to create product variants
                            </p>
                          </div>
                        ) : (
                          <div className="max-h-[400px] overflow-y-auto border border-neutral-200 rounded-xl">
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 p-4">
                              {variantsForDisplay.map((v) => (
                                <div
                                  key={v.id}
                                  className="bg-white border border-neutral-200 rounded-lg p-3 hover:border-[var(--color-accent)] hover:shadow-sm transition-all"
                                >
                                  {v.sizeName && (
                                    <div className="text-xs font-semibold text-[var(--color-accent)] mb-1 truncate">
                                      {v.sizeName}
                                    </div>
                                  )}
                                  <div className="text-xs font-medium text-neutral-900 mb-2 line-clamp-2" title={v.sizeName ? `${v.sizeName} / ${v.wickName} / ${v.scentName}` : `${v.wickName} / ${v.scentName}`}>
                                    {v.scentName}
                                  </div>
                                  <div className="text-xs text-neutral-500 mb-2 truncate">{v.wickName}</div>
                                  <input
                                    className="input text-sm w-full"
                                    type="number"
                                    min="0"
                                    value={v.stock}
                                    placeholder="Stock"
                                    onChange={(e) => {
                                      const newData = { ...editing.variantConfig!.variantData };
                                      newData[v.id] = { stock: e.target.value === "" ? 0 : Number(e.target.value) };
                                      setEditing({
                                        ...editing,
                                        variantConfig: { ...editing.variantConfig!, variantData: newData },
                                      });
                                    }}
                                    onBlur={(e) => {
                                      const val = e.target.value === "" ? 0 : Number(e.target.value);
                                      const newData = { ...editing.variantConfig!.variantData };
                                      newData[v.id] = { stock: Math.max(0, val) };
                                      setEditing({
                                        ...editing,
                                        variantConfig: { ...editing.variantConfig!, variantData: newData },
                                      });
                                    }}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-200 bg-neutral-50">
              <button
                className="btn text-sm px-4 py-2"
                onClick={() => {
                  setEditing(null);
                  setSlugTouched(false);
                  setSlugError(null);
                  setError(null);
                }}
              >
                <svg className="w-4 h-4 inline mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel
              </button>

              <button
                className="btn btn-primary text-sm px-6 py-2"
                onClick={() => {
                  if (!editing) return;
                  stageProduct(editing);
                  setEditing(null);
                }}
              >
                <svg className="w-4 h-4 inline mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save Draft
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && qrDataURL && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={closeQRModal} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-[var(--color-ink)]">Scan to Upload</h2>
              <button className="p-2 hover:bg-neutral-100 rounded-lg transition-colors" onClick={closeQRModal} aria-label="Close">
                <svg className="w-5 h-5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* QR Code */}
            <div className="bg-white p-4 rounded-xl border-2 border-neutral-200 mb-4">
              <img src={qrDataURL} alt="QR Code" className="w-full h-auto" />
            </div>

            {/* Copy link (uses uploadToken so it's not unused) */}
            {uploadToken && origin && (
              <div className="mb-4 p-3 rounded-xl border border-neutral-200 bg-neutral-50">
                <div className="text-xs text-neutral-600 mb-2">Or open this link on your phone:</div>
                <div className="flex gap-2">
                  <input className="input flex-1 text-xs" readOnly value={`${origin}/mobile-upload?token=${uploadToken}`} />
                  <button
                    type="button"
                    className="btn text-xs"
                    onClick={async () => {
                      const url = `${origin}/mobile-upload?token=${uploadToken}`;
                      try {
                        await navigator.clipboard.writeText(url);
                        await showAlert("Upload link copied to clipboard!", "Copied");
                      } catch {
                        await showAlert("Could not copy link. Try selecting and copying it manually.", "Copy failed");
                      }
                    }}
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="space-y-3 mb-4">
              <div className="flex items-start gap-3 text-sm">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 font-semibold text-xs">1</span>
                </div>
                <p className="text-neutral-700">Open your phone&apos;s camera app</p>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 font-semibold text-xs">2</span>
                </div>
                <p className="text-neutral-700">Point it at this QR code</p>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 font-semibold text-xs">3</span>
                </div>
                <p className="text-neutral-700">Select and upload photos from your phone</p>
              </div>
            </div>

            {/* Upload Status */}
            {uploadedCount > 0 && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-900">
                    {uploadedCount} {uploadedCount === 1 ? "image" : "images"} uploaded
                  </p>
                  <p className="text-xs text-green-700">Images are being added to your product</p>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-neutral-200">
              <p className="text-xs text-neutral-500">Session expires in 5 minutes</p>
              <button className="btn btn-primary text-sm" onClick={closeQRModal}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}