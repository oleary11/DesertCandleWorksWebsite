"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import s from "@/components/home/home.module.css";
import { serif } from "@/lib/storefrontFonts";

/**
 * Storefront dialog: a bottom sheet on phones, a centered card on larger
 * screens. Portaled to <body> so card hover transforms can't trap it, and it
 * carries the storefront scope (.s-ui) and colour tokens itself.
 */
export default function ShopDialog({
  title,
  subtitle,
  onClose,
  busy,
  footer,
  size = "md",
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  onClose: () => void;
  /** While true, backdrop clicks and Escape don't close (e.g. a request is in flight). */
  busy?: boolean;
  footer?: React.ReactNode;
  size?: "md" | "lg";
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const busyRef = useRef(busy);
  busyRef.current = busy;

  useEffect(() => {
    setMounted(true);
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busyRef.current) onCloseRef.current();
      // Keep Tab inside the dialog.
      if (e.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  useEffect(() => {
    if (mounted) panelRef.current?.focus();
  }, [mounted]);

  if (!mounted) return null;

  const width = size === "lg" ? "sm:max-w-2xl" : "sm:max-w-md";

  return createPortal(
    <div className={`${s.page} s-ui fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4`}>
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        className="absolute inset-0 cursor-default bg-[rgb(40_24_16/0.45)] backdrop-blur-[2px] motion-safe:animate-[fadeIn_150ms_ease-out]"
        onClick={() => !busy && onClose()}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shop-dialog-title"
        tabIndex={-1}
        className={`relative flex max-h-[92dvh] w-full ${width} flex-col overflow-hidden rounded-t-3xl bg-[var(--home-cream)] shadow-[0_30px_80px_-20px_rgb(40_24_16/0.55)] outline-none sm:rounded-3xl motion-safe:animate-[sheetIn_220ms_cubic-bezier(.22,.61,.36,1)]`}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-[var(--home-line)] sm:hidden" aria-hidden />
        <div className="flex shrink-0 items-start justify-between gap-4 px-6 pb-3 pt-4 sm:pt-6">
          <div className="min-w-0">
            <h2 id="shop-dialog-title" className={`${serif.className} text-2xl leading-tight text-[var(--home-ink)]`}>
              {title}
            </h2>
            {subtitle && <div className="mt-1 text-sm text-[var(--home-muted)]">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="-mr-2 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--home-muted)] transition-colors hover:bg-[var(--home-sand)] hover:text-[var(--home-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-clay)]"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-4">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-[var(--home-line)] bg-[var(--home-cream)] px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
