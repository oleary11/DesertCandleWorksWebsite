"use client";

import { useState, useEffect } from "react";
import { Search, Users, Package } from "lucide-react";
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
    discountPercent: promotion?.discountPercent?.toString() || "",
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

      if (
        formData.type === "quantity_discount" &&
        (!formData.minQuantity || !formData.discountPercent)
      ) {
        setError("Minimum quantity and discount percentage are required");
        setLoading(false);
        return;
      }

      if (
        formData.type === "bogo" &&
        (!formData.minQuantity || !formData.applyToQuantity)
      ) {
        setError("Minimum quantity and apply to quantity are required for BOGO");
        setLoading(false);
        return;
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

      if (formData.discountPercent) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-gradient-to-r from-neutral-50 to-white">
          <div>
            <h2 className="text-xl font-semibold text-[var(--color-ink)]">
              {isEditing ? "Edit Promotion" : "Create Promotion"}
            </h2>
            <p className="text-sm text-[var(--color-muted)] mt-0.5">
              {isEditing ? "Update promotion details and settings" : "Create a new discount code or promotional campaign"}
            </p>
          </div>
          <button
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
            onClick={onClose}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 min-h-0">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
              <p className="text-sm text-rose-900">{error}</p>
            </div>
          )}

          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">Basic Information</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Promotion Code <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  className="input w-full uppercase"
                  value={formData.code}
                  onChange={(e) => handleChange("code", e.target.value.toUpperCase())}
                  placeholder="SUMMER10"
                  required
                />
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  Customer-facing code (will be uppercase)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Internal Name <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  className="input w-full"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="Summer Sale 2024"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                className="textarea w-full"
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder="Optional description for internal use"
                rows={2}
              />
            </div>
          </div>

          {/* Trigger Method */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">Activation Method</h3>

            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="trigger"
                  value="code_required"
                  checked={formData.trigger === "code_required"}
                  onChange={(e) => handleChange("trigger", e.target.value)}
                  className="w-4 h-4"
                />
                <div>
                  <div className="font-medium">Require Promo Code</div>
                  <div className="text-xs text-[var(--color-muted)]">
                    Customer must enter the code at checkout
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="trigger"
                  value="automatic"
                  checked={formData.trigger === "automatic"}
                  onChange={(e) => handleChange("trigger", e.target.value)}
                  className="w-4 h-4"
                />
                <div>
                  <div className="font-medium">Automatic</div>
                  <div className="text-xs text-[var(--color-muted)]">
                    Auto-applies when criteria are met
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Discount Type & Amount */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">Discount Settings</h3>

            <div>
              <label className="block text-sm font-medium mb-1">
                Discount Type <span className="text-rose-600">*</span>
              </label>
              <select
                className="input w-full"
                value={formData.type}
                onChange={(e) => handleChange("type", e.target.value)}
                required
              >
                <option value="percentage">Percentage Off</option>
                <option value="fixed_amount">Fixed Amount Off</option>
                <option value="quantity_discount">Quantity Discount</option>
                <option value="bogo">Buy One Get One</option>
              </select>
            </div>

            {(formData.type === "percentage" || formData.type === "quantity_discount") && (
              <div>
                <label className="block text-sm font-medium mb-1">
                  Discount Percentage <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    className="input w-full pr-8"
                    value={formData.discountPercent}
                    onChange={(e) => handleChange("discountPercent", e.target.value)}
                    placeholder="10"
                    min="0"
                    max="100"
                    step="0.01"
                    required
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]">
                    %
                  </span>
                </div>
              </div>
            )}

            {formData.type === "fixed_amount" && (
              <div>
                <label className="block text-sm font-medium mb-1">
                  Discount Amount <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]">
                    $
                  </span>
                  <input
                    type="number"
                    className="input w-full pl-8"
                    value={formData.discountAmountCents}
                    onChange={(e) => handleChange("discountAmountCents", e.target.value)}
                    placeholder="5.00"
                    step="any"
                    required
                  />
                </div>
              </div>
            )}

            {(formData.type === "quantity_discount" || formData.type === "bogo") && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Minimum Quantity <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="number"
                    className="input w-full"
                    value={formData.minQuantity}
                    onChange={(e) => handleChange("minQuantity", e.target.value)}
                    placeholder="3"
                    min="1"
                    required
                  />
                  <p className="text-xs text-[var(--color-muted)] mt-1">
                    {formData.type === "quantity_discount" ? "Buy at least this many" : "Buy this many"}
                  </p>
                </div>

                {formData.type === "bogo" && (
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Get Free <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="number"
                      className="input w-full"
                      value={formData.applyToQuantity}
                      onChange={(e) => handleChange("applyToQuantity", e.target.value)}
                      placeholder="1"
                      min="1"
                      required
                    />
                    <p className="text-xs text-[var(--color-muted)] mt-1">
                      Get this many free
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* User Targeting */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2 flex items-center gap-2">
              <Users className="w-5 h-5" />
              User Targeting
            </h3>

            <div>
              <label className="block text-sm font-medium mb-2">Who can use this promotion?</label>
              <select
                className="input w-full"
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
              <div className="border border-[var(--color-line)] rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium">
                    Selected Users ({selectedUsers.length})
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectAllUsers}
                      className="text-xs btn btn-sm px-2 py-1"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={clearAllUsers}
                      className="text-xs btn btn-sm px-2 py-1"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-muted)]" />
                    <input
                      type="text"
                      className="input w-full pl-10"
                      placeholder="Search users by name or email..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                    />
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-1">
                  {filteredUsers.length === 0 ? (
                    <p className="text-sm text-[var(--color-muted)] text-center py-4">
                      No users found
                    </p>
                  ) : (
                    filteredUsers.map((user) => (
                      <label
                        key={user.id}
                        className="flex items-center gap-2 p-2 hover:bg-neutral-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user.id)}
                          onChange={() => toggleUser(user.id)}
                          className="w-4 h-4"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {user.firstName} {user.lastName}
                          </div>
                          <div className="text-xs text-[var(--color-muted)] truncate">
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
                <label className="block text-sm font-medium mb-1">
                  Minimum Order Count <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  className="input w-full"
                  value={formData.minOrderCount}
                  onChange={(e) => handleChange("minOrderCount", e.target.value)}
                  placeholder="5"
                  min="1"
                  required
                />
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  User must have at least this many completed orders
                </p>
              </div>
            )}

            {formData.userTargeting === "lifetime_spend" && (
              <div>
                <label className="block text-sm font-medium mb-1">
                  Minimum Lifetime Spend <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]">
                    $
                  </span>
                  <input
                    type="number"
                    className="input w-full pl-8"
                    value={formData.minLifetimeSpendCents}
                    onChange={(e) => handleChange("minLifetimeSpendCents", e.target.value)}
                    placeholder="100.00"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  User must have spent at least this much in total
                </p>
              </div>
            )}
          </div>

          {/* Order Restrictions */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">Order Restrictions</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Minimum Order Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]">
                    $
                  </span>
                  <input
                    type="number"
                    className="input w-full pl-8"
                    value={formData.minOrderAmountCents}
                    onChange={(e) => handleChange("minOrderAmountCents", e.target.value)}
                    placeholder="50.00"
                    step="any"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Max Total Uses</label>
                <input
                  type="number"
                  className="input w-full"
                  value={formData.maxRedemptions}
                  onChange={(e) => handleChange("maxRedemptions", e.target.value)}
                  placeholder="Unlimited"
                  min="1"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Max Uses Per Customer</label>
              <input
                type="number"
                className="input w-full"
                value={formData.maxRedemptionsPerCustomer}
                onChange={(e) => handleChange("maxRedemptionsPerCustomer", e.target.value)}
                placeholder="Unlimited"
                min="1"
              />
            </div>
          </div>

          {/* Product Restrictions */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2 flex items-center gap-2">
              <Package className="w-5 h-5" />
              Product Restrictions (Optional)
            </h3>

            <p className="text-sm text-[var(--color-muted)]">
              Leave empty to apply to all products, or select specific products:
            </p>

            <div className="border border-[var(--color-line)] rounded-lg p-4 max-h-60 overflow-y-auto space-y-1">
              {products.length === 0 ? (
                <p className="text-sm text-[var(--color-muted)] text-center py-4">
                  No products available
                </p>
              ) : (
                products.map((product) => (
                  <label
                    key={product.slug}
                    className="flex items-center gap-2 p-2 hover:bg-neutral-50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedProducts.includes(product.slug)}
                      onChange={() => toggleProduct(product.slug)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{product.name}</span>
                  </label>
                ))
              )}
            </div>

            {selectedProducts.length > 0 && (
              <p className="text-xs text-[var(--color-muted)]">
                {selectedProducts.length} product(s) selected
              </p>
            )}
          </div>

          {/* Timeline */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">Timeline</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Start Date (Optional)</label>
                <input
                  type="date"
                  className="input w-full"
                  value={formData.startsAt}
                  onChange={(e) => handleChange("startsAt", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Expiration Date (Optional)</label>
                <input
                  type="date"
                  className="input w-full"
                  value={formData.expiresAt}
                  onChange={(e) => handleChange("expiresAt", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Active Status */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="active"
              checked={formData.active}
              onChange={(e) => handleChange("active", e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="active" className="text-sm font-medium cursor-pointer">
              Active (promotion can be used)
            </label>
          </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-200 bg-neutral-50">
            <button
              type="button"
              onClick={onClose}
              className="btn hover:bg-white transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? "Saving..." : isEditing ? "Update Promotion" : "Create Promotion"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
