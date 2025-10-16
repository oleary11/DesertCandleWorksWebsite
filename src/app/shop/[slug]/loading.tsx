export default function Loading() {
  return (
    <section className="pt-8 md:pt-12 px-6">
      <article className="mx-auto max-w-6xl grid gap-8 md:gap-10 md:grid-cols-2 items-start pb-14">
        {/* Image Skeleton */}
        <div className="relative w-full aspect-[4/5] md:aspect-[3/4] max-h-[56svh] md:max-h-[60svh] overflow-hidden rounded-lg md:rounded-xl bg-neutral-200 animate-pulse" />

        {/* Content Skeleton */}
        <div>
          {/* Title */}
          <div className="h-10 bg-neutral-200 rounded-lg w-3/4 mb-3 animate-pulse" />

          {/* Description */}
          <div className="space-y-2 mb-6">
            <div className="h-4 bg-neutral-200 rounded w-full animate-pulse" />
            <div className="h-4 bg-neutral-200 rounded w-5/6 animate-pulse" />
          </div>

          {/* Price */}
          <div className="h-7 bg-neutral-200 rounded w-24 mb-8 animate-pulse" />

          {/* Variant Selectors */}
          <div className="space-y-6">
            {/* Scent Collection Toggle */}
            <div>
              <div className="h-5 bg-neutral-200 rounded w-32 mb-2 animate-pulse" />
              <div className="flex gap-3">
                <div className="flex-1 h-12 bg-neutral-200 rounded-xl animate-pulse" />
                <div className="flex-1 h-12 bg-neutral-200 rounded-xl animate-pulse" />
              </div>
            </div>

            {/* Wick Type */}
            <div>
              <div className="h-5 bg-neutral-200 rounded w-24 mb-2 animate-pulse" />
              <div className="h-12 bg-neutral-200 rounded-lg animate-pulse" />
            </div>

            {/* Scent */}
            <div>
              <div className="h-5 bg-neutral-200 rounded w-16 mb-2 animate-pulse" />
              <div className="h-12 bg-neutral-200 rounded-lg animate-pulse" />
            </div>

            {/* Quantity */}
            <div>
              <div className="h-5 bg-neutral-200 rounded w-20 mb-2 animate-pulse" />
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-neutral-200 rounded-lg animate-pulse" />
                <div className="h-8 w-16 bg-neutral-200 rounded animate-pulse" />
                <div className="h-12 w-12 bg-neutral-200 rounded-lg animate-pulse" />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <div className="flex-1 h-12 bg-neutral-200 rounded-xl animate-pulse" />
              <div className="flex-1 h-12 bg-neutral-200 rounded-xl animate-pulse" />
            </div>
          </div>
        </div>
      </article>
    </section>
  );
}
