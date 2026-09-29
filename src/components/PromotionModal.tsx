"use client";

import { useState, useEffect } from "react";
import { Search, Users, Package } from "lucide-react";
import { Modal } from "@/app/admin/_components/ui";
import { Promotion, PromotionType, PromotionTrigger, UserTargeting } from "@/lib/promotions";

type Product = {
  slug: string;
  name: string;
};

type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

type PromotionModalProps = {
  promotion?: Promotion;
  onClose: () => void;
  onSuccess: () => void;
};

export default function PromotionModal({ promotion, onClose, onSuccess }: PromotionModalProps) {
  const isEditing = !!promotion;

  // Form state
  const [formData, setFormData] = useState({
    code: promotion?.code || "",
    name: promotion?.name || "",
    description: promotion?.description || "",
    trigger: (promotion?.trigger || "code_required") as PromotionTrigger,
    type: (promotion?.type || "percentage") as PromotionType,
    discountPercent: (promotion?.type === "bogo" ? "" : promotion?.discountPercent?.toString()) || "",
    bogoDiscountType: (promotion?.type === "bogo" && promotion?.discountPercent && promotion.discountPercent < 100) ? "percent" : "free" as "free" | "percent",
    bogoDiscountPercent: (promotion?.type === "bogo" && promotion?.discountPercent && promotion.discountPercent < 100) ? promotion.discountPercent.toString() : "",
    discountAmountCents: promotion?.discountAmountCents
      ? (promotion.discountAmountCents / 100).toString()
      : "",
    minQuantity: promotion?.minQuantity?.toString() || "",
    applyToQuantity: promotion?.applyToQuantity?.toString() || "",
    minOrderAmountCents: promotion?.minOrderAmountCents
      ? (promotion.minOrderAmountCents / 100).toString()
      : "",
    maxRedemptions: promotion?.maxRedemptions?.toString() || "",
    maxRedemptionsPerCustomer: promotion?.maxRedemptionsPerCustomer?.toString() || "",
    userTargeting: (promotion?.userTargeting || "all") as UserTargeting,
    minOrderCount: promotion?.minOrderCount?.toString() || "",
    minLifetimeSpendCents: promotion?.minLifetimeSpendCents
      ? (promotion.minLifetimeSpendCents / 100).toString()
      : "",
    startsAt: promotion?.startsAt?.split("T")[0] || "",
    expiresAt: promotion?.expiresAt?.split("T")[0] || "",
    active: promotion?.active !== false,
  });

  const [selectedProducts, setSelectedProducts] = useState<string[]>(
    promotion?.applicableProductSlugs || []
  );
  const [selectedUsers, setSelectedUsers] = useState<string[]>(promotion?.targetUserIds || []);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Load products for product selection
  useEffect(() => {
    loadProducts();
    loadUsers();
  }, []);

  async function loadProducts() {
    try {
      const res = await fetch("/api/admin/products");
      if (!res.ok) return;
      const data = await res.json();
      setProducts(data.items || []);
    } catch (err) {
      console.error("Failed to load products:", err);
    }
  }

  async function loadUsers() {
    try {
      const res = await fetch("/api/admin/customers");
      if (!res.ok) return;
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error("Failed to load users:", err);
    }
  }

  function handleChange(field: string, value: string | boolean) {
    setFormData({ ...formData, [field]: value });
  }

  function toggleProduct(slug: string) {
    setSelectedProducts((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  }

  function toggleUser(userId: string) {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  function selectAllUsers() {
    setSelectedUsers(users.map((u) => u.id));
  }

  function clearAllUsers() {
    setSelectedUsers([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Validation
      if (!formData.code || !formData.name || !formData.type) {
        setError("Code, name, and type are required");
        setLoading(false);
        return;
      }

      if (formData.type === "percentage" && !formData.discountPercent) {
        setError("Discount percentage is required");
        setLoading(false);
        return;
      }

      if (formData.type === "fixed_amount" && !formData.discountAmountCents) {
        setError("Discount amount is required");
        setLoading(false);
        return;
      }

      if (formData.type === "bogo") {
        if (!formData.minQuantity || !formData.applyToQuantity) {
          setError("Buy quantity and get quantity are required for BOGO");
          setLoading(false);
          return;
        }
        if (formData.bogoDiscountType === "percent" && !formData.bogoDiscountPercent) {
          setError("Discount percentage is required");
          setLoading(false);
          return;
        }
      }

      if (formData.userTargeting === "specific_users" && selectedUsers.length === 0) {
        setError("Please select at least one user");
        setLoading(false);
        return;
      }

      if (formData.userTargeting === "order_count" && !formData.minOrderCount) {
        setError("Minimum order count is required");
        setLoading(false);
        return;
      }

      if (formData.userTargeting === "lifetime_spend" && !formData.minLifetimeSpendCents) {
        setError("Minimum lifetime spend is required");
        setLoading(false);
        return;
      }

      // Build request body
      const body: Record<string, unknown> = {
        code: formData.code.toUpperCase(),
        name: formData.name,
        description: formData.description || undefined,
        trigger: formData.trigger,
        type: formData.type,
        active: formData.active,
        userTargeting: formData.userTargeting,
      };

      if (formData.type === "bogo") {
        body.discountPercent = formData.bogoDiscountType === "percent"
          ? parseFloat(formData.bogoDiscountPercent)
          : 100; // 100 = free
      } else if (formData.discountPercent) {
        body.discountPercent = parseFloat(formData.discountPercent);
      }

      if (formData.discountAmountCents) {
        body.discountAmountCents = Math.round(parseFloat(formData.discountAmountCents) * 100);
      }

      if (formData.minQuantity) {
        body.minQuantity = parseInt(formData.minQuantity);
      }

      if (formData.applyToQuantity) {
        body.applyToQuantity = parseInt(formData.applyToQuantity);
      }

      if (formData.minOrderAmountCents) {
        body.minOrderAmountCents = Math.round(parseFloat(formData.minOrderAmountCents) * 100);
      }

      if (formData.maxRedemptions) {
        body.maxRedemptions = parseInt(formData.maxRedemptions);
      }

      if (formData.maxRedemptionsPerCustomer) {
        body.maxRedemptionsPerCustomer = parseInt(formData.maxRedemptionsPerCustomer);
      }

      if (selectedProducts.length > 0) {
        body.applicableProductSlugs = selectedProducts;
      }

      if (formData.userTargeting === "specific_users") {
        body.targetUserIds = selectedUsers;
      }

      if (formData.userTargeting === "order_count" && formData.minOrderCount) {
        body.minOrderCount = parseInt(formData.minOrderCount);
      }

      if (formData.userTargeting === "lifetime_spend" && formData.minLifetimeSpendCents) {
        body.minLifetimeSpendCents = Math.round(
          parseFloat(formData.minLifetimeSpendCents) * 100
        );
      }

      if (formData.startsAt) {
        body.startsAt = new Date(formData.startsAt).toISOString();
      }

      if (formData.expiresAt) {
        body.expiresAt = new Date(formData.expiresAt).toISOString();
      }

      if (isEditing) {
        body.id = promotion.id;
      }

      const res = await fetch("/api/admin/promotions", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to save promotion");
        setLoading(false);
        return;
      }

      onSuccess();
    } catch (err) {
      console.error("Promotion save error:", err);
      setError("Failed to save promotion");
      setLoading(false);
    }
  }

  const filteredUsers = users.filter(
    (user) =>
      user.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      user.firstName.toLowerCase().includes(userSearch.toLowerCase()) ||
      user.lastName.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <Modal
      size="lg"
      title={isEditing ? "Edit promotion" : "New promotion"}
      description={isEditing ? "Update the code, discount and who can use it." : "A discount code or automatic promotion."}
      onClose={onClose}
      busy={loading}
      footer={
        <>
          <button type="button" onClick={onClose} className="a-btn" disabled={loading}>
            Cancel
          </button>
          <button type="submit" form="promotion-form" className="a-btn a-btn-primary" disabled={loading}>
            {loading ? "Saving…" : isEditing ? "Save promotion" : "Create promotion"}
          </button>
        </>
      }
    >
        <form id="promotion-form" onSubmit={handleSubmit} className="space-y-7">
          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-[#fdecea] p-3 text-sm text-[#7a1a12]">
              {error}
            </div>
          )}

          {/* Basic Info */}
          <section className="space-y-4 border-b border-[var(--a-line)] pb-7">
            <h3 className="text-base font-semibold text-[var(--a-ink)]">Details</h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="a-label">
                  Promotion Code <span className="text-[var(--a-faint)]" aria-hidden>*</span>
                </label>
                <input
                  type="text"
                  className="a-input font-mono uppercase"
                  value={formData.code}
                  onChange={(e) => handleChange("code", e.target.value.toUpperCase())}
                  placeholder="SUMMER10"
                  required
                />
                <p className="a-help">
                  Customer-facing code (will be uppercase)
                </p>
              </div>

              <div>
                <label className="a-label">
                  Internal Name <span className="text-[var(--a-faint)]" aria-hidden>*</span>
                </label>
                <input
                  type="text"
                  className="a-input"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="Summer Sale 2024"
                  required
                />
              </div>
            </div>

            <div>
              <label className="a-label">Description</label>
              <textarea
                className="a-textarea"
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder="Optional description for internal use"
                rows={2}
              />
            </div>
          </section>

          {/* Trigger Method */}
          <section className="space-y-4 border-b border-[var(--a-line)] pb-7">
            <h3 className="text-base font-semibold text-[var(--a-ink)]">How it applies</h3>

            <div className="space-y-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--a-line)] p-3 transition-colors hover:border-[var(--a-line-strong)] has-[:checked]:border-[var(--a-ink)]">
                <input
                  type="radio"
                  name="trigger"
                  value="code_required"
                  checked={formData.trigger === "code_required"}
                  onChange={(e) => handleChange("trigger", e.target.value)}
                  className="a-check"
                />
                <div>
                  <div className="text-sm font-medium text-[var(--a-ink)]">Require Promo Code</div>
                  <div className="text-xs text-[var(--a-muted)]">
                    Customer must enter the code at checkout
                  </div>
                </div>
              </label>

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--a-line)] p-3 transition-colors hover:border-[var(--a-line-strong)] has-[:checked]:border-[var(--a-ink)]">
                <input
                  type="radio"
                  name="trigger"
                  value="automatic"
                  checked={formData.trigger === "automatic"}
                  onChange={(e) => handleChange("trigger", e.target.value)}
                  className="a-check"
                />
                <div>
                  <div className="text-sm font-medium text-[var(--a-ink)]">Automatic</div>
                  <div className="text-xs text-[var(--a-muted)]">
                    Auto-applies when criteria are met
                  </div>
                </div>
              </label>
            </div>
          </section>

          {/* Discount Type & Amount */}
          <section className="space-y-4 border-b border-[var(--a-line)] pb-7">
            <h3 className="text-base font-semibold text-[var(--a-ink)]">Discount</h3>

            <div>
              <label className="a-label">
                Discount Type <span className="text-[var(--a-faint)]" aria-hidden>*</span>
              </label>
              <select
                className="a-select"
                value={formData.type}
                onChange={(e) => handleChange("type", e.target.value)}
                required
              >
                <option value="percentage">Percentage Off</option>
                <option value="fixed_amount">Fixed Amount Off</option>
                <option value="bogo">Buy X Get Y Free</option>
              </select>
            </div>

            {formData.type === "percentage" && (
              <div>
                <label className="a-label">
                  Discount Percentage <span className="text-[var(--a-faint)]" aria-hidden>*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    className="a-input pr-8 tabular-nums"
                    value={formData.discountPercent}
                    onChange={(e) => handleChange("discountPercent", e.target.value)}
                    placeholder="50"
                    min="0"
                    max="100"
                    step="0.01"
                    required
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--a-faint)]">
                    %
                  </span>
                </div>
              </div>
            )}

            {formData.type === "fixed_amount" && (
              <div>
                <label className="a-label">
                  Discount Amount <span className="text-[var(--a-faint)]" aria-hidden>*</span>
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--a-faint)]">
                    $
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="a-input !pl-7 tabular-nums"
                    value={formData.discountAmountCents}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "" || /^\d*\.?\d*$/.test(val)) {
                        handleChange("discountAmountCents", val);
                      }
                    }}
                    placeholder="5.00"
                    required
                  />
                </div>
              </div>
            )}

            {formData.type === "bogo" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="a-label">
                      Buy Quantity <span className="text-[var(--a-faint)]" aria-hidden>*</span>
                    </label>
                    <input
                      type="number"
                      className="a-input"
                      value={formData.minQuantity}
                      onChange={(e) => handleChange("minQuantity", e.target.value)}
                      placeholder="1"
                      min="1"
                      required
                    />
                    <p className="a-help">
                      Customer must buy this many
                    </p>
                  </div>

                  <div>
                    <label className="a-label">
                      Get Quantity <span className="text-[var(--a-faint)]" aria-hidden>*</span>
                    </label>
                    <input
                      type="number"
                      className="a-input"
                      value={formData.applyToQuantity}
                      onChange={(e) => handleChange("applyToQuantity", e.target.value)}
                      placeholder="1"
                      min="1"
                      required
                    />
                    <p className="a-help">
                      This many items get the discount
                    </p>
                  </div>
                </div>

                <div>
                  <label className="a-label">
                    Discount on those items <span className="text-[var(--a-faint)]" aria-hidden>*</span>
                  </label>
                  <div className="flex gap-3">
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--a-line)] p-3 transition-colors hover:border-[var(--a-line-strong)] has-[:checked]:border-[var(--a-ink)]">
                      <input
                        type="radio"
                        name="bogoDiscountType"
                        value="free"
                        checked={formData.bogoDiscountType === "free"}
                        onChange={() => handleChange("bogoDiscountType", "free")}
                        className="a-check"
                      />
                      <span className="text-sm font-medium">Free (100% off)</span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--a-line)] p-3 transition-colors hover:border-[var(--a-line-strong)] has-[:checked]:border-[var(--a-ink)]">
                      <input
                        type="radio"
                        name="bogoDiscountType"
                        value="percent"
                        checked={formData.bogoDiscountType === "percent"}
                        onChange={() => handleChange("bogoDiscountType", "percent")}
                        className="a-check"
                      />
                      <span className="text-sm font-medium">Percentage off</span>
                    </label>
                  </div>
                </div>

                {formData.bogoDiscountType === "percent" && (
                  <div>
                    <label className="a-label">
                      Discount Percentage <span className="text-[var(--a-faint)]" aria-hidden>*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        className="a-input pr-8 tabular-nums"
                        value={formData.bogoDiscountPercent}
                        onChange={(e) => handleChange("bogoDiscountPercent", e.target.value)}
                        placeholder="50"
                        min="1"
                        max="99"
                        required
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--a-faint)]">
                        %
                      </span>
                    </div>
                    <p className="a-help">
                      e.g. 50 = buy 1 get 1 at half price
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* User Targeting */}
          <section className="space-y-4 border-b border-[var(--a-line)] pb-7">
            <h3 className="text-base font-semibold text-[var(--a-ink)] flex items-center gap-2">
              <Users className="h-4 w-4 text-[var(--a-muted)]" aria-hidden />
              Who can use it
            </h3>

            <div>
              <label className="a-label">Who can use this promotion?</label>
              <select
                className="a-select"
                value={formData.userTargeting}
                onChange={(e) => handleChange("userTargeting", e.target.value)}
              >
                <option value="all">All Users</option>
                <option value="first_time">First-Time Customers Only</option>
                <option value="returning">Returning Customers Only</option>
                <option value="specific_users">Specific Users</option>
                <option value="order_count">Users with X+ Orders</option>
                <option value="lifetime_spend">Users who spent $X+</option>
              </select>
            </div>

            {formData.userTargeting === "specific_users" && (
              <div className="rounded-lg border border-[var(--a-line)] p-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="a-label mb-0">
                    Selected Users ({selectedUsers.length})
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectAllUsers}
                      className="a-btn a-btn-sm"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={clearAllUsers}
                      className="a-btn a-btn-sm"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--a-faint)]" />
                    <input
                      type="text"
                      className="a-input !pl-9"
                      placeholder="Search users by name or email..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                    />
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-1">
                  {filteredUsers.length === 0 ? (
                    <p className="text-sm text-[var(--a-muted)] text-center py-4">
                      No users found
                    </p>
                  ) : (
                    filteredUsers.map((user) => (
                      <label
                        key={user.id}
                        className="a-menu-item font-normal"
                      >
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user.id)}
                          onChange={() => toggleUser(user.id)}
                          className="a-check"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {user.firstName} {user.lastName}
                          </div>
                          <div className="text-xs text-[var(--a-muted)] truncate">
                            {user.email}
                          </div>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}

            {formData.userTargeting === "order_count" && (
              <div>
                <label className="a-label">
                  Minimum Order Count <span className="text-[var(--a-faint)]" aria-hidden>*</span>
                </label>
                <input
                  type="number"
                  className="a-input"
                  value={formData.minOrderCount}
                  onChange={(e) => handleChange("minOrderCount", e.target.value)}
                  placeholder="5"
                  min="1"
                  required
                />
                <p className="a-help">
                  User must have at least this many completed orders
                </p>
              </div>
            )}

            {formData.userTargeting === "lifetime_spend" && (
              <div>
                <label className="a-label">
                  Minimum Lifetime Spend <span className="text-[var(--a-faint)]" aria-hidden>*</span>
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--a-faint)]">
                    $
                  </span>
                  <input
                    type="number"
                    className="a-input !pl-7 tabular-nums"
                    value={formData.minLifetimeSpendCents}
                    onChange={(e) => handleChange("minLifetimeSpendCents", e.target.value)}
                    placeholder="100.00"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
                <p className="a-help">
                  User must have spent at least this much in total
                </p>
              </div>
            )}
          </section>

          {/* Order Restrictions */}
          <section className="space-y-4 border-b border-[var(--a-line)] pb-7">
            <h3 className="text-base font-semibold text-[var(--a-ink)]">Limits</h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="a-label">Minimum Order Amount</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--a-faint)]">
                    $
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="a-input !pl-7 tabular-nums"
                    value={formData.minOrderAmountCents}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "" || /^\d*\.?\d*$/.test(val)) {
                        handleChange("minOrderAmountCents", val);
                      }
                    }}
                    placeholder="50.00"
                  />
                </div>
              </div>

              <div>
                <label className="a-label">Max Total Uses</label>
                <input
                  type="number"
                  className="a-input"
                  value={formData.maxRedemptions}
                  onChange={(e) => handleChange("maxRedemptions", e.target.value)}
                  placeholder="Unlimited"
                  min="1"
                />
              </div>
            </div>

            <div>
              <label className="a-label">Max Uses Per Customer</label>
              <input
                type="number"
                className="a-input"
                value={formData.maxRedemptionsPerCustomer}
                onChange={(e) => handleChange("maxRedemptionsPerCustomer", e.target.value)}
                placeholder="Unlimited"
                min="1"
              />
            </div>
          </section>

          {/* Product Restrictions */}
          <section className="space-y-4 border-b border-[var(--a-line)] pb-7">
            <h3 className="text-base font-semibold text-[var(--a-ink)] flex items-center gap-2">
              <Package className="h-4 w-4 text-[var(--a-muted)]" aria-hidden />
              Products (optional)
            </h3>

            <p className="text-sm text-[var(--a-muted)]">
              Leave empty to apply to all products, or select specific products:
            </p>

            <div className="max-h-60 overflow-y-auto rounded-lg border border-[var(--a-line)] p-1">
              {products.length === 0 ? (
                <p className="text-sm text-[var(--a-muted)] text-center py-4">
                  No products available
                </p>
              ) : (
                products.map((product) => (
                  <label
                    key={product.slug}
                    className="a-menu-item font-normal"
                  >
                    <input
                      type="checkbox"
                      checked={selectedProducts.includes(product.slug)}
                      onChange={() => toggleProduct(product.slug)}
                      className="a-check"
                    />
                    <span className="text-sm">{product.name}</span>
                  </label>
                ))
              )}
            </div>

            {selectedProducts.length > 0 && (
              <p className="text-xs text-[var(--a-muted)]">
                {selectedProducts.length} product(s) selected
              </p>
            )}
          </section>

          {/* Timeline */}
          <section className="space-y-4 border-b border-[var(--a-line)] pb-7">
            <h3 className="text-base font-semibold text-[var(--a-ink)]">Dates</h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="a-label">Start Date (Optional)</label>
                <input
                  type="date"
                  className="a-input"
                  value={formData.startsAt}
                  onChange={(e) => handleChange("startsAt", e.target.value)}
                />
              </div>

              <div>
                <label className="a-label">Expiration Date (Optional)</label>
                <input
                  type="date"
                  className="a-input"
                  value={formData.expiresAt}
                  onChange={(e) => handleChange("expiresAt", e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Active Status */}
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--a-line)] p-3 text-sm">
            <input
              type="checkbox"
              className="a-check"
              checked={formData.active}
              onChange={(e) => handleChange("active", e.target.checked)}
            />
            <span>
              <span className="block font-medium text-[var(--a-ink)]">Active</span>
              <span className="block text-xs text-[var(--a-muted)]">Customers can use this promotion now.</span>
            </span>
          </label>
        </form>
    </Modal>
  );
}
