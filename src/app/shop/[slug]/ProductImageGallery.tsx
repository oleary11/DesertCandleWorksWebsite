"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  images: string[];
  productName: string;
};

export default function ProductImageGallery({ images, productName }: Props) {
  const [index, setIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className="flex aspect-[4/5] items-center justify-center rounded-3xl bg-[#efe3d6] text-[var(--home-muted)]">
        Photo coming soon
      </div>
    );
  }

  const many = images.length > 1;
  const go = (next: number) => setIndex((next + images.length) % images.length);

  return (
    <div className="lg:sticky lg:top-28">
      <div
        className="group relative aspect-[4/5] overflow-hidden rounded-3xl bg-[#efe3d6] shadow-[0_1px_2px_rgb(63_42_33/0.06),0_24px_50px_-24px_rgb(63_42_33/0.45)]"
        role={many ? "region" : undefined}
        aria-roledescription={many ? "carousel" : undefined}
        aria-label={many ? `${productName} photos` : undefined}
        tabIndex={many ? 0 : undefined}
        onKeyDown={(e) => {
          if (!many) return;
          if (e.key === "ArrowRight") go(index + 1);
          if (e.key === "ArrowLeft") go(index - 1);
        }}
      >
        <Image
          key={images[index]}
          src={images[index]}
          alt={`${productName}, photo ${index + 1} of ${images.length}`}
          fill
          className="object-cover motion-safe:animate-[fadeIn_200ms_ease-out]"
          priority={index === 0}
          sizes="(min-width: 1024px) 55vw, 100vw"
        />

        {many && (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label="Previous photo"
              className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[var(--home-ink)] shadow-md transition-opacity hover:bg-white focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-clay)] md:opacity-0 md:group-hover:opacity-100"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label="Next photo"
              className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[var(--home-ink)] shadow-md transition-opacity hover:bg-white focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-clay)] md:opacity-0 md:group-hover:opacity-100"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
            <p className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-xs tabular-nums text-white" aria-live="polite">
              {index + 1} / {images.length}
            </p>
          </>
        )}
      </div>

      {many && (
        <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={img}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show photo ${i + 1}`}
              aria-current={i === index}
              className={`relative h-20 w-16 shrink-0 overflow-hidden rounded-xl transition ${
                i === index ? "ring-2 ring-[var(--home-ink)] ring-offset-2 ring-offset-[var(--home-cream)]" : "opacity-70 hover:opacity-100"
              } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-clay)]`}
            >
              <Image src={img} alt="" fill className="object-cover" sizes="64px" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
