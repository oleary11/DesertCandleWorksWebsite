export default function Loading() {
  return (
    <>
      {/* Free Shipping Banner Skeleton */}
      <div className="full-bleed bg-gradient-to-r from-blue-600 to-blue-700 py-3">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <div className="h-5 bg-blue-500/30 rounded w-96 mx-auto animate-pulse" />
        </div>
      </div>

      {/* Header Skeleton */}
      <div className="full-bleed relative isolate py-12 sm:py-16">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-white/70 to-white/90 backdrop-blur-[2px]" />
        <div className="mx-auto max-w-6xl px-6 text-center">
          <div className="h-10 bg-neutral-200 rounded-lg w-80 mx-auto mb-4 animate-pulse" />
          <div className="h-5 bg-neutral-200 rounded w-96 mx-auto mb-2 animate-pulse" />
          <div className="h-4 bg-neutral-200 rounded w-48 mx-auto animate-pulse" />
        </div>
      </div>

      {/* Mobile Filters Skeleton */}
      <div className="lg:hidden px-6 mb-8">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 h-12 bg-neutral-200 rounded-lg animate-pulse" />
          <div className="flex-1 h-12 bg-neutral-200 rounded-lg animate-pulse" />
        </div>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-9 w-24 bg-neutral-200 rounded-full animate-pulse" />
          ))}
        </div>
      </div>

      {/* Main Content Skeleton */}
      <div className="px-6 pb-12">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
            {/* Desktop Sidebar Skeleton */}
            <aside className="hidden lg:block lg:w-64 flex-shrink-0">
              <div className="space-y-6">
                {/* Collections */}
                <div>
                  <div className="h-4 bg-neutral-200 rounded w-24 mb-3 animate-pulse" />
                  <div className="h-6 bg-neutral-200 rounded w-full animate-pulse" />
                </div>
                {/* Availability */}
                <div>
                  <div className="h-4 bg-neutral-200 rounded w-24 mb-3 animate-pulse" />
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-10 bg-neutral-200 rounded-lg animate-pulse" />
                    ))}
                  </div>
                </div>
                {/* Sort */}
                <div>
                  <div className="h-4 bg-neutral-200 rounded w-16 mb-3 animate-pulse" />
                  <div className="h-10 bg-neutral-200 rounded-lg animate-pulse" />
                </div>
              </div>
            </aside>

            {/* Product Grid Skeleton */}
            <div className="flex-1 mx-auto max-w-6xl">
              <div className="grid gap-5 sm:gap-6 grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="card overflow-hidden">
                    {/* Image skeleton */}
                    <div className="aspect-[3/4] bg-neutral-200 animate-pulse" />
                    {/* Content skeleton */}
                    <div className="p-4 space-y-3">
                      <div className="h-5 bg-neutral-200 rounded w-3/4 animate-pulse" />
                      <div className="h-4 bg-neutral-200 rounded w-1/2 animate-pulse" />
                      <div className="h-3 bg-neutral-200 rounded w-16 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
