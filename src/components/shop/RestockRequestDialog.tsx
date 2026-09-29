"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import type { GlobalScent } from "@/lib/scents";
import ShopDialog from "./ShopDialog";
import { btnPrimary, btnQuiet, fieldClass, labelClass } from "./styles";

/**
 * "Tell me when it's back" form. Posts to /api/request-scent, which emails the
 * shop and adds the customer to the mailing list.
 */
export default function RestockRequestDialog({
  productName,
  wickTypes = [],
  scents = [],
  onClose,
}: {
  productName: string;
  wickTypes?: { id: string; name: string }[];
  scents?: GlobalScent[];
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [wickType, setWickType] = useState("");
  const [scent, setScent] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const requestableScents = scents.filter((s) => !s.limited);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/request-scent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          productName,
          wickType: wickType || "Any",
          scent: scent || "Any available scent",
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setStatus("success");
        setMessage(data.message || "You're on the list. We'll email you when it's back.");
      } else {
        setStatus("error");
        setMessage(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setMessage("Couldn't reach the shop. Check your connection and try again.");
    }
  }

  return (
    <ShopDialog
      title={status === "success" ? "You're on the list" : "Get notified"}
      subtitle={productName}
      onClose={onClose}
      busy={status === "loading"}
      footer={
        status === "success" ? (
          <button type="button" className={`${btnPrimary} w-full`} onClick={onClose}>
            Done
          </button>
        ) : (
          <div className="flex gap-2">
            <button type="button" className={`${btnQuiet} flex-1`} onClick={onClose} disabled={status === "loading"}>
              Cancel
            </button>
            <button type="submit" form="restock-form" className={`${btnPrimary} flex-[2]`} disabled={status === "loading"}>
              {status === "loading" ? "Sending…" : "Notify me"}
            </button>
          </div>
        )
      }
    >
      {status === "success" ? (
        <div role="status" className="flex items-start gap-3 rounded-2xl bg-[var(--home-sage)] p-4 text-[15px] text-[var(--home-ink)]">
          <Check className="mt-0.5 h-5 w-5 shrink-0 text-[#4d6a3a]" aria-hidden />
          {message}
        </div>
      ) : (
        <form id="restock-form" onSubmit={submit} className="space-y-4">
          <p className="text-[15px] leading-relaxed text-[var(--home-muted)]">
            Tell us what you&apos;d like and we&apos;ll email you when it&apos;s poured. You&apos;ll also join our mailing list.
          </p>

          {wickTypes.length > 0 && (
            <label className="block">
              <span className={labelClass}>
                Wick <span className="font-normal text-[var(--home-muted)]">(optional)</span>
              </span>
              <select className={fieldClass} value={wickType} onChange={(e) => setWickType(e.target.value)} disabled={status === "loading"}>
                <option value="">Any wick</option>
                {wickTypes.map((w) => (
                  <option key={w.id} value={w.name}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {requestableScents.length > 0 && (
            <label className="block">
              <span className={labelClass}>
                Scent <span className="font-normal text-[var(--home-muted)]">(optional)</span>
              </span>
              <select className={fieldClass} value={scent} onChange={(e) => setScent(e.target.value)} disabled={status === "loading"}>
                <option value="">Any scent</option>
                {requestableScents.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                    {s.seasonal ? " (seasonal)" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block">
            <span className={labelClass}>Email</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              spellCheck={false}
              required
              className={fieldClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={status === "loading"}
            />
          </label>

          {status === "error" && (
            <p role="alert" className="rounded-xl bg-[#f7e1da] px-4 py-3 text-sm text-[#7a2a1c]">
              {message}
            </p>
          )}
        </form>
      )}
    </ShopDialog>
  );
}
