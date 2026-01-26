"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, DollarSign, Search } from "lucide-react";

type Product = {
  slug: string;
  name: string;
  price: number;
  stock: number;
  sku: string;
  variantConfig?: {
    wickTypes: Array<{ id: string; name: string }>;
    variantData: Record<string, { stock: number }>;
  };
};

type GlobalScent = {
  id: string;
  name: string;
  limited?: boolean;
  enabledProducts?: string[];
  sortOrder?: number;
};

type SaleItem = {
  id: string;
  isCustom: boolean; // true for custom products not in the database
  productSlug: string;
  productName: string;
  quantity: number;
  priceCents: number;
  variantId?: string;
  sizeName?: string;
  wickType?: string; // wick type ID for scent tracking
  scentId?: string; // scent ID for analytics
  scentName?: string; // scent name for display
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
      <label htmlFor={id} className="block text-sm font-medium mb-1">
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
              {filtered.length === 0 ? (
                <div className="px-4 py-3 text-sm text-[var(--color-muted)]">
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
      const [productsRes, scentsRes] = await Promise.all([
        fetch("/api/admin/products"),
        fetch("/api/admin/scents"),
      ]);

      if (!productsRes.ok) throw new Error("Failed to load products");
      if (!scentsRes.ok) throw new Error("Failed to load scents");

      const productsData = await productsRes.json();
      const scentsData = await scentsRes.json();

      setProducts(productsData.items || []);
      setScents(scentsData.scents || []);
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
      priceCents: 0,
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
        priceCents: Math.round(product.price * 100),
        variantId: undefined, // Reset variant when product changes
        wickType: undefined, // Reset wick type
        scentId: undefined, // Reset scent
        scentName: undefined,
      });
    }
  }

  function handleScentChange(itemId: string, scentId: string, wickType?: string) {
    const scent = scents.find((s) => s.id === scentId);
    const item = items.find((i) => i.id === itemId);

    if (scent && item) {
      // Build variant ID if we have a wick type
      const effectiveWickType = wickType || item.wickType || "standard-wick";
      const variantId = `${effectiveWickType}-${scentId}`;

      updateItem(itemId, {
        scentId,
        scentName: scent.name,
        wickType: effectiveWickType,
        variantId: item.isCustom ? undefined : variantId, // Only set variantId for non-custom products
      });
    } else if (!scentId) {
      // Clear scent selection
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
      // Update variant ID if we have a scent selected
      const variantId = item.scentId ? `${wickType}-${item.scentId}` : undefined;
      updateItem(itemId, {
        wickType,
        variantId: item.isCustom ? undefined : variantId,
      });
    }
  }

  // Helper function to calculate total stock for a product (base + all variants)
  function calculateTotalStock(product: Product): number {
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
        label: "Select product...",
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
  }, [products]);

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
            priceCents: item.priceCents,
            variantId: item.variantId,
            sizeName: item.sizeName,
            wickType: item.wickType,
            scentId: item.scentId,
            scentName: item.scentName,
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

  const subtotalCents = items.reduce((sum, item) => sum + item.priceCents, 0);
  const effectiveDiscountCents = Math.min(discountCents, subtotalCents); // Can't discount more than subtotal
  const totalCents = subtotalCents - effectiveDiscountCents;

  if (loading) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-[var(--color-muted)]">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 bg-neutral-50">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)] mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Admin
          </Link>
          <h1 className="text-3xl font-bold">Record Manual Sale</h1>
          <p className="text-[var(--color-muted)] mt-1">
            Add in-person or cash sales to analytics and inventory
          </p>
        </div>

        {/* Messages */}
        {error && (
          <div className="card p-4 bg-rose-50 border border-rose-200 mb-6">
            <p className="text-rose-600 text-sm">{error}</p>
          </div>
        )}
        {success && (
          <div className="card p-4 bg-green-50 border border-green-200 mb-6">
            <p className="text-green-600 text-sm">{success}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Items */}
          <div className="card p-6 bg-white">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Sale Items</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => addItem(false)}
                  className="btn bg-[var(--color-ink)] text-white hover:bg-opacity-90"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Product
                </button>
                <button
                  type="button"
                  onClick={() => addItem(true)}
                  className="btn bg-amber-600 text-white hover:bg-amber-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Custom
                </button>
              </div>
            </div>

            {items.length === 0 ? (
              <p className="text-[var(--color-muted)] text-center py-8">
                No items added yet. Click &quot;Add Item&quot; to start.
              </p>
            ) : (
              <div className="space-y-4">
                {items.map((item) => {
                  const selectedProduct = products.find((p) => p.slug === item.productSlug);
                  const hasVariants = selectedProduct?.variantConfig?.wickTypes &&
                    selectedProduct.variantConfig.wickTypes.length > 0;

                  // Get wick types - use product's wick types if available, otherwise default options
                  const wickTypes = selectedProduct?.variantConfig?.wickTypes || [
                    { id: "standard-wick", name: "Standard Wick" },
                    { id: "wood-wick", name: "Wood Wick" },
                  ];

                  return (
                    <div key={item.id} className="border border-[var(--color-line)] rounded-lg p-4 mb-4">
                      {/* Item Type Badge */}
                      <div className="flex items-center justify-between mb-3">
                        <span className={`text-xs font-semibold px-2 py-1 rounded ${
                          item.isCustom
                            ? "bg-amber-100 text-amber-700"
                            : "bg-blue-100 text-blue-700"
                        }`}>
                          {item.isCustom ? "Custom Product" : "Catalog Product"}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="btn bg-rose-600 text-white hover:bg-rose-700 py-1 px-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Product Selection or Custom Name */}
                        {item.isCustom ? (
                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium mb-1">Product Name *</label>
                            <input
                              type="text"
                              className="input w-full"
                              placeholder="Enter custom product name..."
                              value={item.productName}
                              onChange={(e) => updateItem(item.id, { productName: e.target.value })}
                              required
                            />
                          </div>
                        ) : (
                          <div className="md:col-span-2">
                            <ComboBox
                              id={`product-${item.id}`}
                              label="Product"
                              placeholder="Search products..."
                              value={item.productSlug}
                              items={productItems}
                              onChange={(val) => handleProductChange(item.id, val)}
                              emptyMessage="No products match your search."
                            />
                          </div>
                        )}

                        {/* Quantity */}
                        <div>
                          <label className="block text-sm font-medium mb-1">Quantity</label>
                          <input
                            type="number"
                            className="input w-full"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              updateItem(item.id, { quantity: parseInt(e.target.value) || 1 })
                            }
                            required
                          />
                        </div>

                        {/* Price */}
                        <div>
                          <label className="block text-sm font-medium mb-1">Price ($)</label>
                          <input
                            type="number"
                            className="input w-full"
                            step="0.01"
                            min="0"
                            value={(item.priceCents / 100).toFixed(2)}
                            onChange={(e) =>
                              updateItem(item.id, {
                                priceCents: Math.round(parseFloat(e.target.value || "0") * 100),
                              })
                            }
                            required
                          />
                        </div>
                      </div>

                      {/* Scent and Wick Selection - shown for all items */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-[var(--color-line)]">
                        {/* Wick Type */}
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Wick Type <span className="text-[var(--color-muted)]">(optional)</span>
                          </label>
                          <select
                            className="input w-full"
                            value={item.wickType || ""}
                            onChange={(e) => handleWickTypeChange(item.id, e.target.value)}
                          >
                            <option value="">Select wick type...</option>
                            {wickTypes.map((wt) => (
                              <option key={wt.id} value={wt.id}>
                                {wt.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Scent */}
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Scent <span className="text-[var(--color-muted)]">(optional)</span>
                          </label>
                          <select
                            className="input w-full"
                            value={item.scentId || ""}
                            onChange={(e) => handleScentChange(item.id, e.target.value, item.wickType)}
                          >
                            <option value="">Select scent...</option>
                            {scents
                              .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999))
                              .map((scent) => (
                                <option key={scent.id} value={scent.id}>
                                  {scent.name} {scent.limited ? "(Limited)" : ""}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>

                      {/* Stock info for non-custom products with variants */}
                      {!item.isCustom && hasVariants && item.variantId && (
                        <div className="mt-3 text-sm text-[var(--color-muted)]">
                          Variant Stock: {
                            selectedProduct?.variantConfig?.variantData?.[item.variantId]?.stock ?? 0
                          }
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Order Summary with Discount */}
            {items.length > 0 && (
              <div className="mt-6 pt-4 border-t border-[var(--color-line)]">
                {/* Subtotal */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-[var(--color-muted)]">Subtotal:</span>
                  <span className="text-sm">
                    ${(subtotalCents / 100).toFixed(2)}
                  </span>
                </div>

                {/* Discount Input */}
                <div className="flex items-center justify-between mb-3 gap-4">
                  <label htmlFor="discount" className="text-sm font-medium">
                    Discount:
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[var(--color-muted)]">-$</span>
                    <input
                      id="discount"
                      type="number"
                      className="input w-24 text-right"
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
                  </div>
                </div>

                {/* Show discount warning if exceeds subtotal */}
                {discountCents > subtotalCents && (
                  <div className="text-xs text-amber-600 mb-2">
                    Discount capped at subtotal (${(subtotalCents / 100).toFixed(2)})
                  </div>
                )}

                {/* Total */}
                <div className="flex items-center justify-between pt-3 border-t border-[var(--color-line)]">
                  <span className="text-lg font-bold">Total:</span>
                  <span className="text-2xl font-bold text-green-600">
                    ${(totalCents / 100).toFixed(2)}
                  </span>
                </div>

                {/* Show savings if discount applied */}
                {effectiveDiscountCents > 0 && (
                  <div className="text-xs text-green-600 text-right mt-1">
                    Customer saves ${(effectiveDiscountCents / 100).toFixed(2)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Payment Details */}
          <div className="card p-6 bg-white">
            <h2 className="text-xl font-bold mb-4">Payment Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Payment Method</label>
                <select
                  className="input w-full"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as "cash" | "card" | "other")}
                  required
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card (Non-Stripe)</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Customer Email <span className="text-[var(--color-muted)]">(optional)</span>
                </label>
                <input
                  type="email"
                  className="input w-full"
                  placeholder="customer@example.com"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium mb-1">
                Notes <span className="text-[var(--color-muted)]">(optional)</span>
              </label>
              <textarea
                className="textarea w-full"
                rows={3}
                placeholder="Add any notes about this sale..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="mt-4">
              <label className="flex items-start gap-3 cursor-pointer group p-3 border border-[var(--color-line)] rounded-lg hover:border-[var(--color-accent)] transition">
                <div className="relative flex items-center justify-center mt-0.5">
                  <input
                    type="checkbox"
                    checked={decrementStock}
                    onChange={(e) => setDecrementStock(e.target.checked)}
                    className="peer absolute opacity-0 w-5 h-5 cursor-pointer"
                  />
                  <div className="w-5 h-5 rounded border-2 border-[var(--color-line)] group-hover:border-[var(--color-accent)] transition-colors peer-checked:bg-[var(--color-accent)] peer-checked:border-[var(--color-accent)] flex items-center justify-center pointer-events-none">
                    {decrementStock && (
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
                <div className="flex-1">
                  <div className="text-sm font-medium">Decrement Stock</div>
                  <p className="text-xs text-[var(--color-muted)] mt-1">
                    Uncheck this if the sale was made-to-order or custom (not from existing inventory).
                    Check this if you sold from your current stock.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={submitting || items.length === 0}
              className="btn bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex-1"
            >
              <DollarSign className="w-4 h-4 mr-2" />
              {submitting ? "Recording Sale..." : `Record Sale - $${(totalCents / 100).toFixed(2)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
