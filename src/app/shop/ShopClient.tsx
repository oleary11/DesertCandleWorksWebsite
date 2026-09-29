"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import ProductCard from "@/components/ProductCard";
import type { Product } from "@/lib/products";
import { generateVariants } from "@/lib/products";
import type { GlobalScent } from "@/lib/scents";
import type { BottlePickerOption } from "./[slug]/HomeGoodsBottlePicker";
import { useCartStore } from "@/lib/cartStore";
import { Truck, Search, CheckCircle, XCircle, SlidersHorizontal, X } from "lucide-react";
import s from "@/components/home/home.module.css";
import { serif } from "@/lib/storefrontFonts";
import ShopDialog from "@/components/shop/ShopDialog";
import { btnPrimary, btnQuiet, chipClass, fieldClass, labelClass } from "@/components/shop/styles";

type ProductWithStock = Product & { _computedStock: number };

type SortOption = "name-asc" | "name-desc" | "price-asc" | "price-desc";
type FilterOption = "all" | "in-stock" | "low-stock" | "out-of-stock";
type CategoryFilter = "all" | "candle" | "home_goods";

type AlcoholType = { id: string; name: string; sortOrder?: number };

const FILTER_LABEL: Record<FilterOption, string> = {
  "in-stock": "In stock",
  all: "Everything",
  "low-stock": "Last one",
  "out-of-stock": "Sold out",
};

const CATEGORY_TABS: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "candle", label: "Candles" },
  { value: "home_goods", label: "Home goods" },
];

const FILTERS_KEY = "shopFilters";
const HOME_GOODS_SECTION = "Home Goods";

type SavedFilters = {
  sortBy: SortOption;
  filterBy: FilterOption;
  categoryFilter: CategoryFilter;
  searchQuery: string;
  selectedScents: string[];
};

function getRestoredFilters(): SavedFilters | null {
  if (typeof window === "undefined") return null;
  try {
    const fromProduct =
      sessionStorage.getItem("fromProductPage") ||
      sessionStorage.getItem("useBackButton");
    if (!fromProduct) return null;
    const saved = sessionStorage.getItem(FILTERS_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

type ShopClientProps = {
  products: ProductWithStock[];
  globalScents: GlobalScent[];
  alcoholTypes: AlcoholType[]; // NEW for grouping
  homeGoodsBottles: Record<string, BottlePickerOption[]>;
};

export default function ShopClient({ products, globalScents, alcoholTypes, homeGoodsBottles }: ShopClientProps) {
  const searchParams = useSearchParams();
  const clearCart = useCartStore((state) => state.clearCart);

  const [sortBy, setSortBy] = useState<SortOption>(() => getRestoredFilters()?.sortBy ?? "name-asc");
  const [filterBy, setFilterBy] = useState<FilterOption>(() => getRestoredFilters()?.filterBy ?? "in-stock");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(() => getRestoredFilters()?.categoryFilter ?? "all");
  const [searchQuery, setSearchQuery] = useState<string>(() => getRestoredFilters()?.searchQuery ?? "");
  const [showStatusBanner, setShowStatusBanner] = useState(false);
  const [statusType, setStatusType] = useState<"success" | "cancelled" | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [selectedScents, setSelectedScents] = useState<Set<string>>(() => {
    const saved = getRestoredFilters()?.selectedScents;
    return saved ? new Set(saved) : new Set();
  });

  // Price range from products
  const priceRange = useMemo(() => {
    const prices = products.map((p) => p.price);
    return {
      min: Math.floor(Math.min(...prices)),
      max: Math.ceil(Math.max(...prices)),
    };
  }, [products]);

  const [priceMin, setPriceMin] = useState(priceRange.min);
  const [priceMax, setPriceMax] = useState(priceRange.max);

  // Separate main signature scents from limited/seasonal scents
  // Limited = only for specific products, Seasonal = available everywhere but grouped as limited
  const { mainScents, limitedScentIds } = useMemo(() => {
    const main = globalScents
      .filter(s => !s.limited && !s.seasonal)
      .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
    const limitedIds = new Set(globalScents.filter(s => s.limited || s.seasonal).map(s => s.id));
    return { mainScents: main, limitedScentIds: limitedIds };
  }, [globalScents]);

  const hasActiveFilters =
    sortBy !== "name-asc" ||
    filterBy !== "in-stock" ||
    categoryFilter !== "all" ||
    searchQuery !== "" ||
    priceMin !== priceRange.min ||
    priceMax !== priceRange.max ||
    selectedScents.size > 0;

  function resetFilters() {
    setSortBy("name-asc");
    setFilterBy("in-stock");
    setCategoryFilter("all");
    setSearchQuery("");
    setPriceMin(priceRange.min);
    setPriceMax(priceRange.max);
    setSelectedScents(new Set());
  }

  // Toggle scent filter
  function toggleScent(scentId: string) {
    setSelectedScents(prev => {
      const next = new Set(prev);
      if (next.has(scentId)) {
        next.delete(scentId);
      } else {
        next.add(scentId);
      }
      return next;
    });
  }

  // Checkout status & banner
  useEffect(() => {
    const status = searchParams.get("status");
    if (status === "success" || status === "cancelled") {
      setStatusType(status);
      setShowStatusBanner(true);

      if (status === "success") {
        clearCart();
      }

      const timer = setTimeout(() => {
        setShowStatusBanner(false);
      }, 10000);

      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete("status");
      window.history.replaceState({}, "", url.toString());

      return () => clearTimeout(timer);
    }
  }, [searchParams, clearCart]);

  // Restore scroll when coming back from product page
  useEffect(() => {
    const shouldRestore = sessionStorage.getItem("useBackButton");
    const savedPosition = sessionStorage.getItem("shopScrollPosition");

    if (shouldRestore === "true" && savedPosition) {
      requestAnimationFrame(() => {
        window.scrollTo({
          top: parseInt(savedPosition, 10),
          behavior: "instant" as ScrollBehavior,
        });
      });

      sessionStorage.removeItem("useBackButton");
      sessionStorage.removeItem("fromProductPage");
    }
  }, []);

  // Persist filter state to sessionStorage so it can be restored when navigating back
  useEffect(() => {
    const state: SavedFilters = {
      sortBy,
      filterBy,
      categoryFilter,
      searchQuery,
      selectedScents: Array.from(selectedScents),
    };
    sessionStorage.setItem(FILTERS_KEY, JSON.stringify(state));
  }, [sortBy, filterBy, categoryFilter, searchQuery, selectedScents]);

  // Base filter/sort (before grouping)
  const filteredAndSortedProducts = useMemo(() => {
    let filtered = [...products];

    // Category (Candles vs Home Goods)
    if (categoryFilter !== "all") {
      filtered = filtered.filter((p) => (p.productType || "candle") === categoryFilter);
    }

    // Search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((p) => {
        const nameMatch = p.name.toLowerCase().includes(query);
        const descMatch = p.seoDescription?.toLowerCase().includes(query);
        return nameMatch || descMatch;
      });
    }

    // Price range
    filtered = filtered.filter((p) => p.price >= priceMin && p.price <= priceMax);

    // Scent filter
    if (selectedScents.size > 0) {
      filtered = filtered.filter((p) => {
        // Products without scent variants never match a scent filter
        if (!p.variantConfig?.variantData) return false;

        const { variantData, wickTypes } = p.variantConfig;
        const wickIds = new Set(wickTypes.map(w => w.id));

        // Check if any in-stock variant matches selected scents
        for (const variantId of Object.keys(variantData)) {
          // Only consider variants that have stock
          if ((variantData[variantId]?.stock ?? 0) === 0) continue;

          // Extract scent ID from variant ID
          let remainingId = variantId;

          // Remove size prefix if present
          if (remainingId.startsWith('size-')) {
            const sizeEndIndex = remainingId.indexOf('-', 5);
            if (sizeEndIndex !== -1) {
              remainingId = remainingId.substring(sizeEndIndex + 1);
            }
          }

          // Remove wick type prefix
          let scentId = remainingId;
          for (const wickId of wickIds) {
            if (remainingId.startsWith(wickId + '-')) {
              scentId = remainingId.substring(wickId.length + 1);
              break;
            }
          }

          // Check if this scent matches any selected filter
          if (selectedScents.has(scentId)) {
            return true;
          }
          // Check if "limited" is selected and this scent is a limited scent
          if (selectedScents.has("limited") && limitedScentIds.has(scentId)) {
            return true;
          }
        }
        return false; // No in-stock variant matched
      });
    }

    // Stock filter
    if (filterBy === "in-stock") {
      filtered = filtered.filter((p) => p._computedStock > 0);
    } else if (filterBy === "low-stock") {
      filtered = filtered.filter((p) => p._computedStock === 1);
    } else if (filterBy === "out-of-stock") {
      filtered = filtered.filter((p) => p._computedStock === 0);
    }
    // "all" shows everything - no filtering needed

    // Sort: in-stock first, then user-selected sort
    filtered.sort((a, b) => {
      const aIn = a._computedStock > 0 ? 1 : 0;
      const bIn = b._computedStock > 0 ? 1 : 0;
      if (aIn !== bIn) return bIn - aIn;

      switch (sortBy) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "price-asc":
          return a.price - b.price;
        case "price-desc":
          return b.price - a.price;
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return filtered;
  }, [
    products,
    sortBy,
    filterBy,
    categoryFilter,
    searchQuery,
    priceMin,
    priceMax,
    selectedScents,
    limitedScentIds,
  ]);

  // Build ordering index for Alcohol Types
  const typeOrderIndex = useMemo(() => {
    const idx = new Map<string, number>();
    alcoholTypes.forEach((t, i) => idx.set(t.name, t.sortOrder ?? i + 1));
    if (!idx.has("Other")) idx.set("Other", 9999);
    // Home Goods is its own section, always first (ahead of every alcohol-type section)
    idx.set(HOME_GOODS_SECTION, -1);
    return idx;
  }, [alcoholTypes]);

  // Group filtered results — Home Goods gets its own section, candles group by Alcohol Type
  const grouped = useMemo(() => {
    const m = new Map<string, ProductWithStock[]>();
    for (const p of filteredAndSortedProducts) {
      const key = p.productType === "home_goods" ? HOME_GOODS_SECTION : (p.alcoholType || "Other");
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(p);
    }

    // Sort inside each group: in-stock first, then by name
    for (const [key, list] of m) {
      list.sort((a, b) => {
        // In-stock items first
        const aInStock = a._computedStock > 0 ? 1 : 0;
        const bInStock = b._computedStock > 0 ? 1 : 0;
        if (aInStock !== bInStock) return bInStock - aInStock;
        // Then alphabetically
        return a.name.localeCompare(b.name);
      });
      m.set(key, list);
    }

    // order sections by alcoholTypes sortOrder (fallback alpha)
    return Array.from(m.entries()).sort((a, b) => {
      const ai = typeOrderIndex.get(a[0]) ?? 9999;
      const bi = typeOrderIndex.get(b[0]) ?? 9999;
      if (ai !== bi) return ai - bi;
      return a[0].localeCompare(b[0]);
    });
  }, [filteredAndSortedProducts, typeOrderIndex]);

  const productCount = products.length;
  const displayCount = filteredAndSortedProducts.length;
  const inStockCount = filteredAndSortedProducts.filter((p) => p._computedStock > 0).length;

  const priceFiltered = priceMin !== priceRange.min || priceMax !== priceRange.max;
  const activeChips: { key: string; label: string; clear: () => void }[] = [
    ...(filterBy !== "in-stock"
      ? [{ key: "stock", label: FILTER_LABEL[filterBy], clear: () => setFilterBy("in-stock") }]
      : []),
    ...Array.from(selectedScents).map((id) => ({
      key: `scent-${id}`,
      label: id === "limited" ? "Limited scents" : mainScents.find((sc) => sc.id === id)?.name ?? id,
      clear: () => toggleScent(id),
    })),
    ...(priceFiltered ? [{ key: "price", label: `$${priceMin}–$${priceMax}`, clear: () => { setPriceMin(priceRange.min); setPriceMax(priceRange.max); } }] : []),
    ...(searchQuery ? [{ key: "q", label: `“${searchQuery}”`, clear: () => setSearchQuery("") }] : []),
  ];
  const filterCount = activeChips.filter((c) => c.key !== "q").length;

  const filterPanel = (
    <div className="space-y-7">
      <fieldset>
        <legend className={labelClass}>Availability</legend>
        <div className="flex flex-wrap gap-2">
          {(["in-stock", "all", "low-stock", "out-of-stock"] as FilterOption[]).map((opt) => (
            <button key={opt} type="button" aria-pressed={filterBy === opt} onClick={() => setFilterBy(opt)} className={chipClass(filterBy === opt)}>
              {FILTER_LABEL[opt]}
            </button>
          ))}
        </div>
      </fieldset>

      {categoryFilter !== "home_goods" && (mainScents.length > 0 || limitedScentIds.size > 0) && (
        <fieldset>
          <legend className={`${labelClass} flex w-full items-baseline justify-between`}>
            Scent
            {selectedScents.size > 0 && (
              <button type="button" onClick={() => setSelectedScents(new Set())} className="text-xs font-medium text-[var(--home-clay)] hover:underline">
                Clear
              </button>
            )}
          </legend>
          <div className="flex flex-wrap gap-2">
            {mainScents.map((scent) => (
              <button
                key={scent.id}
                type="button"
                aria-pressed={selectedScents.has(scent.id)}
                onClick={() => toggleScent(scent.id)}
                className={chipClass(selectedScents.has(scent.id))}
              >
                {scent.name}
              </button>
            ))}
            {limitedScentIds.size > 0 && (
              <button
                type="button"
                aria-pressed={selectedScents.has("limited")}
                onClick={() => toggleScent("limited")}
                className={chipClass(selectedScents.has("limited"))}
              >
                Limited &amp; seasonal
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-[var(--home-muted)]">Shows candles with that scent in stock.</p>
        </fieldset>
      )}

      <fieldset>
        <legend className={`${labelClass} flex w-full items-baseline justify-between`}>
          Price
          <span className="text-sm font-normal tabular-nums text-[var(--home-muted)]">
            ${priceMin} – ${priceMax}
          </span>
        </legend>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs text-[var(--home-muted)]">Minimum</span>
            <input
              type="range"
              min={priceRange.min}
              max={priceRange.max}
              value={priceMin}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val <= priceMax) setPriceMin(val);
              }}
              className="w-full cursor-pointer accent-[var(--home-clay)]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-[var(--home-muted)]">Maximum</span>
            <input
              type="range"
              min={priceRange.min}
              max={priceRange.max}
              value={priceMax}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val >= priceMin) setPriceMax(val);
              }}
              className="w-full cursor-pointer accent-[var(--home-clay)]"
            />
          </label>
        </div>
      </fieldset>

      {hasActiveFilters && (
        <button type="button" onClick={resetFilters} className={`${btnQuiet} w-full`}>
          Reset filters
        </button>
      )}
    </div>
  );

  return (
    <div className={`${s.page} s-ui`}>
      {/* Checkout result */}
      {showStatusBanner && statusType && (
        <div
          role="status"
          className={`px-6 py-4 ${statusType === "success" ? "bg-[var(--home-sage)]" : "bg-[var(--home-peach)]"}`}
        >
          <div className="mx-auto flex max-w-7xl items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              {statusType === "success" ? (
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#4d6a3a]" aria-hidden />
              ) : (
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--home-clay)]" aria-hidden />
              )}
              <div>
                <p className="font-semibold text-[var(--home-ink)]">
                  {statusType === "success" ? "Thank you, your order is confirmed" : "Checkout cancelled"}
                </p>
                <p className="text-sm text-[var(--home-muted)]">
                  {statusType === "success"
                    ? "A confirmation email is on its way."
                    : "Nothing was charged. Your cart is still here when you're ready."}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowStatusBanner(false)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--home-muted)] hover:bg-white/60 hover:text-[var(--home-ink)]"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      )}

      {/* Header band */}
      <header className={`${s.paper} px-6 pb-10 pt-12 sm:pt-16`}>
        <div className="mx-auto max-w-7xl">
          <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--home-clay)]">The shop</p>
          <h1 className={`${serif.className} mt-3 max-w-3xl text-balance text-4xl leading-[1.1] text-[var(--home-ink)] sm:text-5xl`}>
            Shop Scottsdale candles &amp; more
          </h1>
          <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-[var(--home-muted)]">
            100% natural coconut apricot wax candles made in Arizona. Clean burning, low-soot, and eco-friendly. Upcycled bottles, wood
            wicks, and desert-inspired scents.
          </p>
          <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-sm text-[var(--home-ink)]">
            <Truck className="h-4 w-4 text-[var(--home-clay)]" aria-hidden />
            Free shipping over $100 · Free local pickup in Scottsdale
          </p>

          <div role="tablist" aria-label="Category" className="mt-8 flex gap-6 border-b border-[var(--home-line)]">
            {CATEGORY_TABS.map((opt) => {
              const active = categoryFilter === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setCategoryFilter(opt.value)}
                  className={`-mb-px border-b-2 pb-3 text-[15px] transition-colors ${
                    active
                      ? "border-[var(--home-clay)] font-semibold text-[var(--home-ink)]"
                      : "border-transparent text-[var(--home-muted)] hover:text-[var(--home-ink)]"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div className={`${s.cream} px-6 pb-20 pt-8`}>
        <div className="mx-auto flex max-w-7xl gap-12">
          {/* Desktop filters */}
          <aside className="hidden w-64 shrink-0 lg:block" aria-label="Filters">
            <div className="sticky top-28 max-h-[calc(100dvh-8rem)] overflow-y-auto pb-4 pr-1">{filterPanel}</div>
          </aside>

          <div className="min-w-0 flex-1">
            {/* Toolbar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="relative block flex-1">
                <span className="sr-only">Search the shop</span>
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a8958a]" aria-hidden />
                <input
                  type="search"
                  placeholder="Search by bottle or scent…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoComplete="off"
                  className={`${fieldClass} pl-10`}
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(true)}
                  className={`${btnQuiet} flex-1 lg:hidden`}
                  aria-haspopup="dialog"
                >
                  <SlidersHorizontal className="h-4 w-4" aria-hidden />
                  Filters
                  {filterCount > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--home-ink)] px-1.5 text-xs font-semibold !text-white">
                      {filterCount}
                    </span>
                  )}
                </button>
                <label className="block flex-1 sm:w-48 sm:flex-none">
                  <span className="sr-only">Sort</span>
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)} className={`${fieldClass} min-h-11`}>
                    <option value="name-asc">Name, A–Z</option>
                    <option value="name-desc">Name, Z–A</option>
                    <option value="price-asc">Price, low to high</option>
                    <option value="price-desc">Price, high to low</option>
                  </select>
                </label>
              </div>
            </div>

            {/* Results summary + active filters */}
            <div className="mt-4 flex flex-wrap items-center gap-2" aria-live="polite">
              <p className="mr-2 text-sm text-[var(--home-muted)]">
                {displayCount} of {productCount} {productCount === 1 ? "product" : "products"}
                {filterBy !== "in-stock" && ` · ${inStockCount} in stock`}
              </p>
              {activeChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={chip.clear}
                  className="inline-flex min-h-8 items-center gap-1 rounded-full bg-[var(--home-sand)] pl-3 pr-2 text-sm text-[var(--home-ink)] hover:bg-[var(--home-line)]"
                  aria-label={`Remove filter ${chip.label}`}
                >
                  {chip.label}
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              ))}
            </div>

            {/* Product sections */}
            <div className="mt-8 space-y-14">
              {grouped.map(([typeName, list]) => (
                <section key={typeName} aria-labelledby={`group-${typeName}`}>
                  <div className="mb-5 flex items-baseline justify-between gap-4 border-b border-[var(--home-line)] pb-3">
                    <h2 id={`group-${typeName}`} className={`${serif.className} text-2xl text-[var(--home-ink)] sm:text-[1.75rem]`}>
                      {typeName}
                    </h2>
                    <span className="text-sm tabular-nums text-[var(--home-muted)]">{list.length}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-9 sm:gap-x-6 md:grid-cols-3 xl:grid-cols-4">
                    {list.map((p) => {
                      const variants = p.variantConfig ? generateVariants(p, globalScents) : [];
                      return (
                        <ProductCard
                          key={p.slug}
                          product={p}
                          compact
                          variants={variants}
                          globalScents={globalScents}
                          homeGoodsBottles={p.productType === "home_goods" ? homeGoodsBottles[p.slug] : undefined}
                        />
                      );
                    })}
                  </div>
                </section>
              ))}

              {grouped.length === 0 && (
                <div className="rounded-3xl bg-white/70 px-6 py-16 text-center">
                  <p className={`${serif.className} text-2xl text-[var(--home-ink)]`}>Nothing matches those filters</p>
                  <p className="mt-2 text-[15px] text-[var(--home-muted)]">Try another scent, widen the price range, or include sold-out candles.</p>
                  <button type="button" onClick={resetFilters} className={`${btnPrimary} mt-6`}>
                    Reset filters
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {mobileFiltersOpen && (
        <ShopDialog
          title="Filters"
          subtitle={`${displayCount} ${displayCount === 1 ? "product" : "products"} match`}
          onClose={() => setMobileFiltersOpen(false)}
          footer={
            <button type="button" className={`${btnPrimary} w-full`} onClick={() => setMobileFiltersOpen(false)}>
              Show {displayCount} {displayCount === 1 ? "product" : "products"}
            </button>
          }
        >
          {filterPanel}
        </ShopDialog>
      )}
    </div>
  );
}
