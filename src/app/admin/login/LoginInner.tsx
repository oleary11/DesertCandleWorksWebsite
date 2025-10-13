"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function LoginInner() {
  const sp = useSearchParams();
  const next = sp.get("next") || "/admin";
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    fd.append("next", next);

    const res = await fetch("/api/admin/login", { method: "POST", body: fd });
    if (res.ok) {
      // server sets cookie + redirects URL in JSON for fetch; or use 303 redirect if form-posting
      try {
        const j = await res.json();
        if (j?.redirect) {
          window.location.href = j.redirect as string;
          return;
        }
      } catch {
        // If API used 303 redirect, browser already navigated on real form posts
      }
      window.location.href = next;
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Invalid password");
    }
    setSubmitting(false);
  }

  // Optional: autofocus password
  useEffect(() => {
    (document.getElementById("pw") as HTMLInputElement | null)?.focus();
  }, []);

  return (
    <section className="min-h-dvh flex items-center justify-center p-6">
      <div className="card p-6 w-[420px] max-w-[95vw]">
        <h1 className="text-xl font-semibold">Admin login</h1>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          Enter the admin password to continue.
        </p>

        <form className="mt-4 space-y-4" onSubmit={onSubmit}>
          <input type="hidden" name="next" value={next} />
          <label className="block">
            <div className="text-xs mb-1">Password</div>
            <input
              id="pw"
              className="input w-full"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>

          {error && <p className="text-rose-600 text-sm">{error}</p>}

          <button className="btn btn-primary w-full" type="submit" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </section>
  );
}