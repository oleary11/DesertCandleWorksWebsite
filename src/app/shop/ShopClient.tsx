"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import ProductCard from "@/components/ProductCard";
import type { Product } from "@/lib/products";
import { generateVariants } from "@/lib/products";
import type { GlobalScent } from "@/lib/scents";
import { useCartStore } from "@/lib/cartStore";
import { Truck, Search, CheckCircle, XCircle, SlidersHorizontal, X } from "lucide-react";

type ProductWithStock = Product & { _computedStock: number };

type SortOption = "name-asc" | "name-desc" | "price-asc" | "price-desc";
type FilterOption = "all" | "in-stock" | "low-stock" | "out-of-stock";

type AlcoholType = { id: string; name: string; sortOrder?: number };

type ShopClientProps = {
  products: ProductWithStock[];
  globalScents: GlobalScent[];
  alcoholTypes: AlcoholType[]; // NEW for grouping
};

export default function ShopClient({ products, globalScents, alcoholTypes }: ShopClientProps) {
  const searchParams = useSearchParams();
  const clearCart = useCartStore((state) => state.clearCart);

  const [sortBy, setSortBy] = useState<SortOption>("name-asc");
  const [filterBy, setFilterBy] = useState<FilterOption>("in-stock");
  const [searchQuery, setSearchQuery] = useState("");
  const [showStatusBanner, setShowStatusBanner] = useState(false);
  const [statusType, setStatusType] = useState<"success" | "cancelled" | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [selectedScents, setSelectedScents] = useState<Set<string>>(new Set()); // scent IDs or "limited" for limited scents

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

  // Base filter/sort (before grouping)
  const filteredAndSortedProducts = useMemo(() => {
    let filtered = [...products];

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
        // Products without variant config don't have scents, skip scent filtering for them
        if (!p.variantConfig?.variantData) return true;

        const { variantData, wickTypes } = p.variantConfig;
        const wickIds = new Set(wickTypes.map(w => w.id));

        // Check if any variant matches selected scents
        for (const variantId of Object.keys(variantData)) {
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
            return true; // Direct match to a main scent
          }
          // Check if "limited" is selected and this scent is a limited scent
          if (selectedScents.has("limited") && limitedScentIds.has(scentId)) {
            return true;
          }
        }
        return false; // No matching scents found
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
    return idx;
  }, [alcoholTypes]);

  // Group filtered results by Alcohol Type in requested order
  const grouped = useMemo(() => {
    const m = new Map<string, ProductWithStock[]>();
    for (const p of filteredAndSortedProducts) {
      const key = p.alcoholType || "Other";
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
  const inStockCount = products.filter((p) => p._computedStock > 0).length;
  const displayCount = filteredAndSortedProducts.length;

  return (
    <>
      {/* Checkout Status Banner */}
      {showStatusBanner && statusType && (
        <div
          className={`full-bleed ${
            statusType === "success"
              ? "bg-gradient-to-r from-green-600 to-green-700"
              : "bg-gradient-to-r from-amber-600 to-amber-700"
          } text-white py-4 shadow-lg`}
        >
          <div className="mx-auto max-w-6xl px-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {statusType === "success" ? (
                  <CheckCircle className="w-5 h-5 flex-shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 flex-shrink-0" />
                )}
                <div>
                  <p className="font-semibold">
                    {statusType === "success" ? "Order Confirmed!" : "Order Cancelled"}
                  </p>
                  <p className="text-sm opacity-90">
                    {statusType === "success"
                      ? "Thank you for your purchase! A confirmation email has been sent to your email address."
                      : "Your order was cancelled. No charges were made."}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowStatusBanner(false)}
                className="text-white/80 hover:text-white transition flex-shrink-0"
                aria-label="Dismiss"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Free Shipping Banner */}
      <div className="full-bleed bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <p className="text-sm font-medium flex items-center justify-center gap-2">
            <Truck className="w-4 h-4" />
            Free shipping on orders over $100 • Free local pickup in Scottsdale, AZ
          </p>
        </div>
      </div>

      {/* Header with counts */}
      <div className="full-bleed relative isolate py-12 sm:py-16">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-white/70 to-white/90 backdrop-blur-[2px]" />
        <div className="mx-auto max-w-6xl px-6 text-center">
          <h1>Shop Scottsdale Candles</h1>
          <p className="mt-3 text-[var(--color-muted)]">
            100% natural coconut apricot wax candles made in Arizona. Clean burning, smokeless, and eco-friendly. Upcycled bottles, wood wicks, and desert-inspired scents.
          </p>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Showing {displayCount} of {productCount} {productCount === 1 ? "candle" : "candles"} (
            {inStockCount} in stock)
          </p>

          {/* Search Bar */}
          <div className="mt-6 mx-auto max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-muted)] pointer-events-none" />
              <input
                type="text"
                placeholder="Search candles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 text-sm rounded-xl border border-[var(--color-line)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)] hover:text-[var(--color-ink)] transition"
                  aria-label="Clear search"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Filters Toggle Button */}
      <div className="lg:hidden px-6 mb-6">
        <button
          onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border-2 border-[var(--color-line)] bg-white hover:border-[var(--color-accent)] transition shadow-sm"
        >
          <div className="flex items-center gap-3">
            <SlidersHorizontal className="w-5 h-5 text-[var(--color-ink)]" />
            <span className="font-medium text-[var(--color-ink)]">
              Filters & Sort
            </span>
          </div>
          {mobileFiltersOpen ? (
            <X className="w-5 h-5 text-[var(--color-muted)]" />
          ) : (
            <svg className="w-5 h-5 text-[var(--color-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Filters Panel (Collapsible) */}
      {mobileFiltersOpen && (
        <div className="lg:hidden px-6 mb-8 animate-in slide-in-from-top-4 duration-200">
          {/* Price Range Filter - Mobile */}
          <div className="mb-6 p-4 rounded-lg border border-[var(--color-line)] bg-white shadow-sm">
            <h3 className="text-sm font-semibold mb-3">Price Range</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 text-sm">
              <span className="font-medium">${priceMin}</span>
              <span className="text-[var(--color-muted)]">-</span>
              <span className="font-medium">${priceMax}</span>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-[var(--color-muted)]">Min: ${priceMin}</label>
              <input
                type="range"
                min={priceRange.min}
                max={priceRange.max}
                value={priceMin}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val <= priceMax) setPriceMin(val);
                }}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-neutral-200"
                style={{ accentColor: "var(--color-accent)" }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-[var(--color-muted)]">Max: ${priceMax}</label>
              <input
                type="range"
                min={priceRange.min}
                max={priceRange.max}
                value={priceMax}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val >= priceMin) setPriceMax(val);
                }}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-neutral-200"
                style={{ accentColor: "var(--color-accent)" }}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {/* Sort - Mobile */}
          <div className="flex-1">
            <select
              id="sort-mobile"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="w-full px-3 py-3 text-sm rounded-lg border border-[var(--color-line)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-ink)] focus:ring-offset-1"
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="price-asc">Price (Low-High)</option>
              <option value="price-desc">Price (High-Low)</option>
            </select>
          </div>
        </div>

        {/* Stock Filters - Mobile */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setFilterBy("all")}
            className={`px-4 py-2 text-sm rounded-full border transition ${
              filterBy === "all"
                ? "bg-[var(--color-ink)] text-white border-[var(--color-ink)]"
                : "border-[var(--color-line)] hover:border-[var(--color-ink)]"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterBy("in-stock")}
            className={`px-4 py-2 text-sm rounded-full border transition ${
              filterBy === "in-stock"
                ? "bg-[var(--color-ink)] text-white border-[var(--color-ink)]"
                : "border-[var(--color-line)] hover:border-[var(--color-ink)]"
            }`}
          >
            In Stock
          </button>
          <button
            onClick={() => setFilterBy("low-stock")}
            className={`px-4 py-2 text-sm rounded-full border transition ${
              filterBy === "low-stock"
                ? "bg-[var(--color-ink)] text-white border-[var(--color-ink)]"
                : "border-[var(--color-line)] hover:border-[var(--color-ink)]"
            }`}
          >
            Low Stock
          </button>
          <button
            onClick={() => setFilterBy("out-of-stock")}
            className={`px-4 py-2 text-sm rounded-full border transition ${
              filterBy === "out-of-stock"
                ? "bg-[var(--color-ink)] text-white border-[var(--color-ink)]"
                : "border-[var(--color-line)] hover:border-[var(--color-ink)]"
            }`}
          >
            Out of Stock
          </button>
        </div>

        {/* Scent Filters - Mobile */}
        <div className="p-4 rounded-lg border border-[var(--color-line)] bg-white shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Scent</h3>
            {selectedScents.size > 0 && (
              <button
                onClick={() => setSelectedScents(new Set())}
                className="text-xs text-[var(--color-accent)] hover:underline"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {mainScents.map((scent) => (
              <button
                key={scent.id}
                onClick={() => toggleScent(scent.id)}
                className={`px-3 py-1.5 text-sm rounded-full border transition ${
                  selectedScents.has(scent.id)
                    ? "bg-[var(--color-ink)] text-white border-[var(--color-ink)]"
                    : "border-[var(--color-line)] hover:border-[var(--color-ink)]"
                }`}
              >
                {scent.name}
              </button>
            ))}
            {limitedScentIds.size > 0 && (
              <button
                onClick={() => toggleScent("limited")}
                className={`px-3 py-1.5 text-sm rounded-full border transition italic ${
                  selectedScents.has("limited")
                    ? "bg-[var(--color-ink)] text-white border-[var(--color-ink)]"
                    : "border-[var(--color-line)] hover:border-[var(--color-ink)]"
                }`}
              >
                Limited Scents
              </button>
            )}
          </div>
        </div>
        </div>
      )}

      {/* Main Content with Sidebar */}
      <div className="px-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
            {/* Desktop Sidebar */}
            <aside className="hidden lg:block lg:w-64 flex-shrink-0">
              <div className="space-y-6">
                {/* Availability */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Availability</h3>
                  <div className="space-y-2">
                    <button
                      onClick={() => setFilterBy("all")}
                      className={`w-full text-left px-3 py-2 text-sm rounded-lg transition ${
                        filterBy === "all" ? "bg-[var(--color-ink)] text-white" : "hover:bg-neutral-50"
                      }`}
                    >
                      All Products
                    </button>
                    <button
                      onClick={() => setFilterBy("in-stock")}
                      className={`w-full text-left px-3 py-2 text-sm rounded-lg transition ${
                        filterBy === "in-stock" ? "bg-[var(--color-ink)] text-white" : "hover:bg-neutral-50"
                      }`}
                    >
                      In Stock
                    </button>
                    <button
                      onClick={() => setFilterBy("low-stock")}
                      className={`w-full text-left px-3 py-2 text-sm rounded-lg transition ${
                        filterBy === "low-stock" ? "bg-[var(--color-ink)] text-white" : "hover:bg-neutral-50"
                      }`}
                    >
                      Low Stock
                    </button>
                    <button
                      onClick={() => setFilterBy("out-of-stock")}
                      className={`w-full text-left px-3 py-2 text-sm rounded-lg transition ${
                        filterBy === "out-of-stock" ? "bg-[var(--color-ink)] text-white" : "hover:bg-neutral-50"
                      }`}
                    >
                      Out of Stock
                    </button>
                  </div>
                </div>

                {/* Price Range - Desktop */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Price Range</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-[var(--color-muted)]">${priceMin}</span>
                      <span className="text-[var(--color-muted)]">-</span>
                      <span className="text-[var(--color-muted)]">${priceMax}</span>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-[var(--color-muted)]">Min: ${priceMin}</label>
                      <input
                        type="range"
                        min={priceRange.min}
                        max={priceRange.max}
                        value={priceMin}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (val <= priceMax) setPriceMin(val);
                        }}
                        className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-neutral-200"
                        style={{ accentColor: "var(--color-accent)" }}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-[var(--color-muted)]">Max: ${priceMax}</label>
                      <input
                        type="range"
                        min={priceRange.min}
                        max={priceRange.max}
                        value={priceMax}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (val >= priceMin) setPriceMax(val);
                        }}
                        className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-neutral-200"
                        style={{ accentColor: "var(--color-accent)" }}
                      />
                    </div>
                  </div>
                </div>

                {/* Scent Filter */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Scent</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {mainScents.map((scent) => (
                      <label
                        key={scent.id}
                        className="flex items-center gap-2 cursor-pointer text-sm hover:bg-neutral-50 px-2 py-1 rounded transition"
                      >
                        <input
                          type="checkbox"
                          checked={selectedScents.has(scent.id)}
                          onChange={() => toggleScent(scent.id)}
                          className="w-4 h-4 rounded border-[var(--color-line)] text-[var(--color-ink)] focus:ring-[var(--color-ink)] focus:ring-offset-0"
                        />
                        <span>{scent.name}</span>
                      </label>
                    ))}
                    {/* Limited Scents option */}
                    {limitedScentIds.size > 0 && (
                      <label
                        className="flex items-center gap-2 cursor-pointer text-sm hover:bg-neutral-50 px-2 py-1 rounded transition border-t border-[var(--color-line)] pt-2 mt-2"
                      >
                        <input
                          type="checkbox"
                          checked={selectedScents.has("limited")}
                          onChange={() => toggleScent("limited")}
                          className="w-4 h-4 rounded border-[var(--color-line)] text-[var(--color-ink)] focus:ring-[var(--color-ink)] focus:ring-offset-0"
                        />
                        <span className="italic">Limited Scents</span>
                      </label>
                    )}
                  </div>
                  {selectedScents.size > 0 && (
                    <button
                      onClick={() => setSelectedScents(new Set())}
                      className="mt-2 text-xs text-[var(--color-accent)] hover:underline"
                    >
                      Clear scent filters
                    </button>
                  )}
                </div>

                {/* Sort */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Sort</h3>
                  <select
                    id="sort"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-line)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-ink)] focus:ring-offset-1"
                  >
                    <option value="name-asc">Name (A-Z)</option>
                    <option value="name-desc">Name (Z-A)</option>
                    <option value="price-asc">Price (Low-High)</option>
                    <option value="price-desc">Price (High-Low)</option>
                  </select>
                </div>
              </div>
            </aside>

            {/* Product Sections (Grouped) */}
            <div className="flex-1 mx-auto max-w-6xl">
              {grouped.map(([typeName, list]) => (
                <section key={typeName} className="mb-16">
                  <h2 className="text-lg sm:text-xl font-semibold">{typeName}</h2>

                  {/* Add bottom padding inside grid to separate from divider */}
                  <div className="mt-6 grid gap-5 sm:gap-6 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 pb-6">
                    {list.map((p) => {
                      const variants = p.variantConfig ? generateVariants(p, globalScents) : [];
                      return (
                        <ProductCard
                          key={p.slug}
                          product={p}
                          compact
                          variants={variants}
                          globalScents={globalScents}
                        />
                      );
                    })}
                  </div>

                  {/* Bottom divider */}
                  <div className="h-px w-full bg-[var(--color-line)]" />
                </section>
              ))}

              {/* Empty state */}
              {grouped.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-[var(--color-muted)]">No candles match your filters.</p>
                  <button
                    onClick={() => {
                      setFilterBy("all");
                      setSortBy("name-asc");
                      setSearchQuery("");
                      setPriceMin(priceRange.min);
                      setPriceMax(priceRange.max);
                      setSelectedScents(new Set());
                    }}
                    className="mt-4 text-sm text-[var(--color-accent)] hover:underline"
                  >
                    Reset filters
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}