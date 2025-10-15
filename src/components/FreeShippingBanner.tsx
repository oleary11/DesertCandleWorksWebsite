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
    <div
      className={`
        relative overflow-hidden rounded-lg border p-4
        ${qualified
          ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
          : "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800"
        }
      `}
    >
      <div className="flex items-start gap-3">
        <Truck
          className={`
            w-5 h-5 mt-0.5 flex-shrink-0
            ${qualified ? "text-green-600 dark:text-green-400" : "text-blue-600 dark:text-blue-400"}
          `}
        />
        <div className="flex-1">
          {qualified ? (
            <>
              <p className="text-sm font-medium text-green-900 dark:text-green-100">
                You qualify for free shipping!
              </p>
              <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
                Your order of ${currentTotal.toFixed(2)} qualifies for free standard shipping (5-7 business days).
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Free shipping on orders over ${threshold}
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                Add ${remaining.toFixed(2)} more to qualify for free standard shipping.
              </p>
            </>
          )}
        </div>
      </div>

      {!qualified && (
        <div className="mt-3">
          <div className="h-2 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 dark:bg-blue-400 transition-all duration-300 ease-out"
              style={{ width: `${Math.min((currentTotal / threshold) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
