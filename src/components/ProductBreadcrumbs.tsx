"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Home, ChevronRight } from "lucide-react";
import { useEffect } from "react";

type ProductBreadcrumbsProps = {
  productName: string;
};

export default function ProductBreadcrumbs({ productName }: ProductBreadcrumbsProps) {
  const router = useRouter();

  useEffect(() => {
    // Store that we came from a product page (for scroll restoration on /shop)
    sessionStorage.setItem('fromProductPage', 'true');
  }, []);

  const handleBackClick = () => {
    // Mark that we're using the back button (for scroll restoration)
    sessionStorage.setItem('useBackButton', 'true');

    // Try to go back in history (preserves scroll position)
    if (window.history.length > 1) {
      router.back();
    } else {
      // Fallback to shop page if no history
      router.push("/shop");
    }
  };

  return (
    <div className="space-y-3">
      {/* Back Button */}
      <button
        onClick={handleBackClick}
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)] transition group"
      >
        <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
        <span>Back to Shop</span>
      </button>

      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
        <Link
          href="/"
          className="text-[var(--color-muted)] hover:text-[var(--color-ink)] transition flex items-center gap-1"
        >
          <Home className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Home</span>
        </Link>

        <ChevronRight className="w-3.5 h-3.5 text-[var(--color-muted)]" />

        <Link
          href="/shop"
          className="text-[var(--color-muted)] hover:text-[var(--color-ink)] transition"
        >
          Shop
        </Link>

        <ChevronRight className="w-3.5 h-3.5 text-[var(--color-muted)]" />

        <span className="text-[var(--color-ink)] font-medium truncate max-w-xs">
          {productName}
        </span>
      </nav>
    </div>
  );
}
