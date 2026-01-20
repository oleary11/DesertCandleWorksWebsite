import { Star, ExternalLink } from "lucide-react";
import { getRandomVisibleReviews, type GoogleReview } from "@/lib/reviewsStore";

interface GoogleReviewsProps {
  maxReviews?: number;
}

export default async function GoogleReviews({ maxReviews = 3 }: GoogleReviewsProps) {
  const reviews = await getRandomVisibleReviews(maxReviews);

  if (reviews.length === 0) {
    return null;
  }

  // Generate initials from name if not provided
  function getInitials(review: GoogleReview): string {
    if (review.reviewerInitials) return review.reviewerInitials;
    const parts = review.reviewerName.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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

  // Schema.org Review markup
  const reviewSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "5",
      reviewCount: reviews.length.toString(),
      bestRating: "5",
      worstRating: "1",
    },
    review: reviews.map((review) => ({
      "@type": "Review",
      author: {
        "@type": "Person",
        name: review.reviewerName,
      },
      datePublished: review.date,
      reviewBody: review.text,
      reviewRating: {
        "@type": "Rating",
        ratingValue: review.rating.toString(),
        bestRating: "5",
        worstRating: "1",
      },
      publisher: {
        "@type": "Organization",
        name: "Google",
      },
    })),
  };

  return (
    <section className="mt-12 pt-8 border-t border-[var(--color-line)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(reviewSchema) }}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {renderStars(5)}
          </div>
          <h2 className="text-lg font-semibold">Customer Reviews</h2>
        </div>
        <a
          href="https://g.page/r/CQcLSwY5Vml0EBM/review"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[var(--color-accent)] hover:underline flex items-center gap-1"
        >
          Leave a Review
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Reviews Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {reviews.map((review) => (
          <div
            key={review.id}
            className="bg-white border border-[var(--color-line)] rounded-xl p-4 hover:shadow-md transition-shadow"
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center font-semibold text-sm flex-shrink-0">
                {getInitials(review)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{review.reviewerName}</div>
                <div className="flex items-center gap-2">
                  {renderStars(review.rating)}
                </div>
              </div>
            </div>

            {/* Review Text */}
            <p className="text-sm text-[var(--color-muted)] line-clamp-4 mb-3">{review.text}</p>

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-[var(--color-line)]">
              <span className="text-xs text-[var(--color-muted)]">
                {new Date(review.date).toLocaleDateString("en-US", {
                  month: "short",
                  year: "numeric",
                })}
              </span>
              <div className="flex items-center gap-1 text-xs text-[var(--color-muted)]">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span>Verified Google Review</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
