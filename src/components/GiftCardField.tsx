"use client";

import { useEffect, useState } from "react";
import { Gift, X } from "lucide-react";

export const GIFT_CARD_STORAGE_KEY = "dcw_giftcard";

export type AppliedGiftCard = { code: string; balanceCents: number };

/**
 * "Have a gift card?" in the cart. Remembers the card for the visit (and picks up a code
 * from a gift card email's "Shop with your gift card" link, saved by AnalyticsTracker).
 */
export default function GiftCardField({
  value,
  onChange,
  appliedCents,
  fieldClass,
  buttonClass,
}: {
  value: AppliedGiftCard | null;
  onChange: (card: AppliedGiftCard | null) => void;
  /** How much of the card this order uses. */
  appliedCents: number;
  fieldClass: string;
  buttonClass: string;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  const check = async (raw: string, quiet = false) => {
    setChecking(true);
    setError("");
    try {
      const res = await fetch("/api/gift-cards/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: raw }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "That gift card code wasn't found.");
      onChange({ code: data.code, balanceCents: data.balanceCents });
      try {
        localStorage.setItem(GIFT_CARD_STORAGE_KEY, data.code);
      } catch {}
      setCode("");
      setOpen(false);
    } catch (err) {
      try {
        localStorage.removeItem(GIFT_CARD_STORAGE_KEY);
      } catch {}
      if (!quiet) setError(err instanceof Error ? err.message : "That gift card code wasn't found.");
    } finally {
      setChecking(false);
    }
  };

  // A saved card is re-checked on load, so the balance is current.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(GIFT_CARD_STORAGE_KEY);
      if (saved && !value) check(saved, true);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remove = () => {
    onChange(null);
    try {
      localStorage.removeItem(GIFT_CARD_STORAGE_KEY);
    } catch {}
  };

  const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  if (value) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-[var(--home-line)] bg-[var(--home-cream)] px-3 py-2.5 text-sm">
        <Gift className="mt-0.5 h-4 w-4 shrink-0 text-[var(--home-clay)]" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold tracking-wide text-[var(--home-ink)]">{value.code}</p>
          <p className="text-xs text-[var(--home-muted)]">
            Using {money(appliedCents)} of {money(value.balanceCents)}.{" "}
            {value.balanceCents - appliedCents > 0 ? `${money(value.balanceCents - appliedCents)} stays on the card.` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={remove}
          aria-label="Remove gift card"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--home-muted)] hover:bg-white"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 text-sm font-medium text-[var(--home-clay)] underline-offset-4 hover:underline"
      >
        <Gift className="h-4 w-4" aria-hidden />
        Have a gift card?
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (code.trim()) check(code);
      }}
    >
      <label htmlFor="gift-card-code" className="text-sm font-semibold text-[var(--home-ink)]">
        Gift card
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="gift-card-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="GIFT-XXXX-XXXX"
          autoComplete="off"
          spellCheck={false}
          className={`${fieldClass} flex-1 uppercase tracking-wide`}
          aria-describedby={error ? "gift-card-error" : undefined}
        />
        <button type="submit" disabled={!code.trim() || checking} className={buttonClass}>
          {checking ? "Checking…" : "Apply"}
        </button>
      </div>
      {error && (
        <p id="gift-card-error" role="alert" className="mt-2 text-sm text-[#9b3b2a]">
          {error}
        </p>
      )}
    </form>
  );
}
