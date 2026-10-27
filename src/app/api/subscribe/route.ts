import { NextRequest, NextResponse } from "next/server";
import { validateEmail } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rateLimit";
import { subscribeToNewsletter } from "@/lib/newsletter";

export const runtime = "nodejs";

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
    // Rate limiting protection against email spam/DoS
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const rateLimitOk = await checkRateLimit(ip);

    if (!rateLimitOk) {
      return NextResponse.json(
        { ok: false, error: "Too many subscription attempts. Please try again in 15 minutes." },
        { status: 429 }
      );
    }

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

    if (!email_address) {
      return NextResponse.json({ ok: false, error: "Email is required." }, { status: 400 });
    }

    // Validate and normalize email
    const emailValidation = validateEmail(email_address);
    if (!emailValidation.valid) {
      return NextResponse.json({ ok: false, error: emailValidation.error }, { status: 400 });
    }
    const normalizedEmail = emailValidation.normalized;

    const result = await subscribeToNewsletter(normalizedEmail);
    if (result.ok) {
      return NextResponse.json(result.already ? { ok: true, already: true } : { ok: true }, { status: result.already ? 200 : 201 });
    }
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, error: "Server error." }, { status: 500 });
  }
}