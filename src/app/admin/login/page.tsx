"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

export default function AdminLoginPage() {
  const sp = useSearchParams();
  const next = sp.get("next") || "/admin";
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw, next }),
    });
    if (res.redirected) {
      window.location.href = res.url;
      return;
    }
    const j = await res.json().catch(() => ({}));
    setErr(j.error || "Login failed");
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-sm p-6">
      <h1 className="text-2xl font-semibold">Admin login</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <input
          type="password"
          className="input"
          placeholder="Password"
          value={pw}
          onChange={e => setPw(e.target.value)}
        />
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <button disabled={loading} className="btn btn-primary w-full">
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}