"use client";

import { useState, useMemo, useEffect } from "react";
import ProductCard from "@/components/ProductCard";
import type { Product } from "@/lib/products";
import type { GlobalScent } from "@/lib/scents";
import { Truck } from "lucide-react";

type ProductWithStock = Product & { _computedStock: number };

type ShopClientProps = {
  products: ProductWithStock[];
  globalScents: GlobalScent[];
};

type SortOption = "name-asc" | "name-desc" | "price-asc" | "price-desc";
type FilterOption = "all" | "in-stock" | "low-stock" | "out-of-stock";

export default function ShopClient({ products, globalScents }: ShopClientProps) {
  const [sortBy, setSortBy] = useState<SortOption>("name-asc");
  const [filterBy, setFilterBy] = useState<FilterOption>("all");
  const [showSeasonalOnly, setShowSeasonalOnly] = useState(false);

  // Restore scroll position when returning from product page
  useEffect(() => {
    const shouldRestore = sessionStorage.getItem('useBackButton');
    const savedPosition = sessionStorage.getItem('shopScrollPosition');

    if (shouldRestore === 'true' && savedPosition) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        window.scrollTo({
          top: parseInt(savedPosition, 10),
          behavior: 'instant' as ScrollBehavior
        });
      });

      // Clean up flags
      sessionStorage.removeItem('useBackButton');
      sessionStorage.removeItem('fromProductPage');
    }
  }, []);

  // Get experimental/seasonal scents
  const seasonalScents = useMemo(() =>
    globalScents.filter(s => s.experimental),
    [globalScents]
  );
  const hasSeasonalScents = seasonalScents.length > 0;

  const filteredAndSortedProducts = useMemo(() => {
    let filtered = [...products];

    // Apply seasonal scents filter
    if (showSeasonalOnly) {
      const seasonalScentIds = new Set(seasonalScents.map(s => s.id));
      filtered = filtered.filter((p) => {
        // Only show products that have variantConfig AND have at least one seasonal scent enabled
        if (!p.variantConfig) return false;

        // Check if product has any variants with seasonal scents
        const { variantData } = p.variantConfig;
        return Object.keys(variantData).some(variantId => {
          // Extract scent ID from variant ID (format: "wickId-scentId")
          const parts = variantId.split('-');
          const scentId = parts.slice(1).join('-'); // Handle scent IDs with hyphens
          return seasonalScentIds.has(scentId);
        });
      });
    }

    // Apply stock filter
    if (filterBy === "in-stock") {
      filtered = filtered.filter((p) => p._computedStock > 0);
    } else if (filterBy === "low-stock") {
      filtered = filtered.filter((p) => {
        const stock = p._computedStock;
        return stock > 0 && stock <= 3;
      });
    } else if (filterBy === "out-of-stock") {
      filtered = filtered.filter((p) => p._computedStock === 0);
    }

    // Apply sort
    filtered.sort((a, b) => {
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
          return 0;
      }
    });

    return filtered;
  }, [products, sortBy, filterBy, showSeasonalOnly, seasonalScents]);

  const productCount = products.length;
  const inStockCount = products.filter((p) => p._computedStock > 0).length;
  const displayCount = filteredAndSortedProducts.length;

  return (
    <>
      {/* Free Shipping Banner */}
      <div className="full-bleed bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <p className="text-sm font-medium flex items-center justify-center gap-2">
            <Truck className="w-4 h-4" />
            Free shipping on orders over $50 • Free local pickup in Scottsdale, AZ
          </p>
        </div>
      </div>

      {/* Header with counts */}
      <div className="full-bleed relative isolate py-12 sm:py-16">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-white/70 to-white/90 backdrop-blur-[2px]" />
        <div className="mx-auto max-w-6xl px-6 text-center">
          <h1>Shop Scottsdale Candles</h1>
          <p className="mt-3 text-[var(--color-muted)]">
            Hand-poured soy candles made locally in Arizona. Upcycled bottles, wood wicks, and desert-inspired scents.
          </p>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Showing {displayCount} of {productCount} {productCount === 1 ? "candle" : "candles"} ({inStockCount} in stock)
          </p>
        </div>
      </div>

      {/* Mobile Filters */}
      <div className="lg:hidden px-6 mb-8">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {/* Seasonal Scents Filter - Mobile */}
          {hasSeasonalScents && (
            <div className="flex-1">
              <label className="flex items-center gap-3 cursor-pointer group p-3 rounded-lg border border-[var(--color-line)] hover:border-[var(--color-accent)] transition">
                <div className="relative flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={showSeasonalOnly}
                    onChange={(e) => setShowSeasonalOnly(e.target.checked)}
                    className="peer absolute opacity-0 w-5 h-5 cursor-pointer"
                  />
                  <div className="w-5 h-5 rounded border-2 border-[var(--color-line)] group-hover:border-[var(--color-accent)] transition-colors peer-checked:bg-[var(--color-accent)] peer-checked:border-[var(--color-accent)] flex items-center justify-center pointer-events-none">
                    {showSeasonalOnly && (
                      <svg
                        className="w-3 h-3 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-sm whitespace-nowrap">Candles with Seasonal Scents</span>
              </label>
            </div>
          )}

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
        <div className="flex flex-wrap gap-2">
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
      </div>

      {/* Main Content with Sidebar */}
      <div className="px-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
            {/* Desktop Sidebar */}
            <aside className="hidden lg:block lg:w-64 flex-shrink-0">
            <div className="space-y-6">
              {/* Seasonal Scents Filter */}
              {hasSeasonalScents && (
                <div>
                  <h3 className="text-sm font-semibold mb-3">Collections</h3>
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center mt-0.5">
                      <input
                        type="checkbox"
                        checked={showSeasonalOnly}
                        onChange={(e) => setShowSeasonalOnly(e.target.checked)}
                        className="peer absolute opacity-0 w-5 h-5 cursor-pointer"
                      />
                      <div className="w-5 h-5 rounded border-2 border-[var(--color-line)] group-hover:border-[var(--color-accent)] transition-colors peer-checked:bg-[var(--color-accent)] peer-checked:border-[var(--color-accent)] flex items-center justify-center pointer-events-none">
                        {showSeasonalOnly && (
                          <svg
                            className="w-3 h-3 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={3}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <span className="text-sm leading-relaxed group-hover:text-[var(--color-accent)] transition">
                      Candles with Seasonal Scents
                    </span>
                  </label>
                </div>
              )}

              {/* Stock Filters */}
              <div>
                <h3 className="text-sm font-semibold mb-3">Availability</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => setFilterBy("all")}
                    className={`w-full text-left px-3 py-2 text-sm rounded-lg transition ${
                      filterBy === "all"
                        ? "bg-[var(--color-ink)] text-white"
                        : "hover:bg-neutral-50"
                    }`}
                  >
                    All Products
                  </button>
                  <button
                    onClick={() => setFilterBy("in-stock")}
                    className={`w-full text-left px-3 py-2 text-sm rounded-lg transition ${
                      filterBy === "in-stock"
                        ? "bg-[var(--color-ink)] text-white"
                        : "hover:bg-neutral-50"
                    }`}
                  >
                    In Stock
                  </button>
                  <button
                    onClick={() => setFilterBy("low-stock")}
                    className={`w-full text-left px-3 py-2 text-sm rounded-lg transition ${
                      filterBy === "low-stock"
                        ? "bg-[var(--color-ink)] text-white"
                        : "hover:bg-neutral-50"
                    }`}
                  >
                    Low Stock
                  </button>
                  <button
                    onClick={() => setFilterBy("out-of-stock")}
                    className={`w-full text-left px-3 py-2 text-sm rounded-lg transition ${
                      filterBy === "out-of-stock"
                        ? "bg-[var(--color-ink)] text-white"
                        : "hover:bg-neutral-50"
                    }`}
                  >
                    Out of Stock
                  </button>
                </div>
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

            {/* Product grid - centered */}
            <div className="flex-1 mx-auto max-w-6xl">
              <div className="grid gap-5 sm:gap-6 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filteredAndSortedProducts.map((p) => (
              <ProductCard key={p.slug} product={p} compact />
            ))}
          </div>

              {/* Empty state */}
              {filteredAndSortedProducts.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-[var(--color-muted)]">No candles match your filters.</p>
                  <button
                    onClick={() => {
                      setFilterBy("all");
                      setSortBy("name-asc");
                      setShowSeasonalOnly(false);
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
