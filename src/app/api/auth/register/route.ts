import { NextRequest, NextResponse } from "next/server";
import { createUser, linkGuestOrdersToUser, createEmailVerificationToken } from "@/lib/userStore";
import { createUserSession } from "@/lib/userSession";
import { checkRateLimit, resetRateLimit } from "@/lib/rateLimit";
import { sendEmailVerification } from "@/lib/email";
import { validateEmail, validatePassword } from "@/lib/validation";

export async function POST(req: NextRequest) {
  try {
    // Rate limiting protection against spam account creation
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const rateLimitOk = await checkRateLimit(ip);

    if (!rateLimitOk) {
      return NextResponse.json(
        { error: "Too many registration attempts. Please try again in 15 minutes." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { email, password, firstName, lastName } = body;

    // Validation
    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    // Email validation
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return NextResponse.json({ error: emailValidation.error }, { status: 400 });
    }

    // Password validation
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json({ error: passwordValidation.error }, { status: 400 });
    }

    // Create user with normalized email
    const normalizedEmail = emailValidation.normalized;
    const user = await createUser(normalizedEmail, password, firstName, lastName);

    // Reset rate limit on successful registration
    await resetRateLimit(ip);

    // Link any previous guest orders to this new account and award retroactive points
    let linkedOrdersCount = 0;
    try {
      linkedOrdersCount = await linkGuestOrdersToUser(normalizedEmail, user.id);
      if (linkedOrdersCount > 0) {
        console.log(`[Registration] Linked ${linkedOrdersCount} guest order(s) to new user ${user.id}`);
      }
    } catch (err) {
      console.error("[Registration] Failed to link guest orders:", err);
      // Don't fail registration if linking fails
    }

    // Create session
    await createUserSession(user.id, user.email);

    // Send email verification (don't block registration if this fails)
    try {
      const verificationToken = await createEmailVerificationToken(user.id);
      await sendEmailVerification(normalizedEmail, verificationToken.token);
      console.log(`[Registration] Verification email sent to ${normalizedEmail}`);
    } catch (emailErr) {
      console.error("[Registration] Failed to send verification email:", emailErr);
      // Don't fail registration if email sending fails
    }

    // Add to mailing list (don't block registration if this fails)
    try {
      const buttondownKey = process.env.BUTTONDOWN_API_KEY;
      if (buttondownKey) {
        const mailingListRes = await fetch("https://api.buttondown.email/v1/subscribers", {
          method: "POST",
          headers: {
            Authorization: `Token ${buttondownKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email_address: normalizedEmail,
            type: "regular" // Bypass confirmation email
          }),
        });

        if (mailingListRes.ok) {
          console.log(`[Registration] Added ${normalizedEmail} to mailing list`);
        } else {
          const errorText = await mailingListRes.text();
          // Ignore "already subscribed" errors
          if (!errorText.toLowerCase().includes("already")) {
            console.error("[Registration] Failed to add to mailing list:", errorText);
          }
        }
      }
    } catch (mailingErr) {
      console.error("[Registration] Failed to add to mailing list:", mailingErr);
      // Don't fail registration if mailing list signup fails
    }

    // Get updated user with retroactive points
    const { getUserById } = await import("@/lib/userStore");
    const updatedUser = await getUserById(user.id);

    return NextResponse.json(
      {
        success: true,
        user: {
          id: updatedUser?.id || user.id,
          email: updatedUser?.email || user.email,
          firstName: updatedUser?.firstName || user.firstName,
          lastName: updatedUser?.lastName || user.lastName,
          points: updatedUser?.points || user.points,
        },
        linkedOrders: linkedOrdersCount,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Auth] Registration error:", error);

    if (error instanceof Error && error.message === "Email already registered") {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
