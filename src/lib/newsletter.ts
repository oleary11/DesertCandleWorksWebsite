// Newsletter list (Buttondown). Used by the footer signup and the 10%-off welcome popup.

type ButtondownJSON = {
  detail?: string | { msg?: string }[];
  errors?: { message?: string }[];
};

export type SubscribeResult = { ok: true; already?: boolean } | { ok: false; error: string; status: number };

/**
 * Adds an address to the newsletter. Already on the list counts as success. `metadata`
 * (e.g. their phone number) is saved on the subscriber, and updated if they're already on it.
 */
export async function subscribeToNewsletter(email: string, metadata?: Record<string, string>): Promise<SubscribeResult> {
  const API_KEY = process.env.BUTTONDOWN_API_KEY;
  if (!API_KEY) return { ok: false, error: "Newsletter not configured.", status: 500 };

  // Buttondown expects { email_address } at this endpoint/host
  const bdRes = await fetch("https://api.buttondown.email/v1/subscribers", {
    method: "POST",
    headers: {
      Authorization: `Token ${API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      email_address: email,
      type: "regular", // Bypass confirmation email
      ...(metadata ? { metadata } : {}),
    }),
  });

  const text = await bdRes.text();
  let data: ButtondownJSON = {};
  try {
    data = JSON.parse(text) as ButtondownJSON;
  } catch {
    // non-JSON error body; keep text for fallback message
  }

  if (bdRes.ok) return { ok: true };

  // Normalize error details from Buttondown
  const detailString =
    (typeof data.detail === "string" && data.detail) ||
    (Array.isArray(data.detail) && data.detail.map((d) => d?.msg).filter(Boolean).join(", ")) ||
    (Array.isArray(data.errors) && data.errors.map((e) => e?.message).filter(Boolean).join(", ")) ||
    text ||
    "Subscription failed.";

  if (detailString.toLowerCase().includes("already")) {
    if (metadata) {
      await fetch(`https://api.buttondown.email/v1/subscribers/${encodeURIComponent(email)}`, {
        method: "PATCH",
        headers: { Authorization: `Token ${API_KEY}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ metadata }),
      }).catch((err) => console.error("[Newsletter] Couldn't update subscriber details:", err));
    }
    return { ok: true, already: true };
  }
  return { ok: false, error: detailString, status: 400 };
}
