"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function NavBar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        {/* Logo + Name */}
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/images/logo.png"
            alt="Desert Candle Works logo"
            className="w-8 h-8 object-contain"
          />
          <span className="text-lg font-semibold tracking-tight">Desert Candle Works</span>
        </Link>

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
            <Link href="/" onClick={() => setOpen(false)} className="hover:opacity-80 transition">Home</Link>
            <Link href="/shop" onClick={() => setOpen(false)} className="hover:opacity-80 transition">Shop</Link>
            <Link href="/about" onClick={() => setOpen(false)} className="hover:opacity-80 transition">About</Link>
            <Link href="/contact" onClick={() => setOpen(false)} className="hover:opacity-80 transition">Contact</Link>
          </nav>
        </div>
      )}
    </>
  );
}