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
    <section className="mx-auto max-w-xl px-0">
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor="newsletter-email" className="sr-only">
          Email address
        </label>
        <input
          id="newsletter-email"
          type="email"
          name="email"
          autoComplete="email"
          spellCheck={false}
          required
          placeholder="Your email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-[#e5d3c4] bg-white px-4 py-3.5 text-base text-[#3f2a21]
                     placeholder:text-[#9a8072] focus:border-[#a9502f] focus:outline-none focus:ring-2 focus:ring-[#a9502f]/25 sm:flex-1"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="rounded-xl bg-[#a9502f] px-7 py-3.5 font-semibold text-white shadow-[0_10px_24px_-10px_rgb(169_80_47/0.7)]
                     transition-colors hover:bg-[#8f4125] disabled:opacity-60"
        >
          {status === "loading" ? "Joining…" : "Sign me up"}
        </button>
      </form>

      <p
        aria-live="polite"
        className={`mt-3 min-h-5 text-center text-sm ${
          status === "success" ? "text-emerald-700" : "text-rose-700"
        }`}
      >
        {status !== "idle" ? message : ""}
      </p>
    </section>
  );
}
