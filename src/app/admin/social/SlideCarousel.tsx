"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Swipeable preview of a post's slides, with arrows and dots. */
export default function SlideCarousel({ slides }: { slides: string[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  function go(i: number) {
    const el = track.current;
    if (!el) return;
    const next = Math.max(0, Math.min(slides.length - 1, i));
    // Jump straight there: a smooth scrollTo on a snap container can stall and leave the slide unchanged.
    setIndex(next);
    el.scrollLeft = next * el.clientWidth;
  }

  return (
    <div className="absolute inset-0">
      {/* Swipe / trackpad scroll between slides, snapping to each one */}
      <div
        ref={track}
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / Math.max(el.clientWidth, 1)));
        }}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((url, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={url} src={url} alt={`Slide ${i + 1}`} draggable={false} className="h-full w-full shrink-0 snap-center object-cover" />
        ))}
      </div>

      {slides.length > 1 && (
        <>
          <button
            aria-label="Previous slide"
            onClick={() => go(index - 1)}
            disabled={index === 0}
            className="absolute left-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-neutral-900 shadow disabled:opacity-0 transition-opacity"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            aria-label="Next slide"
            onClick={() => go(index + 1)}
            disabled={index === slides.length - 1}
            className="absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-neutral-900 shadow disabled:opacity-0 transition-opacity"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                aria-label={`Slide ${i + 1}`}
                onClick={() => go(i)}
                className={`h-2 rounded-full transition-colors ${i === index ? "w-5 bg-white" : "w-2 bg-white/60"}`}
              />
            ))}
          </div>
          <span className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white">
            {index + 1}/{slides.length}
          </span>
        </>
      )}
    </div>
  );
}
