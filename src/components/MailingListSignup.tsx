"use client";

import { useState } from "react";

export default function MailingListSignup() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle"|"loading"|"success"|"error">("idle");
  const [message, setMessage] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setMessage("");
  
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: {
            email_address: email,
          },
        }),
      });
  
      const data = await res.json();
      if (data.ok) {
        setStatus("success");
        setMessage("Thanks for subscribing! You're all set.");
        setEmail("");
      } else {
        setStatus("error");
        setMessage(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  };  

  return (
    <section className="mx-auto max-w-6xl px-6 mt-16">
      <div className="rounded-2xl border p-8 sm:p-10 bg-white
                      border-[color-mix(in_oklab,var(--color-ink)_10%,transparent)]
                      shadow-[0_8px_30px_rgba(20,16,12,0.06)]">
        <div className="max-w-2xl">
          <h2 className="text-xl font-semibold">Join our mailing list</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Discount codes, drops, restocks, and desert-scented stories. No spam, unsubscribe anytime.
          </p>

          <form onSubmit={onSubmit} className="mt-6 flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full sm:flex-1 rounded-xl border px-4 py-3
                         border-[color-mix(in_oklab,var(--color-ink)_18%,transparent)]
                         focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="rounded-xl px-6 py-3 font-medium text-white
                         [background:linear-gradient(180deg,_color-mix(in_oklab,_var(--color-accent)_92%,_white_8%),_color-mix(in_oklab,_var(--color-accent)_78%,_black_4%))]
                         shadow-[0_1px_0_rgba(255,255,255,.45)_inset,0_10px_30px_rgba(20,16,12,.08)]
                         hover:opacity-95 transition disabled:opacity-60"
            >
              {status === "loading" ? "Joining…" : "Join"}
            </button>
          </form>

          {status !== "idle" && (
            <p
              className={`mt-3 text-sm ${
                status === "success" ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {message}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}