import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { validateEmail } from "@/lib/validation";
import { subscribeToNewsletter } from "@/lib/newsletter";
import { removeUnsubscribe } from "@/lib/unsubscribe";
import { getWelcomeOffer, issueWelcomeCode, sendWelcomeEmail } from "@/lib/welcomeOffer";

export const runtime = "nodejs";

const MAX_SIGNUPS_PER_HOUR = 5;

/** US numbers as (480) 442-7764; other countries need a leading + and are kept as typed. */
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  const us = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (!raw.trim().startsWith("+") || raw.trim().startsWith("+1")) {
    if (us.length !== 10 || /^[01]/.test(us)) return null;
    return `(${us.slice(0, 3)}) ${us.slice(3, 6)}-${us.slice(6)}`;
  }
  return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
}

/** GET: whether the popup should show, and for how much off. */
export async function GET() {
  const offer = getWelcomeOffer();
  return NextResponse.json(offer ? { active: true, percent: offer.percent } : { active: false });
}

/**
 * POST { email, phone }: joins the newsletter and emails their own single-use code. The code is
 * never returned here, so getting the discount takes a real inbox.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  const limitKey = `rate_limit:welcome:${ip}`;
  try {
    const attempts = await kv.incr(limitKey);
    if (attempts === 1) await kv.expire(limitKey, 3600);
    if (attempts > MAX_SIGNUPS_PER_HOUR) {
      return NextResponse.json({ ok: false, error: "Too many tries. Please try again later." }, { status: 429 });
    }
  } catch (error) {
    console.warn("[Welcome offer] Rate limit unavailable:", error);
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { email?: unknown; phone?: unknown };
    const check = validateEmail(typeof body.email === "string" ? body.email : "");
    if (!check.valid) return NextResponse.json({ ok: false, error: check.error }, { status: 400 });
    const email = check.normalized;
    const phone = normalizePhone(typeof body.phone === "string" ? body.phone : "");
    if (!phone) return NextResponse.json({ ok: false, error: "Please enter a valid phone number." }, { status: 400 });

    const offer = getWelcomeOffer();
    if (!offer) return NextResponse.json({ ok: false, error: "This offer has ended." }, { status: 410 });

    const subscribed = await subscribeToNewsletter(email, { phone, source: "welcome popup" });
    if (!subscribed.ok) return NextResponse.json({ ok: false, error: subscribed.error }, { status: subscribed.status });
    // Signing up again means they want our emails, even if they unsubscribed before.
    await removeUnsubscribe(email).catch(() => {});

    let promotion;
    try {
      promotion = await issueWelcomeCode(email, offer.percent);
    } catch (error) {
      return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 409 });
    }

    // Re-sending the same code is fine (they lost the email), but not more than every few minutes.
    if (await kv.set(`welcome:sent:${email}`, "1", { nx: true, ex: 600 }).catch(() => "OK")) {
      await sendWelcomeEmail(email, promotion);
    }
    return NextResponse.json({ ok: true, percent: offer.percent });
  } catch (error) {
    console.error("[Welcome offer] Signup failed:", error);
    return NextResponse.json({ ok: false, error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
