"use client";

import { useEffect } from "react";
import { addToRecentlyViewed } from "@/lib/recentlyViewed";
import type { Product } from "@/lib/products";

type ProductPageTrackerProps = {
  product: Pick<Product, "slug" | "name" | "image" | "price">;
};

export default function ProductPageTracker({ product }: ProductPageTrackerProps) {
  useEffect(() => {
    // Track this product view
    addToRecentlyViewed(product);
  }, [product]);

  return null; // This component doesn't render anything
}
