"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Plus, Search, Trash2, X } from "lucide-react";
import PageHeader from "../_components/PageHeader";
import { Badge } from "../_components/ui";
import CandleSpinner from "@/components/CandleSpinner";

type Product = {
  slug: string;
  name: string;
  price: number;
  stock: number;
  sku: string;
  alcoholType?: string;
  variantConfig?: {
    sizes?: Array<{ id: string; name: string; priceCents: number }>;
    wickTypes: Array<{ id: string; name: string }>;
    variantData: Record<string, { stock: number }>;
  };
  productType?: "candle" | "home_goods";
  bottleOptions?: Array<{ bottleId: string; bottleName: string; priceCents?: number }>;
  requiresUncut?: boolean;
};

type BottleInventoryItem = {
  id: string;
  name: string;
  imageUrl?: string;
  alcoholType?: string;
  qtyUncut: number;
  qtyCutUnpolished: number;
  qtyCutPolished: number;
  usableForHomeGoods: boolean;
  archived: boolean;
};

// Mirrors getSingleBottleStock() in src/lib/bottleInventoryStore.ts — that
// version is server-only (imports the db client), so the same small formula
// is duplicated here for the admin UI's stock display.
function getBottleStock(bottle: BottleInventoryItem, requiresUncut?: boolean): number {
  return requiresUncut
    ? bottle.qtyUncut
    : bottle.qtyUncut + bottle.qtyCutUnpolished + bottle.qtyCutPolished;
}

type GlobalScent = {
  id: string;
  name: string;
  limited?: boolean;
  enabledProducts?: string[];
  sortOrder?: number;
};

type AlcoholType = {
  id: string;
  name: string;
  sortOrder?: number;
};

type SaleItem = {
  id: string;
  isCustom: boolean; // true for custom products not in the database
  productSlug: string;
  productName: string;
  quantity: number;
  unitPriceCents: number; // Price per unit (not total)
  variantId?: string; // candle variant id ("wickType-scentId"), OR — for Home Goods items — the selected bottle's id (bottle_inventory.id)
  selectedSizeId?: string; // size ID for variant tracking
  sizeName?: string;
  wickType?: string; // wick type ID for scent tracking
  scentId?: string; // scent ID for analytics
  scentName?: string; // scent name for display
  alcoholType?: string; // alcohol type for analytics
  productType?: "candle" | "home_goods";
  bottleName?: string; // denormalized label for the selected Home Goods bottle
};

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
}) {
  const {
    id,
    label,
    placeholder = "Search…",
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
      <label htmlFor={id} className="a-label">
        {label}
      </label>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--a-faint)]" />

        <input
          id={id}
          ref={inputRef}
          className="a-input !pl-9 !pr-10"
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
          role="combobox"
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
            className="a-icon-btn absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
            onClick={() => {
              setQuery("");
              setActiveIndex(0);
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}

        {open && (
          <div
            id={`${id}-listbox`}
            role="listbox"
            className="a-card absolute z-30 mt-1.5 w-full min-w-[min(20rem,calc(100vw-3rem))] overflow-hidden shadow-lg"
          >
            <div className="max-h-72 overflow-y-auto overscroll-contain">
              {filtered.length === 0 ? (
                <div className="px-4 py-3 text-sm text-[var(--a-muted)]">
                  {emptyMessage}
                </div>
              ) : (
                <>
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
                          "w-full text-left px-3.5 py-2.5",
                          "transition-colors",
                          item.disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                          isActive ? "bg-[var(--a-tint)]" : "bg-white",
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
                              <div className="mt-0.5 truncate text-xs text-[var(--a-muted)]">
                                {item.sublabel}
                              </div>
                            ) : null}
                          </div>
                          {isSelected ? (
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--a-ink)]" aria-label="Selected" />
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ManualSalePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [scents, setScents] = useState<GlobalScent[]>([]);
  const [alcoholTypes, setAlcoholTypes] = useState<AlcoholType[]>([]);
  const [bottleInventory, setBottleInventory] = useState<BottleInventoryItem[]>([]);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [customerEmail, setCustomerEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "other">("cash");
  const [notes, setNotes] = useState("");
  const [decrementStock, setDecrementStock] = useState(true);
  const [discountCents, setDiscountCents] = useState(0); // Order-level discount
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [productsRes, scentsRes, alcoholTypesRes, bottleInventoryRes] = await Promise.all([
        fetch("/api/admin/products"),
        fetch("/api/admin/scents"),
        fetch("/api/admin/alcohol-types"),
        fetch("/api/admin/bottle-inventory"),
      ]);

      if (!productsRes.ok) throw new Error("Failed to load products");
      if (!scentsRes.ok) throw new Error("Failed to load scents");
      if (!alcoholTypesRes.ok) throw new Error("Failed to load alcohol types");
      if (!bottleInventoryRes.ok) throw new Error("Failed to load bottle inventory");

      const productsData = await productsRes.json();
      const scentsData = await scentsRes.json();
      const alcoholTypesData = await alcoholTypesRes.json();
      const bottleInventoryData = await bottleInventoryRes.json();

      setProducts(productsData.items || []);
      setScents(scentsData.scents || []);
      setAlcoholTypes(alcoholTypesData.types || []);
      setBottleInventory(bottleInventoryData.items || []);
    } catch (err) {
      setError("Failed to load data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadProducts() {
    await loadData();
  }

  function addItem(isCustom: boolean = false) {
    const newItem: SaleItem = {
      id: crypto.randomUUID(),
      isCustom,
      productSlug: isCustom ? "custom" : "",
      productName: "",
      quantity: 1,
      unitPriceCents: 0,
    };
    setItems([...items, newItem]);
  }

  function removeItem(id: string) {
    setItems(items.filter((item) => item.id !== id));
  }

  function updateItem(id: string, updates: Partial<SaleItem>) {
    setItems(
      items.map((item) => {
        if (item.id === id) {
          return { ...item, ...updates };
        }
        return item;
      })
    );
  }

  function handleProductChange(itemId: string, productSlug: string) {
    const product = products.find((p) => p.slug === productSlug);
    if (product) {
      updateItem(itemId, {
        productSlug: product.slug,
        productName: product.name,
        unitPriceCents: Math.round(product.price * 100),
        productType: product.productType === "home_goods" ? "home_goods" : "candle",
        variantId: undefined,
        selectedSizeId: undefined,
        sizeName: undefined,
        wickType: undefined,
        scentId: undefined,
        scentName: undefined,
        bottleName: undefined,
        alcoholType: product.alcoholType,
      });
    }
  }

  // Home Goods items select a physical bottle instead of a wick/scent/size
  // variant — the bottle IS the variant (see SaleItem.variantId doc comment).
  function handleBottleChange(itemId: string, bottleId: string) {
    const item = items.find((i) => i.id === itemId);
    const product = products.find((p) => p.slug === item?.productSlug);
    if (!item || !product) return;

    const option = product.bottleOptions?.find((o) => o.bottleId === bottleId);
    const bottle = bottleInventory.find((b) => b.id === bottleId);
    const unitPriceCents = option?.priceCents ?? Math.round(product.price * 100);

    updateItem(itemId, {
      variantId: bottleId || undefined,
      bottleName: bottle?.name ?? option?.bottleName,
      unitPriceCents,
      alcoholType: bottle?.alcoholType ?? product.alcoholType,
    });
  }

  function handleSizeChange(itemId: string, sizeId: string) {
    const item = items.find((i) => i.id === itemId);
    const product = products.find((p) => p.slug === item?.productSlug);
    const size = product?.variantConfig?.sizes?.find((s) => s.id === sizeId);
    if (!item) return;

    const variantId = sizeId && item.wickType && item.scentId
      ? `${sizeId}-${item.wickType}-${item.scentId}`
      : undefined;

    updateItem(itemId, {
      selectedSizeId: sizeId || undefined,
      sizeName: size?.name,
      unitPriceCents: size ? size.priceCents : Math.round((product?.price ?? 0) * 100),
      variantId: item.isCustom ? undefined : variantId,
    });
  }

  function handleScentChange(itemId: string, scentId: string, wickType?: string) {
    const scent = scents.find((s) => s.id === scentId);
    const item = items.find((i) => i.id === itemId);

    if (scent && item) {
      const effectiveWickType = wickType || item.wickType || "standard-wick";
      const variantId = item.selectedSizeId
        ? `${item.selectedSizeId}-${effectiveWickType}-${scentId}`
        : `${effectiveWickType}-${scentId}`;

      updateItem(itemId, {
        scentId,
        scentName: scent.name,
        wickType: effectiveWickType,
        variantId: item.isCustom ? undefined : variantId,
      });
    } else if (!scentId) {
      updateItem(itemId, {
        scentId: undefined,
        scentName: undefined,
        variantId: undefined,
      });
    }
  }

  function handleWickTypeChange(itemId: string, wickType: string) {
    const item = items.find((i) => i.id === itemId);
    if (item) {
      const variantId = item.scentId
        ? item.selectedSizeId
          ? `${item.selectedSizeId}-${wickType}-${item.scentId}`
          : `${wickType}-${item.scentId}`
        : undefined;
      updateItem(itemId, {
        wickType,
        variantId: item.isCustom ? undefined : variantId,
      });
    }
  }

  const bottleById = useMemo(() => new Map(bottleInventory.map((b) => [b.id, b])), [bottleInventory]);

  // Helper function to calculate total stock for a product (base + all variants,
  // or — for Home Goods — the live sum across its linked bottles)
  function calculateTotalStock(product: Product): number {
    if (product.productType === "home_goods") {
      let total = 0;
      for (const opt of product.bottleOptions || []) {
        const bottle = bottleById.get(opt.bottleId);
        if (bottle) total += getBottleStock(bottle, product.requiresUncut);
      }
      return total;
    }
    let total = product.stock || 0;
    if (product.variantConfig?.variantData) {
      for (const variant of Object.values(product.variantConfig.variantData)) {
        total += variant.stock || 0;
      }
    }
    return total;
  }

  // Build product items for ComboBox
  const productItems = useMemo(() => {
    return [
      {
        value: "",
        label: "Select product…",
        sublabel: "Choose a product to add",
      },
      ...products.map((p) => {
        const totalStock = calculateTotalStock(p);
        return {
          value: p.slug,
          label: p.name,
          sublabel: `Stock: ${totalStock} | Price: $${p.price.toFixed(2)} | SKU: ${p.sku}`,
        };
      }),
    ];
    // calculateTotalStock is a plain function (not memoized) that closes over
    // bottleById, which is already listed below as the real reactive dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, bottleById]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (items.length === 0) {
      setError("Please add at least one item");
      return;
    }

    // Validate all items have products selected or custom product name
    for (const item of items) {
      if (item.isCustom) {
        if (!item.productName || item.productName.trim() === "") {
          setError("Please enter a product name for all custom items");
          return;
        }
      } else {
        if (!item.productSlug) {
          setError("Please select a product for all items");
          return;
        }
        if (item.productType === "home_goods" && !item.variantId) {
          setError(`Please select a bottle for "${item.productName}"`);
          return;
        }
      }
      if (item.quantity < 1) {
        setError("Quantity must be at least 1 for all items");
        return;
      }
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/admin/manual-sale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            isCustom: item.isCustom,
            productSlug: item.isCustom ? "custom" : item.productSlug,
            productName: item.productName,
            quantity: item.quantity,
            priceCents: item.unitPriceCents * item.quantity, // Send total price for this line item
            unitPriceCents: item.unitPriceCents, // Also send per-unit price
            variantId: item.variantId,
            sizeName: item.sizeName,
            wickType: item.wickType,
            scentId: item.scentId,
            scentName: item.scentName,
            alcoholType: item.alcoholType,
            productType: item.isCustom ? undefined : item.productType,
            bottleName: item.bottleName,
          })),
          discountCents: effectiveDiscountCents, // Order-level discount to distribute
          customerEmail: customerEmail || undefined,
          paymentMethod,
          notes: notes || undefined,
          decrementStock,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to record sale");
      }

      setSuccess(`Sale recorded successfully! Order ID: ${data.orderId}`);
      // Reset form
      setItems([]);
      setCustomerEmail("");
      setPaymentMethod("cash");
      setNotes("");
      setDecrementStock(true);
      setDiscountCents(0); // Reset discount
      // Reload products to get updated stock
      loadProducts();
    } catch (err) {
      setError(String(err));
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  const subtotalCents = items.reduce((sum, item) => sum + (item.unitPriceCents * item.quantity), 0);
  const effectiveDiscountCents = Math.min(discountCents, subtotalCents); // Can't discount more than subtotal
  const totalCents = subtotalCents - effectiveDiscountCents;

  if (loading) {
    return (
      <div className="a-ui flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <CandleSpinner />
        <p className="text-sm font-medium text-[var(--a-muted)]">Loading…</p>
      </div>
    );
  }

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const money = (cents: number) =>
    `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="a-ui mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader title="Manual sale" description="Record an in-person or cash sale. It counts toward analytics and, if you choose, inventory." />

      {error && (
        <div role="alert" className="mb-6 rounded-lg border border-red-200 bg-[#fdecea] p-4 text-sm text-[#7a1a12]">
          {error}
        </div>
      )}
      {success && (
        <div role="status" className="mb-6 flex items-center gap-2 rounded-lg border border-green-200 bg-[#e8f5ec] p-4 text-sm text-[#1f4d2e]">
          <Check className="h-4 w-4 shrink-0" aria-hidden />
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          {/* Items */}
          <section className="a-card p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-[var(--a-ink)]">Items</h2>
              <div className="flex gap-2">
                <button type="button" onClick={() => addItem(false)} className="a-btn a-btn-sm">
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Product
                </button>
                <button type="button" onClick={() => addItem(true)} className="a-btn a-btn-sm">
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Custom item
                </button>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--a-line-strong)] px-4 py-10 text-center">
                <p className="text-sm text-[var(--a-muted)]">No items yet. Add a product from the catalog, or a custom item.</p>
                <button type="button" onClick={() => addItem(false)} className="a-btn a-btn-primary a-btn-sm mt-3">
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Add product
                </button>
              </div>
            ) : (
              <ol className="space-y-3">
                {items.map((item, index) => {
                  const selectedProduct = products.find((p) => p.slug === item.productSlug);
                  const isHomeGoods = !item.isCustom && selectedProduct?.productType === "home_goods";
                  const hasVariants = !isHomeGoods && selectedProduct?.variantConfig?.wickTypes &&
                    selectedProduct.variantConfig.wickTypes.length > 0;
                  const hasSizes = !isHomeGoods && (selectedProduct?.variantConfig?.sizes?.length ?? 0) > 0;

                  // Get wick types - use product's wick types if available, otherwise default options
                  const wickTypes = selectedProduct?.variantConfig?.wickTypes || [
                    { id: "standard-wick", name: "Standard Wick" },
                    { id: "wood-wick", name: "Wood Wick" },
                  ];

                  // Bottle choices for Home Goods items — same eligible bottles + live
                  // stock the storefront's bottle picker shows (see HomeGoodsBottlePicker).
                  const bottleItems: ComboItem<string>[] = isHomeGoods
                    ? (selectedProduct?.bottleOptions || []).map((opt) => {
                        const bottle = bottleById.get(opt.bottleId);
                        const stock = bottle ? getBottleStock(bottle, selectedProduct?.requiresUncut) : 0;
                        return {
                          value: opt.bottleId,
                          label: bottle?.name ?? opt.bottleName,
                          sublabel: `Stock: ${stock}${bottle?.alcoholType ? ` | ${bottle.alcoholType}` : ""}`,
                          disabled: stock <= 0,
                        };
                      })
                    : [];

                  return (
                    <li key={item.id} className="rounded-xl border border-[var(--a-line)] p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[var(--a-ink)]">Item {index + 1}</span>
                          <Badge tone={item.isCustom ? "amber" : "neutral"}>{item.isCustom ? "Custom" : "Catalog"}</Badge>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="a-icon-btn a-icon-btn-danger h-8 w-8"
                          aria-label={`Remove item ${index + 1}`}
                          title="Remove item"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        {item.isCustom ? (
                          <div className="col-span-2">
                            <label htmlFor={`name-${item.id}`} className="a-label">Product name</label>
                            <input
                              id={`name-${item.id}`}
                              type="text"
                              className="a-input"
                              placeholder="What did you sell?"
                              value={item.productName}
                              onChange={(e) => updateItem(item.id, { productName: e.target.value })}
                              required
                            />
                          </div>
                        ) : (
                          <div className="col-span-2">
                            <ComboBox
                              id={`product-${item.id}`}
                              label="Product"
                              placeholder="Search products…"
                              value={item.productSlug}
                              items={productItems}
                              onChange={(val) => handleProductChange(item.id, val)}
                              emptyMessage="No products match your search."
                            />
                          </div>
                        )}

                        <div>
                          <label htmlFor={`qty-${item.id}`} className="a-label">Quantity</label>
                          <input
                            id={`qty-${item.id}`}
                            type="number"
                            className="a-input tabular-nums"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              updateItem(item.id, { quantity: parseInt(e.target.value) || 1 })
                            }
                            required
                          />
                        </div>

                        <div>
                          <label htmlFor={`price-${item.id}`} className="a-label">Price each</label>
                          <div className="relative">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--a-faint)]">$</span>
                            <input
                              id={`price-${item.id}`}
                              type="number"
                              className="a-input pl-7 tabular-nums"
                              step="0.01"
                              min="0"
                              value={(item.unitPriceCents / 100).toFixed(2)}
                              onChange={(e) =>
                                updateItem(item.id, {
                                  unitPriceCents: Math.round(parseFloat(e.target.value || "0") * 100),
                                })
                              }
                              required
                            />
                          </div>
                          {item.quantity > 1 && (
                            <p className="a-help">Line total {money(item.unitPriceCents * item.quantity)}</p>
                          )}
                        </div>
                      </div>

                      {/* Bottle Selection - Home Goods items sell a specific physical bottle */}
                      {isHomeGoods && (
                        <div className="mt-4">
                          <ComboBox
                            id={`bottle-${item.id}`}
                            label="Bottle"
                            placeholder="Search bottles…"
                            value={item.variantId || ""}
                            items={bottleItems}
                            onChange={(val) => handleBottleChange(item.id, val)}
                            emptyMessage="No bottles configured for this product — add one in Bottle Inventory first."
                            className="md:w-96"
                          />
                        </div>
                      )}

                      {/* Size Selection - only shown for products with sizes */}
                      {!item.isCustom && hasSizes && (
                        <div className="mt-4">
                          <label htmlFor={`size-${item.id}`} className="a-label">Size</label>
                          <select
                            id={`size-${item.id}`}
                            className="a-select md:w-64"
                            value={item.selectedSizeId || ""}
                            onChange={(e) => handleSizeChange(item.id, e.target.value)}
                          >
                            <option value="">Select size…</option>
                            {selectedProduct?.variantConfig?.sizes?.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} — ${(s.priceCents / 100).toFixed(2)}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Variant details */}
                      <div className={`mt-4 grid grid-cols-1 gap-4 ${isHomeGoods ? "" : "sm:grid-cols-3"}`}>
                        <div>
                          <label htmlFor={`alcohol-${item.id}`} className="a-label">
                            Alcohol type{" "}
                            {item.isCustom && <span className="font-normal text-[var(--a-muted)]">(for analytics)</span>}
                          </label>
                          <select
                            id={`alcohol-${item.id}`}
                            className="a-select"
                            value={item.alcoholType || ""}
                            onChange={(e) => updateItem(item.id, { alcoholType: e.target.value || undefined })}
                          >
                            <option value="">Select…</option>
                            {alcoholTypes
                              .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999))
                              .map((at) => (
                                <option key={at.id} value={at.name}>
                                  {at.name}
                                </option>
                              ))}
                          </select>
                        </div>

                        {!isHomeGoods && (
                          <div>
                            <label htmlFor={`wick-${item.id}`} className="a-label">
                              Wick <span className="font-normal text-[var(--a-muted)]">(optional)</span>
                            </label>
                            <select
                              id={`wick-${item.id}`}
                              className="a-select"
                              value={item.wickType || ""}
                              onChange={(e) => handleWickTypeChange(item.id, e.target.value)}
                            >
                              <option value="">Select…</option>
                              {wickTypes.map((wt) => (
                                <option key={wt.id} value={wt.id}>
                                  {wt.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {!isHomeGoods && (
                          <div>
                            <label htmlFor={`scent-${item.id}`} className="a-label">
                              Scent <span className="font-normal text-[var(--a-muted)]">(optional)</span>
                            </label>
                            <select
                              id={`scent-${item.id}`}
                              className="a-select"
                              value={item.scentId || ""}
                              onChange={(e) => handleScentChange(item.id, e.target.value, item.wickType)}
                            >
                              <option value="">Select…</option>
                              {scents
                                .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999))
                                .map((scent) => (
                                  <option key={scent.id} value={scent.id}>
                                    {scent.name} {scent.limited ? "(Limited)" : ""}
                                  </option>
                                ))}
                            </select>
                          </div>
                        )}
                      </div>

                      {!item.isCustom && hasVariants && item.variantId && (
                        <p className="a-help">
                          {selectedProduct?.variantConfig?.variantData?.[item.variantId]?.stock ?? 0} of this variant in stock
                        </p>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {/* Payment */}
          <section className="a-card p-5 sm:p-6">
            <h2 className="mb-4 text-base font-semibold text-[var(--a-ink)]">Payment</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="payment-method" className="a-label">Method</label>
                <select
                  id="payment-method"
                  className="a-select"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as "cash" | "card" | "other")}
                  required
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card (not Stripe)</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label htmlFor="customer-email" className="a-label">
                  Customer email <span className="font-normal text-[var(--a-muted)]">(optional)</span>
                </label>
                <input
                  id="customer-email"
                  type="email"
                  className="a-input"
                  placeholder="customer@example.com"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="sale-notes" className="a-label">
                Notes <span className="font-normal text-[var(--a-muted)]">(optional)</span>
              </label>
              <textarea
                id="sale-notes"
                className="a-textarea"
                rows={3}
                placeholder="Market name, trade details, anything worth remembering"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </section>
        </div>

        {/* Summary */}
        <aside className="a-card p-5 lg:sticky lg:top-20">
          <h2 className="mb-4 text-base font-semibold text-[var(--a-ink)]">Summary</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--a-muted)]">
                Subtotal · {itemCount} {itemCount === 1 ? "item" : "items"}
              </dt>
              <dd className="tabular-nums">{money(subtotalCents)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt>
                <label htmlFor="discount" className="text-[var(--a-muted)]">Discount</label>
              </dt>
              <dd className="relative w-28">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--a-faint)]">−$</span>
                <input
                  id="discount"
                  type="number"
                  className="a-input h-9 pl-8 text-right tabular-nums"
                  step="0.01"
                  min="0"
                  max={(subtotalCents / 100).toFixed(2)}
                  value={discountCents > 0 ? (discountCents / 100).toFixed(2) : ""}
                  placeholder="0.00"
                  onChange={(e) => {
                    const value = parseFloat(e.target.value || "0");
                    setDiscountCents(Math.round(value * 100));
                  }}
                />
              </dd>
            </div>
            {discountCents > subtotalCents && (
              <p className="text-xs text-[#8a5a06]">Discount capped at the subtotal ({money(subtotalCents)}).</p>
            )}
            <div className="flex items-baseline justify-between border-t border-[var(--a-line)] pt-3">
              <dt className="font-semibold">Total</dt>
              <dd className="text-2xl font-semibold tracking-tight tabular-nums">{money(totalCents)}</dd>
            </div>
            {effectiveDiscountCents > 0 && (
              <p className="text-right text-xs text-[#1f6b3a]">Customer saves {money(effectiveDiscountCents)}</p>
            )}
          </dl>

          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--a-line)] p-3 text-sm transition-colors hover:border-[var(--a-line-strong)]">
            <input
              type="checkbox"
              className="a-check mt-0.5"
              checked={decrementStock}
              onChange={(e) => setDecrementStock(e.target.checked)}
            />
            <span>
              <span className="font-medium text-[var(--a-ink)]">Take from stock</span>
              <span className="mt-0.5 block text-xs text-[var(--a-muted)]">
                Leave unchecked for made-to-order or custom pieces that weren&apos;t in inventory.
              </span>
            </span>
          </label>

          <button
            type="submit"
            disabled={submitting || items.length === 0}
            className="a-btn a-btn-primary mt-4 h-11 w-full text-[15px]"
          >
            {submitting ? "Recording…" : `Record sale · ${money(totalCents)}`}
          </button>
        </aside>
      </form>
    </div>
  );
}
