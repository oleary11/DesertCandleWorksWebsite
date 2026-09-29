"use client";

import { useEffect, useMemo, useState, useRef, useCallback, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Download,
  FileSpreadsheet,
  ImageIcon,
  ImageOff,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Star,
  Trash2,
  Video,
  X,
  ArrowDown,
  ArrowUp,
  AlertCircle,
  Check,
  ChevronDown as ChevronDownIcon,
  ChevronUp,
  Info,
  QrCode,
  Upload,
} from "lucide-react";
import PageHeader from "../_components/PageHeader";
import { Badge, FilterSelect, FormSection, Menu, MenuItem, MenuLabel } from "../_components/ui";
import CandleSpinner from "@/components/CandleSpinner";
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
  containerId?: string;
};

type VariantConfig = {
  sizes?: ProductSize[];
  wickTypes: WickType[];
  // scents are now global - not stored per product
  variantData: Record<string, { stock: number }>;
};

// A single bottle offered on a Home Goods listing. priceCents is OPTIONAL:
// when omitted, this bottle simply inherits the listing's Product.price
// ("Default Price") live — only set it when this specific bottle needs to
// override that default (e.g. a Pappy Van Winkle bottle costs more than a
// Tito's bottle even on the same listing).
type HomeGoodsBottleOption = {
  bottleId: string;
  bottleName: string;
  priceCents?: number;
  stripePriceId?: string;
};

// Shape read from /api/admin/bottle-inventory for the bottle checklist
type BottleInventoryItem = {
  id: string;
  name: string;
  qtyUncut: number;
  qtyCutUnpolished: number;
  qtyCutPolished: number;
  defaultPriceCents?: number;
  imageUrl?: string;
  usableForHomeGoods: boolean;
  archived: boolean;
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
  productType?: "candle" | "home_goods"; // default "candle" when absent
  bottleOptions?: HomeGoodsBottleOption[]; // only used when productType === "home_goods"
  requiresUncut?: boolean; // Home Goods only: only whole/uncut bottles work
  requiresUnpoured?: boolean; // Home Goods only: uncut OR cut bottles work (default true, the common case)
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
    productType: "candle",
    bottleOptions: [],
    requiresUncut: false,
    requiresUnpoured: true,
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
      <label htmlFor={id} className="a-label">
        {label}
      </label>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--a-muted)] pointer-events-none" />

        <input
          id={id}
          ref={inputRef}
          className="a-input !pl-10 !pr-10"
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
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-md hover:bg-[var(--a-tint)]"
            onClick={() => {
              setQuery("");
              setActiveIndex(0);
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
          >
            <span className="text-[var(--a-muted)]">✕</span>
          </button>
        )}

        {open && (
          <div
            id={`${id}-listbox`}
            role="listbox"
            className="absolute z-30 mt-2 w-full rounded-xl border border-[var(--a-line)] bg-white shadow-lg overflow-hidden"
          >
            <div className="max-h-72 overflow-y-auto overscroll-contain">
              {filtered.length === 0 ? (
                <div className="px-4 py-3 text-sm text-[var(--a-muted)]">
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
                        <div className="text-xs text-[var(--a-muted)] mt-0.5">
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

/* ---------- Home Goods form (bottle-picker product type) ---------- */
function HomeGoodsBottleOptionsForm(props: {
  editing: Product;
  setEditing: React.Dispatch<React.SetStateAction<Product | null>>;
  bottleInventory: BottleInventoryItem[];
  handleImagePick: (
    e: React.ChangeEvent<HTMLInputElement>,
    editingLocal: Product | null,
    setEditingLocal: (v: Product) => void
  ) => void;
  removeImage: (index: number, editingLocal: Product | null, setEditingLocal: (v: Product) => void) => void;
  slugTouched: boolean;
  setSlugTouched: (v: boolean) => void;
  isServerItem: (slug: string) => boolean;
  slugify: (name: string) => string;
  SLUG_REGEX: RegExp;
  slugError: string | null;
  setSlugError: (v: string | null) => void;
}) {
  const {
    editing,
    setEditing,
    bottleInventory,
    handleImagePick,
    removeImage,
    setSlugTouched,
    isServerItem,
    slugify,
    SLUG_REGEX,
    slugError,
    setSlugError,
  } = props;

  const bottleOptions = editing.bottleOptions || [];
  const mode: "uncut" | "unpoured" = editing.requiresUncut ? "uncut" : "unpoured";
  // Only bottles flagged usable-for-Home-Goods in the Inventory catalog ever
  // show up here — some bottles just don't work for any Home Goods product.
  const eligibleInventory = bottleInventory.filter((b) => !b.archived && b.usableForHomeGoods);

  function setDefaultPrice(dollars: number) {
    setEditing({ ...editing, price: dollars });
  }

  function setRequirement(nextMode: "uncut" | "unpoured") {
    setEditing({
      ...editing,
      requiresUncut: nextMode === "uncut",
      requiresUnpoured: nextMode === "unpoured",
    });
  }

  // Auto-check every eligible bottle once, for a brand-new draft only — never
  // overwrite an existing product's manually-curated bottle list.
  const autoPopulatedRef = useRef(false);
  useEffect(() => {
    if (autoPopulatedRef.current) return;
    if (isServerItem(editing.slug)) {
      autoPopulatedRef.current = true;
      return;
    }
    if (bottleInventory.length === 0) return;
    autoPopulatedRef.current = true;
    setEditing((prev) => {
      if (!prev) return prev;
      const already = new Set((prev.bottleOptions || []).map((o) => o.bottleId));
      const additions = eligibleInventory
        .filter((b) => !already.has(b.id))
        .map((b): HomeGoodsBottleOption => ({ bottleId: b.id, bottleName: b.name }));
      return { ...prev, bottleOptions: [...(prev.bottleOptions || []), ...additions] };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bottleInventory.length]);

  return (
    <div className="space-y-6">
      {/* Basic Information (shared with candles: one posting, one set of images, no per-bottle photos) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block">
          <div className="a-label">Product Name</div>
          <input
            className="a-input"
            value={editing.name}
            onChange={(e) => {
              const name = e.target.value;
              setEditing((prev) => {
                if (!prev) return prev;
                const next = { ...prev, name };
                if (!props.slugTouched && !isServerItem(prev.slug)) {
                  next.slug = slugify(name);
                  setSlugError(next.slug && SLUG_REGEX.test(next.slug) ? null : "Use lowercase letters/numbers with single hyphens");
                }
                return next;
              });
            }}
            placeholder="e.g. Soap Dispenser"
          />
        </label>

        <label className="block">
          <div className="a-label">URL Slug</div>
          <input
            className="a-input"
            value={editing.slug}
            disabled={isServerItem(editing.slug)}
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
            placeholder="e.g. soap-dispenser"
          />
          {slugError && <p className="a-error">{slugError}</p>}
        </label>

        <label className="block">
          <div className="a-label">SKU</div>
          <input className="a-input" value={editing.sku} onChange={(e) => setEditing({ ...editing, sku: e.target.value })} />
        </label>

        <label className="flex items-center gap-2 self-end pb-2">
          <input
            type="checkbox"
            checked={editing.visibleOnWebsite !== false}
            onChange={(e) => setEditing({ ...editing, visibleOnWebsite: e.target.checked })}
          />
          <span>Show on website</span>
        </label>

        <label className="block md:col-span-2">
          <div className="a-label">Description</div>
          <textarea
            className="a-textarea"
            rows={4}
            value={editing.seoDescription}
            onChange={(e) => setEditing({ ...editing, seoDescription: e.target.value })}
            placeholder="Describe this Home Goods listing"
          />
        </label>
      </div>

      {/* Images — one shared set for the whole listing, not per bottle */}
      <div className="a-panel">
        <h4 className="mb-3 text-sm font-semibold text-[var(--a-ink)]">Images</h4>
        <label className="a-btn cursor-pointer focus-within:shadow-[var(--a-focus)]">
          <Upload className="h-4 w-4" aria-hidden />
          Add photos
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => handleImagePick(e, editing, (v) => setEditing(v))}
          />
        </label>
        {editing.images && editing.images.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 mt-3">
            {editing.images.map((url, idx) => (
              <div key={url + idx} className="relative aspect-square rounded-lg overflow-hidden border border-[var(--a-line)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  className="absolute top-1 right-1 bg-white/90 rounded-full p-1 hover:bg-white"
                  onClick={() => removeImage(idx, editing, (v) => setEditing(v))}
                  title="Remove image"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottle Options */}
      <div className="a-panel">
        <div className="mb-3">
          <h4 className="text-sm font-semibold text-[var(--a-ink)]">Bottle Options</h4>
          <p className="text-xs text-[var(--a-muted)] mt-0.5">
            Every eligible bottle from your Inventory is checked by default. Uncheck any you don&apos;t want to
            offer on this listing — unchecking removes it.
          </p>
        </div>

        <label className="block max-w-[10rem] mb-4">
          <div className="a-label">Default Price ($)</div>
          <input
            className="a-input"
            type="number"
            step="0.01"
            min="0"
            value={editing.price === 0 ? "" : editing.price}
            onChange={(e) => setDefaultPrice(e.target.value === "" ? 0 : Number(e.target.value))}
            placeholder="0.00"
          />
        </label>

        <div className="flex flex-wrap gap-4 mb-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={mode === "uncut"} onChange={() => setRequirement("uncut")} />
            Requires Uncut
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={mode === "unpoured"} onChange={() => setRequirement("unpoured")} />
            Requires Unpoured
          </label>
        </div>
        <p className="text-xs text-[var(--a-muted)] mb-3">
          {mode === "uncut"
            ? "Only whole, uncut bottles work for this listing (e.g. a soap dispenser needs an intact bottle)."
            : "Uncut, cut unpolished, or cut polished bottles all work for this listing (the common case)."}
        </p>

        {eligibleInventory.length > 0 ? (
          <>
            <div className="max-h-96 overflow-y-auto border border-[var(--a-line)] rounded-xl divide-y divide-[var(--a-line)] bg-white">
              {eligibleInventory.map((b) => {
                const opt = bottleOptions.find((o) => o.bottleId === b.id);
                const checked = !!opt;
                const effectiveCents = opt?.priceCents ?? Math.round((editing.price || 0) * 100);
                const hasStock = b.qtyUncut + b.qtyCutUnpolished + b.qtyCutPolished > 0;
                return (
                  <div key={b.id} className="flex items-center gap-3 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      className="shrink-0"
                      onChange={(e) => {
                        if (e.target.checked) {
                          const newOption: HomeGoodsBottleOption = { bottleId: b.id, bottleName: b.name };
                          setEditing({ ...editing, bottleOptions: [...bottleOptions, newOption] });
                        } else {
                          setEditing({ ...editing, bottleOptions: bottleOptions.filter((o) => o.bottleId !== b.id) });
                        }
                      }}
                    />
                    <div className="w-9 h-9 rounded-md overflow-hidden bg-[var(--a-tint)] shrink-0 flex items-center justify-center">
                      {b.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.imageUrl} alt="" className="w-full h-full object-contain" />
                      ) : (
                        <span className="text-[9px] text-[var(--a-faint)]">No photo</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{b.name}</div>
                      <div className="text-xs text-[var(--a-muted)] truncate whitespace-nowrap overflow-hidden">
                        Uncut: {b.qtyUncut} · Cut Unpolished: {b.qtyCutUnpolished} · Cut Polished: {b.qtyCutPolished}
                        {!hasStock && <span className="text-amber-600 ml-1">(no stock yet)</span>}
                      </div>
                    </div>
                    {checked && (
                      <input
                        className="a-input !w-24 shrink-0"
                        type="number"
                        step="0.01"
                        min="0"
                        value={(effectiveCents / 100).toFixed(2)}
                        onChange={(e) => {
                          const next = bottleOptions.map((o) =>
                            o.bottleId === b.id
                              ? { ...o, priceCents: Math.round((parseFloat(e.target.value) || 0) * 100) }
                              : o
                          );
                          setEditing({ ...editing, bottleOptions: next });
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-[var(--a-muted)] mt-2">{bottleOptions.length} bottle(s) selected</p>
          </>
        ) : (
          <div className="text-center py-4 text-sm text-[var(--a-muted)]">
            No bottles are marked usable for Home Goods yet — check the &quot;Home Goods&quot; column on the
            Inventory page.
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Square catalog sync for Home Goods listings. Mirrors the candle Stripe/Square
 * section (one variation per bottle choice instead of per size×wick×scent),
 * but skips the "Stripe Price ID" part entirely — Home Goods checkout uses
 * dynamic per-bottle pricing and never needs a pre-created Stripe object.
 */
function HomeGoodsSquareSection(props: {
  editing: Product;
  setEditing: React.Dispatch<React.SetStateAction<Product | null>>;
  showAlert: (message: string, title?: string) => Promise<void>;
  showConfirm: (message: string, title?: string) => Promise<boolean>;
  setSaving: (v: boolean) => void;
  setSavingLabel: (v: string) => void;
  load: () => Promise<void>;
}) {
  const { editing, setEditing, showAlert, showConfirm, setSaving, setSavingLabel, load } = props;

  async function createStripeProduct() {
    if (!editing.name.trim()) {
      await showAlert("Please enter a product name first", "Missing Information");
      return;
    }
    if (!editing.price || editing.price <= 0) {
      await showAlert("Please enter a valid default price first", "Missing Information");
      return;
    }
    if (!editing.bottleOptions || editing.bottleOptions.length === 0) {
      await showAlert("Select at least one bottle option first", "Missing Information");
      return;
    }

    try {
      setSavingLabel("Creating Stripe product and bottle prices…");
      setSaving(true);
      const stripeImages = editing.images?.length
        ? editing.images
        : editing.image ? [editing.image] : [];
      const res = await fetch("/api/admin/create-stripe-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editing.name,
          price: editing.price,
          description: editing.seoDescription,
          images: stripeImages,
          bottleOptions: editing.bottleOptions,
        }),
      });
      const data = (await res.json()) as {
        productId?: string;
        priceId?: string;
        priceMapping?: Record<string, string>;
        priceCount?: number;
        error?: string;
        details?: string;
      };
      if (!res.ok || !data.priceId) {
        throw new Error(data.details || data.error || "Failed to create Stripe product");
      }

      const bottleOptions = editing.bottleOptions.map((option) => ({
        ...option,
        stripePriceId: data.priceMapping?.[option.bottleId] || option.stripePriceId,
      }));
      const updated = { ...editing, stripePriceId: data.priceId, bottleOptions };
      setEditing(updated);

      const saveRes = await fetch(`/api/admin/products/${editing.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stripePriceId: data.priceId, bottleOptions }),
      });
      if (!saveRes.ok) {
        const saveError = (await saveRes.json()) as { error?: string };
        setSaving(false);
        await showAlert(
          `Stripe product created but failed to save to the website: ${saveError.error || "Unknown error"}`,
          "Warning",
        );
        return;
      }

      await load();
      setSaving(false);
      await showAlert(
        `Stripe product created and saved successfully!\n\nProduct ID: ${data.productId}\nBottle prices: ${data.priceCount || bottleOptions.length}`,
        "Success",
      );
    } catch (err) {
      setSaving(false);
      await showAlert(err instanceof Error ? err.message : "Failed to create Stripe product", "Error");
    } finally {
      setSaving(false);
    }
  }

  async function createSquareProduct() {
    if (!editing.name.trim()) {
      await showAlert("Please enter a product name first", "Missing Information");
      return;
    }
    if (!editing.price || editing.price <= 0) {
      await showAlert("Please enter a valid default price first", "Missing Information");
      return;
    }
    if (!editing.bottleOptions || editing.bottleOptions.length === 0) {
      await showAlert("Select at least one bottle option first", "Missing Information");
      return;
    }

    try {
      setSavingLabel(editing.squareCatalogId ? "Re-creating Square product…" : "Creating Square product…");
      setSaving(true);

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
          bottleOptions: editing.bottleOptions,
          replaceCatalogItemId: editing.squareCatalogId || undefined,
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

      const wasRecreate = !!editing.squareCatalogId;

      setEditing({
        ...editing,
        squareCatalogId: data.catalogItemId,
        squareVariantMapping: data.variantMapping || {},
      });

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
        setSaving(false);
        await showAlert(
          `Square product created but failed to save to database: ${saveError.error || "Unknown error"}`,
          "Warning"
        );
        return;
      }

      await load();
      setSaving(false);
      await showAlert(
        `Square catalog item ${wasRecreate ? "re-created" : "created"} and saved successfully!\n\nCatalog Item ID: ${data.catalogItemId}\nVariations: ${data.variationCount}\nImages: ${data.imageCount}` +
          (wasRecreate ? "\n\nThe previous Square item was replaced automatically." : ""),
        "Success"
      );
    } catch (err) {
      setSaving(false);
      await showAlert(err instanceof Error ? err.message : "Failed to create Square product", "Error");
    }
  }

  async function syncStock() {
    try {
      setSavingLabel("Syncing stock to Square…");
      setSaving(true);
      const res = await fetch("/api/admin/sync-square-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productSlug: editing.slug }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error || "Failed to sync stock");
      setSaving(false);
      await showAlert(`Stock synced to Square successfully!\n\n${data.message}`, "Success");
    } catch (err) {
      setSaving(false);
      await showAlert(err instanceof Error ? err.message : "Failed to sync stock to Square", "Error");
    }
  }

  async function syncDetails() {
    try {
      setSavingLabel("Syncing details to Square…");
      setSaving(true);
      const res = await fetch("/api/admin/sync-square-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productSlug: editing.slug }),
      });
      const data = (await res.json()) as {
        error?: string;
        results?: Array<{ imagesUploaded?: number; totalImages?: number }>;
      };
      if (!res.ok) throw new Error(data.error || "Failed to sync details");
      const r = data.results?.[0];
      setSaving(false);
      await showAlert(
        `Product details synced to Square!\n\nImages uploaded: ${r?.imagesUploaded ?? 0} / ${r?.totalImages ?? 0}`,
        "Success"
      );
    } catch (err) {
      setSaving(false);
      await showAlert(err instanceof Error ? err.message : "Failed to sync details to Square", "Error");
    }
  }

  async function recreateWithCurrentBottles() {
    const confirmed = await showConfirm(
      `This will re-create "${editing.name}" on Square with the current bottle list (including any bottles added or removed since it was last synced). The existing Square item will be replaced. Continue?`,
      "Re-create Square Item"
    );
    if (!confirmed) return;
    await createSquareProduct();
  }

  return (
    <div className="mb-8">
      <div className="mb-8">
        <h3 className="mb-4 text-base font-semibold text-[var(--a-ink)]">Stripe (Online)</h3>
        <label className="block">
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="a-label mb-0">Stripe Price ID</span>
            {!editing.stripePriceId && (
              <button
                type="button"
                className="a-link"
                onClick={createStripeProduct}
              >
                Create Stripe Product
              </button>
            )}
          </div>
          <input
            className="a-input"
            value={editing.stripePriceId || ""}
            onChange={(e) => setEditing({ ...editing, stripePriceId: e.target.value })}
            placeholder="Click 'Create Stripe Product' or paste manually"
          />
        </label>
        <p className="mt-1 text-xs text-[var(--a-muted)]">
          Creates one Stripe product with a separate price for every selected bottle option.
        </p>
      </div>

      <h3 className="text-sm font-semibold text-[var(--a-ink)] mb-4 flex items-center gap-2">
        <svg className="h-4 w-4 text-[var(--a-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        Square (POS)
      </h3>
      <label className="block">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="a-label mb-0">Square Catalog ID</span>
          <div className="flex flex-wrap gap-2">
            {editing.squareCatalogId && (
              <button type="button" className="a-link" onClick={syncStock}>
                Sync Stock to Square
              </button>
            )}
            {editing.squareCatalogId && (
              <button type="button" className="a-link" onClick={syncDetails}>
                Sync Details to Square
              </button>
            )}
            {editing.squareCatalogId && (
              <button type="button" className="a-link" onClick={recreateWithCurrentBottles}>
                Re-create with Current Bottles
              </button>
            )}
            {!editing.squareCatalogId && (
              <button type="button" className="a-link" onClick={createSquareProduct}>
                Create Square Product
              </button>
            )}
          </div>
        </div>
        <input
          className="a-input"
          value={editing.squareCatalogId || ""}
          onChange={(e) => setEditing({ ...editing, squareCatalogId: e.target.value })}
          placeholder="Click 'Create Square Product' or paste manually"
        />
      </label>
      <p className="mt-1 text-xs text-[var(--a-muted)]">
        Each bottle option becomes its own Square item variation with its own price. Re-run &quot;Re-create with
        Current Bottles&quot; after adding or removing a bottle from this listing.
      </p>
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
  const [bottleInventory, setBottleInventory] = useState<BottleInventoryItem[]>([]);
  const [settings, setSettings] = useState<CalculatorSettings>({
    waxCostPerOz: 0,
    waterToWaxRatio: 0.9,
    defaultFragranceLoad: 0.1,
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const isHomeGoods = editing?.productType === "home_goods";
  const [priceInputStr, setPriceInputStr] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [savingLabel, setSavingLabel] = useState<string>("Working…");
  const [imageSyncProgress, setImageSyncProgress] = useState<{ current: number; total: number } | null>(null);
  const [syncMenuOpen, setSyncMenuOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New filter and sort states
  const [visibleFilter, setVisibleFilter] = useState<"all" | "visible" | "hidden">("all");
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [scentFilter, setScentFilter] = useState<string[]>([]); // scent IDs
  const [stockFilter, setStockFilter] = useState<"all" | "in-stock" | "out-of-stock">("all");
  const [bestFilter, setBestFilter] = useState<"all" | "best" | "not-best">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [sortBy, setSortBy] = useState<"name" | "price" | "cost" | "stock" | "best" | "status" | "none">("none");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [scentDropdownOpen, setScentDropdownOpen] = useState(false);

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
      const [productsRes, scentsRes, typesRes, containersRes, settingsRes, bottleInventoryRes] = await Promise.all([
        fetch("/api/admin/products", { cache: "no-store" }),
        fetch("/api/admin/scents", { cache: "no-store" }),
        fetch("/api/admin/alcohol-types?active=1", { cache: "no-store" }),
        fetch("/api/admin/containers", { cache: "no-store" }),
        fetch("/api/admin/calculator-settings", { cache: "no-store" }),
        fetch("/api/admin/bottle-inventory", { cache: "no-store" }),
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

      if (bottleInventoryRes.ok) {
        const bottleData = (await bottleInventoryRes.json()) as { items?: BottleInventoryItem[] };
        setBottleInventory(bottleData.items || []);
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

  // Sync priceInputStr whenever a different product is opened for editing
  useEffect(() => {
    if (editing) {
      setPriceInputStr(editing.price === 0 ? "" : editing.price.toString());
    } else {
      setPriceInputStr("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.slug]);

  // Close filter dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (typeDropdownOpen && !target.closest(".type-filter-dropdown")) {
        setTypeDropdownOpen(false);
      }
      if (scentDropdownOpen && !target.closest(".scent-filter-dropdown")) {
        setScentDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [typeDropdownOpen, scentDropdownOpen]);

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

    // Scent filter (multi-select) — only show products with in-stock variants for the selected scent(s)
    if (scentFilter.length > 0) {
      result = result.filter((p) => {
        if (!p.variantConfig) return false;
        const { variantData } = p.variantConfig;
        return scentFilter.some((scentId) =>
          Object.entries(variantData).some(([key, data]) => key.endsWith(`-${scentId}`) && data.stock > 0)
        );
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
  }, [merged, filter, visibleFilter, typeFilter, scentFilter, stockFilter, bestFilter, statusFilter, sortBy, sortDirection, hasDraft]);

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
      return <th className={className}>{children}</th>;
    }

    const isActive = sortBy === column;
    const Arrow = sortDirection === "asc" ? ArrowUp : ArrowDown;

    return (
      <th
        className={className}
        aria-sort={isActive ? (sortDirection === "asc" ? "ascending" : "descending") : undefined}
      >
        <button
          type="button"
          className={`inline-flex items-center gap-1 whitespace-nowrap transition-colors hover:text-[var(--a-ink)] ${isActive ? "text-[var(--a-ink)]" : ""}`}
          onClick={() => handleSort(column)}
        >
          {children}
          {isActive && <Arrow className="h-3 w-3" aria-hidden />}
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

    setSavingLabel("Publishing…");
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
    setSavingLabel("Publishing all…");
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

  // Total stock across all filtered products (uses variant stock when available)
  const totalStock = useMemo(() => filtered.reduce((sum, p) => sum + getTotalStock(p), 0), [filtered]);

  // Next SKU for new product modal
  const nextSku = useMemo(() => {
    const allSkus = [...items.map((i) => i.sku), ...Object.values(staged).map((d) => d.sku)].filter(Boolean);
    return computeNextSku(allSkus);
  }, [items, staged]);

  /* ---------- Sync actions ---------- */
  async function syncStripeHomeGoods() {
                    setSyncMenuOpen(false);
                    const homeGoods = merged.filter((product) =>
                      product.productType === "home_goods" && product.stripePriceId && product.bottleOptions?.length,
                    );
                    if (homeGoods.length === 0) {
                      await showAlert("No Home Goods products are connected to Stripe yet.", "Info");
                      return;
                    }
                    const confirmed = await showConfirm(
                      `Sync prices and bottle variations for ${homeGoods.length} Home Goods Stripe products? Changed prices will receive new Stripe Price IDs.`,
                      "Sync Stripe Prices",
                    );
                    if (!confirmed) return;
                    setSavingLabel("Syncing Stripe prices and variations…");
                    setSaving(true);
                    try {
                      const res = await fetch("/api/admin/sync-stripe-home-goods", { method: "POST" });
                      const data = (await res.json()) as {
                        synced?: number;
                        failed?: number;
                        pricesCreated?: number;
                        pricesDeactivated?: number;
                        error?: string;
                      };
                      if (!res.ok) throw new Error(data.error || "Stripe sync failed");
                      await load();
                      setSaving(false);
                      await showAlert(
                        `Stripe sync complete!\n\nProducts: ${data.synced || 0} synced, ${data.failed || 0} failed\nNew prices: ${data.pricesCreated || 0}\nOld prices deactivated: ${data.pricesDeactivated || 0}`,
                        "Sync Complete",
                      );
                    } catch (error) {
                      setSaving(false);
                      await showAlert(error instanceof Error ? error.message : "Stripe sync failed", "Error");
                    } finally {
                      setSaving(false);
                    }
  }

  async function syncAllToSquare() {
                    setSyncMenuOpen(false);
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
                    setSavingLabel("Generating variant mappings…");
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
                  setSavingLabel("Generating variant mappings…");
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

              setSavingLabel("Syncing stock & details to Square…");
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

                setSaving(false);
                await showAlert(
                  `Sync complete!\n\nStock: ${stockData.successCount} synced, ${stockData.errorCount} errors\nDetails: ${detailsData.successCount ?? 0} synced, ${detailsData.errorCount ?? 0} errors${
                    detailsData.error ? `\n\nDetails error: ${detailsData.error}` : ""
                  }${stockErrors ? "\n\nStock errors:\n" + stockErrors : ""}`,
                  "Sync Complete"
                );
              } catch (err) {
                // eslint-disable-next-line no-console
                console.error("[Sync All Square] Error:", err);
                setSaving(false);
                await showAlert(err instanceof Error ? err.message : "Failed to sync all products to Square", "Error");
              }
  }

  async function syncImagesToSquare() {
                    setSyncMenuOpen(false);
                    const confirmed = await showConfirm(
                "Sync images for all Square products? This uploads product photos to Square in batches of 5. It may take several minutes.",
                "Sync Images to Square"
              );
              if (!confirmed) return;

              const IMAGE_CHUNK_SIZE = 5;
              const bottleImageMap = new Map(bottleInventory.map((bottle) => [bottle.id, bottle.imageUrl]));
              const imageJobs = merged
                .filter((product) => product.squareCatalogId)
                .map((product) => {
                  const urls = product.productType === "home_goods"
                    ? (product.bottleOptions || [])
                        .map((option) => bottleImageMap.get(option.bottleId))
                        .filter((url): url is string => Boolean(url))
                    : product.images?.length ? product.images : product.image ? [product.image] : [];
                  return { slug: product.slug, imageCount: new Set(urls).size, isHomeGoods: product.productType === "home_goods" };
                })
                .filter((job) => job.imageCount > 0);
              const totalToProcess = imageJobs.reduce((sum, job) => sum + job.imageCount, 0);

              setSavingLabel("Syncing images to Square…");
              setSaving(true);
              setImageSyncProgress({ current: 0, total: totalToProcess });
              let totalImages = 0;
              let totalErrors = 0;
              let processedImages = 0;

              try {
                for (const job of imageJobs) {
                  for (let imageOffset = 0; imageOffset < job.imageCount; imageOffset += IMAGE_CHUNK_SIZE) {
                    const res = await fetch(
                      job.isHomeGoods
                        ? "/api/admin/sync-square-home-goods-images"
                        : "/api/admin/sync-square-details",
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(
                          job.isHomeGoods
                            ? { productSlug: job.slug, offset: imageOffset, limit: IMAGE_CHUNK_SIZE }
                            : {
                                productSlug: job.slug,
                                imagesOnly: true,
                                imageOffset,
                                imageLimit: IMAGE_CHUNK_SIZE,
                              },
                        ),
                      },
                    );

                    if (!res.ok) {
                      const text = await res.text();
                      throw new Error(`Image batch failed for ${job.slug} (${res.status}): ${text.slice(0, 100)}`);
                    }

                    const data = (await res.json()) as {
                      totalImagesUploaded?: number;
                      errorCount?: number;
                      results?: Array<{ imageErrors?: number; imagesProcessed?: number }>;
                      uploaded?: number;
                      failed?: number;
                      processed?: number;
                    };
                    const result = data.results?.[0];
                    totalImages += job.isHomeGoods ? (data.uploaded ?? 0) : (data.totalImagesUploaded ?? 0);
                    totalErrors += job.isHomeGoods
                      ? (data.failed ?? 0)
                      : (data.errorCount ?? 0) + (result?.imageErrors ?? 0);
                    processedImages += job.isHomeGoods
                      ? (data.processed ?? 0)
                      : result?.imagesProcessed ?? Math.min(IMAGE_CHUNK_SIZE, job.imageCount - imageOffset);
                    setImageSyncProgress({ current: processedImages, total: totalToProcess });
                  }
                }
                const total = imageJobs.length;

                // Dismiss overlay before showing modal so user can see it
                setSaving(false);
                setImageSyncProgress(null);
                await showAlert(
                  `Image sync complete!\n\n${totalImages} images uploaded across ${total} products${totalErrors ? `\n${totalErrors} errors` : ""}`,
                  "Images Synced"
                );
              } catch (err) {
                // eslint-disable-next-line no-console
                console.error("[Sync Images] Error:", err);
                setSaving(false);
                setImageSyncProgress(null);
                await showAlert(err instanceof Error ? err.message : "Failed to sync images to Square", "Error");
              }
  }

  /* ---------- List helpers ---------- */
  const stagedCount = Object.keys(staged).length;
  const filtersActive =
    filter !== "" ||
    visibleFilter !== "all" ||
    typeFilter.length > 0 ||
    scentFilter.length > 0 ||
    stockFilter !== "all" ||
    bestFilter !== "all" ||
    statusFilter !== "all" ||
    sortBy !== "none";

  function clearFilters() {
    setFilter("");
    setVisibleFilter("all");
    setTypeFilter([]);
    setScentFilter([]);
    setStockFilter("all");
    setBestFilter("all");
    setStatusFilter("all");
    setSortBy("none");
    setSortDirection("asc");
  }

  function openEditor(p: Product) {
    setEditing(p);
    setSlugTouched(true);
    setSlugError(null);
    setError(null);
  }

  function closeEditor() {
    setEditing(null);
    setSlugTouched(false);
    setSlugError(null);
    setError(null);
  }

  function openNewProduct() {
    const p = emptyProduct();
    p.sku = nextSku; // default auto-increment
    setEditing(p);
    setSlugTouched(false);
    setSlugError(null);
    setError(null);
  }

  function productThumb(p: Product) {
    const img = p.images?.[0] ?? p.image;
    return (
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[var(--a-tint)]">
        {img ? (
          <Image src={img} alt="" fill sizes="48px" className="object-contain p-0.5" />
        ) : (
          <ImageOff className="absolute inset-0 m-auto h-5 w-5 text-[var(--a-faint)]" strokeWidth={1.5} aria-hidden />
        )}
      </div>
    );
  }

  function productBadges(p: Product) {
    const isDraft = hasDraft(p.slug);
    const hidden = p.visibleOnWebsite === false;
    if (!isDraft && !hidden && !p.bestSeller) return null;
    return (
      <span className="flex flex-wrap gap-1">
        {isDraft && <Badge tone="amber">Unpublished</Badge>}
        {hidden && <Badge>Hidden</Badge>}
        {p.bestSeller && (
          <Badge tone="amber">
            <Star className="h-3 w-3 fill-current" aria-hidden />
            Best seller
          </Badge>
        )}
      </span>
    );
  }

  /* ---------- UI ---------- */
  return (
    <div className="a-ui mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
      {/* Full-screen loading overlay — shown during any long-running operation */}
      {saving && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
          <div role="status" aria-live="polite" className="a-card flex min-w-[220px] flex-col items-center gap-4 px-10 py-8 shadow-2xl">
            <CandleSpinner />
            <p className="text-sm font-medium text-[var(--a-ink)]">
              {imageSyncProgress
                ? `Syncing images… ${imageSyncProgress.current} / ${imageSyncProgress.total}`
                : savingLabel}
            </p>
          </div>
        </div>
      )}

      <PageHeader
        title="Products"
        description={loading ? "Loading…" : `${merged.length} products · ${totalStock} in stock${filtersActive ? " (filtered)" : ""}`}
        actions={
          <>
            <Menu
              label={<><Download className="h-4 w-4" aria-hidden />Export</>}
              open={exportOpen}
              onOpenChange={setExportOpen}
              align="left"
              disabled={filtered.length === 0}
            >
              <MenuLabel>{filtered.length} products</MenuLabel>
              <MenuItem icon={<FileSpreadsheet className="h-4 w-4" />} onClick={() => { setExportOpen(false); exportToCSV(); }}>
                CSV spreadsheet
              </MenuItem>
              <MenuItem icon={<Video className="h-4 w-4" />} onClick={() => { setExportOpen(false); exportToTikTok(); }}>
                TikTok Shop template
              </MenuItem>
            </Menu>

            <Menu
              label={<><RefreshCw className="h-4 w-4" aria-hidden />Sync</>}
              open={syncMenuOpen}
              onOpenChange={setSyncMenuOpen}
              disabled={saving}
            >
              <MenuLabel>Square</MenuLabel>
              <MenuItem icon={<RefreshCw className="h-4 w-4" />} hint="Inventory, names and descriptions" disabled={saving} onClick={() => void syncAllToSquare()}>
                Sync stock + details
              </MenuItem>
              <MenuItem icon={<ImageIcon className="h-4 w-4" />} hint="Uploads photos in batches of 5" disabled={saving} onClick={() => void syncImagesToSquare()}>
                Sync images
              </MenuItem>
              <MenuLabel>Stripe</MenuLabel>
              <MenuItem icon={<RefreshCw className="h-4 w-4" />} hint="Home Goods prices and bottle options" disabled={saving} onClick={() => void syncStripeHomeGoods()}>
                Sync prices + variations
              </MenuItem>
              <Link href="/admin/stripe-product-sync" role="menuitem" className="a-menu-item" onClick={() => setSyncMenuOpen(false)}>
                <ImageIcon className="h-4 w-4 text-[var(--a-muted)]" aria-hidden />
                Sync images
              </Link>
            </Menu>

            <button className="a-btn a-btn-primary" onClick={openNewProduct}>
              <Plus className="h-4 w-4" aria-hidden />
              <span className="sm:hidden">New</span>
              <span className="hidden sm:inline">New product</span>
            </button>
          </>
        }
      />

      {/* Unpublished changes */}
      {stagedCount > 0 && (
        <div className="sticky top-16 z-20 mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-[#fdf6e7] px-4 py-3 shadow-sm">
          <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden />
          <p className="min-w-0 flex-1 text-sm text-[#6b4a0b]">
            <span className="font-semibold">
              {stagedCount} unpublished {stagedCount === 1 ? "change" : "changes"}.
            </span>{" "}
            They won&apos;t show on the site until you publish.
          </p>
          <div className="flex gap-2">
            <button className="a-btn a-btn-sm" onClick={() => setStaged({})} disabled={saving}>
              Discard all
            </button>
            <button className="a-btn a-btn-primary a-btn-sm" onClick={publishAll} disabled={saving}>
              {saving ? "Publishing…" : "Publish all"}
            </button>
          </div>
        </div>
      )}

      {/* Search + filters */}
      <div className="mb-4 flex flex-col gap-2 xl:flex-row xl:items-center">
        <label className="relative block xl:w-80 xl:shrink-0">
          <span className="sr-only">Search products</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--a-faint)]" aria-hidden />
          <input
            className="a-input pl-9"
            placeholder="Search name, slug or SKU…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </label>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 xl:flex-1">
          <FilterSelect
            label="Visibility"
            value={visibleFilter}
            onChange={setVisibleFilter}
            options={[
              { value: "all", label: "Visibility" },
              { value: "visible", label: "Visible" },
              { value: "hidden", label: "Hidden" },
            ]}
          />

          {/* Type filter (multi-select) */}
          <div className="type-filter-dropdown relative">
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={typeDropdownOpen}
              className={`a-select text-left ${typeFilter.length ? "a-select-active" : ""}`}
              onClick={() => setTypeDropdownOpen(!typeDropdownOpen)}
            >
              <span className="block truncate">
                {typeFilter.length === 0 ? "Type" : typeFilter.length === 1 ? typeFilter[0] : `${typeFilter.length} types`}
              </span>
            </button>
            {typeDropdownOpen && (
              <div className="a-card absolute z-30 mt-1.5 max-h-72 w-full min-w-48 overflow-y-auto p-1.5 shadow-lg">
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
                      <label key={typeName} className="a-menu-item font-normal">
                        <input
                          type="checkbox"
                          className="a-check"
                          checked={typeFilter.includes(typeName)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setTypeFilter([...typeFilter, typeName]);
                            } else {
                              setTypeFilter(typeFilter.filter((t) => t !== typeName));
                            }
                          }}
                        />
                        {typeName}
                      </label>
                    ));
                })()}
              </div>
            )}
          </div>

          {/* Scent filter (multi-select) */}
          <div className="scent-filter-dropdown relative">
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={scentDropdownOpen}
              className={`a-select text-left ${scentFilter.length ? "a-select-active" : ""}`}
              onClick={() => setScentDropdownOpen(!scentDropdownOpen)}
            >
              <span className="block truncate">
                {scentFilter.length === 0
                  ? "Scent"
                  : scentFilter.length === 1
                    ? (globalScents.find((s) => s.id === scentFilter[0])?.name ?? scentFilter[0])
                    : `${scentFilter.length} scents`}
              </span>
            </button>
            {scentDropdownOpen && (
              <div className="a-card absolute z-30 mt-1.5 max-h-72 w-full min-w-56 overflow-y-auto p-1.5 shadow-lg">
                {globalScents
                  .slice()
                  .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
                  .map((scent) => (
                    <label key={scent.id} className="a-menu-item font-normal">
                      <input
                        type="checkbox"
                        className="a-check"
                        checked={scentFilter.includes(scent.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setScentFilter([...scentFilter, scent.id]);
                          } else {
                            setScentFilter(scentFilter.filter((id) => id !== scent.id));
                          }
                        }}
                      />
                      <span className="flex-1">{scent.name}</span>
                      {scent.limited && <Badge tone="amber">Limited</Badge>}
                    </label>
                  ))}
              </div>
            )}
          </div>

          <FilterSelect
            label={scentFilter.length > 0 ? "Stock (in stock only while filtering by scent)" : "Stock"}
            value={scentFilter.length > 0 ? "in-stock" : stockFilter}
            onChange={setStockFilter}
            disabled={scentFilter.length > 0}
            options={[
              { value: "all", label: "Stock" },
              { value: "in-stock", label: "In stock" },
              { value: "out-of-stock", label: "Out of stock" },
            ]}
          />
          <FilterSelect
            label="Best seller"
            value={bestFilter}
            onChange={setBestFilter}
            options={[
              { value: "all", label: "Best seller" },
              { value: "best", label: "Best sellers" },
              { value: "not-best", label: "Not best sellers" },
            ]}
          />
          <FilterSelect
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "all", label: "Status" },
              { value: "published", label: "Published" },
              { value: "draft", label: "Unpublished" },
            ]}
          />
        </div>

        {filtersActive && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex h-10 items-center gap-1.5 self-start rounded-lg px-3 text-sm font-medium text-[var(--a-muted)] hover:bg-[var(--a-tint)] hover:text-[var(--a-ink)] xl:self-auto"
          >
            <X className="h-4 w-4" aria-hidden />
            Clear
          </button>
        )}
      </div>

      {/* Content */}
      <div>
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16">
            <CandleSpinner />
            <p className="text-sm font-medium text-[var(--a-muted)]">Loading products…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="a-card flex flex-col items-center gap-3 px-6 py-16 text-center">
            <p className="font-medium text-[var(--a-ink)]">No products match</p>
            <p className="text-sm text-[var(--a-muted)]">Try a different search or clear the filters.</p>
            {filtersActive && (
              <button className="a-btn a-btn-sm mt-1" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="a-card hidden overflow-hidden lg:block">
              <table className="a-table">
                <thead>
                  <tr>
                    <SortableHeader column="none" className="w-16 text-center">Visible</SortableHeader>
                    <SortableHeader column="name">Product</SortableHeader>
                    <SortableHeader column="price" className="w-28 text-right">Price</SortableHeader>
                    <SortableHeader column="cost" className="w-36 text-right">Cost</SortableHeader>
                    <SortableHeader column="none" className="w-36">Type</SortableHeader>
                    <SortableHeader column="stock" className="w-24 text-right">Stock</SortableHeader>
                    <SortableHeader column="best" className="w-16 text-center">Best</SortableHeader>
                    <th className="w-44">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const isDraft = hasDraft(p.slug);
                    const profitMargin =
                      p.materialCost && p.price > 0 ? (((p.price - p.materialCost) / p.price) * 100).toFixed(0) : null;
                    const stock = getTotalStock(p);

                    return (
                      <tr key={p.slug} className={isDraft ? "bg-[#fffaf0]" : undefined}>
                        <td className="text-center">
                          <input
                            type="checkbox"
                            className="a-check"
                            checked={p.visibleOnWebsite !== false}
                            onChange={(e) => stageProduct({ ...p, visibleOnWebsite: e.target.checked })}
                            aria-label={`Show ${p.name} on the shop`}
                            title={p.visibleOnWebsite !== false ? "Visible on shop" : "Hidden from shop"}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => openEditor(p)}
                            className="group flex w-full items-center gap-3 text-left focus-visible:outline-none"
                          >
                            {productThumb(p)}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium text-[var(--a-ink)] group-hover:underline group-focus-visible:underline">
                                {p.name}
                              </span>
                              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--a-muted)]">
                                <span className="truncate">{p.sku || p.slug}</span>
                                {productBadges(p)}
                              </span>
                            </span>
                          </button>
                        </td>
                        <td className="a-num font-medium">${p.price.toFixed(2)}</td>
                        <td className="a-num">
                          {p.materialCost ? (
                            <>
                              <span className="block">${p.materialCost.toFixed(2)}</span>
                              {profitMargin && <span className="block whitespace-nowrap text-xs font-medium text-[#1f6b3a]">{profitMargin}% margin</span>}
                            </>
                          ) : (
                            <span className="text-[var(--a-faint)]">—</span>
                          )}
                        </td>
                        <td>
                          <Badge>{p.alcoholType ?? "Other"}</Badge>
                        </td>
                        <td className={`a-num font-medium ${stock === 0 ? "text-[var(--a-faint)]" : ""}`}>{stock}</td>
                        <td className="text-center">
                          <button
                            type="button"
                            onClick={() => stageProduct({ ...p, bestSeller: !p.bestSeller })}
                            className="a-icon-btn"
                            aria-pressed={!!p.bestSeller}
                            aria-label={p.bestSeller ? `Unmark ${p.name} as best seller` : `Mark ${p.name} as best seller`}
                            title={p.bestSeller ? "Best seller" : "Mark as best seller"}
                          >
                            <Star
                              className={`h-4 w-4 ${p.bestSeller ? "fill-amber-400 text-amber-500" : "text-[var(--a-line-strong)]"}`}
                              aria-hidden
                            />
                          </button>
                        </td>
                        <td>
                          <div className="flex items-center justify-end gap-1">
                            {isDraft && (
                              <>
                                <button className="a-btn a-btn-sm" onClick={() => discardDraft(p.slug)}>
                                  Discard
                                </button>
                                <button className="a-btn a-btn-primary a-btn-sm" disabled={saving} onClick={() => publishOne(p.slug)}>
                                  {saving ? "…" : "Publish"}
                                </button>
                              </>
                            )}
                            <button className="a-icon-btn" title="Edit" aria-label={`Edit ${p.name}`} onClick={() => openEditor(p)}>
                              <Pencil className="h-4 w-4" aria-hidden />
                            </button>
                            <button
                              className="a-icon-btn a-icon-btn-danger"
                              title="Delete"
                              aria-label={`Delete ${p.name}`}
                              onClick={() => void deleteProduct(p.slug)}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile/Tablet card list */}
            <ul className="space-y-2 lg:hidden">
              {filtered.map((p) => {
                const isDraft = hasDraft(p.slug);
                const stock = getTotalStock(p);
                return (
                  <li key={p.slug} className={`a-card p-3 ${isDraft ? "border-amber-200 bg-[#fffaf0]" : ""}`}>
                    <div className="flex items-start gap-3">
                      <button type="button" onClick={() => openEditor(p)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                        {productThumb(p)}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-[var(--a-ink)]">{p.name}</span>
                          <span className="mt-0.5 block text-sm text-[var(--a-muted)]">
                            <span className="font-medium text-[var(--a-ink)]">${p.price.toFixed(2)}</span>
                            {" · "}
                            <span>{stock === 0 ? "Out of stock" : `${stock} in stock`}</span>
                          </span>
                          <span className="mt-1.5 block">{productBadges(p)}</span>
                        </span>
                      </button>
                      <label className="flex shrink-0 flex-col items-center gap-1 pt-0.5 text-[11px] text-[var(--a-muted)]">
                        <input
                          type="checkbox"
                          className="a-check"
                          checked={p.visibleOnWebsite !== false}
                          onChange={(e) => stageProduct({ ...p, visibleOnWebsite: e.target.checked })}
                        />
                        Visible
                      </label>
                    </div>

                    <div className="mt-3 flex gap-2 border-t border-[var(--a-line)] pt-3">
                      <button className="a-btn a-btn-sm flex-1" onClick={() => openEditor(p)}>
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                        Edit
                      </button>
                      {isDraft && (
                        <>
                          <button className="a-btn a-btn-sm" onClick={() => discardDraft(p.slug)}>
                            Discard
                          </button>
                          <button className="a-btn a-btn-primary a-btn-sm" disabled={saving} onClick={() => publishOne(p.slug)}>
                            {saving ? "…" : "Publish"}
                          </button>
                        </>
                      )}
                      <button
                        className="a-icon-btn a-icon-btn-danger h-8 w-8"
                        aria-label={`Delete ${p.name}`}
                        onClick={() => void deleteProduct(p.slug)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {/* ---------- Edit/Create slide-over ---------- */}
      {editing && (
        <div className="a-ui fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="product-editor-title">
          <button type="button" aria-label="Close editor" className="a-fade-enter absolute inset-0 bg-black/30" onClick={closeEditor} />
          <div className="a-sheet-enter relative flex h-full w-full max-w-4xl flex-col bg-[var(--a-surface)] shadow-2xl">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-[var(--a-line)] px-5 py-4 sm:px-8">
              <div className="min-w-0">
                <p className="a-section-label text-[var(--a-faint)]">
                  {isServerItem(editing.slug) ? "Edit product" : "New product"}
                </p>
                <h2 id="product-editor-title" className="mt-0.5 truncate text-xl font-semibold tracking-tight text-[var(--a-ink)]">
                  {editing.name.trim() || "Untitled product"}
                </h2>
              </div>
              <button className="a-icon-btn -mr-2 shrink-0" onClick={closeEditor} aria-label="Close">
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8">
              {error && (
                <div role="alert" className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-[#fdecea] p-4">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#b42318]" aria-hidden />
                  <p className="text-sm text-[#7a1a12]">{error}</p>
                </div>
              )}

              {/* Category toggle — only meaningful for a brand-new draft; locked once published */}
              <div className="mb-2">
                <div className="a-label">Category</div>
                <div className="inline-flex rounded-lg border border-[var(--a-line)] bg-[var(--a-canvas)] p-1" role="group" aria-label="Product category">
                  <button
                    type="button"
                    disabled={isServerItem(editing.slug)}
                    className={`rounded-md px-4 py-1.5 text-sm transition-colors ${
                      !isHomeGoods ? "bg-white font-medium text-[var(--a-ink)] shadow-sm" : "text-[var(--a-muted)] hover:text-[var(--a-ink)]"
                    } ${isServerItem(editing.slug) ? "cursor-not-allowed opacity-60" : ""}`}
                    onClick={() =>
                      setEditing({
                        ...editing,
                        productType: "candle",
                        // Restore a variant config if it was cleared by switching to Home Goods
                        variantConfig: editing.variantConfig ?? {
                          wickTypes: [{ id: "standard", name: "Standard Wick" }],
                          variantData: {},
                        },
                      })
                    }
                  >
                    Candle
                  </button>
                  <button
                    type="button"
                    disabled={isServerItem(editing.slug)}
                    className={`rounded-md px-4 py-1.5 text-sm transition-colors ${
                      isHomeGoods ? "bg-white font-medium text-[var(--a-ink)] shadow-sm" : "text-[var(--a-muted)] hover:text-[var(--a-ink)]"
                    } ${isServerItem(editing.slug) ? "cursor-not-allowed opacity-60" : ""}`}
                    onClick={() =>
                      setEditing({
                        ...editing,
                        productType: "home_goods",
                        // Home Goods has no wick/scent/size variants — clear the candle-only config
                        // so the storefront doesn't try to render a wick/scent picker for it.
                        variantConfig: undefined,
                        bottleOptions: editing.bottleOptions ?? [],
                        requiresUncut: editing.requiresUncut ?? false,
                        requiresUnpoured: editing.requiresUnpoured ?? true,
                      })
                    }
                  >
                    Home Goods
                  </button>
                </div>
                {isServerItem(editing.slug) && (
                  <p className="text-xs text-[var(--a-muted)] mt-1">Category can&apos;t be changed after a product is published.</p>
                )}
              </div>

              {isHomeGoods ? (
                <div className="mt-6">
                  <HomeGoodsBottleOptionsForm
                    editing={editing}
                    setEditing={setEditing}
                    bottleInventory={bottleInventory}
                    handleImagePick={handleImagePick}
                    removeImage={removeImage}
                    slugTouched={slugTouched}
                    setSlugTouched={setSlugTouched}
                    isServerItem={isServerItem}
                    slugify={slugify}
                    SLUG_REGEX={SLUG_REGEX}
                    slugError={slugError}
                    setSlugError={setSlugError}
                  />
                  <HomeGoodsSquareSection
                    editing={editing}
                    setEditing={setEditing}
                    showAlert={showAlert}
                    showConfirm={showConfirm}
                    setSaving={setSaving}
                    setSavingLabel={setSavingLabel}
                    load={load}
                  />
                </div>
              ) : (
              <>
              <FormSection title="Details" description="What customers see on the shop.">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* Name */}
                  <label className="block">
                    <div className="a-label">Product Name</div>
                    <input
                      className="a-input"
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
                    <div className="a-label">URL Slug</div>
                    <input
                      className="a-input"
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
                    {slugError && <p className="a-error">{slugError}</p>}
                  </label>

                  <label className="block">
                    <div className="a-label">Price</div>
                    <input
                      className="a-input"
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

                  {/* SKU */}
                  <label className="block">
                    <div className="a-label">SKU</div>
                    <div className="flex gap-2">
                      <input
                        className="a-input flex-1"
                        value={editing.sku}
                        onChange={(e) => setEditing({ ...editing, sku: e.target.value })}
                        placeholder="DCW-0001"
                      />
                      <button
                        type="button"
                        className="a-btn"
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
                    <div className="a-label">Alcohol Type</div>
                    <div className="flex gap-2">
                      <select
                        className="a-select flex-1"
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

                  {/* Weight */}
                  <label className="block">
                    <div className="a-label">Candle Weight (ounces)</div>
                    <input
                      className="a-input"
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
                    <div className="a-help">
                      Weight of jar + wax only. Packaging (~16oz) added automatically for shipping.
                    </div>
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
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <span className="a-label mb-0">Description</span>
                      <button
                        type="button"
                        className="a-link"
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
                      className="a-textarea"
                      rows={4}
                      value={editing.seoDescription}
                      onChange={(e) => setEditing({ ...editing, seoDescription: e.target.value })}
                      placeholder="Select a container and click 'Auto-generate' or type manually"
                    />
                  </label>
                </div>
                <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3">
                  {/* Visible on Website */}
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--a-ink)]">
                    <input
                      type="checkbox"
                      className="a-check"
                      checked={editing.visibleOnWebsite !== false}
                      onChange={(e) => setEditing({ ...editing, visibleOnWebsite: e.target.checked })}
                    />
                    <span>Show on website</span>
                  </label>
                  {/* Best Seller */}
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--a-ink)]">
                    <input type="checkbox" className="a-check" checked={!!editing.bestSeller} onChange={(e) => setEditing({ ...editing, bestSeller: e.target.checked })} />
                    <span>Best seller</span>
                  </label>
                  {/* Young & Dumb */}
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--a-ink)]">
                    <input type="checkbox" className="a-check" checked={!!editing.youngDumb} onChange={(e) => setEditing({ ...editing, youngDumb: e.target.checked })} />
                    <span>Young &amp; Dumb</span>
                  </label>
                </div>
              </FormSection>

              <FormSection title="Photos" description="The first photo is the main one on the shop. Use the arrows to reorder.">
                  {/* Images - Multiple Upload */}
                  <div className="block sm:col-span-2">
                    <div className="flex flex-wrap gap-2">
                      <label className="a-btn cursor-pointer focus-within:shadow-[var(--a-focus)]">
                        <Upload className="h-4 w-4" aria-hidden />
                        Add photos
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="sr-only"
                          onChange={(e) => handleImagePick(e, editing, (v) => setEditing(v))}
                        />
                      </label>
                      <button
                        type="button"
                        className="a-btn"
                        onClick={startQRUpload}
                      >
                        <QrCode className="h-4 w-4" aria-hidden />
                        Upload from phone
                      </button>
                    </div>

                    {/* Display current images */}
                    {editing.images && editing.images.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {editing.images.map((img, idx) => (
                          <div key={idx} className="flex items-center gap-3 rounded-lg border border-[var(--a-line)] bg-white p-2.5">
                            <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-[var(--a-tint)]">
                              <Image src={img} alt={`Product image ${idx + 1}`} fill sizes="80px" className="object-contain" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-[var(--a-muted)] truncate">{img}</div>
                              {idx === 0 && <span className="mt-1 inline-block"><Badge tone="green">Main photo</Badge></span>}
                            </div>
                            <div className="flex gap-1">
                              {idx > 0 && (
                                <button
                                  type="button"
                                  className="a-icon-btn h-8 w-8"
                                  onClick={() => moveImageUp(idx, editing, (v) => setEditing(v))}
                                  title="Move up"
                                  aria-label="Move photo up"
                                >
                                  <ChevronUp className="h-4 w-4" aria-hidden />
                                </button>
                              )}
                              {editing.images && idx < editing.images.length - 1 && (
                                <button
                                  type="button"
                                  className="a-icon-btn h-8 w-8"
                                  onClick={() => moveImageDown(idx, editing, (v) => setEditing(v))}
                                  title="Move down"
                                  aria-label="Move photo down"
                                >
                                  <ChevronDownIcon className="h-4 w-4" aria-hidden />
                                </button>
                              )}
                              <button
                                type="button"
                                className="a-icon-btn h-8 w-8"
                                onClick={() => removeImage(idx, editing, (v) => setEditing(v))}
                                title="Remove"
                                aria-label="Remove photo"
                              >
                                <Trash2 className="h-4 w-4" aria-hidden />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 rounded-lg border border-dashed border-[var(--a-line-strong)] px-4 py-6 text-center text-sm text-[var(--a-muted)]">No photos yet. Add some from this computer or your phone.</p>
                    )}
                  </div>
              </FormSection>

              <FormSection title="Inventory & variants" description="Sizes and wicks combine with every available scent to make the variants below.">
                <div className="mb-5 max-w-xs">
                  {/* Base Stock */}
                  <label className="block">
                    <div className="a-label">Base stock</div>
                    <input
                      className="a-input"
                      type="number"
                      value={editing.stock}
                      onChange={(e) => setEditing({ ...editing, stock: e.target.value === "" ? 0 : Number(e.target.value) })}
                      onBlur={(e) => {
                        const val = e.target.value === "" ? 0 : Number(e.target.value);
                        setEditing({ ...editing, stock: Math.max(0, val) });
                      }}
                    />
                    {editing.variantConfig && <p className="a-help">Variant stock is set per scent below.</p>}
                  </label>
                </div>
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
                      <div className="a-panel">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="text-sm font-semibold text-[var(--a-ink)]">Sizes (Optional)</h4>
                            <p className="text-xs text-[var(--a-muted)] mt-0.5">Add multiple sizes with different prices</p>
                          </div>
                          <button
                            type="button"
                            className="a-btn a-btn-sm"
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
                              <div key={size.id} className="rounded-lg border border-[var(--a-line)] bg-white p-3">
                                <div className="grid grid-cols-1 gap-3">
                                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                                    <div>
                                      <label className="a-label">Size Name</label>
                                      <input
                                        className="a-input"
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
                                      <label className="a-label">Ounces</label>
                                      <input
                                        className="a-input"
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
                                      <label className="a-label">Bottle / Container</label>
                                      <select
                                        className="a-select"
                                        value={size.containerId || ""}
                                        onChange={(e) => {
                                          const newSizes = [...(editing.variantConfig?.sizes || [])];
                                          newSizes[idx] = { ...size, containerId: e.target.value || undefined };
                                          setEditing({ ...editing, variantConfig: { ...editing.variantConfig!, sizes: newSizes } });
                                        }}
                                      >
                                        <option value="">Use product container{editing.containerId ? ` (${containers.find((c) => c.id === editing.containerId)?.name || editing.containerId})` : ""}</option>
                                        {containers.map((container) => (
                                          <option key={container.id} value={container.id}>{container.name}</option>
                                        ))}
                                      </select>
                                    </div>
<div>
                                      <label className="a-label">Price ($)</label>
                                      <input
                                        className="a-input"
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
                                      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                                        <label className="a-label mb-0">Stripe Price ID (Optional)</label>
                                        {!size.stripePriceId && (
                                          <button
                                            type="button"
                                            className="a-link"
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
                                                setSavingLabel("Creating Stripe product…");
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

                                                setSaving(false);
                                                await showAlert(
                                                  `Stripe product created for ${size.name}!\n\nProduct ID: ${data.productId}\nPrice ID: ${data.priceId}`,
                                                  "Success"
                                                );
                                              } catch (err) {
                                                console.error("[Create Stripe Product for Size] Error:", err);
                                                setSaving(false);
                                                await showAlert(err instanceof Error ? err.message : "Failed to create Stripe product", "Error");
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
                                        className="a-input font-mono"
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
                                        className="a-icon-btn a-icon-btn-danger"
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
                          <div className="text-center py-4 text-sm text-[var(--a-muted)]">
                            No sizes configured. This product will use the base price.
                          </div>
                        )}
                      </div>

                      {/* Wick Types Configuration */}
                      <div className="a-panel">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-semibold text-[var(--a-ink)]">Wick Types</h4>
                          <button
                            type="button"
                            className="a-btn a-btn-sm"
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
                            <div key={wick.id} className="flex items-center gap-2 rounded-lg border border-[var(--a-line)] bg-white p-2">
                              <input
                                className="a-input flex-1"
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
                                className="a-icon-btn a-icon-btn-danger"
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

                      {/* Scents info */}
                      <p className="flex items-start gap-2 text-sm text-[var(--a-muted)]">
                        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                        <span>
                          Scents are shared across all products and become variants automatically.{" "}
                          <Link href="/admin/scents" className="font-medium text-[var(--a-accent-ink)] hover:underline">
                            Manage scents
                          </Link>
                        </span>
                      </p>

                      {/* Variant Stock Grid */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-sm font-semibold text-[var(--a-ink)]">Inventory ({variantsForDisplay.length} variants)</h4>
                          <div className="text-xs text-[var(--a-muted)]">
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
                          <div className="max-h-[420px] overflow-y-auto rounded-xl border border-[var(--a-line)] bg-[var(--a-canvas)]">
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 p-4">
                              {variantsForDisplay.map((v) => (
                                <div
                                  key={v.id}
                                  className="rounded-lg border border-[var(--a-line)] bg-white p-3 transition-colors focus-within:border-[var(--a-accent-ink)] hover:border-[var(--a-line-strong)]"
                                >
                                  {v.sizeName && (
                                    <div className="mb-1 truncate text-xs font-semibold text-[var(--a-accent-ink)]">
                                      {v.sizeName}
                                    </div>
                                  )}
                                  <div className="text-xs font-medium text-[var(--a-ink)] mb-2 line-clamp-2" title={v.sizeName ? `${v.sizeName} / ${v.wickName} / ${v.scentName}` : `${v.wickName} / ${v.scentName}`}>
                                    {v.scentName}
                                  </div>
                                  <div className="text-xs text-[var(--a-muted)] mb-2 truncate">{v.wickName}</div>
                                  <input
                                    className="a-input"
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
              </FormSection>

              <FormSection title="Sales channels" description="Stripe handles website checkout. Square handles in-person sales.">
                <div className="space-y-5">
                  {/* Stripe Price ID */}
                  <label className="block sm:col-span-2">
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <span className="a-label mb-0">Stripe Price ID</span>
                      {!editing.stripePriceId && (
                        <button
                          type="button"
                          className="a-link"
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
                              setSavingLabel("Creating Stripe product…");
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

                              setSaving(false);
                              await showAlert(
                                `Stripe product created successfully!\n\nProduct ID: ${data.productId}\nPrice ID: ${data.priceId}`,
                                "Success"
                              );
                            } catch (err) {
                              // eslint-disable-next-line no-console
                              console.error("[Create Stripe Product] Error:", err);
                              setSaving(false);
                              await showAlert(err instanceof Error ? err.message : "Failed to create Stripe product", "Error");
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
                      className="a-input"
                      value={editing.stripePriceId || ""}
                      onChange={(e) => setEditing({ ...editing, stripePriceId: e.target.value })}
                      placeholder="Click 'Create Stripe Product' or paste manually"
                    />
                  </label>

                  {/* Square Catalog ID */}
                  <label className="block sm:col-span-2">
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <span className="a-label mb-0">Square Catalog ID</span>
                      <div className="flex gap-2">
                        {editing.squareCatalogId && (
                          <button
                            type="button"
                            className="a-link"
                            onClick={async () => {
                              // Sync stock to Square (auto-map first if needed)
                              try {
                                setSavingLabel("Syncing stock to Square…");
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

                                setSaving(false);
                                await showAlert(`Stock synced to Square successfully!\n\n${data.message}`, "Success");
                              } catch (err) {
                                // eslint-disable-next-line no-console
                                console.error("[Sync Square Stock] Error:", err);
                                setSaving(false);
                                await showAlert(err instanceof Error ? err.message : "Failed to sync stock to Square", "Error");
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
                            className="a-link"
                            onClick={async () => {
                              try {
                                setSavingLabel("Syncing details to Square…");
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
                                setSaving(false);
                                await showAlert(
                                  `Product details synced to Square!\n\nImages uploaded: ${r?.imagesUploaded ?? 0} / ${r?.totalImages ?? 0}`,
                                  "Success"
                                );
                              } catch (err) {
                                setSaving(false);
                                await showAlert(err instanceof Error ? err.message : "Failed to sync details to Square", "Error");
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
                            className="a-link"
                            onClick={async () => {
                              const confirmed = await showConfirm(
                                `This will recreate "${editing.name}" on Square with all current website variants.\n\nUse this when you've added new scents or wick types that aren't on Square yet.\n\nContinue?`,
                                "Remap Variants"
                              );

                              if (!confirmed) return;

                              try {
                                setSavingLabel("Remapping variants…");
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

                                // Dismiss overlay before asking the follow-up question
                                setSaving(false);
                                const syncNow = await showConfirm(
                                  "Variants remapped successfully!\n\nWould you like to sync stock levels to Square now?",
                                  "Sync Stock?"
                                );

                                if (syncNow) {
                                  setSavingLabel("Syncing stock to Square…");
                                  setSaving(true);
                                  const res = await fetch("/api/admin/sync-square-stock", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ productSlug: editing.slug }),
                                  });

                                  const data = (await res.json()) as { error?: string; message?: string };

                                  if (!res.ok) {
                                    throw new Error(data.error || "Failed to sync stock");
                                  }

                                  setSaving(false);
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
                                setSaving(false);
                                await showAlert(
                                  err instanceof Error ? err.message : "Failed to remap variants",
                                  "Error"
                                );
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
                            className="a-link"
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
                                setSavingLabel("Creating Square product…");
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
                                    replaceCatalogItemId: editing.squareCatalogId || undefined,
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

                                setSaving(false);
                                await showAlert(
                                  `Square catalog item created and saved successfully!\n\nCatalog Item ID: ${data.catalogItemId}\nVariations: ${data.variationCount}\nImages: ${data.imageCount}`,
                                  "Success"
                                );
                              } catch (err) {
                                // eslint-disable-next-line no-console
                                console.error("[Create Square Product] Error:", err);
                                setSaving(false);
                                await showAlert(err instanceof Error ? err.message : "Failed to create Square product", "Error");
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
                            className="a-link"
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
                                setSavingLabel("Creating Square product…");
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
                                    replaceCatalogItemId: editing.squareCatalogId || undefined,
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

                                setSaving(false);
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
                                setSaving(false);
                                await showAlert(err instanceof Error ? err.message : "Failed to re-create Square product", "Error");
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
                      className="a-input"
                      value={editing.squareCatalogId || ""}
                      onChange={(e) => setEditing({ ...editing, squareCatalogId: e.target.value })}
                      placeholder="Click 'Create Square Product' or paste manually"
                    />
                  </label>
                </div>
              </FormSection>
              </>
              )}
            </div>

            {/* Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--a-line)] bg-[var(--a-canvas)] px-5 py-3 sm:px-8">
              <p className="hidden text-xs text-[var(--a-muted)] sm:block">
                Saved as an unpublished change. Publish it from the product list.
              </p>
              <div className="ml-auto flex gap-2">
                <button className="a-btn" onClick={closeEditor}>
                  Cancel
                </button>
                <button
                  className="a-btn a-btn-primary"
                  onClick={() => {
                    if (!editing) return;
                    stageProduct(editing);
                    setEditing(null);
                  }}
                >
                  <Check className="h-4 w-4" aria-hidden />
                  Save draft
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && qrDataURL && (
        <div className="a-ui fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="qr-title">
          <button type="button" aria-label="Close" className="a-fade-enter absolute inset-0 bg-black/40" onClick={closeQRModal} />
          <div className="a-card a-fade-enter relative w-full max-w-sm p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 id="qr-title" className="text-lg font-semibold tracking-tight text-[var(--a-ink)]">Upload from your phone</h2>
                <p className="mt-0.5 text-sm text-[var(--a-muted)]">Scan with your phone&apos;s camera, then pick photos.</p>
              </div>
              <button className="a-icon-btn -mr-2 -mt-1 shrink-0" onClick={closeQRModal} aria-label="Close">
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="mx-auto mb-4 w-full max-w-[240px] rounded-xl border border-[var(--a-line)] bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- data: URL generated client-side */}
              <img src={qrDataURL} alt="QR code for the phone upload page" className="h-auto w-full" />
            </div>

            {uploadToken && origin && (
              <div className="mb-4">
                <div className="a-label text-xs text-[var(--a-muted)]">Or open this link on your phone</div>
                <div className="flex gap-2">
                  <input className="a-input flex-1 text-xs" readOnly value={`${origin}/mobile-upload?token=${uploadToken}`} aria-label="Upload link" />
                  <button
                    type="button"
                    className="a-btn"
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

            {uploadedCount > 0 && (
              <div role="status" className="mb-4 flex items-center gap-3 rounded-lg border border-green-200 bg-[#e8f5ec] p-3">
                <Check className="h-5 w-5 shrink-0 text-[#1f6b3a]" aria-hidden />
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#1f4d2e]">
                    {uploadedCount} {uploadedCount === 1 ? "photo" : "photos"} uploaded
                  </p>
                  <p className="text-xs text-[#1f6b3a]">They&apos;re being added to this product.</p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 border-t border-[var(--a-line)] pt-4">
              <p className="text-xs text-[var(--a-muted)]">Link expires in 5 minutes</p>
              <button className="a-btn a-btn-primary" onClick={closeQRModal}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}