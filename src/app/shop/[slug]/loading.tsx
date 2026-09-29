import s from "@/components/home/home.module.css";

const bar = "rounded-full bg-[#eadccf] motion-safe:animate-pulse";

export default function Loading() {
  return (
    <div className={`${s.page} s-ui`} aria-busy="true" aria-label="Loading product">
      <section className={`${s.cream} px-6 pb-20 pt-6`}>
        <div className={`${bar} mx-auto mb-6 h-3 w-48 max-w-7xl`} />

        <div className="mx-auto grid max-w-7xl items-start gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-7">
            <div className="aspect-[4/5] rounded-3xl bg-[#eadccf] motion-safe:animate-pulse" />
            <div className="mt-4 flex gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-20 w-16 rounded-xl bg-[#eadccf] motion-safe:animate-pulse" />
              ))}
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className={`${bar} h-3 w-24`} />
            <div className={`${bar} mt-4 h-10 w-4/5`} />
            <div className="mt-5 space-y-2">
              <div className={`${bar} h-4 w-full`} />
              <div className={`${bar} h-4 w-11/12`} />
              <div className={`${bar} h-4 w-2/3`} />
            </div>

            <div className="mt-10 space-y-8">
              {[3, 2, 6].map((count, row) => (
                <div key={row}>
                  <div className={`${bar} mb-3 h-4 w-28`} />
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: count }, (_, i) => (
                      <div key={i} className="h-11 w-28 rounded-xl bg-[#eadccf] motion-safe:animate-pulse" />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 grid gap-3 border-t border-[var(--home-line)] pt-6 sm:grid-cols-2">
              <div className={`${bar} h-12`} />
              <div className={`${bar} h-12`} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
