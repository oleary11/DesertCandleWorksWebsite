"use client";

import Image from "next/image";
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
    <section className="a-ui flex min-h-dvh items-center justify-center bg-[var(--a-canvas)] px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image src="/images/logo.png" alt="" width={56} height={56} priority className="h-14 w-14 rounded-full ring-1 ring-[var(--a-line)]" />
          <p className="mt-3 text-lg font-semibold tracking-tight text-[var(--a-ink)]">Desert Candle Works</p>
          <p className="text-sm text-[var(--a-muted)]">Admin</p>
        </div>

        <div className="a-card p-6 shadow-[var(--a-shadow-hover)]">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--a-ink)]">{needsTwoFactor ? "Two-factor code" : "Sign in"}</h1>
          <p className="mt-1 text-sm text-[var(--a-muted)]">
            {needsTwoFactor ? "Enter the code from your authenticator app." : "Use your admin email and password."}
          </p>

          <form className="mt-5 space-y-4" onSubmit={onSubmit}>
            <input type="hidden" name="next" value={next} />

            {!needsTwoFactor ? (
              <>
                <label className="block">
                  <span className="a-label">Email</span>
                  <input id="email" className="a-input" name="email" type="email" autoComplete="email" required />
                </label>

                <label className="block">
                  <span className="a-label">Password</span>
                  <input id="pw" className="a-input" name="password" type="password" autoComplete="current-password" required />
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
                <span className="a-label">Code</span>
                <input
                  id="twoFactorToken"
                  className="a-input font-mono tracking-widest"
                  name="twoFactorToken"
                  type="text"
                  inputMode="numeric"
                  placeholder="6-digit code or backup code"
                  autoComplete="one-time-code"
                  required
                />
                <p className="a-help">A backup code works too.</p>
              </label>
            )}

            {error && (
              <p role="alert" className="rounded-lg border border-red-200 bg-[#fdecea] px-3 py-2 text-sm text-[#7a1a12]">
                {error}
              </p>
            )}

            <button className="a-btn a-btn-primary h-11 w-full" type="submit" disabled={submitting}>
              {submitting ? "Signing in…" : needsTwoFactor ? "Verify" : "Sign in"}
            </button>

            {needsTwoFactor && (
              <button
                type="button"
                onClick={() => {
                  setNeedsTwoFactor(false);
                  setError(null);
                }}
                className="w-full text-center text-sm text-[var(--a-muted)] hover:text-[var(--a-ink)]"
              >
                Back to sign in
              </button>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}