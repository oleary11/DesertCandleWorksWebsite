import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type ButtondownJSON = {
  detail?: string | { msg?: string }[];
  errors?: { message?: string }[];
};

function extractEmailAddressFromJSON(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;

  if (typeof o.email_address === "string") return o.email_address;
  if (typeof o.email === "string") return o.email;

  const payload = o.payload as unknown;
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    if (typeof p.email_address === "string") return p.email_address;
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const ct = req.headers.get("content-type") || "";
    let email_address: string | null = null;

    if (ct.includes("application/json")) {
      const body: unknown = await req.json().catch(() => ({}));
      email_address = extractEmailAddressFromJSON(body);
    } else {
      const form = await req.formData().catch(() => null);
      const v = form?.get("email_address") || form?.get("email");
      email_address = typeof v === "string" ? v : null;
    }

    email_address = email_address?.trim() || null;
    if (!email_address) {
      return NextResponse.json({ ok: false, error: "Email is required." }, { status: 400 });
    }

    const API_KEY = process.env.BUTTONDOWN_API_KEY;
    if (!API_KEY) {
      return NextResponse.json({ ok: false, error: "Newsletter not configured." }, { status: 500 });
    }

    // Buttondown expects { email_address } at this endpoint/host
    const bdRes = await fetch("https://api.buttondown.email/v1/subscribers", {
      method: "POST",
      headers: {
        Authorization: `Token ${API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ email_address }),
    });

    const text = await bdRes.text();
    let data: ButtondownJSON = {};
    try {
      data = JSON.parse(text) as ButtondownJSON;
    } catch {
      // non-JSON error body; keep text for fallback message
    }

    if (bdRes.ok) {
      return NextResponse.json({ ok: true }, { status: 201 });
    }

    // Normalize error details from Buttondown
    const detailString =
      (typeof data.detail === "string" && data.detail) ||
      (Array.isArray(data.detail) && data.detail.map((d) => d?.msg).filter(Boolean).join(", ")) ||
      (Array.isArray(data.errors) && data.errors.map((e) => e?.message).filter(Boolean).join(", ")) ||
      text ||
      "Subscription failed.";

    if (detailString.toLowerCase().includes("already")) {
      return NextResponse.json({ ok: true, already: true }, { status: 200 });
    }

    return NextResponse.json({ ok: false, error: detailString }, { status: 400 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, error: "Server error." }, { status: 500 });
  }
}