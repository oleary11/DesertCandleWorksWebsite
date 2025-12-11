"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Edit, Trash2, Calendar, Tag, TrendingUp } from "lucide-react";
import { Promotion, PromotionType } from "@/lib/promotions";
import PromotionModal from "@/components/PromotionModal";
import { useModal } from "@/hooks/useModal";

export default function AdminPromotionsPage() {
  const { showAlert, showConfirm } = useModal();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);

  useEffect(() => {
    loadPromotions();
  }, []);

  async function loadPromotions() {
    try {
      const res = await fetch("/api/admin/promotions");
      if (!res.ok) throw new Error("Failed to load promotions");
      const data = await res.json();
      setPromotions(data.promotions || []);
    } catch (err) {
      setError("Failed to load promotions");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(promo: Promotion) {
    try {
      const res = await fetch("/api/admin/promotions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: promo.id, active: !promo.active }),
      });

      if (!res.ok) throw new Error("Failed to update promotion");
      await loadPromotions();
    } catch (err) {
      await showAlert("Failed to update promotion", "Error");
      console.error(err);
    }
  }

  async function deletePromotion(id: string) {
    const confirmed = await showConfirm("Are you sure you want to delete this promotion?", "Confirm Delete");
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/admin/promotions?id=${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete promotion");
      await loadPromotions();
    } catch (err) {
      await showAlert("Failed to delete promotion", "Error");
      console.error(err);
    }
  }

  function formatDate(isoString?: string) {
    if (!isoString) return "No expiration";
    return new Date(isoString).toLocaleDateString();
  }

  function getTypeLabel(type: PromotionType): string {
    switch (type) {
      case "percentage":
        return "Percentage Off";
      case "fixed_amount":
        return "Fixed Amount Off";
      case "quantity_discount":
        return "Quantity Discount";
      case "bogo":
        return "Buy One Get One";
      default:
        return type;
    }
  }

  function getDiscountDisplay(promo: Promotion): string {
    if (promo.type === "percentage" && promo.discountPercent) {
      return `${promo.discountPercent}% off`;
    }
    if (promo.type === "fixed_amount" && promo.discountAmountCents) {
      return `$${(promo.discountAmountCents / 100).toFixed(2)} off`;
    }
    if (promo.type === "quantity_discount" && promo.minQuantity && promo.discountPercent) {
      return `Buy ${promo.minQuantity}+ get ${promo.discountPercent}% off`;
    }
    if (promo.type === "bogo" && promo.minQuantity && promo.applyToQuantity) {
      return `Buy ${promo.minQuantity} get ${promo.applyToQuantity} free`;
    }
    return "N/A";
  }

  const activePromotions = promotions.filter((p) => p.active);
  const inactivePromotions = promotions.filter((p) => !p.active);

  if (loading) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-[var(--color-muted)]">Loading promotions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 bg-neutral-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)] mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Admin
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Promotions</h1>
              <p className="text-[var(--color-muted)] mt-1">
                Manage discount codes and promotional campaigns
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn bg-[var(--color-accent)] text-white flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Promotion
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card p-6 bg-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <Tag className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-sm font-medium text-[var(--color-muted)]">Active Promotions</span>
            </div>
            <p className="text-3xl font-bold">{activePromotions.length}</p>
          </div>

          <div className="card p-6 bg-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-[var(--color-muted)]">Total Redemptions</span>
            </div>
            <p className="text-3xl font-bold">
              {promotions.reduce((sum, p) => sum + p.currentRedemptions, 0)}
            </p>
          </div>

          <div className="card p-6 bg-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-sm font-medium text-[var(--color-muted)]">Total Promotions</span>
            </div>
            <p className="text-3xl font-bold">{promotions.length}</p>
          </div>
        </div>

        {error && (
          <div className="card p-4 bg-red-50 border border-red-200 text-red-800 mb-6">
            {error}
          </div>
        )}

        {/* Active Promotions */}
        {activePromotions.length > 0 && (
          <div className="card p-6 bg-white mb-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              Active Promotions ({activePromotions.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--color-line)]">
                    <th className="text-left py-3 text-sm font-semibold">Code</th>
                    <th className="text-left py-3 text-sm font-semibold">Name</th>
                    <th className="text-left py-3 text-sm font-semibold">Type</th>
                    <th className="text-left py-3 text-sm font-semibold">Discount</th>
                    <th className="text-right py-3 text-sm font-semibold">Redemptions</th>
                    <th className="text-left py-3 text-sm font-semibold">Expires</th>
                    <th className="text-right py-3 text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activePromotions.map((promo) => (
                    <tr key={promo.id} className="border-b border-[var(--color-line)]">
                      <td className="py-3 text-sm font-mono font-bold">{promo.code}</td>
                      <td className="py-3 text-sm">{promo.name}</td>
                      <td className="py-3 text-sm">
                        <span className="badge bg-blue-100 text-blue-700 text-xs">
                          {getTypeLabel(promo.type)}
                        </span>
                      </td>
                      <td className="py-3 text-sm font-medium text-green-600">
                        {getDiscountDisplay(promo)}
                      </td>
                      <td className="py-3 text-sm text-right">
                        {promo.currentRedemptions}
                        {promo.maxRedemptions && ` / ${promo.maxRedemptions}`}
                      </td>
                      <td className="py-3 text-sm text-[var(--color-muted)]">
                        {formatDate(promo.expiresAt)}
                      </td>
                      <td className="py-3 text-sm text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => toggleActive(promo)}
                            className="text-xs btn btn-sm px-2 py-1"
                          >
                            Deactivate
                          </button>
                          <button
                            onClick={() => setEditingPromotion(promo)}
                            className="p-1 text-[var(--color-muted)] hover:text-[var(--color-ink)]"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deletePromotion(promo.id)}
                            className="p-1 text-[var(--color-muted)] hover:text-rose-600"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Inactive Promotions */}
        {inactivePromotions.length > 0 && (
          <div className="card p-6 bg-white">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gray-400"></span>
              Inactive Promotions ({inactivePromotions.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--color-line)]">
                    <th className="text-left py-3 text-sm font-semibold">Code</th>
                    <th className="text-left py-3 text-sm font-semibold">Name</th>
                    <th className="text-left py-3 text-sm font-semibold">Type</th>
                    <th className="text-right py-3 text-sm font-semibold">Redemptions</th>
                    <th className="text-right py-3 text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {inactivePromotions.map((promo) => (
                    <tr key={promo.id} className="border-b border-[var(--color-line)] opacity-60">
                      <td className="py-3 text-sm font-mono">{promo.code}</td>
                      <td className="py-3 text-sm">{promo.name}</td>
                      <td className="py-3 text-sm">
                        <span className="badge bg-gray-100 text-gray-700 text-xs">
                          {getTypeLabel(promo.type)}
                        </span>
                      </td>
                      <td className="py-3 text-sm text-right">{promo.currentRedemptions}</td>
                      <td className="py-3 text-sm text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => toggleActive(promo)}
                            className="text-xs btn btn-sm px-2 py-1"
                          >
                            Activate
                          </button>
                          <button
                            onClick={() => deletePromotion(promo.id)}
                            className="p-1 text-[var(--color-muted)] hover:text-rose-600"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {promotions.length === 0 && (
          <div className="card p-12 bg-white text-center">
            <Tag className="w-12 h-12 text-[var(--color-muted)] mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Promotions Yet</h3>
            <p className="text-[var(--color-muted)] mb-6">
              Create your first promotion to start offering discounts to customers
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn bg-[var(--color-accent)] text-white inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Promotion
            </button>
          </div>
        )}

        {/* Create/Edit Modal */}
        {showCreateModal && (
          <PromotionModal
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => {
              setShowCreateModal(false);
              loadPromotions();
            }}
          />
        )}

        {editingPromotion && (
          <PromotionModal
            promotion={editingPromotion}
            onClose={() => setEditingPromotion(null)}
            onSuccess={() => {
              setEditingPromotion(null);
              loadPromotions();
            }}
          />
        )}
      </div>
    </div>
  );
}
