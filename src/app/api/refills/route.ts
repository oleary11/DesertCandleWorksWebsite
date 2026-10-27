import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { validateEmail } from "@/lib/validation";
import { createRefillRequest, refillLabel, type RefillAddress } from "@/lib/refills";

export const runtime = "nodejs";

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** POST: a refill request from /refills. Free; payment is asked once the bottle arrives. */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  if (!(await checkRateLimit(ip, "subscribe"))) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }
  try {
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const name = clean(b.name, 100);
    const email = validateEmail(clean(b.email, 255));
    const phone = clean(b.phone, 30);
    const bottle = clean(b.bottle, 120);
    const scent = clean(b.scent, 80);
    const sendMethod = b.sendMethod === "dropoff" ? "dropoff" : "mail";
    const returnMethod = b.returnMethod === "pickup" ? "pickup" : "ship";
    if (!name || !email.valid || phone.replace(/\D/g, "").length < 10 || !bottle || !scent) {
      return NextResponse.json({ error: "Please fill in your name, email, phone, bottle and scent." }, { status: 400 });
    }
    let address: RefillAddress | null = null;
    if (returnMethod === "ship") {
      const a = (b.address ?? {}) as Record<string, unknown>;
      address = {
        line1: clean(a.line1, 120),
        line2: clean(a.line2, 120) || undefined,
        city: clean(a.city, 80),
        state: clean(a.state, 2).toUpperCase(),
        postalCode: clean(a.postalCode, 10),
      };
      if (!address.line1 || !address.city || address.state.length !== 2 || !/^\d{5}(-\d{4})?$/.test(address.postalCode)) {
        return NextResponse.json({ error: "Please fill in the address to ship it back to." }, { status: 400 });
      }
    }
    const request = await createRefillRequest({
      name,
      email: email.normalized,
      phone,
      bottle,
      scent,
      sendMethod,
      returnMethod,
      address,
      notes: clean(b.notes, 1000) || null,
    });
    return NextResponse.json({ ok: true, number: refillLabel(request) });
  } catch (error) {
    console.error("[Refill] Request failed:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
