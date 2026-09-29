"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Tag, Trash2 } from "lucide-react";
import PageHeader from "../_components/PageHeader";
import { Stat, Switch } from "../_components/ui";
import { Promotion, PromotionType } from "@/lib/promotions";
import PromotionModal from "@/components/PromotionModal";
import { useModal } from "@/hooks/useModal";
import CandleSpinner from "@/components/CandleSpinner";

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
      case "bogo":
        return "Buy X Get Y Free";
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
    if (promo.type === "bogo" && promo.minQuantity && promo.applyToQuantity) {
      const pct = promo.discountPercent ?? 100;
      const discountLabel = pct >= 100 ? "free" : `${pct}% off`;
      return `Buy ${promo.minQuantity} get ${promo.applyToQuantity} ${discountLabel}`;
    }
    return "N/A";
  }

  const activePromotions = promotions.filter((p) => p.active);
  const inactivePromotions = promotions.filter((p) => !p.active);

  if (loading) {
    return (
      <div className="a-ui flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <CandleSpinner />
        <p className="text-sm font-medium text-[var(--a-muted)]">Loading promotions…</p>
      </div>
    );
  }

  const sorted = [...activePromotions, ...inactivePromotions];

  return (
    <div className="a-ui mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Promotions"
        description="Discount codes and automatic promotions."
        actions={
          <button onClick={() => setShowCreateModal(true)} className="a-btn a-btn-primary">
            <Plus className="h-4 w-4" aria-hidden />
            New promotion
          </button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Active" value={activePromotions.length} />
        <Stat label="Redemptions" value={promotions.reduce((sum, p) => sum + p.currentRedemptions, 0)} hint="All promotions" />
        <Stat className="col-span-2 sm:col-span-1" label="Total promotions" value={promotions.length} />
      </div>

      {error && (
        <div role="alert" className="mb-6 rounded-lg border border-red-200 bg-[#fdecea] p-4 text-sm text-[#7a1a12]">
          {error}
        </div>
      )}

      {promotions.length === 0 ? (
        <div className="a-card flex flex-col items-center px-6 py-16 text-center">
          <span className="a-icon-tile mb-3 h-11 w-11">
            <Tag className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </span>
          <p className="font-medium text-[var(--a-ink)]">No promotions yet</p>
          <p className="mt-1 text-sm text-[var(--a-muted)]">Create one to start offering discounts.</p>
          <button onClick={() => setShowCreateModal(true)} className="a-btn a-btn-primary mt-4">
            <Plus className="h-4 w-4" aria-hidden />
            New promotion
          </button>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="a-card hidden overflow-hidden md:block">
            <table className="a-table">
              <thead>
                <tr>
                  <th className="w-20">Active</th>
                  <th>Code</th>
                  <th>Discount</th>
                  <th className="text-right">Used</th>
                  <th>Expires</th>
                  <th className="w-24">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((promo) => (
                  <tr key={promo.id} className={promo.active ? undefined : "text-[var(--a-muted)]"}>
                    <td>
                      <Switch checked={promo.active} onChange={() => toggleActive(promo)} label={`${promo.active ? "Deactivate" : "Activate"} ${promo.code}`} />
                    </td>
                    <td>
                      <p className={`font-mono font-semibold ${promo.active ? "text-[var(--a-ink)]" : ""}`}>{promo.code}</p>
                      <p className="mt-0.5 text-xs text-[var(--a-muted)]">{promo.name}</p>
                    </td>
                    <td>
                      <p className={promo.active ? "font-medium text-[var(--a-ink)]" : ""}>{getDiscountDisplay(promo)}</p>
                      <p className="mt-0.5 text-xs text-[var(--a-muted)]">{getTypeLabel(promo.type)}</p>
                    </td>
                    <td className="a-num">
                      {promo.currentRedemptions}
                      {promo.maxRedemptions ? <span className="text-[var(--a-muted)]"> / {promo.maxRedemptions}</span> : null}
                    </td>
                    <td className="whitespace-nowrap text-[var(--a-muted)]">{formatDate(promo.expiresAt)}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setEditingPromotion(promo)} className="a-icon-btn" aria-label={`Edit ${promo.code}`} title="Edit">
                          <Pencil className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          onClick={() => deletePromotion(promo.id)}
                          className="a-icon-btn a-icon-btn-danger"
                          aria-label={`Delete ${promo.code}`}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile list */}
          <ul className="a-card divide-y divide-[var(--a-line)] md:hidden">
            {sorted.map((promo) => (
              <li key={promo.id} className="flex items-start gap-3 px-4 py-3">
                <div className="pt-0.5">
                  <Switch checked={promo.active} onChange={() => toggleActive(promo)} label={`${promo.active ? "Deactivate" : "Activate"} ${promo.code}`} />
                </div>
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditingPromotion(promo)}>
                  <p className="font-mono font-semibold text-[var(--a-ink)]">{promo.code}</p>
                  <p className="text-sm text-[var(--a-muted)]">
                    {getDiscountDisplay(promo)} · used {promo.currentRedemptions}
                    {promo.maxRedemptions ? ` / ${promo.maxRedemptions}` : ""}
                  </p>
                  <p className="text-xs text-[var(--a-muted)]">{promo.expiresAt ? `Expires ${formatDate(promo.expiresAt)}` : "No expiration"}</p>
                </button>
                <button
                  onClick={() => deletePromotion(promo.id)}
                  className="a-icon-btn a-icon-btn-danger h-8 w-8 shrink-0"
                  aria-label={`Delete ${promo.code}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

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
  );
}
