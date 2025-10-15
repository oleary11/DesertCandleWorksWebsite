"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function EntrancePage() {
  const router = useRouter();
  const [flicker, setFlicker] = useState(1);
  const [isOpening, setIsOpening] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Check if user has already visited
    const hasVisited = localStorage.getItem("dcw_has_visited");
    if (hasVisited === "true") {
      router.push("/");
      return;
    }

    // Candlelight flicker effect
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    const interval = setInterval(() => {
      if (isMobile) {
        setFlicker(0.96 + Math.random() * 0.04);
      } else {
        setFlicker(0.92 + Math.random() * 0.08);
      }
    }, isMobile ? 300 : 200);

    return () => clearInterval(interval);
  }, [router]);

  const handleEnter = () => {
    setIsOpening(true);
    // Mark as visited
    localStorage.setItem("dcw_has_visited", "true");

    // Wait for door animation to complete before navigating
    setTimeout(() => {
      router.push("/");
    }, 2000); // 2 second animation
  };

  // Deterministic particles for SSR safety
  const PARTICLES = Array.from({ length: 20 }, (_, i) => {
    const seed = i * 12345;
    const pseudoRandom1 = ((seed * 9301 + 49297) % 233280) / 233280;
    const pseudoRandom2 = (((seed + 1) * 9301 + 49297) % 233280) / 233280;
    const pseudoRandom3 = (((seed + 2) * 9301 + 49297) % 233280) / 233280;
    const pseudoRandom4 = (((seed + 3) * 9301 + 49297) % 233280) / 233280;

    return {
      top: pseudoRandom1 * 100,
      left: pseudoRandom2 * 100,
      delay: pseudoRandom3 * 3,
      duration: 2 + pseudoRandom4 * 2,
    };
  });

  if (!mounted) {
    return null; // Prevent hydration mismatch
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0806] flex items-center justify-center">
      {/* Candlelight glow effect */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(
            ellipse 60% 70% at 50% 50%,
            rgba(255, 247, 237, ${0.15 * flicker}),
            rgba(255, 237, 213, ${0.1 * flicker}),
            rgba(245, 222, 179, ${0.06 * flicker}),
            rgba(210, 180, 140, ${0.03 * flicker}),
            transparent 70%
          )`,
          transition: "background 0.15s ease-out",
        }}
      />

      {/* Dark vignette edges */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(
            ellipse 70% 75% at 50% 50%,
            transparent 0%,
            transparent 50%,
            rgba(0, 0, 0, 0.4) 75%,
            rgba(0, 0, 0, 0.8) 95%,
            rgba(0, 0, 0, 0.95) 100%
          )`
        }}
      />

      {/* Floating particles */}
      {PARTICLES.map((particle, idx) => (
        <div
          key={idx}
          className="absolute w-1 h-1 rounded-full bg-amber-200/30"
          style={{
            top: `${particle.top}%`,
            left: `${particle.left}%`,
            animation: `float ${particle.duration}s ease-in-out ${particle.delay}s infinite alternate`,
            opacity: 0.3 * flicker,
          }}
        />
      ))}

      {/* Door overlay - splits and opens */}
      <div
        className={`absolute inset-0 z-20 transition-all duration-[2000ms] ease-in-out ${
          isOpening ? "pointer-events-none" : ""
        }`}
      >
        {/* Left door */}
        <div
          className={`absolute inset-y-0 left-0 w-1/2 bg-[#0a0806] border-r border-amber-900/30 transition-transform duration-[2000ms] ease-in-out ${
            isOpening ? "-translate-x-full" : "translate-x-0"
          }`}
          style={{
            boxShadow: isOpening ? "10px 0 50px rgba(255, 237, 213, 0.3)" : "none",
          }}
        />

        {/* Right door */}
        <div
          className={`absolute inset-y-0 right-0 w-1/2 bg-[#0a0806] border-l border-amber-900/30 transition-transform duration-[2000ms] ease-in-out ${
            isOpening ? "translate-x-full" : "translate-x-0"
          }`}
          style={{
            boxShadow: isOpening ? "-10px 0 50px rgba(255, 237, 213, 0.3)" : "none",
          }}
        />
      </div>

      {/* Main content */}
      <div className="relative z-10 text-center px-6 max-w-2xl">
        <h1
          className="text-5xl md:text-7xl font-bold mb-6 transition-opacity duration-500"
          style={{
            color: "#fffbeb",
            textShadow: `0 0 20px rgba(255, 247, 237, ${0.3 * flicker})`,
            opacity: isOpening ? 0 : 1,
          }}
        >
          Desert Candle Works
        </h1>

        <p
          className="text-lg md:text-xl mb-8 transition-opacity duration-500"
          style={{
            color: "#fef3c7",
            opacity: isOpening ? 0 : 0.9,
          }}
        >
          Hand-poured candles in upcycled bottles
        </p>

        <p
          className="text-sm md:text-base mb-12 max-w-md mx-auto transition-opacity duration-500"
          style={{
            color: "#fde68a",
            opacity: isOpening ? 0 : 0.7,
          }}
        >
          Each candle is carefully crafted to bring warmth and light to your space,
          transforming reclaimed bottles into beautiful, sustainable treasures.
        </p>

        <button
          onClick={handleEnter}
          disabled={isOpening}
          className="group relative px-8 py-4 text-lg font-medium rounded-xl transition-all duration-300 disabled:opacity-0"
          style={{
            background: `linear-gradient(180deg,
              rgba(251, 191, 36, ${0.2 * flicker}),
              rgba(245, 158, 11, ${0.15 * flicker})
            )`,
            border: `2px solid rgba(251, 191, 36, ${0.4 * flicker})`,
            color: "#fef3c7",
            boxShadow: `0 4px 20px rgba(251, 191, 36, ${0.2 * flicker})`,
          }}
        >
          <span className="relative z-10">Enter</span>
          <div
            className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{
              background: `radial-gradient(circle at center,
                rgba(251, 191, 36, 0.2),
                transparent 70%
              )`,
            }}
          />
        </button>
      </div>

      {/* CSS for floating animation */}
      <style jsx>{`
        @keyframes float {
          from {
            transform: translateY(0) translateX(0);
          }
          to {
            transform: translateY(-20px) translateX(10px);
          }
        }
      `}</style>
    </div>
  );
}
