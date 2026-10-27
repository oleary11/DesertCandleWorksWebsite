"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Tag, X } from "lucide-react";
import { PROMO_STORAGE_KEY } from "@/lib/attributionShared";

const DISMISS_KEY = "dcw_promo_banner_dismissed";

/** "Your code is saved" note after arriving from a link with ?promo=CODE. */
export function PromoBanner() {
  const pathname = usePathname();
  const [code, setCode] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const read = () => {
      try {
        const saved = localStorage.getItem(PROMO_STORAGE_KEY);
        setCode(saved);
        setDismissed(sessionStorage.getItem(DISMISS_KEY) === saved);
      } catch {
        setCode(null);
      }
    };
    read();
    window.addEventListener("dcw-promo", read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("dcw-promo", read);
      window.removeEventListener("storage", read);
    };
  }, []);

  // The cart shows the applied code itself; admin never shows shopper UI.
  if (!code || dismissed || pathname.startsWith("/admin") || pathname.startsWith("/cart")) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4" role="status">
      <div className="flex max-w-md items-center gap-3 rounded-full bg-[#2f2a25] py-2 pl-4 pr-2 text-sm text-white shadow-lg">
        <Tag className="h-4 w-4 shrink-0 text-[#f2c48f]" aria-hidden />
        <p className="min-w-0">
          Code <span className="font-semibold tracking-wide">{code}</span> is saved. It&apos;s applied in your cart.
        </p>
        <button
          type="button"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-white/10"
          aria-label="Dismiss"
          onClick={() => {
            try {
              sessionStorage.setItem(DISMISS_KEY, code);
            } catch {}
            setDismissed(true);
          }}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
