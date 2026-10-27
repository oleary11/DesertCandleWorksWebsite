"use client";

import { useState } from "react";
import { btnPrimary, chipClass, fieldClass, labelClass } from "@/components/shop/styles";
import { serif } from "@/lib/storefrontFonts";

export default function RefillForm({ scents }: { scents: string[] }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    bottle: "",
    scent: "",
    sendMethod: "mail" as "mail" | "dropoff",
    returnMethod: "ship" as "ship" | "pickup",
    line1: "",
    line2: "",
    city: "",
    state: "AZ",
    postalCode: "",
    notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/refills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          address:
            form.returnMethod === "ship"
              ? { line1: form.line1, line2: form.line2, city: form.city, state: form.state, postalCode: form.postalCode }
              : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      setDone(data.number);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const card = "rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgb(63_42_33/0.06),0_20px_44px_-28px_rgb(63_42_33/0.4)] ring-1 ring-[var(--home-line)] sm:p-8";

  if (done) {
    return (
      <div className={`${card} text-center`}>
        <h2 className={`${serif.className} text-3xl text-[var(--home-ink)]`}>Request {done} is in</h2>
        <p className="mt-3 text-[var(--home-muted)]">
          We emailed {form.email} with how to {form.sendMethod === "mail" ? "pack and mail your bottle" : "drop off your bottle"}.
          Put <strong className="text-[var(--home-ink)]">{done}</strong> on a note inside the box so we know it&apos;s yours.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={`${card} space-y-6`}>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block sm:col-span-1">
          <span className={labelClass}>Name</span>
          <input required className={fieldClass} value={form.name} onChange={set("name")} autoComplete="name" />
        </label>
        <label className="block">
          <span className={labelClass}>Email</span>
          <input required type="email" className={fieldClass} value={form.email} onChange={set("email")} autoComplete="email" spellCheck={false} />
        </label>
        <label className="block">
          <span className={labelClass}>Phone</span>
          <input required type="tel" className={fieldClass} value={form.phone} onChange={set("phone")} autoComplete="tel" />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Which bottle?</span>
          <input
            required
            className={fieldClass}
            value={form.bottle}
            onChange={set("bottle")}
            placeholder="e.g. Hendrick's Gin"
          />
        </label>
        <label className="block">
          <span className={labelClass}>Refill scent</span>
          <select required className={fieldClass} value={form.scent} onChange={set("scent")}>
            <option value="">Pick a scent</option>
            {scents.map((scent) => (
              <option key={scent}>{scent}</option>
            ))}
          </select>
        </label>
      </div>

      <fieldset>
        <legend className={labelClass}>Getting the bottle to us</legend>
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={form.sendMethod === "mail"} onClick={() => setForm({ ...form, sendMethod: "mail" })} className={chipClass(form.sendMethod === "mail")}>
            I&apos;ll mail it
          </button>
          <button type="button" aria-pressed={form.sendMethod === "dropoff"} onClick={() => setForm({ ...form, sendMethod: "dropoff" })} className={chipClass(form.sendMethod === "dropoff")}>
            Drop off in Scottsdale
          </button>
        </div>
        {form.sendMethod === "mail" && (
          <p className="mt-2 text-xs text-[var(--home-muted)]">You cover the shipping to us. We&apos;ll email our address and packing tips.</p>
        )}
      </fieldset>

      <fieldset>
        <legend className={labelClass}>Getting it back</legend>
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={form.returnMethod === "ship"} onClick={() => setForm({ ...form, returnMethod: "ship" })} className={chipClass(form.returnMethod === "ship")}>
            Ship it to me ($20 + shipping)
          </button>
          <button type="button" aria-pressed={form.returnMethod === "pickup"} onClick={() => setForm({ ...form, returnMethod: "pickup" })} className={chipClass(form.returnMethod === "pickup")}>
            Pick up in Scottsdale ($20)
          </button>
        </div>
      </fieldset>

      {form.returnMethod === "ship" && (
        <div className="grid gap-4 sm:grid-cols-6">
          <label className="block sm:col-span-4">
            <span className={labelClass}>Street address</span>
            <input required className={fieldClass} value={form.line1} onChange={set("line1")} autoComplete="address-line1" />
          </label>
          <label className="block sm:col-span-2">
            <span className={labelClass}>Apt / suite</span>
            <input className={fieldClass} value={form.line2} onChange={set("line2")} autoComplete="address-line2" />
          </label>
          <label className="block sm:col-span-3">
            <span className={labelClass}>City</span>
            <input required className={fieldClass} value={form.city} onChange={set("city")} autoComplete="address-level2" />
          </label>
          <label className="block sm:col-span-1">
            <span className={labelClass}>State</span>
            <input required maxLength={2} className={`${fieldClass} uppercase`} value={form.state} onChange={set("state")} autoComplete="address-level1" />
          </label>
          <label className="block sm:col-span-2">
            <span className={labelClass}>ZIP</span>
            <input required inputMode="numeric" className={fieldClass} value={form.postalCode} onChange={set("postalCode")} autoComplete="postal-code" />
          </label>
        </div>
      )}

      <label className="block">
        <span className={labelClass}>Anything else? (optional)</span>
        <textarea rows={3} className={`${fieldClass} min-h-24 py-3`} value={form.notes} onChange={set("notes")} placeholder="Wick preference, a deadline, anything we should know" />
      </label>

      {error && (
        <p role="alert" className="text-sm text-[#9b3b2a]">
          {error}
        </p>
      )}

      <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>
        {busy ? "Sending…" : "Request a refill"}
      </button>
      <p className="text-center text-xs text-[var(--home-muted)]">Nothing to pay now. We only charge once your bottle arrives safely.</p>
    </form>
  );
}
