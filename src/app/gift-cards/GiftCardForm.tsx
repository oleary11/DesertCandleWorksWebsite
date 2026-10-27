"use client";

import { useState } from "react";
import { btnPrimary, chipClass, fieldClass, labelClass } from "@/components/shop/styles";
import { GIFT_CARD_AMOUNTS, GIFT_CARD_MAX, GIFT_CARD_MAX_SEND_DAYS, GIFT_CARD_MIN } from "@/lib/giftCardOptions";

const arizonaDate = (offsetDays = 0) =>
  new Date(Date.now() + offsetDays * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Phoenix" });

/** Has this Arizona date and time already passed? (Arizona is UTC-7 all year.) */
const isPast = (date: string, time: string) => new Date(`${date}T${time || "00:00"}:00-07:00`).getTime() <= Date.now() + 5 * 60_000;

export default function GiftCardForm() {
  const [amount, setAmount] = useState<number | "custom">(50);
  const [custom, setCustom] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [purchaserEmail, setPurchaserEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sendDate, setSendDate] = useState(arizonaDate());
  // Empty = as soon as it's paid (only offered for today).
  const [sendTime, setSendTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const value = amount === "custom" ? Number(custom) : amount;
  const sendNow = sendDate === arizonaDate() && (!sendTime || isPast(sendDate, sendTime));
  const valid = Number.isFinite(value) && value >= GIFT_CARD_MIN && value <= GIFT_CARD_MAX;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) {
      setError(`Choose an amount from $${GIFT_CARD_MIN} to $${GIFT_CARD_MAX}.`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/gift-cards/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Math.round(value),
          recipientName,
          recipientEmail,
          fromName,
          purchaserEmail,
          message,
          ...(sendNow ? {} : { sendDate, sendTime: sendTime || "08:00" }),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Couldn't start checkout. Please try again.");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start checkout. Please try again.");
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-6 rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgb(63_42_33/0.06),0_20px_44px_-28px_rgb(63_42_33/0.4)] ring-1 ring-[var(--home-line)] sm:p-8"
    >
      <fieldset>
        <legend className={labelClass}>Amount</legend>
        <div className="flex flex-wrap gap-2">
          {GIFT_CARD_AMOUNTS.map((a) => (
            <button key={a} type="button" aria-pressed={amount === a} onClick={() => setAmount(a)} className={chipClass(amount === a)}>
              ${a}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={amount === "custom"}
            onClick={() => setAmount("custom")}
            className={chipClass(amount === "custom")}
          >
            Other amount
          </button>
        </div>
        {amount === "custom" && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-lg text-[var(--home-muted)]">$</span>
            <input
              type="number"
              inputMode="numeric"
              min={GIFT_CARD_MIN}
              max={GIFT_CARD_MAX}
              step={1}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder={`${GIFT_CARD_MIN} to ${GIFT_CARD_MAX}`}
              className={`${fieldClass} max-w-[200px]`}
              aria-label="Gift card amount in dollars"
              autoFocus
            />
          </div>
        )}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Their name</span>
          <input className={fieldClass} value={recipientName} onChange={(e) => setRecipientName(e.target.value)} autoComplete="off" />
        </label>
        <label className="block">
          <span className={labelClass}>Their email</span>
          <input
            type="email"
            required
            className={fieldClass}
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label className="block">
          <span className={labelClass}>From</span>
          <input
            required
            className={fieldClass}
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
          />
        </label>
        <label className="block">
          <span className={labelClass}>Your email (for the receipt)</span>
          <input
            type="email"
            required
            className={fieldClass}
            value={purchaserEmail}
            onChange={(e) => setPurchaserEmail(e.target.value)}
            autoComplete="email"
            spellCheck={false}
          />
        </label>
      </div>

      <label className="block">
        <span className={labelClass}>Note (optional)</span>
        <textarea
          rows={3}
          maxLength={500}
          className={`${fieldClass} min-h-24 py-3`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Happy birthday! Pick a scent that reminds you of home."
        />
      </label>

      <fieldset>
        <legend className={labelClass}>When should we email it?</legend>
        <div className="flex flex-wrap gap-3">
          <input
            type="date"
            aria-label="Send date"
            className={`${fieldClass} max-w-[200px]`}
            value={sendDate}
            min={arizonaDate()}
            max={arizonaDate(GIFT_CARD_MAX_SEND_DAYS - 1)}
            onChange={(e) => {
              const date = e.target.value || arizonaDate();
              setSendDate(date);
              // A later day needs a time; morning is a nice default.
              if (date !== arizonaDate() && !sendTime) setSendTime("08:00");
            }}
          />
          <input
            type="time"
            aria-label="Send time"
            className={`${fieldClass} max-w-[160px]`}
            value={sendTime}
            step={900}
            onChange={(e) => setSendTime(e.target.value)}
          />
        </div>
        <span className="mt-2 block text-xs text-[var(--home-muted)]">
          {sendNow
            ? "Sends right after you pay. Pick a later time or day to schedule it."
            : `Sends ${new Date(`${sendDate}T${sendTime || "08:00"}:00-07:00`).toLocaleString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                timeZone: "America/Phoenix",
              })} Arizona time.`}{" "}
          Up to {GIFT_CARD_MAX_SEND_DAYS} days out.
        </span>
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-[#9b3b2a]">
          {error}
        </p>
      )}

      <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>
        {busy ? "Starting checkout…" : valid ? `Buy a $${Math.round(value)} gift card` : "Buy gift card"}
      </button>
    </form>
  );
}
