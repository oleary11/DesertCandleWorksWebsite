// app/api/subscribe/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const ct = req.headers.get("content-type") || "";
    let email_address: string | null = null;

    if (ct.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      email_address =
        body?.email_address ??
        body?.email ??
        body?.payload?.email_address ??
        null;
    } else {
      const form = await req.formData().catch(() => null);
      const v = form?.get("email_address") || form?.get("email");
      email_address = typeof v === "string" ? v : null;
    }

    email_address = email_address?.trim() || null;
    if (!email_address) {
      return NextResponse.json(
        { ok: false, error: "Email is required." },
        { status: 400 }
      );
    }

    const API_KEY = process.env.BUTTONDOWN_API_KEY;
    if (!API_KEY) {
      return NextResponse.json(
        { ok: false, error: "Newsletter not configured." },
        { status: 500 }
      );
    }

    // Buttondown API (note the .email domain and `email_address` key)
    const bdRes = await fetch("https://api.buttondown.email/v1/subscribers", {
      method: "POST",
      headers: {
        Authorization: `Token ${API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        email_address,
        // tags: ["website"], // optional
      }),
    });

    const text = await bdRes.text();
    let data: any = {};
    try { data = JSON.parse(text); } catch {}

    if (bdRes.ok) {
      return NextResponse.json({ ok: true }, { status: 201 });
    }

    // Common Buttondown error shapes
    const detail =
      (typeof data?.detail === "string" && data.detail) ||
      (Array.isArray(data?.detail) && data.detail.map((d: any) => d?.msg).filter(Boolean).join(", ")) ||
      (Array.isArray(data?.errors) && data.errors.map((e: any) => e?.message).filter(Boolean).join(", ")) ||
      text ||
      "Subscription failed.";

    if (String(detail).toLowerCase().includes("already")) {
      return NextResponse.json({ ok: true, already: true }, { status: 200 });
    }

    return NextResponse.json({ ok: false, error: detail }, { status: 400 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, error: "Server error." }, { status: 500 });
  }
}