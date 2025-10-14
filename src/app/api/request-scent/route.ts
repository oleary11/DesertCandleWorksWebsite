import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type ButtondownJSON = {
  detail?: string | { msg?: string }[];
  errors?: { message?: string }[];
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, productName, wickType, scent } = body as {
      email?: string;
      productName?: string;
      wickType?: string;
      scent?: string;
    };

    const emailAddress = email?.trim();
    if (!emailAddress) {
      return NextResponse.json({ ok: false, error: "Email is required." }, { status: 400 });
    }

    if (!productName || !wickType || !scent) {
      return NextResponse.json(
        { ok: false, error: "Product details are required." },
        { status: 400 }
      );
    }

    const FORMSPREE_ID = process.env.FORMSPREE_SCENT_REQUEST_ID;
    const BUTTONDOWN_API_KEY = process.env.BUTTONDOWN_API_KEY;

    if (!FORMSPREE_ID) {
      return NextResponse.json(
        { ok: false, error: "Email notification not configured." },
        { status: 500 }
      );
    }

    // 1. Send email notification via Formspree (primary action - always happens)
    const formspreeRes = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        email: emailAddress,
        product: productName,
        wickType: wickType,
        scent: scent,
        message: `Customer Request:\n\nEmail: ${emailAddress}\nProduct: ${productName}\nWick Type: ${wickType}\nScent: ${scent}\n\nRequested at: ${new Date().toISOString()}`,
      }),
    });

    if (!formspreeRes.ok) {
      console.error("Formspree error:", await formspreeRes.text());
      return NextResponse.json(
        { ok: false, error: "Failed to submit request. Please try again." },
        { status: 500 }
      );
    }

    // 2. Subscribe to mailing list via Buttondown (secondary action - failure is non-critical)
    if (BUTTONDOWN_API_KEY) {
      try {
        const notes = `Requested: ${productName} - ${wickType} / ${scent}`;
        await fetch("https://api.buttondown.email/v1/subscribers", {
          method: "POST",
          headers: {
            Authorization: `Token ${BUTTONDOWN_API_KEY}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            email_address: emailAddress,
            notes,
            metadata: {
              scent_request: `${productName}|${wickType}|${scent}`,
              requested_at: new Date().toISOString(),
            },
          }),
        });
        // Ignore response - we don't care if they're already subscribed
      } catch (bdErr) {
        console.error("Buttondown subscription failed (non-critical):", bdErr);
        // Continue anyway - email notification is what matters
      }
    }

    return NextResponse.json(
      {
        ok: true,
        message: `Thanks! We've received your request for ${productName} with ${wickType} / ${scent}. We'll notify you at ${emailAddress} when it's back in stock!`,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Scent request error:", err);
    return NextResponse.json({ ok: false, error: "Server error." }, { status: 500 });
  }
}
