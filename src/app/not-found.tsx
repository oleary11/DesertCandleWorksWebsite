// app/not-found.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Generate consistent particle positions (no hydration mismatch)
const PARTICLES = Array.from({ length: 20 }, (_, i) => {
  const seed = i * 12345; // Deterministic seed
  const pseudoRandom1 = ((seed * 9301 + 49297) % 233280) / 233280;
  const pseudoRandom2 = ((seed * 15731 + 789221) % 233280) / 233280;
  const pseudoRandom3 = ((seed * 22695477 + 1) % 233280) / 233280;
  const pseudoRandom4 = ((seed * 43758 + 5453) % 233280) / 233280;

  return {
    top: pseudoRandom1 * 100,
    left: pseudoRandom2 * 100,
    delay: pseudoRandom3 * 3,
    duration: 2 + pseudoRandom4 * 2,
  };
});

export default function NotFound() {
  const [flicker, setFlicker] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      // Random flicker intensity between 0.92 and 1 (more subtle)
      setFlicker(0.92 + Math.random() * 0.08);
    }, 200);

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative min-h-dvh flex items-center justify-center px-6 py-12 overflow-hidden bg-gradient-to-b from-neutral-900 to-black">
      {/* Radial candlelight glow with flicker effect */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-150"
        style={{
          background: `radial-gradient(ellipse 1000px 1100px at center,
            rgba(255, 210, 120, ${0.45 * flicker}) 0%,
            rgba(255, 190, 100, ${0.35 * flicker}) 15%,
            rgba(255, 160, 70, ${0.25 * flicker}) 30%,
            rgba(220, 140, 60, ${0.18 * flicker}) 45%,
            rgba(120, 80, 30, ${0.12 * flicker}) 60%,
            transparent 75%)`,
          opacity: flicker,
        }}
      />

      {/* Content area - oval candlelight zone */}
      <div className="relative z-10 max-w-2xl w-full">
        {/* Glowing oval background - mimics candlelight pool */}
        <div
          className="absolute inset-0 -inset-x-16 -inset-y-12 rounded-[50%] transition-opacity duration-150 blur-2xl"
          style={{
            background: `radial-gradient(ellipse at center,
              rgba(255, 230, 170, ${0.5 * flicker}),
              rgba(255, 210, 140, ${0.4 * flicker}) 40%,
              rgba(255, 190, 120, ${0.25 * flicker}) 70%,
              transparent)`,
            opacity: flicker,
          }}
        />

        {/* Content container */}
        <div className="relative p-10 text-center">
          {/* Flickering candle flame */}
          <div className="relative inline-block mb-6">
            <div
              className="text-7xl transition-all duration-150"
              style={{
                filter: `brightness(${flicker}) drop-shadow(0 0 ${25 * flicker}px rgba(255, 180, 80, 0.9)) drop-shadow(0 0 ${40 * flicker}px rgba(255, 150, 50, 0.5))`,
                transform: `scale(${0.98 + 0.02 * flicker})`,
              }}
              aria-hidden
            >
              🕯️
            </div>
          </div>

          <h1
            className="text-3xl font-semibold tracking-tight transition-colors duration-150"
            style={{
              color: `rgba(${30 + 20 * flicker}, ${20 + 15 * flicker}, ${10 + 10 * flicker}, 1)`,
            }}
          >
            404 — Wick&apos;d Problem
          </h1>

          <p
            className="mt-4 text-base leading-relaxed transition-colors duration-150"
            style={{
              color: `rgba(${50 + 30 * flicker}, ${35 + 20 * flicker}, ${20 + 15 * flicker}, 0.9)`,
            }}
          >
            We looked everywhere, but this page has <em>burned out</em>.
            Try heading back before the wax sets.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/"
              className="
                w-full sm:w-auto
                inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-medium
                bg-gradient-to-b from-amber-500 to-amber-600
                text-white
                shadow-[0_4px_20px_rgba(245,158,11,0.5)]
                hover:shadow-[0_6px_30px_rgba(245,158,11,0.7)]
                hover:-translate-y-0.5 transition-all
              "
            >
              Take me home
            </Link>

            <Link
              href="/shop"
              className="
                w-full sm:w-auto
                inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-medium
                bg-amber-100/30 backdrop-blur-sm
                text-amber-100
                border border-amber-200/30
                hover:bg-amber-100/40 hover:border-amber-200/50
                transition-all
              "
            >
              Shop candles
            </Link>
          </div>

          <div className="mt-6 pt-6 border-t border-amber-200/30">
            <p className="text-xs mb-3 text-amber-50">
              Tip: if you typed the URL, double-check the spelling.
            </p>
            <div className="flex items-center justify-center gap-4 text-xs">
              <Link
                href="/about"
                className="transition underline hover:decoration-amber-200"
                style={{ color: '#fffbeb', textDecorationColor: 'rgba(255, 251, 235, 0.5)' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#fde68a'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#fffbeb'}
              >
                About
              </Link>
              <span style={{ color: '#fffbeb' }}>•</span>
              <Link
                href="/contact"
                className="transition underline hover:decoration-amber-200"
                style={{ color: '#fffbeb', textDecorationColor: 'rgba(255, 251, 235, 0.5)' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#fde68a'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#fffbeb'}
              >
                Contact
              </Link>
              <span style={{ color: '#fffbeb' }}>•</span>
              <Link
                href="/policies"
                className="transition underline hover:decoration-amber-200"
                style={{ color: '#fffbeb', textDecorationColor: 'rgba(255, 251, 235, 0.5)' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#fde68a'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#fffbeb'}
              >
                Policies
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Subtle particles/sparkles effect - no hydration issues */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        {PARTICLES.map((particle, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-amber-300 rounded-full animate-pulse"
            style={{
              top: `${particle.top}%`,
              left: `${particle.left}%`,
              animationDelay: `${particle.delay}s`,
              animationDuration: `${particle.duration}s`,
            }}
          />
        ))}
      </div>
    </section>
  );
}