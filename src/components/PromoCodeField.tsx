"use client";

import { useState } from "react";
import { Tag } from "lucide-react";

type PromoCodeFieldProps = {
  onPromoApplied: (promotionId: string, discountAmount: number) => void;
  onPromoRemoved: () => void;
  subtotalCents: number;
};

/**
 * Simple promo code field with server-side validation and rate limiting
 *
 * Security is handled server-side at /api/validate-promo:
 * - Rate limiting: 5 attempts/hour per IP
 * - Session limiting: 3 attempts/hour per session
 * - Rapid-fire blocking: >3 attempts in 10 seconds = blocked
 *
 * Primary anti-Honey protection: Stripe checkout has allow_promotion_codes: false
 * so there's no promo field for Honey to target at checkout.
 */
export default function PromoCodeField({
  onPromoApplied,
  onPromoRemoved,
  subtotalCents,
}: PromoCodeFieldProps) {
  const [value, setValue] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    promotionId: string;
    discountAmount: number;
  } | null>(null);

  const handleApply = async () => {
    if (!value.trim() || isValidating) return;

    setIsValidating(true);
    setError("");

    try {
      // Generate session fingerprint
      const sessionId = sessionStorage.getItem("session_id") || crypto.randomUUID();
      sessionStorage.setItem("session_id", sessionId);

      const response = await fetch("/api/validate-promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: value.trim().toUpperCase(),
          sessionId,
          subtotalCents,
        }),
      });

      const data = await response.json();

      if (response.ok && data.valid) {
        // Promo code is valid
        setAppliedPromo({
          code: value.trim().toUpperCase(),
          promotionId: data.promotionId,
          discountAmount: data.discountAmountCents,
        });
        onPromoApplied(data.promotionId, data.discountAmountCents);
        setValue("");
      } else {
        setError(data.error || "Invalid promo code");
      }
    } catch (err) {
      console.error("Promo validation error:", err);
      setError("Failed to validate promo code");
    } finally {
      setIsValidating(false);
    }
  };

  const handleRemove = () => {
    setAppliedPromo(null);
    onPromoRemoved();
    setError("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleApply();
    }
  };

  if (appliedPromo) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-900">
                {appliedPromo.code}
              </p>
              <p className="text-xs text-green-700">
                -${(appliedPromo.discountAmount / 100).toFixed(2)} discount applied
              </p>
            </div>
          </div>
          <button
            onClick={handleRemove}
            className="text-xs text-green-700 hover:text-green-900 underline"
          >
            Remove
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            placeholder="Promo code"
            disabled={isValidating}
            name="promo"
            id="promo-code"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg
                     focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent
                     disabled:bg-neutral-100 disabled:cursor-not-allowed uppercase"
          />
          <Tag className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        </div>
        <button
          onClick={handleApply}
          disabled={isValidating || !value.trim()}
          className="px-4 py-2 text-sm font-medium rounded-lg
                   bg-[var(--color-accent)] text-[var(--color-accent-ink)]
                   hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed
                   transition-opacity"
        >
          {isValidating ? "..." : "Apply"}
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
