"use client";

import { Truck } from "lucide-react";

type FreeShippingProgressProps = {
  currentTotal: number;
  threshold?: number;
};

export default function FreeShippingProgress({
  currentTotal,
  threshold = 50
}: FreeShippingProgressProps) {
  const remaining = threshold - currentTotal;
  const progress = Math.min((currentTotal / threshold) * 100, 100);
  const hasReachedThreshold = currentTotal >= threshold;

  return (
    <div className="p-4 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200">
      {/* Progress Bar */}
      <div className="mb-3">
        <div className="h-2 bg-blue-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500 ease-out rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Message */}
      <div className="flex items-start gap-2.5">
        <Truck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          {hasReachedThreshold ? (
            <p className="font-semibold text-blue-900">
              You qualify for free shipping!
            </p>
          ) : (
            <p className="text-blue-900">
              <span className="font-semibold">${remaining.toFixed(2)}</span> away from{" "}
              <span className="font-semibold">free shipping</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
