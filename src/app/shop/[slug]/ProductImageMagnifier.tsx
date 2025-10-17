"use client";

import Image from "next/image";
import { useState, useRef, MouseEvent } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";

type ProductImageMagnifierProps = {
  src: string;
  alt: string;
};

export default function ProductImageMagnifier({ src, alt }: ProductImageMagnifierProps) {
  const [magnifierEnabled, setMagnifierEnabled] = useState(false);
  const [showMagnifier, setShowMagnifier] = useState(false);
  const [magnifierPosition, setMagnifierPosition] = useState({ x: 0, y: 0 });
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const imgRef = useRef<HTMLDivElement>(null);

  const magnifierSize = 250;
  const zoomLevel = 2.5;

  const handleMouseEnter = () => {
    if (magnifierEnabled) {
      setShowMagnifier(true);
    }
  };

  const handleMouseLeave = () => {
    setShowMagnifier(false);
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!imgRef.current || !magnifierEnabled) return;

    const rect = imgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Cursor position for magnifier placement
    setCursorPosition({ x: e.clientX, y: e.clientY });

    // Position on the image for magnified view
    setMagnifierPosition({ x, y });
  };

  const toggleMagnifier = () => {
    setMagnifierEnabled(!magnifierEnabled);
    setShowMagnifier(false);
  };

  return (
    <>
      <div
        ref={imgRef}
        className={`relative w-full h-full ${magnifierEnabled ? "cursor-crosshair" : ""}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
      >
        {/* Toggle Button - Hidden on mobile */}
        <button
          onClick={toggleMagnifier}
          className="hidden md:block absolute top-3 right-3 z-[1001] p-2 rounded-lg bg-white/90 backdrop-blur-sm border border-[var(--color-line)] shadow-sm hover:bg-white transition-colors"
          aria-label={magnifierEnabled ? "Disable magnifier" : "Enable magnifier"}
          title={magnifierEnabled ? "Disable magnifier" : "Enable magnifier"}
        >
          {magnifierEnabled ? (
            <ZoomOut className="w-5 h-5 text-[var(--color-ink)]" />
          ) : (
            <ZoomIn className="w-5 h-5 text-[var(--color-ink)]" />
          )}
        </button>

        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover"
          sizes="(min-width: 1024px) 540px, 90vw"
          quality={90}
          priority
        />
      </div>

      {/* Magnifier lens */}
      {showMagnifier && (
        <div
          style={{
            position: "fixed",
            left: `${cursorPosition.x - magnifierSize / 2}px`,
            top: `${cursorPosition.y - magnifierSize / 2}px`,
            width: `${magnifierSize}px`,
            height: `${magnifierSize}px`,
            pointerEvents: "none",
            border: "3px solid rgba(255, 255, 255, 0.9)",
            borderRadius: "50%",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
            backgroundImage: `url(${src})`,
            backgroundRepeat: "no-repeat",
            backgroundSize: `${(imgRef.current?.offsetWidth || 0) * zoomLevel}px ${
              (imgRef.current?.offsetHeight || 0) * zoomLevel
            }px`,
            backgroundPosition: `-${magnifierPosition.x * zoomLevel - magnifierSize / 2}px -${
              magnifierPosition.y * zoomLevel - magnifierSize / 2
            }px`,
            zIndex: 1000,
          }}
        />
      )}
    </>
  );
}
