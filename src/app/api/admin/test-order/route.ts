import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { createOrder, completeOrder, getUserByEmail } from "@/lib/userStore";
import { incrStock, incrVariantStock } from "@/lib/productsStore";

/**
 * Admin-only endpoint to create test orders for testing the order/points system
 * POST /api/admin/test-order
 *
 * Request body:
 * - email: Customer email
 * - items: Array of { productSlug, productName, quantity, priceCents, variantId? }
 * - totalCents: Order total in cents
 * - isGuest: (optional) Set to true to test guest checkout, false/omit for authenticated user
 * - sendEmail: (optional) Set to true to send invoice email
 */
export async function POST(req: NextRequest) {
  const authed = await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      email,
      items, // Array of { productSlug, productName, quantity, priceCents, variantId? }
      totalCents,
      isGuest = false, // Optional: test guest checkout
      sendEmail = false, // Optional: send invoice email
    } = body;

    if (!email || !items || !totalCents) {
      return NextResponse.json(
        { error: "Missing required fields: email, items, totalCents" },
        { status: 400 }
      );
    }

    // Get user by email (only if not testing guest checkout)
    let user = null;
    if (!isGuest) {
      user = await getUserByEmail(email);
      if (!user) {
        return NextResponse.json(
          { error: `No user found with email: ${email}. Set "isGuest": true to test guest checkout.` },
          { status: 404 }
        );
      }
    }

    // Generate a mock checkout session ID
    const mockSessionId = `test_order_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Decrement stock for each item
    for (const item of items) {
      try {
        if (item.variantId) {
          console.log(`[Test Order] Decrementing variant stock: ${item.productSlug} variant ${item.variantId} x${item.quantity}`);
          await incrVariantStock(item.productSlug, item.variantId, -item.quantity);
        } else {
          console.log(`[Test Order] Decrementing base stock: ${item.productSlug} x${item.quantity}`);
          await incrStock(item.productSlug, -item.quantity);
        }
      } catch (err) {
        console.error(`[Test Order] Stock decrement failed for ${item.productSlug}:`, err);
        // Continue anyway for testing purposes
      }
    }

    // Create the order (guest or authenticated)
    if (isGuest) {
      console.log(`[Test Order] Creating GUEST order for ${email}`);
      await createOrder(email, mockSessionId, totalCents, items); // No userId = guest
    } else {
      console.log(`[Test Order] Creating order for user ${user!.id} (${email})`);
      await createOrder(email, mockSessionId, totalCents, items, user!.id);
    }

    // Complete the order and award points (if authenticated)
    await completeOrder(mockSessionId);

    const pointsEarned = Math.round(totalCents / 100); // 1 point per dollar, rounded

    if (isGuest) {
      console.log(`[Test Order] Guest order created - no points awarded`);
    } else {
      console.log(`[Test Order] Awarded ${pointsEarned} points to ${email}`);
    }

    // Optionally send invoice email
    let emailSent = false;
    if (sendEmail) {
      try {
        const { sendOrderInvoiceEmail } = await import("@/lib/email");
        await sendOrderInvoiceEmail(mockSessionId);
        emailSent = true;
        console.log(`[Test Order] Invoice email sent to ${email}`);
      } catch (emailErr) {
        console.error(`[Test Order] Failed to send invoice email:`, emailErr);
      }
    }

    // Get the created order
    const { getOrderById } = await import("@/lib/userStore");
    const order = await getOrderById(mockSessionId);

    return NextResponse.json({
      success: true,
      order,
      pointsEarned: isGuest ? 0 : pointsEarned,
      isGuest,
      emailSent,
      message: isGuest
        ? `Test GUEST order created for ${email}. No points awarded.${emailSent ? ' Invoice email sent.' : ''}`
        : `Test order created for ${email}. Awarded ${pointsEarned} points.${emailSent ? ' Invoice email sent.' : ''}`,
    });
  } catch (error) {
    console.error("[Test Order] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create test order" },
      { status: 500 }
    );
  }
}
