import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import Stripe from "stripe";
import { getOrderById } from "@/lib/userStore";
import { logAdminAction } from "@/lib/adminLogs";

export const runtime = "nodejs";

/**
 * GET: Fetch recent Stripe checkout sessions and check if they're in our database
 */
export async function GET() {
  const isAdmin = await isAdminAuthed();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  try {
    const stripe = new Stripe(secretKey);

    // Fetch last 100 completed checkout sessions
    const sessions = await stripe.checkout.sessions.list({
      limit: 100,
      status: "complete",
    });

    // Check which ones are in our database
    const sessionData = await Promise.all(
      sessions.data.map(async (session) => {
        const existingOrder = await getOrderById(session.id);
        return {
          id: session.id,
          customerEmail: session.customer_details?.email || "Unknown",
          amountTotal: session.amount_total,
          created: new Date(session.created * 1000).toISOString(),
          inDatabase: !!existingOrder,
          orderStatus: existingOrder?.status,
        };
      })
    );

    return NextResponse.json({
      sessions: sessionData,
      total: sessions.data.length,
      missing: sessionData.filter((s) => !s.inDatabase).length,
    });
  } catch (error) {
    console.error("[Stripe Sync] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch Stripe sessions", details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST: Manually process a specific Stripe session through webhook logic
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  const isAdmin = await isAdminAuthed();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { sessionId } = body;

    if (!sessionId) {
      await logAdminAction({
        action: "stripe-sync.process",
        adminEmail: "admin",
        ip,
        userAgent,
        success: false,
        details: { reason: "missing_session_id" },
      });
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const stripe = new Stripe(secretKey);

    // Fetch the session
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.status !== "complete") {
      await logAdminAction({
        action: "stripe-sync.process",
        adminEmail: "admin",
        ip,
        userAgent,
        success: false,
        details: { reason: "session_not_complete", sessionId, status: session.status },
      });
      return NextResponse.json(
        { error: "Session is not completed" },
        { status: 400 }
      );
    }

    // Check if already processed - but allow reprocessing if totals don't match
    const existingOrder = await getOrderById(session.id);
    if (existingOrder && existingOrder.status === "completed") {
      // Verify order completeness by checking totals
      const sessionTotal = session.amount_total || 0;
      const orderTotal = existingOrder.totalCents;

      // If totals match, order is complete and correct - skip reprocessing
      if (orderTotal === sessionTotal) {
        await logAdminAction({
          action: "stripe-sync.process",
          adminEmail: "admin",
          ip,
          userAgent,
          success: true,
          details: { reason: "already_processed", sessionId, skipped: true },
        });
        return NextResponse.json({
          message: "Order already exists and is complete (totals match)",
          order: existingOrder,
          skipped: true,
        });
      }

      // If totals don't match, order may be incomplete - reprocess to fix
      console.warn(
        `[Stripe Sync] Order ${session.id} exists but totals don't match (Stripe: ${sessionTotal}, DB: ${orderTotal}) - reprocessing to fix`
      );
    }

    // Import webhook processing logic
    const { getPriceToProduct } = await import("@/lib/pricemap");
    const { incrStock, incrVariantStock } = await import("@/lib/productsStore");
    const {
      getUserByEmail,
      createOrder,
      completeOrder,
      redeemPoints,
    } = await import("@/lib/userStore");

    const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
    const priceToProduct = await getPriceToProduct();

    const customerEmail = session.customer_details?.email || "";
    const pointsRedeemed = session.metadata?.pointsRedeemed
      ? parseInt(session.metadata.pointsRedeemed)
      : 0;
    const sessionUserId = session.metadata?.userId || "";
    const orderItems: Array<{
      productSlug: string;
      productName: string;
      quantity: number;
      priceCents: number;
    }> = [];

    let productSubtotalCents = 0;

    // Process line items
    for (let index = 0; index < lineItems.data.length; index++) {
      const item = lineItems.data[index];
      const qty = item.quantity ?? 1;

      const priceId =
        session.metadata?.[`item_${index}_price`] || item.price?.id || "";
      const productInfo = priceToProduct.get(priceId);

      if (productInfo && qty > 0) {
        const itemTotal = item.amount_total || 0;
        const productName =
          session.metadata?.[`item_${index}_name`] ||
          item.description ||
          "Unknown Product";

        orderItems.push({
          productSlug: productInfo.slug,
          productName,
          quantity: qty,
          priceCents: itemTotal,
        });

        productSubtotalCents += itemTotal;

        const variantId = session.metadata?.[`item_${index}_variant`];

        try {
          if (variantId) {
            console.log(
              `[Stripe Sync] Decrementing variant stock: ${productInfo.slug} variant ${variantId} x${qty}`
            );
            await incrVariantStock(productInfo.slug, variantId, -qty);
          } else {
            console.log(
              `[Stripe Sync] Decrementing base stock: ${productInfo.slug} x${qty}`
            );
            await incrStock(productInfo.slug, -qty);
          }
        } catch (err) {
          console.error(
            `[Stripe Sync] Stock decrement failed for ${productInfo.slug} ${
              variantId ? `variant ${variantId}` : ""
            } x${qty}`,
            err
          );
        }
      } else {
        // UNMAPPED PRODUCT - Track it anyway with special slug
        console.warn(
          `[Stripe Sync] No product mapping found for price ${priceId} at line item ${index} - tracking as unmapped`
        );

        if (qty > 0) {
          const itemTotal = item.amount_total || 0;
          const productName = item.description || "Unmapped Product";

          // Create unmapped product slug using price ID
          const unmappedSlug = `unmapped-${priceId}`;

          // Add to order items with special unmapped slug
          orderItems.push({
            productSlug: unmappedSlug,
            productName: `${productName} (Not Listed)`,
            quantity: qty,
            priceCents: itemTotal,
          });

          // Add to product subtotal (for points calculation)
          productSubtotalCents += itemTotal;

          console.log(
            `[Stripe Sync] Tracked unmapped product: ${productName} (price: ${priceId}) - can be mapped later`
          );
        }
      }
    }

    // Handle order creation and points
    if (customerEmail) {
      const user = await getUserByEmail(customerEmail);

      if (user) {
        // Redeem points if they were used
        if (pointsRedeemed > 0 && sessionUserId === user.id) {
          try {
            await redeemPoints(
              user.id,
              pointsRedeemed,
              `Redeemed for order #${session.id.slice(0, 8)}`
            );
            console.log(`[Stripe Sync] Redeemed ${pointsRedeemed} points for ${customerEmail}`);
          } catch (err) {
            console.error(`[Stripe Sync] Failed to redeem points:`, err);
          }
        }

        // Create order and award points
        console.log(`[Stripe Sync] Creating order for user ${user.id} (${customerEmail})`);
        await createOrder(
          customerEmail,
          session.id,
          productSubtotalCents,
          orderItems,
          user.id
        );
        await completeOrder(session.id);
        console.log(
          `[Stripe Sync] Awarded ${Math.round(productSubtotalCents / 100)} points to ${customerEmail}`
        );
      } else {
        // Guest checkout
        console.log(`[Stripe Sync] Guest checkout for ${customerEmail}`);
        await createOrder(
          customerEmail,
          session.id,
          productSubtotalCents,
          orderItems
        );
        await completeOrder(session.id);
        console.log(`[Stripe Sync] Guest order created for ${customerEmail}`);
      }
    }

    await logAdminAction({
      action: "stripe-sync.process",
      adminEmail: "admin",
      ip,
      userAgent,
      success: true,
      details: {
        sessionId: session.id,
        customerEmail,
        totalCents: productSubtotalCents,
        itemCount: orderItems.length,
        items: orderItems,
        pointsRedeemed,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Order synced successfully from Stripe",
      sessionId: session.id,
      customerEmail,
      totalCents: productSubtotalCents,
      items: orderItems,
    });
  } catch (error) {
    console.error("[Stripe Sync] Error:", error);
    await logAdminAction({
      action: "stripe-sync.process",
      adminEmail: "admin",
      ip,
      userAgent,
      success: false,
      details: { error: String(error) },
    });
    return NextResponse.json(
      { error: "Failed to sync order", details: String(error) },
      { status: 500 }
    );
  }
}
