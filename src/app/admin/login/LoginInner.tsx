"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function LoginInner() {
  const sp = useSearchParams();
  const next = sp.get("next") || "/admin";
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    fd.append("next", next);

    const res = await fetch("/api/admin/login", { method: "POST", body: fd });
    const j = await res.json().catch(() => ({}));

    if (res.ok) {
      if (j?.requiresTwoFactor) {
        // Password correct, but need 2FA code
        setNeedsTwoFactor(true);
        setError(null);
        setSubmitting(false);
        setTimeout(() => {
          (document.getElementById("twoFactorToken") as HTMLInputElement | null)?.focus();
        }, 100);
        return;
      }

      // Full login success
      if (j?.redirect) {
        window.location.href = j.redirect as string;
        return;
      }
      window.location.href = next;
    } else {
      setError(j.error || "Invalid credentials");
      setSubmitting(false);
    }
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
          {needsTwoFactor
            ? "Enter your 2FA code to continue"
            : "Enter the admin password to continue"}
        </p>

        <form className="mt-4 space-y-4" onSubmit={onSubmit}>
          <input type="hidden" name="next" value={next} />

          {!needsTwoFactor && (
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
          )}

          {needsTwoFactor && (
            <label className="block">
              <div className="text-xs mb-1">2FA Code</div>
              <input
                id="twoFactorToken"
                className="input w-full"
                name="twoFactorToken"
                type="text"
                placeholder="Enter 6-digit code"
                autoComplete="one-time-code"
                required
                maxLength={6}
                pattern="[0-9]{6}"
              />
              <div className="text-xs text-[var(--color-muted)] mt-1">
                Enter the code from your authenticator app or a backup code
              </div>
            </label>
          )}

          {error && <p className="text-rose-600 text-sm">{error}</p>}

          <button className="btn btn-primary w-full" type="submit" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>

          {needsTwoFactor && (
            <button
              type="button"
              onClick={() => {
                setNeedsTwoFactor(false);
                setError(null);
              }}
              className="text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)] w-full text-center"
            >
              ← Back to password
            </button>
          )}
        </form>
      </div>
    </section>
  );
}