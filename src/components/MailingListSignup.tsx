"use client";

import { useState } from "react";

// Same signup as the welcome popup: email + phone, and their own 10% off code by email.
// If the welcome offer is switched off it's a plain newsletter signup.
export default function MailingListSignup() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      let res = await fetch("/api/welcome-offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, phone }),
      });
      let data = await res.json();
      let gotCode = res.ok && data.ok;
      if (res.status === 410) {
        res = await fetch("/api/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: { email_address: email } }),
        });
        data = await res.json();
        gotCode = false;
      }
      if (data.ok) {
        try {
          // They're on the list now, so the popup doesn't need to ask.
          localStorage.setItem("dcw_welcome", "joined");
        } catch {}
        setStatus("success");
        setMessage(
          gotCode
            ? `You're in! Check ${email} for your ${data.percent}% off code.`
            : "Thanks for subscribing! You're all set."
        );
        setEmail("");
        setPhone("");
      } else {
        setStatus("error");
        setMessage(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  };

  const field =
    "w-full rounded-xl border border-[#e5d3c4] bg-white px-4 py-3.5 text-base text-[#3f2a21] placeholder:text-[#9a8072] focus:border-[#a9502f] focus:outline-none focus:ring-2 focus:ring-[#a9502f]/25";

  return (
    <section className="mx-auto max-w-xl px-0">
      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
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
          className={field}
        />
        <label htmlFor="newsletter-phone" className="sr-only">
          Phone number
        </label>
        <input
          id="newsletter-phone"
          type="tel"
          name="phone"
          autoComplete="tel"
          inputMode="tel"
          required
          placeholder="Phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={field}
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="rounded-xl bg-[#a9502f] px-7 py-3.5 font-semibold text-white shadow-[0_10px_24px_-10px_rgb(169_80_47/0.7)]
                     transition-colors hover:bg-[#8f4125] disabled:opacity-60 sm:col-span-2"
        >
          {status === "loading" ? "Joining…" : "Get 10% off"}
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
