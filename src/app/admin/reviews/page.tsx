"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Star, Eye, EyeOff, Trash2, Edit2, Plus } from "lucide-react";
import { useModal } from "@/hooks/useModal";

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
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating ? "fill-amber-400 text-amber-400" : "text-neutral-300"
            }`}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="btn">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold">Google Reviews</h1>
            <p className="text-sm text-[var(--color-muted)]">
              {reviews.length} total · {visibleCount} visible on site
            </p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={handleNew}>
          <Plus className="w-4 h-4 mr-1" />
          Add Review
        </button>
      </div>

      {/* Info Banner */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          <strong>Import your Google reviews manually.</strong> Copy reviews from your Google
          Business profile and add them here. Toggle visibility to control which reviews appear on
          product pages. Reviews marked as visible will be randomly displayed across all product
          pages.
        </p>
      </div>

      {/* Content */}
      {loading ? (
        <p>Loading reviews...</p>
      ) : reviews.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
            <Star className="w-8 h-8 text-amber-500" />
          </div>
          <p className="text-[var(--color-muted)] mb-4">
            No reviews yet. Import your first Google review to get started.
          </p>
          <button className="btn btn-primary" onClick={handleNew}>
            <Plus className="w-4 h-4 mr-1" />
            Add First Review
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedReviews.map((review) => (
            <div
              key={review.id}
              className={`card p-4 ${!review.visible ? "opacity-60" : ""}`}
            >
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center font-semibold text-sm flex-shrink-0">
                  {review.reviewerInitials || review.reviewerName.substring(0, 2).toUpperCase()}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{review.reviewerName}</span>
                    {renderStars(review.rating)}
                    {!review.visible && (
                      <span className="badge bg-neutral-200 text-neutral-600 text-xs">Hidden</span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--color-muted)] mb-2">
                    {new Date(review.date).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                  <p className="text-sm line-clamp-3">{review.text}</p>
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    className="btn p-2"
                    onClick={() => handleToggleVisibility(review.id)}
                    title={review.visible ? "Hide from site" : "Show on site"}
                  >
                    {review.visible ? (
                      <Eye className="w-4 h-4 text-green-600" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-neutral-400" />
                    )}
                  </button>
                  <button
                    className="btn p-2"
                    onClick={() => handleEdit(review)}
                    title="Edit review"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    className="btn p-2"
                    onClick={() => handleDelete(review.id, review.reviewerName)}
                    title="Delete review"
                  >
                    <Trash2 className="w-4 h-4 text-rose-500" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit/Create Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            onClick={() => {
              setEditing(null);
              setError(null);
            }}
          />

          {/* Modal */}
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-gradient-to-r from-neutral-50 to-white">
              <div>
                <h2 className="text-xl font-semibold text-[var(--color-ink)]">
                  {editing.id ? "Edit Review" : "Add Google Review"}
                </h2>
                <p className="text-sm text-[var(--color-muted)] mt-0.5">
                  Copy details from your Google Business profile
                </p>
              </div>
              <button
                className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                onClick={() => {
                  setEditing(null);
                  setError(null);
                }}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {error && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg">
                  <p className="text-sm text-rose-900">{error}</p>
                </div>
              )}

              <div className="space-y-4">
                {/* Reviewer Name */}
                <label className="block">
                  <div className="text-sm font-medium mb-1">Reviewer Name</div>
                  <input
                    className="input"
                    value={editing.reviewerName || ""}
                    onChange={(e) => setEditing({ ...editing, reviewerName: e.target.value })}
                    placeholder="e.g., John Smith"
                  />
                </label>

                {/* Rating */}
                <label className="block">
                  <div className="text-sm font-medium mb-2">Rating</div>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setEditing({ ...editing, rating: star })}
                        className="p-1 hover:scale-110 transition-transform"
                      >
                        <Star
                          className={`w-8 h-8 ${
                            star <= (editing.rating || 0)
                              ? "fill-amber-400 text-amber-400"
                              : "text-neutral-300"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </label>

                {/* Date */}
                <label className="block">
                  <div className="text-sm font-medium mb-1">Review Date</div>
                  <input
                    type="date"
                    className="input"
                    value={editing.date || ""}
                    onChange={(e) => setEditing({ ...editing, date: e.target.value })}
                  />
                </label>

                {/* Review Text */}
                <label className="block">
                  <div className="text-sm font-medium mb-1">Review Text</div>
                  <textarea
                    className="textarea min-h-[150px]"
                    value={editing.text || ""}
                    onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                    placeholder="Copy and paste the review text from Google..."
                  />
                </label>

                {/* Visibility */}
                <label className="flex items-start gap-3 p-3 border border-[var(--color-line)] rounded-lg bg-white hover:bg-neutral-50 transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editing.visible ?? true}
                    onChange={(e) => setEditing({ ...editing, visible: e.target.checked })}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Visible on Site</div>
                    <p className="text-xs text-[var(--color-muted)] mt-1">
                      When checked, this review may appear on product pages.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-200 bg-neutral-50">
              <button
                className="btn hover:bg-white transition-colors"
                onClick={() => {
                  setEditing(null);
                  setError(null);
                }}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : editing.id ? "Update Review" : "Add Review"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
