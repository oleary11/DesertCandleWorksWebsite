"use client";

import { useEffect, useState, useMemo } from "react";
import { Pencil, Plus, Star, Trash2 } from "lucide-react";
import PageHeader from "../_components/PageHeader";
import { Badge, Modal, Switch } from "../_components/ui";
import { useModal } from "@/hooks/useModal";
import CandleSpinner from "@/components/CandleSpinner";

/* ---------- Types ---------- */
type GoogleReview = {
  id: string;
  reviewerName: string;
  reviewerInitials?: string;
  rating: number;
  text: string;
  date: string;
  importedAt: string;
  visible: boolean;
  sortOrder?: number;
};

/* ---------- Component ---------- */
export default function AdminReviewsPage() {
  const { showAlert, showConfirm } = useModal();
  const [reviews, setReviews] = useState<GoogleReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<GoogleReview> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sort reviews by sortOrder, then date
  const sortedReviews = useMemo(() => {
    return [...reviews].sort((a, b) => {
      const orderA = a.sortOrder ?? 999;
      const orderB = b.sortOrder ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [reviews]);

  const visibleCount = useMemo(() => reviews.filter((r) => r.visible).length, [reviews]);

  async function loadReviews() {
    try {
      const res = await fetch("/api/admin/reviews", { cache: "no-store" });
      const data = await res.json();
      setReviews(data.reviews || []);
    } catch (err) {
      console.error("Failed to load reviews:", err);
      setError("Failed to load reviews");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReviews();
  }, []);

  async function handleSave() {
    if (!editing) return;

    // Validation
    if (!editing.reviewerName || !editing.text || !editing.rating || !editing.date) {
      setError("Reviewer name, rating, text, and date are required");
      return;
    }

    if (editing.rating < 1 || editing.rating > 5) {
      setError("Rating must be between 1 and 5");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save review");
        setSaving(false);
        return;
      }

      await loadReviews();
      setEditing(null);
    } catch (err) {
      console.error("Save error:", err);
      setError("Failed to save review");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, reviewerName: string) {
    const confirmed = await showConfirm(
      `Delete review from "${reviewerName}"? This cannot be undone.`,
      "Confirm Delete"
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/admin/reviews?id=${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        await showAlert(data.error || "Failed to delete review", "Error");
        return;
      }

      await loadReviews();
    } catch (err) {
      console.error("Delete error:", err);
      await showAlert("Failed to delete review", "Error");
    }
  }

  async function handleToggleVisibility(id: string) {
    try {
      const res = await fetch(`/api/admin/reviews?id=${id}`, {
        method: "PATCH",
      });

      if (!res.ok) {
        const data = await res.json();
        await showAlert(data.error || "Failed to toggle visibility", "Error");
        return;
      }

      await loadReviews();
    } catch (err) {
      console.error("Toggle error:", err);
      await showAlert("Failed to toggle visibility", "Error");
    }
  }

  function handleNew() {
    setEditing({
      reviewerName: "",
      rating: 5,
      text: "",
      date: new Date().toISOString().split("T")[0],
      visible: true,
      sortOrder: reviews.length,
    });
    setError(null);
  }

  function handleEdit(review: GoogleReview) {
    setEditing({
      ...review,
      date: review.date.split("T")[0], // Format for date input
    });
    setError(null);
  }

  function renderStars(rating: number) {
    return (
      <span className="flex gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-3.5 w-3.5 ${star <= rating ? "fill-amber-400 text-amber-400" : "text-[var(--a-line-strong)]"}`}
            aria-hidden
          />
        ))}
      </span>
    );
  }

  function closeEditor() {
    setEditing(null);
    setError(null);
  }

  return (
    <div className="a-ui mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Google reviews"
        description={`${reviews.length} reviews · ${visibleCount} shown on product pages. Copy them in from your Google Business profile.`}
        actions={
          <button className="a-btn a-btn-primary" onClick={handleNew}>
            <Plus className="h-4 w-4" aria-hidden />
            Add review
          </button>
        }
      />

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-4 py-16">
          <CandleSpinner />
          <p className="text-sm font-medium text-[var(--a-muted)]">Loading reviews…</p>
        </div>
      ) : reviews.length === 0 ? (
        <div className="a-card flex flex-col items-center px-6 py-16 text-center">
          <span className="a-icon-tile mb-3 h-11 w-11">
            <Star className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </span>
          <p className="font-medium text-[var(--a-ink)]">No reviews yet</p>
          <p className="mt-1 text-sm text-[var(--a-muted)]">Add your first Google review to show it on product pages.</p>
          <button className="a-btn a-btn-primary mt-4" onClick={handleNew}>
            <Plus className="h-4 w-4" aria-hidden />
            Add review
          </button>
        </div>
      ) : (
        <ul className="a-card divide-y divide-[var(--a-line)]">
          {sortedReviews.map((review) => (
            <li key={review.id} className="flex items-start gap-3 px-4 py-4 sm:gap-4 sm:px-5">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  review.visible ? "bg-[var(--a-ink)] text-white" : "bg-[var(--a-tint)] text-[var(--a-muted)]"
                }`}
                aria-hidden
              >
                {review.reviewerInitials || review.reviewerName.substring(0, 2).toUpperCase()}
              </span>

              <div className={`min-w-0 flex-1 ${review.visible ? "" : "opacity-60"}`}>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-medium text-[var(--a-ink)]">{review.reviewerName}</span>
                  {renderStars(review.rating)}
                  <span className="text-xs text-[var(--a-muted)]">
                    {new Date(review.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                  </span>
                  {!review.visible && <Badge>Hidden</Badge>}
                </div>
                <p className="mt-1 line-clamp-3 text-sm text-[var(--a-ink)]">{review.text}</p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Switch
                  checked={review.visible}
                  onChange={() => handleToggleVisibility(review.id)}
                  label={review.visible ? `Hide ${review.reviewerName}'s review from the site` : `Show ${review.reviewerName}'s review on the site`}
                />
                <button className="a-icon-btn ml-1" onClick={() => handleEdit(review)} aria-label={`Edit ${review.reviewerName}'s review`} title="Edit">
                  <Pencil className="h-4 w-4" aria-hidden />
                </button>
                <button
                  className="a-icon-btn a-icon-btn-danger"
                  onClick={() => handleDelete(review.id, review.reviewerName)}
                  aria-label={`Delete ${review.reviewerName}'s review`}
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <Modal
          size="sm"
          title={editing.id ? "Edit review" : "Add Google review"}
          description="Copy the details from your Google Business profile."
          onClose={closeEditor}
          busy={saving}
          footer={
            <>
              <button className="a-btn" onClick={closeEditor} disabled={saving}>
                Cancel
              </button>
              <button className="a-btn a-btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : editing.id ? "Save review" : "Add review"}
              </button>
            </>
          }
        >
          {error && (
            <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-[#fdecea] p-3 text-sm text-[#7a1a12]">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <label className="block">
              <span className="a-label">Reviewer name</span>
              <input
                className="a-input"
                value={editing.reviewerName || ""}
                onChange={(e) => setEditing({ ...editing, reviewerName: e.target.value })}
                placeholder="e.g. John Smith"
              />
            </label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <fieldset>
                <legend className="a-label">Rating</legend>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setEditing({ ...editing, rating: star })}
                      aria-label={`${star} star${star === 1 ? "" : "s"}`}
                      aria-pressed={(editing.rating || 0) === star}
                      className="rounded-md p-1 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--a-accent)]"
                    >
                      <Star
                        className={`h-7 w-7 ${star <= (editing.rating || 0) ? "fill-amber-400 text-amber-400" : "text-[var(--a-line-strong)]"}`}
                        aria-hidden
                      />
                    </button>
                  ))}
                </div>
              </fieldset>

              <label className="block">
                <span className="a-label">Review date</span>
                <input
                  type="date"
                  className="a-input"
                  value={editing.date || ""}
                  onChange={(e) => setEditing({ ...editing, date: e.target.value })}
                />
              </label>
            </div>

            <label className="block">
              <span className="a-label">Review text</span>
              <textarea
                className="a-textarea min-h-[150px]"
                value={editing.text || ""}
                onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                placeholder="Paste the review text from Google"
              />
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--a-line)] p-3 transition-colors hover:border-[var(--a-line-strong)]">
              <input
                type="checkbox"
                className="a-check mt-0.5"
                checked={editing.visible ?? true}
                onChange={(e) => setEditing({ ...editing, visible: e.target.checked })}
              />
              <span>
                <span className="block text-sm font-medium text-[var(--a-ink)]">Show on the site</span>
                <span className="mt-0.5 block text-xs text-[var(--a-muted)]">Visible reviews appear at random on product pages.</span>
              </span>
            </label>
          </div>
        </Modal>
      )}
    </div>
  );
}
