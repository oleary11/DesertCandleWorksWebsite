import type { Product } from "./products";
import { getPrimaryImage } from "./products";

const STORAGE_KEY = "recentlyViewedProducts";
const MAX_ITEMS = 8;

export type RecentlyViewedProduct = {
  slug: string;
  name: string;
  image: string;
  price: number;
  viewedAt: number;
};

// Get recently viewed products from localStorage
export function getRecentlyViewed(): RecentlyViewedProduct[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const items: RecentlyViewedProduct[] = JSON.parse(stored);
    // Sort by most recently viewed
    return items.sort((a, b) => b.viewedAt - a.viewedAt);
  } catch (error) {
    console.error("Error reading recently viewed products:", error);
    return [];
  }
}

// Add a product to recently viewed
export function addToRecentlyViewed(product: Product) {
  if (typeof window === "undefined") return;

  try {
    const existing = getRecentlyViewed();

    // Remove if already exists
    const filtered = existing.filter(item => item.slug !== product.slug);

    // Add to front
    const updated: RecentlyViewedProduct[] = [
      {
        slug: product.slug,
        name: product.name,
        image: getPrimaryImage(product) || "",
        price: product.price,
        viewedAt: Date.now(),
      },
      ...filtered,
    ].slice(0, MAX_ITEMS); // Keep only the most recent items

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error("Error adding to recently viewed:", error);
  }
}

// Clear recently viewed
export function clearRecentlyViewed() {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Error clearing recently viewed:", error);
  }
}
