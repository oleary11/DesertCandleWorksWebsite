"use client";

import { Truck } from "lucide-react";

type FreeShippingBannerProps = {
  currentTotal: number;
  threshold?: number;
};

export default function FreeShippingBanner({
  currentTotal,
  threshold = 50
}: FreeShippingBannerProps) {
  const remaining = threshold - currentTotal;
  const qualified = currentTotal >= threshold;

  return (
    <div className="relative overflow-hidden rounded-lg border border-[var(--color-line)] p-4 bg-neutral-50/50 dark:bg-neutral-900/30">
      <div className="flex items-start gap-3">
        <Truck className="w-5 h-5 mt-0.5 flex-shrink-0 text-[var(--color-accent)]" />
        <div className="flex-1">
          {qualified ? (
            <>
              <p className="text-sm font-semibold text-[var(--color-ink)]">
                You qualify for free shipping!
              </p>
              <p className="text-xs text-[var(--color-muted)] mt-0.5">
                Your order of ${currentTotal.toFixed(2)} qualifies for free standard shipping (5-7 business days).
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-[var(--color-ink)]">
                Free shipping on orders over ${threshold}
              </p>
              <p className="text-xs text-[var(--color-muted)] mt-0.5">
                Add ${remaining.toFixed(2)} more to qualify for free standard shipping.
              </p>
            </>
          )}
        </div>
      </div>

      {!qualified && (
        <div className="mt-3">
          <div className="h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--color-accent)] transition-all duration-300 ease-out"
              style={{ width: `${Math.min((currentTotal / threshold) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
