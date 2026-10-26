"use client";

import { useState } from "react";

export default function UnsubscribeForm({ email, token }: { email: string; token: string }) {
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");

  const confirm = async () => {
    setState("working");
    const res = await fetch(`/api/unsubscribe?e=${encodeURIComponent(email)}&t=${encodeURIComponent(token)}&via=page`, {
      method: "POST",
    }).catch(() => null);
    setState(res?.ok ? "done" : "error");
  };

  if (state === "done") {
    return (
      <p className="mt-4 text-neutral-600">
        You&apos;re unsubscribed. <strong>{email}</strong> won&apos;t get our announcement emails anymore. Order and shipping
        emails will still arrive when you buy something.
      </p>
    );
  }

  return (
    <>
      <p className="mt-4 text-neutral-600">
        Stop announcement and promotion emails from Desert Candle Works to <strong>{email}</strong>?
      </p>
      <button onClick={confirm} disabled={state === "working"} className="btn mt-6">
        {state === "working" ? "Unsubscribing…" : "Unsubscribe"}
      </button>
      {state === "error" && (
        <p className="mt-4 text-sm text-red-700">
          That link didn&apos;t work. Email contact@desertcandleworks.com and we&apos;ll remove you by hand.
        </p>
      )}
    </>
  );
}
