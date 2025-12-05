"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function LoginInner() {
  const sp = useSearchParams();
  const next = sp.get("next") || "/admin";
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
        // Store email and password so we can send them again with 2FA token
        const emailValue = fd.get("email")?.toString() || "";
        const passwordValue = fd.get("password")?.toString() || "";
        setEmail(emailValue);
        setPassword(passwordValue);
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

  // Optional: autofocus email field
  useEffect(() => {
    (document.getElementById("email") as HTMLInputElement | null)?.focus();
  }, []);

  return (
    <section className="min-h-dvh flex items-center justify-center p-6">
      <div className="card p-6 w-[420px] max-w-[95vw]">
        <h1 className="text-xl font-semibold">Admin login</h1>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          {needsTwoFactor
            ? "Enter your 2FA code to continue"
            : "Enter your admin credentials to continue"}
        </p>

        <form className="mt-4 space-y-4" onSubmit={onSubmit}>
          <input type="hidden" name="next" value={next} />

          {!needsTwoFactor ? (
            <>
              <label className="block">
                <div className="text-xs mb-1">Email</div>
                <input
                  id="email"
                  className="input w-full"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
              </label>

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
            </>
          ) : (
            <>
              <input type="hidden" name="email" value={email} />
              <input type="hidden" name="password" value={password} />
            </>
          )}

          {needsTwoFactor && (
            <label className="block">
              <div className="text-xs mb-1">2FA Code</div>
              <input
                id="twoFactorToken"
                className="input w-full"
                name="twoFactorToken"
                type="text"
                placeholder="Enter 6-digit code or backup code"
                autoComplete="one-time-code"
                required
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
              ← Back to login
            </button>
          )}
        </form>
      </div>
    </section>
  );
}