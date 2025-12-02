import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { createOrder, completeOrder, getUserByEmail } from "@/lib/userStore";
import { incrStock, incrVariantStock } from "@/lib/productsStore";

/**
 * Admin-only endpoint to create test orders for testing the order/points system
 * POST /api/admin/test-order
 */
export async function POST(req: NextRequest) {
  const authed = await isAdminAuthed(req);
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      email,
      items, // Array of { productSlug, productName, quantity, priceCents, variantId? }
      totalCents,
    } = body;

    if (!email || !items || !totalCents) {
      return NextResponse.json(
        { error: "Missing required fields: email, items, totalCents" },
        { status: 400 }
      );
    }

    // Get user by email
    const user = await getUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        { error: `No user found with email: ${email}` },
        { status: 404 }
      );
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

    // Create the order
    console.log(`[Test Order] Creating order for user ${user.id} (${email})`);
    const order = await createOrder(user.id, email, mockSessionId, totalCents, items);

    // Complete the order and award points
    await completeOrder(mockSessionId);

    const pointsEarned = Math.floor(totalCents / 100);
    console.log(`[Test Order] Awarded ${pointsEarned} points to ${email}`);

    return NextResponse.json({
      success: true,
      order,
      pointsEarned,
      message: `Test order created for ${email}. Awarded ${pointsEarned} points.`,
    });
  } catch (error) {
    console.error("[Test Order] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create test order" },
      { status: 500 }
    );
  }
}
