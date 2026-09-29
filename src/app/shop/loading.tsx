import s from "@/components/home/home.module.css";

const bar = "rounded-full bg-[#eadccf] motion-safe:animate-pulse";

export default function Loading() {
  return (
    <div className={`${s.page} s-ui`} aria-busy="true" aria-label="Loading the shop">
      {/* Header band */}
      <div className={`${s.paper} px-6 pb-10 pt-14 sm:pt-20`}>
        <div className="mx-auto max-w-7xl">
          <div className={`${bar} h-3 w-24`} />
          <div className={`${bar} mt-5 h-11 w-full max-w-md`} />
          <div className={`${bar} mt-5 h-9 w-72 max-w-full`} />
          <div className="mt-8 flex gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`${bar} h-10 w-28`} />
            ))}
          </div>
        </div>
      </div>

      <div className={`${s.cream} px-6 pb-20 pt-8`}>
        <div className="mx-auto flex max-w-7xl gap-12">
          <aside className="hidden w-64 shrink-0 space-y-7 lg:block">
            {[1, 2].map((group) => (
              <div key={group}>
                <div className={`${bar} mb-3 h-3 w-24`} />
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className={`${bar} h-10 w-24`} />
                  ))}
                </div>
              </div>
            ))}
          </aside>

          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className={`${bar} h-11 flex-1`} />
              <div className={`${bar} h-11 sm:w-48`} />
            </div>
            <div className={`${bar} mb-5 mt-10 h-7 w-48`} />
            <div className="grid grid-cols-2 gap-x-4 gap-y-9 sm:gap-x-6 md:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i}>
                  <div className="aspect-[4/5] rounded-2xl bg-[#eadccf] motion-safe:animate-pulse" />
                  <div className={`${bar} mt-4 h-4 w-3/4`} />
                  <div className={`${bar} mt-2 h-3 w-1/3`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
