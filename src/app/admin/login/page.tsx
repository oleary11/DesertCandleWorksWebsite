// app/admin/login/page.tsx
import { Suspense } from "react";
import LoginInner from "./LoginInner";

// Make this page dynamic so SSG doesn't try to pre-render with unknown search params
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <section className="min-h-dvh flex items-center justify-center p-6">
          <div className="card p-6">Loading…</div>
        </section>
      }
    >
      <LoginInner />
    </Suspense>
  );
}