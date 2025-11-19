"use client";

import { useState, useEffect } from "react";
import { Menu, X, ShoppingCart, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useCartStore } from "@/lib/cartStore";

export default function NavBar() {
  const [open, setOpen] = useState(false);
  const [shopDropdownOpen, setShopDropdownOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const totalItems = useCartStore((state) => state.getTotalItems());

  // Only render cart count after hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <div className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        {/* Logo + Name */}
        <Link href="/" className="flex items-center gap-3">
          <span className="text-base md:text-lg font-semibold tracking-tight">
            Desert Candle Works
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <Link className="hover:opacity-80 transition" href="/">Home</Link>

          {/* Shop Dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setShopDropdownOpen(true)}
            onMouseLeave={() => setShopDropdownOpen(false)}
          >
            <Link
              href="/shop"
              className="hover:opacity-80 transition flex items-center gap-1 py-2"
            >
              Shop
              <ChevronDown className="w-3 h-3" />
            </Link>
            {shopDropdownOpen && (
              <div className="absolute top-full left-0 pt-2 pb-2 z-50">
                <div className="bg-white border border-[var(--color-line)] rounded-lg shadow-lg py-2 min-w-[180px]">
                  <Link
                    href="/shop"
                    onClick={() => setShopDropdownOpen(false)}
                    className="block px-4 py-2 hover:bg-neutral-50 transition"
                  >
                    All Candles
                  </Link>
                  <Link
                    href="/shop/young-dumb"
                    onClick={() => setShopDropdownOpen(false)}
                    className="block px-4 py-2 hover:bg-neutral-50 transition"
                  >
                    <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent font-semibold">
                      Young & Dumb
                    </span>
                  </Link>
                </div>
              </div>
            )}
          </div>

          <Link className="hover:opacity-80 transition" href="/about">About</Link>
          <Link className="hover:opacity-80 transition" href="/contact">Contact</Link>
          <div className="flex items-center gap-3 ml-2 pl-4 border-l border-[var(--color-line)]">
            <Link
              href="/cart"
              className="relative text-[var(--color-muted)] hover:text-[var(--color-ink)] transition"
              aria-label="Shopping cart"
            >
              <ShoppingCart className="w-5 h-5" />
              {mounted && totalItems > 0 && (
                <span className="absolute -top-2 -right-2 bg-[var(--color-accent)] text-[var(--color-accent-ink)] text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </Link>
            <div className="h-5 w-px bg-[var(--color-line)]" />
            <a
              href="https://www.instagram.com/desertcandleworks/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-muted)] hover:text-[var(--color-ink)] transition"
              aria-label="Visit our Instagram"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" />
              </svg>
            </a>
            <a
              href="https://www.facebook.com/profile.php?id=61582095448990"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-muted)] hover:text-[var(--color-ink)] transition"
              aria-label="Visit our Facebook page"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
              </svg>
            </a>
          </div>
        </nav>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="md:hidden p-2 text-[var(--color-ink)] hover:opacity-80 transition"
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="md:hidden border-t border-[var(--color-line)] bg-white/95 backdrop-blur-sm">
          <nav className="flex flex-col items-center py-5 space-y-4 text-sm">
            <Link href="/" onClick={() => setOpen(false)} className="hover:opacity-80 transition">Home</Link>

            {/* Shop section */}
            <div className="flex flex-col items-center space-y-2">
              <Link href="/shop" onClick={() => setOpen(false)} className="hover:opacity-80 transition font-medium">Shop</Link>
              <div className="flex flex-col items-center space-y-2 pl-4 text-xs">
                <Link href="/shop" onClick={() => setOpen(false)} className="hover:opacity-80 transition">All Candles</Link>
                <Link href="/shop/young-dumb" onClick={() => setOpen(false)} className="hover:opacity-80 transition bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent font-semibold">Young & Dumb</Link>
              </div>
            </div>

            <Link href="/about" onClick={() => setOpen(false)} className="hover:opacity-80 transition">About</Link>
            <Link href="/contact" onClick={() => setOpen(false)} className="hover:opacity-80 transition">Contact</Link>
            <Link
              href="/cart"
              onClick={() => setOpen(false)}
              className="relative flex items-center gap-2 hover:opacity-80 transition"
            >
              <ShoppingCart className="w-5 h-5" />
              <span>Cart {mounted && totalItems > 0 && `(${totalItems})`}</span>
            </Link>
            <div className="flex items-center gap-4 pt-2 border-t border-[var(--color-line)] mt-2">
              <a
                href="https://www.instagram.com/desertcandleworks/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-muted)] hover:text-[var(--color-ink)] transition"
                aria-label="Visit our Instagram"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" />
                </svg>
              </a>
              <a
                href="https://www.facebook.com/profile.php?id=61582095448990"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-muted)] hover:text-[var(--color-ink)] transition"
                aria-label="Visit our Facebook page"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                </svg>
              </a>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}