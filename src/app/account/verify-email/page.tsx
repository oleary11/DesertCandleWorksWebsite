"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError("Invalid verification link.");
      setLoading(false);
      return;
    }

    verifyEmail();
  }, [token]);

  async function verifyEmail() {
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to verify email");
        setLoading(false);
        return;
      }

      // Success
      setSuccess(true);
      setLoading(false);
    } catch (err) {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="card p-8 text-center">
            <div className="mb-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-accent)] mx-auto"></div>
            </div>
            <h2 className="text-2xl font-semibold mb-2">Verifying Email...</h2>
            <p className="text-[var(--color-muted)]">Please wait while we verify your email address</p>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="card p-8 text-center">
            <div className="mb-4 text-green-600">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold mb-2">Email Verified!</h2>
            <p className="text-[var(--color-muted)] mb-6">
              Your email has been successfully verified. You can now earn and redeem points on your purchases!
            </p>
            <Link href="/account" className="btn-primary inline-block px-6 py-3">
              Go to My Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="card p-8 text-center">
          <div className="mb-4 text-red-600">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold mb-2">Verification Failed</h2>
          <p className="text-red-600 mb-6">{error}</p>
          <Link href="/account" className="btn-primary inline-block px-6 py-3">
            Go to My Account
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-[80vh] flex items-center justify-center">Loading...</div>}>
      <VerifyEmailForm />
    </Suspense>
  );
}
