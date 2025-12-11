"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import ProductCard from "@/components/ProductCard";
import type { Product } from "@/lib/products";
import type { GlobalScent } from "@/lib/scents";
import { useCartStore } from "@/lib/cartStore";
import { Truck, Search, CheckCircle, XCircle, Sparkles } from "lucide-react";

type ProductWithStock = Product & { _computedStock: number };

type SortOption = "name-asc" | "name-desc" | "price-asc" | "price-desc";
type FilterOption = "all" | "in-stock" | "low-stock" | "out-of-stock";

type AlcoholType = { id: string; name: string; sortOrder?: number };

type YoungDumbClientProps = {
  products: ProductWithStock[];
  globalScents: GlobalScent[];
  alcoholTypes: AlcoholType[];
};

export default function YoungDumbClient({ products, globalScents, alcoholTypes }: YoungDumbClientProps) {
  const searchParams = useSearchParams();
  const clearCart = useCartStore((state) => state.clearCart);

  const [sortBy, setSortBy] = useState<SortOption>("name-asc");
  const [filterBy, setFilterBy] = useState<FilterOption>("in-stock");
  const [searchQuery, setSearchQuery] = useState("");
  const [showStatusBanner, setShowStatusBanner] = useState(false);
  const [statusType, setStatusType] = useState<"success" | "cancelled" | null>(null);

  // Price range from products
  const priceRange = useMemo(() => {
    if (products.length === 0) return { min: 0, max: 100 };
    const prices = products.map((p) => p.price);
    return {
      min: Math.floor(Math.min(...prices)),
      max: Math.ceil(Math.max(...prices)),
    };
  }, [products]);

  const [priceMin, setPriceMin] = useState(priceRange.min);
  const [priceMax, setPriceMax] = useState(priceRange.max);

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

  // Filter/sort products
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

    // Stock filter
    if (filterBy === "in-stock") {
      filtered = filtered.filter((p) => p._computedStock > 0);
    } else if (filterBy === "low-stock") {
      filtered = filtered.filter((p) => p._computedStock > 0 && p._computedStock <= 3);
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
  }, [products, sortBy, filterBy, searchQuery, priceMin, priceMax]);

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

    // keep graceful name sort inside each group
    for (const [key, list] of m) {
      list.sort((a, b) => a.name.localeCompare(b.name));
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
              ? "bg-gradient-to-r from-purple-600 to-pink-600"
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

      {/* Free Shipping Banner - Fun gradient */}
      <div className="full-bleed bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white py-3">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <p className="text-sm font-medium flex items-center justify-center gap-2">
            <Truck className="w-4 h-4" />
            Free shipping on orders over $100 • Free local pickup in Scottsdale, AZ
          </p>
        </div>
      </div>

      {/* Header with fun styling */}
      <div className="full-bleed relative isolate py-12 sm:py-16 bg-gradient-to-b from-purple-50 via-pink-50 to-orange-50">
        <div className="absolute inset-0 -z-10 opacity-30">
          <div className="absolute top-10 left-10 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl animate-blob" />
          <div className="absolute top-10 right-10 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000" />
          <div className="absolute bottom-10 left-1/2 w-72 h-72 bg-orange-300 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-4000" />
        </div>
        <div className="mx-auto max-w-6xl px-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-3 pb-3 overflow-visible">
            <Sparkles className="w-8 h-8 text-purple-600" />
            <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent leading-relaxed">
              Young & Dumb
            </h1>
            <Sparkles className="w-8 h-8 text-pink-600" />
          </div>
          <p className="mt-2 text-base sm:text-lg text-gray-600 italic">
            Yeah, we were too once...
          </p>
          <p className="mt-3 text-base sm:text-lg text-gray-700">
            Trendy candles in bottles you know and love. Perfect for gifts, dorms, or your first apartment.
          </p>
          <p className="mt-2 text-sm text-gray-600">
            Showing {displayCount} of {productCount} {productCount === 1 ? "candle" : "candles"} (
            {inStockCount} in stock)
          </p>

          {/* Search Bar */}
          <div className="mt-6 mx-auto max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search candles..."
                className="w-full pl-10 pr-4 py-2 rounded-full border-2 border-purple-200 focus:border-purple-500 focus:outline-none shadow-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Filters */}
      <div className="lg:hidden px-6 mb-8 mt-8">
        {/* Price Range Filter - Mobile */}
        <div className="mb-6 p-4 rounded-lg border border-purple-200">
          <h3 className="text-sm font-semibold mb-3">Price Range</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 text-sm">
              <span className="font-medium">${priceMin}</span>
              <span className="text-gray-500">-</span>
              <span className="font-medium">${priceMax}</span>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-gray-500">Min: ${priceMin}</label>
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
                style={{ accentColor: "#9333ea" }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-gray-500">Max: ${priceMax}</label>
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
                style={{ accentColor: "#9333ea" }}
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
              className="w-full px-3 py-3 text-sm rounded-lg border border-purple-200 bg-white focus:outline-none focus:ring-2 focus:ring-purple-600 focus:ring-offset-1"
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
                ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white border-purple-600"
                : "border-purple-200 hover:border-purple-600"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterBy("in-stock")}
            className={`px-4 py-2 text-sm rounded-full border transition ${
              filterBy === "in-stock"
                ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white border-purple-600"
                : "border-purple-200 hover:border-purple-600"
            }`}
          >
            In Stock
          </button>
          <button
            onClick={() => setFilterBy("low-stock")}
            className={`px-4 py-2 text-sm rounded-full border transition ${
              filterBy === "low-stock"
                ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white border-purple-600"
                : "border-purple-200 hover:border-purple-600"
            }`}
          >
            Low Stock
          </button>
          <button
            onClick={() => setFilterBy("out-of-stock")}
            className={`px-4 py-2 text-sm rounded-full border transition ${
              filterBy === "out-of-stock"
                ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white border-purple-600"
                : "border-purple-200 hover:border-purple-600"
            }`}
          >
            Out of Stock
          </button>
        </div>
      </div>

      {/* Main Content with Sidebar */}
      <div className="px-6 mt-8">
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
                        filterBy === "all" ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white" : "hover:bg-purple-50"
                      }`}
                    >
                      All Products
                    </button>
                    <button
                      onClick={() => setFilterBy("in-stock")}
                      className={`w-full text-left px-3 py-2 text-sm rounded-lg transition ${
                        filterBy === "in-stock" ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white" : "hover:bg-purple-50"
                      }`}
                    >
                      In Stock
                    </button>
                    <button
                      onClick={() => setFilterBy("low-stock")}
                      className={`w-full text-left px-3 py-2 text-sm rounded-lg transition ${
                        filterBy === "low-stock" ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white" : "hover:bg-purple-50"
                      }`}
                    >
                      Low Stock
                    </button>
                    <button
                      onClick={() => setFilterBy("out-of-stock")}
                      className={`w-full text-left px-3 py-2 text-sm rounded-lg transition ${
                        filterBy === "out-of-stock" ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white" : "hover:bg-purple-50"
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
                      <span className="text-gray-600">${priceMin}</span>
                      <span className="text-gray-600">-</span>
                      <span className="text-gray-600">${priceMax}</span>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-gray-500">Min: ${priceMin}</label>
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
                        style={{ accentColor: "#9333ea" }}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-gray-500">Max: ${priceMax}</label>
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
                        style={{ accentColor: "#9333ea" }}
                      />
                    </div>
                  </div>
                </div>

                {/* Sort */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Sort</h3>
                  <select
                    id="sort"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-purple-200 bg-white focus:outline-none focus:ring-2 focus:ring-purple-600 focus:ring-offset-1"
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
              {displayCount === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">No candles found. Try adjusting your filters.</p>
                </div>
              ) : (
                <div className="space-y-12">
                  {grouped.map(([alcoholType, typeProducts]) => (
                    <section key={alcoholType}>
                      <h2 className="text-lg sm:text-xl font-semibold mb-6 pb-2 border-b-2 border-gradient-to-r from-purple-300 to-pink-300">
                        {alcoholType}
                      </h2>
                      <div className="mt-6 grid gap-5 sm:gap-6 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 pb-6">
                        {typeProducts.map((product) => (
                          <ProductCard
                            key={product.slug}
                            product={product}
                            globalScents={globalScents}
                            compact
                          />
                        ))}
                      </div>
                      <div className="h-px w-full bg-purple-200" />
                    </section>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
