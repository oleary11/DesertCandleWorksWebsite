"use client";

import { useEffect, useState } from "react";
import { Gift } from "lucide-react";
import { holidayShippingMessage } from "@/lib/holidayShipping";

/** Slim bar above the header with the Christmas order-by date (lib/holidayShipping.ts). */
export function HolidayShippingBar() {
  // Worked out in the browser so a cached page never shows yesterday's countdown.
  const [message, setMessage] = useState<ReturnType<typeof holidayShippingMessage>>(null);
  useEffect(() => setMessage(holidayShippingMessage()), []);
  if (!message) return null;
  return (
    <div
      className={`flex items-center justify-center gap-2 px-4 py-2 text-center text-[13px] font-medium ${
        message.urgent ? "bg-[#a9502f] text-white" : "bg-[#3f2a21] text-[#fbf6f0]"
      }`}
    >
      <Gift className="h-4 w-4 shrink-0" aria-hidden />
      <span>{message.text}</span>
    </div>
  );
}

/** Same message as a line inside the cart. */
export function HolidayShippingNote() {
  const [message, setMessage] = useState<ReturnType<typeof holidayShippingMessage>>(null);
  useEffect(() => setMessage(holidayShippingMessage()), []);
  if (!message) return null;
  return (
    <p className="flex items-center gap-2 rounded-xl border border-[#e5d3c4] bg-[#fbf6f0] px-3 py-2.5 text-sm text-[#3f2a21]">
      <Gift className="h-4 w-4 shrink-0 text-[#a9502f]" aria-hidden />
      {message.text}
    </p>
  );
}
