import { redis } from "./redis";

const REVIEWS_KEY = "global:reviews";
const REVIEWS_INDEX_KEY = "global:reviews:index";

export interface GoogleReview {
  id: string; // unique identifier (e.g., timestamp-based)
  reviewerName: string; // name of the reviewer
  reviewerInitials?: string; // initials for avatar display
  rating: number; // 1-5 stars
  text: string; // review text
  date: string; // original review date (ISO string)
  importedAt: string; // when we imported it (ISO string)
  visible: boolean; // whether to show on the site
  sortOrder?: number; // optional manual sort order
}

/**
 * Get all reviews (including hidden ones - for admin)
 */
export async function getAllReviews(): Promise<GoogleReview[]> {
  try {
    const reviewIds = await redis.smembers(REVIEWS_INDEX_KEY);
    if (!reviewIds || reviewIds.length === 0) return [];

    const reviews: GoogleReview[] = [];
    for (const id of reviewIds) {
      const data = await redis.get(`${REVIEWS_KEY}:${id}`);
      if (data) {
        reviews.push(data as GoogleReview);
      }
    }

    // Sort by sortOrder, then by date (newest first)
    return reviews.sort((a, b) => {
      const orderA = a.sortOrder ?? 999;
      const orderB = b.sortOrder ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  } catch (error) {
    console.error("Failed to get reviews:", error);
    return [];
  }
}

/**
 * Get only visible reviews (for public display)
 */
export async function getVisibleReviews(): Promise<GoogleReview[]> {
  const allReviews = await getAllReviews();
  return allReviews.filter((review) => review.visible);
}

/**
 * Get random visible reviews for display
 * @param count - number of reviews to return
 */
export async function getRandomVisibleReviews(count: number): Promise<GoogleReview[]> {
  const visibleReviews = await getVisibleReviews();
  if (visibleReviews.length <= count) return visibleReviews;

  // Fisher-Yates shuffle and take first `count`
  const shuffled = [...visibleReviews];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

/**
 * Get a single review by ID
 */
export async function getReview(id: string): Promise<GoogleReview | null> {
  try {
    const data = await redis.get(`${REVIEWS_KEY}:${id}`);
    if (!data) return null;
    return data as GoogleReview;
  } catch (error) {
    console.error(`Failed to get review ${id}:`, error);
    return null;
  }
}

/**
 * Create or update a review
 */
export async function upsertReview(review: GoogleReview): Promise<void> {
  try {
    await redis.set(`${REVIEWS_KEY}:${review.id}`, review);
    await redis.sadd(REVIEWS_INDEX_KEY, review.id);
  } catch (error) {
    console.error(`Failed to upsert review ${review.id}:`, error);
    throw error;
  }
}

/**
 * Delete a review
 */
export async function deleteReview(id: string): Promise<void> {
  try {
    await redis.del(`${REVIEWS_KEY}:${id}`);
    await redis.srem(REVIEWS_INDEX_KEY, id);
  } catch (error) {
    console.error(`Failed to delete review ${id}:`, error);
    throw error;
  }
}

/**
 * Toggle review visibility
 */
export async function toggleReviewVisibility(id: string): Promise<GoogleReview | null> {
  const review = await getReview(id);
  if (!review) return null;

  review.visible = !review.visible;
  await upsertReview(review);
  return review;
}

/**
 * Generate initials from a name
 */
export function generateInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Generate a unique review ID
 */
export function generateReviewId(): string {
  return `review-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}
