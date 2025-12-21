import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { sendEmail } from "@/lib/email";
import { getOrderById, listOrders } from "@/lib/userStore";
import { logAdminAction } from "@/lib/adminLogs";

export const runtime = "nodejs";

type EmailTemplate = "shipping" | "delivery" | "custom";

type SendEmailRequest = {
  // Recipient selection
  recipients: "single" | "all_customers" | "order_customers";
  singleEmail?: string;
  orderId?: string; // For order-specific emails

  // Template
  template: EmailTemplate;
  subject: string;
  htmlBody: string;
  textBody: string;

  // For shipping/delivery templates
  trackingNumber?: string;
};

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  // Check admin auth
  const isAdmin = await isAdminAuthed();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json() as SendEmailRequest;

    // Validate request
    if (!body.subject || !body.htmlBody || !body.textBody) {
      return NextResponse.json(
        { error: "Subject, HTML body, and text body are required" },
        { status: 400 }
      );
    }

    if (!body.recipients) {
      return NextResponse.json(
        { error: "Recipients type is required" },
        { status: 400 }
      );
    }

    // Determine recipient list
    let recipientEmails: string[] = [];
    let recipientCount = 0;

    if (body.recipients === "single") {
      if (!body.singleEmail) {
        return NextResponse.json(
          { error: "Email address is required for single recipient" },
          { status: 400 }
        );
      }
      recipientEmails = [body.singleEmail];
    } else if (body.recipients === "order_customers") {
      // Get email from specific order
      if (!body.orderId) {
        return NextResponse.json(
          { error: "Order ID is required for order customer emails" },
          { status: 400 }
        );
      }
      const order = await getOrderById(body.orderId);
      if (!order) {
        return NextResponse.json(
          { error: "Order not found" },
          { status: 404 }
        );
      }
      recipientEmails = [order.email];
    } else if (body.recipients === "all_customers") {
      // Get all unique customer emails from orders
      const orders = await listOrders();
      const uniqueEmails = new Set<string>();
      orders.forEach(order => {
        if (order.email && !order.email.includes("@admin.local")) {
          uniqueEmails.add(order.email);
        }
      });
      recipientEmails = Array.from(uniqueEmails);
    }

    if (recipientEmails.length === 0) {
      return NextResponse.json(
        { error: "No recipients found" },
        { status: 400 }
      );
    }

    // Send emails
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const email of recipientEmails) {
      try {
        await sendEmail({
          to: email,
          subject: body.subject,
          html: body.htmlBody,
          text: body.textBody,
        });
        results.success++;
        console.log(`[Admin Email] Sent to ${email}`);
      } catch (err) {
        results.failed++;
        results.errors.push(`${email}: ${err instanceof Error ? err.message : String(err)}`);
        console.error(`[Admin Email] Failed to send to ${email}:`, err);
      }
    }

    recipientCount = recipientEmails.length;

    // Log admin action
    await logAdminAction({
      action: "email.send",
      adminEmail: "admin",
      ip,
      userAgent,
      success: results.failed === 0,
      details: {
        template: body.template,
        recipients: body.recipients,
        recipientCount,
        subject: body.subject,
        successCount: results.success,
        failedCount: results.failed,
        orderId: body.orderId,
        trackingNumber: body.trackingNumber,
      },
    });

    return NextResponse.json({
      success: true,
      sent: results.success,
      failed: results.failed,
      total: recipientCount,
      errors: results.errors,
      message: `Successfully sent ${results.success} of ${recipientCount} emails`,
    });
  } catch (error) {
    console.error("[Admin Email] Error:", error);
    await logAdminAction({
      action: "email.send",
      adminEmail: "admin",
      ip,
      userAgent,
      success: false,
      details: { error: String(error) },
    });
    return NextResponse.json(
      { error: "Failed to send email", details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to fetch email templates
 */
export async function GET(req: NextRequest) {
  const isAdmin = await isAdminAuthed();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const templateType = searchParams.get("template");
  const orderId = searchParams.get("orderId");
  const trackingNumber = searchParams.get("trackingNumber");

  try {
    const template = {
      subject: "",
      html: "",
      text: "",
    };

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    if (templateType === "shipping" && orderId && trackingNumber) {
      const order = await getOrderById(orderId);
      if (!order) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }

      const trackingUrl = `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`;

      template.subject = `📦 Your Order Has Shipped! #${orderId} - Desert Candle Works`;
      template.html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
    .header { background: #1e40af; color: white; padding: 20px; text-align: center; }
    .content { padding: 30px; background: #fff; }
    .tracking-box { background: #eff6ff; border: 2px solid #1e40af; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
    .tracking-number { font-size: 24px; font-weight: bold; color: #1e40af; letter-spacing: 2px; }
    .button { display: inline-block; background: #1e40af; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 15px; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; color: white;">Desert Candle Works</h1>
    <p style="margin: 10px 0 0 0; color: #e0e7ff;">Your order is on its way!</p>
  </div>
  <div class="content">
    <h2>📦 Shipped!</h2>
    <p>Great news! Your order has been shipped and is on its way to you.</p>

    <p style="margin: 20px 0;">
      <strong>Order #${orderId}</strong><br>
      <span style="color: #666; font-size: 14px;">Shipped on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
    </p>

    <div class="tracking-box">
      <p style="margin: 0 0 10px 0; color: #1e40af; font-weight: 600;">Tracking Number</p>
      <div class="tracking-number">${trackingNumber}</div>
      <p style="margin: 15px 0 0 0;">
        <a href="${trackingUrl}" class="button">Track Your Package</a>
      </p>
    </div>

    <p>Your candles were hand-poured with care in Scottsdale, Arizona. We hope you enjoy them!</p>

    <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      Questions about your delivery? Contact us at <a href="mailto:contact@desertcandleworks.com">contact@desertcandleworks.com</a>
    </p>
  </div>
  <div class="footer">
    <p style="margin: 0;">© ${new Date().getFullYear()} Desert Candle Works. All rights reserved.</p>
    <p style="margin: 5px 0 0 0;">Scottsdale, AZ | <a href="${baseUrl}">www.desertcandleworks.com</a></p>
  </div>
</body>
</html>`;

      template.text = `
Desert Candle Works - Your Order Has Shipped!

📦 Great news! Your order has been shipped and is on its way to you.

Order #${orderId}
Shipped on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

TRACKING NUMBER:
${trackingNumber}

Track your package:
${trackingUrl}

Your candles were hand-poured with care in Scottsdale, Arizona. We hope you enjoy them!

Questions about your delivery? Contact us at contact@desertcandleworks.com

© ${new Date().getFullYear()} Desert Candle Works. All rights reserved.
Scottsdale, AZ | www.desertcandleworks.com
`;
    } else if (templateType === "delivery" && orderId && trackingNumber) {
      const order = await getOrderById(orderId);
      if (!order) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }

      template.subject = `✅ Delivered! Order #${orderId} - Desert Candle Works`;
      template.html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
    .header { background: #15803d; color: white; padding: 20px; text-align: center; }
    .content { padding: 30px; background: #fff; }
    .delivery-box { background: #f0fdf4; border: 2px solid #15803d; border-radius: 8px; padding: 30px; margin: 20px 0; text-align: center; }
    .button { display: inline-block; background: #1e40af; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 15px; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; color: white;">Desert Candle Works</h1>
    <p style="margin: 10px 0 0 0; color: #d1fae5;">Your order has been delivered!</p>
  </div>
  <div class="content">
    <h2>✅ Delivered!</h2>
    <p>Your Desert Candle Works order has been successfully delivered!</p>

    <p style="margin: 20px 0;">
      <strong>Order #${orderId}</strong><br>
      <span style="color: #666; font-size: 14px;">Delivered on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
    </p>

    <div class="delivery-box">
      <div style="font-size: 48px; margin-bottom: 10px;">📬</div>
      <p style="margin: 0; font-size: 18px; font-weight: 600; color: #15803d;">
        Package Delivered!
      </p>
      <p style="margin: 10px 0 0 0; color: #666;">
        Tracking #${trackingNumber}
      </p>
    </div>

    <h3 style="color: #1e40af;">🕯️ Enjoy Your Candles!</h3>
    <p>We hope you love your hand-poured candles! Each one is crafted with care right here in Scottsdale, Arizona.</p>

    <p><strong>Care Tips:</strong></p>
    <ul style="color: #666;">
      <li>Trim wick to 1/4" before each use</li>
      <li>Burn for 2-3 hours at a time for best results</li>
      <li>Keep away from drafts and flammable materials</li>
    </ul>

    <p style="text-align: center; margin: 30px 0;">
      <a href="${baseUrl}/products" class="button">Shop More Candles</a>
    </p>

    <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      Love your candles? Leave us a review or tag us on social media @desertcandleworks
    </p>
  </div>
  <div class="footer">
    <p style="margin: 0;">© ${new Date().getFullYear()} Desert Candle Works. All rights reserved.</p>
    <p style="margin: 5px 0 0 0;">Scottsdale, AZ | <a href="${baseUrl}">www.desertcandleworks.com</a></p>
  </div>
</body>
</html>`;

      template.text = `
Desert Candle Works - Your Order Has Been Delivered!

✅ Your Desert Candle Works order has been successfully delivered!

Order #${orderId}
Delivered on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

📬 PACKAGE DELIVERED!
Tracking #${trackingNumber}

🕯️ ENJOY YOUR CANDLES!
We hope you love your hand-poured candles! Each one is crafted with care right here in Scottsdale, Arizona.

CARE TIPS:
- Trim wick to 1/4" before each use
- Burn for 2-3 hours at a time for best results
- Keep away from drafts and flammable materials

Love your candles? Leave us a review or tag us on social media @desertcandleworks

Shop more candles: ${baseUrl}/products

© ${new Date().getFullYear()} Desert Candle Works. All rights reserved.
Scottsdale, AZ | www.desertcandleworks.com
`;
    } else {
      // Custom template
      template.subject = "Message from Desert Candle Works";
      template.html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
    .header { background: #1e40af; color: white; padding: 20px; text-align: center; }
    .content { padding: 30px; background: #fff; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; color: white;">Desert Candle Works</h1>
  </div>
  <div class="content">
    <p>[Your message here]</p>
  </div>
  <div class="footer">
    <p style="margin: 0;">© ${new Date().getFullYear()} Desert Candle Works. All rights reserved.</p>
    <p style="margin: 5px 0 0 0;">Scottsdale, AZ | <a href="${baseUrl}">www.desertcandleworks.com</a></p>
  </div>
</body>
</html>`;

      template.text = `
Desert Candle Works

[Your message here]

© ${new Date().getFullYear()} Desert Candle Works. All rights reserved.
Scottsdale, AZ | www.desertcandleworks.com
`;
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error("[Admin Email] Error fetching template:", error);
    return NextResponse.json(
      { error: "Failed to fetch template", details: String(error) },
      { status: 500 }
    );
  }
}
