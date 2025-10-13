"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";

export default function NavBar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        {/* Logo + Name */}
        <a href="/" className="flex items-center gap-2">
          <img
            src="/images/logo.png"
            alt="Desert Candle Works logo"
            className="w-8 h-8 object-contain"
          />
          <span className="text-lg font-semibold tracking-tight">Desert Candle Works</span>
        </a>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <a className="hover:opacity-80 transition" href="/">Home</a>
          <a className="hover:opacity-80 transition" href="/shop">Shop</a>
          <a className="hover:opacity-80 transition" href="/about">About</a>
          <a className="hover:opacity-80 transition" href="/contact">Contact</a>
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
            <a href="/" onClick={() => setOpen(false)} className="hover:opacity-80 transition">Home</a>
            <a href="/shop" onClick={() => setOpen(false)} className="hover:opacity-80 transition">Shop</a>
            <a href="/about" onClick={() => setOpen(false)} className="hover:opacity-80 transition">About</a>
            <a href="/contact" onClick={() => setOpen(false)} className="hover:opacity-80 transition">Contact</a>
          </nav>
        </div>
      )}
    </>
  );
}