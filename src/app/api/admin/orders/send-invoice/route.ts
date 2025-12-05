import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed, getAdminSession } from "@/lib/adminSession";
import { getOrderById } from "@/lib/userStore";
import { sendOrderInvoiceEmail } from "@/lib/email";
import { logAdminAction } from "@/lib/adminLogs";

export const runtime = "nodejs";

/**
 * POST /api/admin/orders/send-invoice
 * Send or resend an invoice email for an order
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  const authed = await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await getAdminSession();
  const body = await req.json().catch(() => ({}));
  const { orderId, customEmail } = body;

  if (!orderId) {
    await logAdminAction({
      action: "order.send-invoice",
      adminEmail: session?.email,
      ip,
      userAgent,
      success: false,
      details: { reason: "missing_order_id" },
    });

    return NextResponse.json(
      { error: "Order ID is required" },
      { status: 400 }
    );
  }

  try {
    // Verify order exists
    const order = await getOrderById(orderId);

    if (!order) {
      await logAdminAction({
        action: "order.send-invoice",
        adminEmail: session?.email,
        ip,
        userAgent,
        success: false,
        details: { reason: "order_not_found", orderId },
      });

      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Determine which email to send to
    const recipientEmail = customEmail || order.email;

    // Validate email for manual sales
    if (order.email === "manual-sale@admin.local" && !customEmail) {
      await logAdminAction({
        action: "order.send-invoice",
        adminEmail: session?.email,
        ip,
        userAgent,
        success: false,
        details: { reason: "manual_sale_missing_email", orderId },
      });

      return NextResponse.json(
        { error: "Custom email is required for manual sales" },
        { status: 400 }
      );
    }

    // Send invoice email with custom recipient if provided
    await sendOrderInvoiceEmail(orderId, customEmail);

    await logAdminAction({
      action: "order.send-invoice",
      adminEmail: session?.email,
      ip,
      userAgent,
      success: true,
      details: {
        orderId,
        customerEmail: order.email,
        recipientEmail,
        isCustomEmail: !!customEmail,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Invoice email sent to ${recipientEmail}`,
    });
  } catch (error) {
    await logAdminAction({
      action: "order.send-invoice",
      adminEmail: session?.email,
      ip,
      userAgent,
      success: false,
      details: { error: String(error), orderId },
    });

    return NextResponse.json(
      { error: "Failed to send invoice email" },
      { status: 500 }
    );
  }
}
