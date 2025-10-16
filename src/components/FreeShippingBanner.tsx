"use client";

import { Truck, Package } from "lucide-react";

type FreeShippingBannerProps = {
  currentTotal: number;
  threshold?: number;
};

export default function FreeShippingBanner({
  currentTotal,
  threshold = 50
}: FreeShippingBannerProps) {
  const remaining = threshold - currentTotal;
  const progress = Math.min((currentTotal / threshold) * 100, 100);
  const qualified = currentTotal >= threshold;

  return (
    <div className={`relative overflow-hidden rounded-xl p-4 border ${
      qualified
        ? "bg-gradient-to-r from-green-50 to-emerald-50 border-green-200"
        : "bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200"
    }`}>
      {/* Progress Bar */}
      <div className="mb-3">
        <div className={`h-2.5 rounded-full overflow-hidden ${
          qualified ? "bg-green-200" : "bg-blue-200"
        }`}>
          <div
            className={`h-full transition-all duration-500 ease-out rounded-full ${
              qualified
                ? "bg-gradient-to-r from-green-500 to-emerald-600"
                : "bg-gradient-to-r from-blue-500 to-blue-600"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Message with Icon */}
      <div className="flex items-start gap-3">
        {qualified ? (
          <Package className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
        ) : (
          <Truck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        )}

        <div className="flex-1">
          {qualified ? (
            <>
              <p className={`text-sm font-semibold ${
                qualified ? "text-green-900" : "text-blue-900"
              }`}>
                You qualify for free shipping!
              </p>
              <p className={`text-xs mt-0.5 ${
                qualified ? "text-green-700" : "text-blue-700"
              }`}>
                Your order of ${currentTotal.toFixed(2)} qualifies for free standard shipping (5-7 business days).
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-blue-900">
                <span className="text-blue-600 font-bold">${remaining.toFixed(2)}</span> away from{" "}
                <span className="text-blue-600">free shipping</span>
              </p>
              <p className="text-xs text-blue-700 mt-0.5">
                Add ${remaining.toFixed(2)} more to qualify for free standard shipping.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
