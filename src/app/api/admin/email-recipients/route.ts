import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { getAllOrders, listAllUsers } from "@/lib/userStore";

export const runtime = "nodejs";

type Recipient = {
  email: string;
  name: string;
  type: "user" | "guest";
  orderId?: string;
  lastOrderDate?: string;
};

/**
 * GET /api/admin/email-recipients
 * Fetch all available email recipients (users + order emails)
 */
export async function GET(req: NextRequest) {
  const isAdmin = await isAdminAuthed();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const recipients: Recipient[] = [];
    const seenEmails = new Set<string>();

    // Get all registered users
    const users = await listAllUsers();
    for (const user of users) {
      if (!seenEmails.has(user.email)) {
        recipients.push({
          email: user.email,
          name: `${user.firstName} ${user.lastName}`.trim(),
          type: "user",
        });
        seenEmails.add(user.email);
      }
    }

    // Get all orders to find guest emails and associate order IDs
    const orders = await getAllOrders();
    const emailToLastOrder = new Map<string, { orderId: string; date: string }>();

    // Build map of email -> most recent order
    for (const order of orders) {
      if (order.email && !order.email.includes("@admin.local")) {
        const existingOrder = emailToLastOrder.get(order.email);
        if (!existingOrder || new Date(order.createdAt) > new Date(existingOrder.date)) {
          emailToLastOrder.set(order.email, {
            orderId: order.id,
            date: order.createdAt,
          });
        }
      }
    }

    // Add order info to existing users and add guest customers
    for (const [email, orderInfo] of emailToLastOrder.entries()) {
      const existingRecipient = recipients.find(r => r.email === email);
      if (existingRecipient) {
        // Update user with order info
        existingRecipient.orderId = orderInfo.orderId;
        existingRecipient.lastOrderDate = orderInfo.date;
      } else if (!seenEmails.has(email)) {
        // Add guest customer
        recipients.push({
          email,
          name: email.split('@')[0], // Use email prefix as name
          type: "guest",
          orderId: orderInfo.orderId,
          lastOrderDate: orderInfo.date,
        });
        seenEmails.add(email);
      }
    }

    // Sort by last order date (most recent first), then by name
    recipients.sort((a, b) => {
      if (a.lastOrderDate && b.lastOrderDate) {
        return new Date(b.lastOrderDate).getTime() - new Date(a.lastOrderDate).getTime();
      }
      if (a.lastOrderDate) return -1;
      if (b.lastOrderDate) return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ recipients });
  } catch (error) {
    console.error("[Email Recipients] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch recipients", details: String(error) },
      { status: 500 }
    );
  }
}
