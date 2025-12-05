"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }

      // Success - refresh auth context and redirect
      await refreshUser();
      router.push("/account");
      router.refresh();
    } catch (err) {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold mb-2">Welcome Back</h1>
          <p className="text-[var(--color-muted)]">Sign in to your account</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                required
                autoComplete="email"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium">Password</label>
                <Link
                  href="/account/forgot-password"
                  className="text-xs text-[var(--color-accent)] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                required
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 text-base font-medium disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-[var(--color-muted)]">
              Don&apos;t have an account?{" "}
              <Link href="/account/register" className="text-[var(--color-accent)] hover:underline font-medium">
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
