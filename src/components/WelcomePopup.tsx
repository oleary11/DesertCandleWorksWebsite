"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Young_Serif } from "next/font/google";
import { MailCheck, X } from "lucide-react";
import { PROMO_STORAGE_KEY } from "@/lib/attributionShared";

const serif = Young_Serif({ weight: "400", subsets: ["latin"], display: "swap" });

// "joined", or the time it was last closed (it comes back after a couple of weeks)
const STATE_KEY = "dcw_welcome";
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;
const DELAY_MS = 12_000;
// Pages where a popup would get in the way of something else.
const QUIET_PATHS = ["/admin", "/cart", "/checkout", "/account", "/unsubscribe", "/success", "/order", "/go/"];

/** "Get 10% off" email signup, shown once to new visitors after a short look around. */
export function WelcomePopup() {
  const pathname = usePathname();
  const [percent, setPercent] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const [joined, setJoined] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const quiet = QUIET_PATHS.some((p) => pathname.startsWith(p));

  // Decide once per visit whether to offer it, then wait for a short look around.
  useEffect(() => {
    if (quiet || percent !== null) return;
    try {
      const state = localStorage.getItem(STATE_KEY);
      if (state === "joined" || (state && Date.now() - Number(state) < SNOOZE_MS)) return;
      // People arriving from our emails are already on the list, and anyone with a
      // code from a link already has a deal.
      const params = new URLSearchParams(window.location.search);
      if (params.get("utm_source") === "email" || params.has("promo") || localStorage.getItem(PROMO_STORAGE_KEY)) return;
    } catch {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const show = () => {
      if (cancelled) return;
      cancelled = true;
      window.removeEventListener("scroll", onScroll);
      clearTimeout(timer);
      setOpen(true);
    };
    const onScroll = () => {
      const depth = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
      if (depth > 0.55) show();
    };

    fetch("/api/welcome-offer")
      .then((res) => res.json())
      .then((data: { active: boolean; percent?: number }) => {
        if (!data.active || !data.percent || cancelled) return;
        setPercent(data.percent);
        timer = setTimeout(show, DELAY_MS);
        window.addEventListener("scroll", onScroll, { passive: true });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
    // Only on first load of a page the popup may show on
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiet]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    // Don't pull the phone keyboard up on its own.
    if (window.matchMedia("(min-width: 640px)").matches) inputRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => {
    setOpen(false);
    try {
      if (localStorage.getItem(STATE_KEY) !== "joined") localStorage.setItem(STATE_KEY, String(Date.now()));
    } catch {}
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/welcome-offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, phone }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      setJoined(true);
      setStatus("idle");
      try {
        localStorage.setItem(STATE_KEY, "joined");
      } catch {}
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  };

  if (!open || quiet || percent === null) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-[#2a1d16]/55 backdrop-blur-[2px] animate-[fadeIn_.2s_ease-out]"
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        className="relative grid w-full max-w-[760px] overflow-hidden rounded-t-3xl bg-[#fbf6f0] text-[#3f2a21] shadow-2xl sm:grid-cols-[1fr_1.15fr] sm:rounded-3xl"
      >
        <div className="relative hidden bg-[#f1ddd3] sm:block">
          <Image
            src="/images/hendricks.png"
            alt="A lit candle in an upcycled Hendrick's Gin bottle"
            fill
            sizes="340px"
            className="object-cover"
          />
        </div>

        <div className="px-6 pb-8 pt-9 sm:px-9 sm:py-11">
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full text-[#74594b] hover:bg-[#f1ddd3]"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>

          {joined ? (
            <div className="text-center sm:text-left">
              <MailCheck className="mx-auto h-10 w-10 text-[#a9502f] sm:mx-0" aria-hidden />
              <h2 id="welcome-title" className={`${serif.className} mt-4 text-[2rem] leading-tight`}>
                Check your inbox
              </h2>
              <p className="mt-3 leading-relaxed text-[#74594b]">
                Your {percent}% off code is on its way to <span className="font-medium text-[#3f2a21]">{email}</span>. The
                link in the email opens the shop with it already applied.
              </p>
              <p className="mt-2 text-sm text-[#9a8072]">Not there in a minute? Check spam or promotions.</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-[#a9502f] px-7 py-3.5 font-semibold text-white shadow-[0_10px_24px_-10px_rgb(169_80_47/0.7)] transition-colors hover:bg-[#8f4125] active:scale-[0.98]"
              >
                Keep browsing
              </button>
            </div>
          ) : (
            <form onSubmit={submit}>
              <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[#a9502f]">Welcome in</p>
              <h2 id="welcome-title" className={`${serif.className} mt-3 text-[2.1rem] leading-[1.1]`}>
                Take {percent}% off your first order
              </h2>
              <p className="mt-3 leading-relaxed text-[#74594b]">
                Join our list for new scents, restocks and the occasional sale. We&apos;ll email your code right away.
              </p>
              <label htmlFor="welcome-email" className="sr-only">
                Email address
              </label>
              <input
                ref={inputRef}
                id="welcome-email"
                type="email"
                autoComplete="email"
                spellCheck={false}
                required
                placeholder="Your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-6 w-full rounded-xl border border-[#e5d3c4] bg-white px-4 py-3.5 text-base text-[#3f2a21] placeholder:text-[#9a8072] focus:border-[#a9502f] focus:outline-none focus:ring-2 focus:ring-[#a9502f]/25"
              />
              <label htmlFor="welcome-phone" className="sr-only">
                Phone number
              </label>
              <input
                id="welcome-phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                required
                placeholder="Phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-3 w-full rounded-xl border border-[#e5d3c4] bg-white px-4 py-3.5 text-base text-[#3f2a21] placeholder:text-[#9a8072] focus:border-[#a9502f] focus:outline-none focus:ring-2 focus:ring-[#a9502f]/25"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="mt-3 w-full rounded-xl bg-[#a9502f] px-7 py-3.5 font-semibold text-white shadow-[0_10px_24px_-10px_rgb(169_80_47/0.7)] transition-colors hover:bg-[#8f4125] active:scale-[0.98] disabled:opacity-60"
              >
                {status === "loading" ? "Getting your code…" : `Get ${percent}% off`}
              </button>
              <p aria-live="polite" className="mt-2 min-h-5 text-sm text-rose-700">
                {status === "error" ? error : ""}
              </p>
              <button type="button" onClick={close} className="mt-1 w-full text-sm text-[#74594b] underline-offset-4 hover:underline">
                No thanks
              </button>
              <p className="mt-4 text-xs leading-relaxed text-[#9a8072]">
                You&apos;ll get emails from Desert Candle Works. Unsubscribe anytime. We keep your number with your
                details and won&apos;t text you unless you ask us to.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
