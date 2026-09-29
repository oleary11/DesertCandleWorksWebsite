"use client";

import { useState, useEffect } from "react";
import { Truck, Check, AlertCircle } from "lucide-react";
import CandleSpinner from "@/components/CandleSpinner";

type Product = {
  sku: string;
  name: string;
  imageUrl?: string;
  weight?: {
    value: number;
    units: "ounces" | "pounds";
  };
  variantConfig?: {
    sizes?: Array<{ id: string; name: string; stripePriceId?: string }>;
    wickTypes?: Array<{ id: string; name: string }>;
    variantData: Record<string, {
      wickType?: string;
      scent?: string;
      stock?: number;
    }>;
  };
};

type GlobalScent = {
  id: string;
  name: string;
};

type TestProduct = {
  sku: string;
  quantity: number;
  unitPrice: number;
  sizeName?: string;
  variantId?: string;
  wickType?: string;
  scent?: string;
};

type ShippingRate = {
  serviceName: string;
  serviceCode: string;
  carrierCode: string;
  shipmentCost: number;
  otherCost: number;
  deliveryDays?: number | null;
};

export default function TestShipStationPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [globalScents, setGlobalScents] = useState<GlobalScent[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  // Form state
  const [shippingAddress, setShippingAddress] = useState({
    name: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "US",
    phone: "",
  });
  const [customerEmail, setCustomerEmail] = useState("test@example.com");
  const [testProducts, setTestProducts] = useState<TestProduct[]>([
    { sku: "", quantity: 1, unitPrice: 25.00 },
  ]);

  // Shipping rate selection state
  const [shippingRates, setShippingRates] = useState<ShippingRate[]>([]);
  const [selectedRate, setSelectedRate] = useState<ShippingRate | null>(null);
  const [loadingRates, setLoadingRates] = useState(false);
  const [ratesError, setRatesError] = useState<string | null>(null);

  // Load products and scents on mount
  useEffect(() => {
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
        setGlobalScents(scentsData.scents || []);
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleAddProduct = () => {
    setTestProducts([...testProducts, { sku: "", quantity: 1, unitPrice: 25.00 }]);
  };

  const handleRemoveProduct = (index: number) => {
    setTestProducts(testProducts.filter((_, i) => i !== index));
  };

  const handleProductChange = (index: number, field: keyof TestProduct, value: string | number) => {
    const updated = [...testProducts];
    updated[index] = { ...updated[index], [field]: value };
    setTestProducts(updated);
  };

  const handleGetRates = async () => {
    setLoadingRates(true);
    setRatesError(null);
    setShippingRates([]);
    setSelectedRate(null);

    try {
      // Validate required fields
      if (!shippingAddress.name || !shippingAddress.line1 || !shippingAddress.city || !shippingAddress.state || !shippingAddress.postalCode) {
        throw new Error("Please fill in all required shipping address fields");
      }

      if (testProducts.length === 0 || !testProducts[0].sku) {
        throw new Error("Please select at least one product");
      }

      // Get rates from ShipStation
      const res = await fetch("/api/admin/get-shipping-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shippingAddress,
          products: testProducts,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch shipping rates");
      }

      if (!data.rates || data.rates.length === 0) {
        throw new Error("No shipping rates available for this address");
      }

      setShippingRates(data.rates);
    } catch (error) {
      console.error("Error fetching rates:", error);
      setRatesError(error instanceof Error ? error.message : "Failed to fetch shipping rates");
    } finally {
      setLoadingRates(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);

    try {
      // Validate required fields
      if (!shippingAddress.name || !shippingAddress.line1 || !shippingAddress.city || !shippingAddress.state || !shippingAddress.postalCode) {
        throw new Error("Please fill in all required shipping address fields");
      }

      if (testProducts.length === 0 || !testProducts[0].sku) {
        throw new Error("Please select at least one product");
      }

      if (!selectedRate) {
        throw new Error("Please select a shipping rate");
      }

      const res = await fetch("/api/admin/test-shipstation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shippingAddress,
          customerEmail,
          customerPhone: shippingAddress.phone,
          products: testProducts,
          requestedShippingService: selectedRate.serviceName, // Send the service name for ShipStation
          shippingAmount: selectedRate.shipmentCost + selectedRate.otherCost, // Include actual shipping cost
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create test order");
      }

      setResult({
        success: true,
        message: data.message || "Test order created successfully",
      });

      // Reset form after success
      setTestProducts([{ sku: "", quantity: 1, unitPrice: 25.00 }]);
      setShippingAddress({
        name: "",
        line1: "",
        line2: "",
        city: "",
        state: "",
        postalCode: "",
        country: "US",
        phone: "",
      });
      setShippingRates([]);
      setSelectedRate(null);
    } catch (error) {
      console.error("Error creating test order:", error);
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "Failed to create test order",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="a-ui flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <CandleSpinner />
          <p className="text-sm font-medium text-[var(--a-ink)]">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="a-ui mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div>
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="a-icon-tile">
              <Truck className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--a-ink)] sm:text-[2.125rem]">Test ShipStation Order Creation</h1>
          </div>
          <p className="mt-1.5 text-[15px] text-[var(--a-muted)]">
            Create a test order in ShipStation to verify API integration. Orders will be marked with &quot;TEST ORDER&quot; in internal notes.
          </p>
        </div>

        {/* Result Message */}
        {result && (
          <div
            className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
              result.success
                ? "bg-green-50 border border-green-200"
                : "bg-rose-50 border border-rose-200"
            }`}
          >
            {result.success ? (
              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <p
                className={`font-medium ${
                  result.success ? "text-green-900" : "text-rose-900"
                }`}
              >
                {result.success ? "Success!" : "Error"}
              </p>
              <p
                className={`text-sm ${
                  result.success ? "text-green-700" : "text-rose-700"
                }`}
              >
                {result.message}
              </p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Shipping Address */}
          <div className="a-card p-5">
            <h2 className="mb-3 text-base font-semibold text-[var(--a-ink)]">Shipping Address</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="a-label">
                  Name <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  className="a-input"
                  value={shippingAddress.name}
                  onChange={(e) =>
                    setShippingAddress({ ...shippingAddress, name: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <label className="a-label">Phone</label>
                <input
                  type="tel"
                  className="a-input"
                  value={shippingAddress.phone}
                  onChange={(e) =>
                    setShippingAddress({ ...shippingAddress, phone: e.target.value })
                  }
                />
              </div>
              <div className="md:col-span-2">
                <label className="a-label">
                  Street Address <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  className="a-input"
                  value={shippingAddress.line1}
                  onChange={(e) =>
                    setShippingAddress({ ...shippingAddress, line1: e.target.value })
                  }
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="a-label">
                  Apartment, Suite, etc.
                </label>
                <input
                  type="text"
                  className="a-input"
                  value={shippingAddress.line2}
                  onChange={(e) =>
                    setShippingAddress({ ...shippingAddress, line2: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="a-label">
                  City <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  className="a-input"
                  value={shippingAddress.city}
                  onChange={(e) =>
                    setShippingAddress({ ...shippingAddress, city: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <label className="a-label">
                  State <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  className="a-input"
                  value={shippingAddress.state}
                  onChange={(e) =>
                    setShippingAddress({ ...shippingAddress, state: e.target.value })
                  }
                  placeholder="AZ"
                  maxLength={2}
                  required
                />
              </div>
              <div>
                <label className="a-label">
                  ZIP Code <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  className="a-input"
                  value={shippingAddress.postalCode}
                  onChange={(e) =>
                    setShippingAddress({
                      ...shippingAddress,
                      postalCode: e.target.value,
                    })
                  }
                  required
                />
              </div>
              <div>
                <label className="a-label">Country</label>
                <input
                  type="text"
                  className="a-input"
                  value={shippingAddress.country}
                  onChange={(e) =>
                    setShippingAddress({ ...shippingAddress, country: e.target.value })
                  }
                  disabled
                />
              </div>
            </div>
          </div>

          {/* Customer Info */}
          <div className="a-card p-5">
            <h2 className="mb-3 text-base font-semibold text-[var(--a-ink)]">Customer Information</h2>
            <div>
              <label className="a-label">Email</label>
              <input
                type="email"
                className="a-input"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Products */}
          <div className="a-card p-5">
            <h2 className="mb-3 text-base font-semibold text-[var(--a-ink)]">Products</h2>
            <div className="space-y-4">
              {testProducts.map((product, index) => {
                const selectedProduct = products.find(p => p.sku === product.sku);
                const hasVariants = selectedProduct?.variantConfig &&
                  Object.keys(selectedProduct.variantConfig.variantData).length > 0;

                return (
                  <div key={index} className="border border-[var(--a-line)] rounded-lg p-4 space-y-3">
                    <div className="flex gap-4 items-end">
                      <div className="flex-1">
                        <label className="a-label">
                          Product <span className="text-rose-600">*</span>
                        </label>
                        <select
                          className="a-select"
                          value={product.sku}
                          onChange={(e) => {
                            const updated = [...testProducts];
                            updated[index] = {
                              ...updated[index],
                              sku: e.target.value,
                              variantId: "",
                              wickType: "",
                              scent: "",
                            };
                            setTestProducts(updated);
                          }}
                          required
                        >
                          <option value="">Select a product</option>
                          {products.map((p) => (
                            <option key={p.sku} value={p.sku}>
                              {p.name} ({p.sku})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="w-24">
                        <label className="a-label">Quantity</label>
                        <input
                          type="number"
                          min="1"
                          className="a-input"
                          value={product.quantity}
                          onChange={(e) =>
                            handleProductChange(index, "quantity", parseInt(e.target.value))
                          }
                        />
                      </div>
                      <div className="w-32">
                        <label className="a-label">Unit Price</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="a-input"
                          value={product.unitPrice}
                          onChange={(e) =>
                            handleProductChange(index, "unitPrice", parseFloat(e.target.value))
                          }
                        />
                      </div>
                      {testProducts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveProduct(index)}
                          className="a-btn btn-ghost text-rose-600 px-3"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    {/* Variant Selection */}
                    {hasVariants && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-[var(--a-line)]">
                        <div>
                          <label className="a-label">
                            Variant <span className="text-xs text-[var(--a-muted)]">(optional)</span>
                          </label>
                          <select
                            className="a-select"
                            value={product.variantId || ""}
                            onChange={(e) => {
                              const variantId = e.target.value;
                              const updated = [...testProducts];

                              // Parse variantId to extract size, wick type, and scent
                              if (variantId) {
                                // Known wick type IDs: "standard-wick", "wood-wick", etc.
                                const knownWickTypes = ['standard-wick', 'wood-wick', 'wood', 'standard'];

                                let sizeName = "";
                                let wickTypeName = "";
                                let scentName = "";

                                // Try to match known wick types
                                for (const wickTypeId of knownWickTypes) {
                                  if (variantId.includes(wickTypeId)) {
                                    // Check if there's a size prefix
                                    const wickIndex = variantId.indexOf(wickTypeId);
                                    if (wickIndex > 0) {
                                      // Extract size ID (everything before wick type)
                                      const sizeId = variantId.substring(0, wickIndex - 1); // -1 to remove hyphen
                                      const size = selectedProduct?.variantConfig?.sizes?.find(s => s.id === sizeId);
                                      sizeName = size?.name || "";
                                    }

                                    // Look up wick type name
                                    const wickType = selectedProduct?.variantConfig?.wickTypes?.find(w => w.id === wickTypeId);
                                    wickTypeName = wickType?.name || "";

                                    // Extract scent ID after the wick type
                                    const afterWick = variantId.substring(wickIndex + wickTypeId.length);
                                    const scentId = afterWick.startsWith('-') ? afterWick.substring(1) : afterWick;

                                    // Look up scent name
                                    const scent = globalScents.find(s => s.id === scentId);
                                    scentName = scent?.name || "";

                                    break;
                                  }
                                }

                                updated[index] = {
                                  ...updated[index],
                                  variantId,
                                  sizeName,
                                  wickType: wickTypeName,
                                  scent: scentName,
                                };
                              } else {
                                updated[index] = {
                                  ...updated[index],
                                  variantId: "",
                                  sizeName: "",
                                  wickType: "",
                                  scent: "",
                                };
                              }

                              setTestProducts(updated);
                            }}
                          >
                            <option value="">Select variant</option>
                            {selectedProduct?.variantConfig?.wickTypes &&
                              (() => {
                                // Generate all combinations: [size × ] wick × scent
                                const sizes = selectedProduct.variantConfig.sizes || [];
                                const wickTypes = selectedProduct.variantConfig.wickTypes;
                                const hasSizes = sizes.length > 0;

                                if (hasSizes) {
                                  // With sizes: size-wickType-scent
                                  return sizes.flatMap(size =>
                                    wickTypes.flatMap(wickType =>
                                      globalScents.map(scent => {
                                        const variantId = `${size.id}-${wickType.id}-${scent.id}`;
                                        return (
                                          <option key={variantId} value={variantId}>
                                            {size.name} - {wickType.name} - {scent.name}
                                          </option>
                                        );
                                      })
                                    )
                                  );
                                } else {
                                  // Without sizes: wickType-scent
                                  return wickTypes.flatMap(wickType =>
                                    globalScents.map(scent => {
                                      const variantId = `${wickType.id}-${scent.id}`;
                                      return (
                                        <option key={variantId} value={variantId}>
                                          {wickType.name} - {scent.name}
                                        </option>
                                      );
                                    })
                                  );
                                }
                              })()
                            }
                          </select>
                        </div>
                        <div className="flex flex-wrap gap-2 text-sm text-[var(--a-muted)]">
                          {product.sizeName && (
                            <span className="a-badge bg-green-100 text-green-700">
                              Size: {product.sizeName}
                            </span>
                          )}
                          {product.wickType && (
                            <span className="a-badge a-badge-blue">
                              Wick: {product.wickType}
                            </span>
                          )}
                          {product.scent && (
                            <span className="a-badge bg-purple-100 text-purple-700">
                              Scent: {product.scent}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                onClick={handleAddProduct}
                className="a-btn btn-ghost text-sm"
              >
                + Add Another Product
              </button>
            </div>
          </div>

          {/* Shipping Rates */}
          <div className="a-card p-5">
            <h2 className="mb-3 text-base font-semibold text-[var(--a-ink)]">Shipping Method</h2>

            <button
              type="button"
              onClick={handleGetRates}
              disabled={loadingRates || !shippingAddress.name || testProducts.length === 0 || !testProducts[0].sku}
              className="a-btn a-btn-primary mb-4"
            >
              {loadingRates ? "Validating & Getting Rates..." : "Get Shipping Rates"}
            </button>

            {ratesError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{ratesError}</span>
              </div>
            )}

            {shippingRates.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-[var(--a-muted)] mb-3">
                  Select a shipping method:
                </p>
                {shippingRates.map((rate, index) => (
                  <label
                    key={index}
                    className={`block p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedRate === rate
                        ? "border-[var(--a-ink)] bg-[var(--a-tint)]"
                        : "border-[var(--a-line)] hover:border-[var(--a-line-strong)]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="shippingRate"
                        checked={selectedRate === rate}
                        onChange={() => setSelectedRate(rate)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{rate.serviceName}</p>
                            <p className="text-sm text-[var(--a-muted)]">
                              {rate.carrierCode} - {rate.serviceCode}
                            </p>
                          </div>
                          <p className="font-semibold">
                            ${(rate.shipmentCost + rate.otherCost).toFixed(2)}
                          </p>
                        </div>
                        {rate.deliveryDays && (
                          <p className="text-sm text-[var(--a-muted)] mt-1">
                            {rate.deliveryDays} business day{rate.deliveryDays !== 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3">
            <button type="submit" className="a-btn" disabled={submitting || !selectedRate}>
              {submitting ? "Creating Order..." : "Create Test Order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
