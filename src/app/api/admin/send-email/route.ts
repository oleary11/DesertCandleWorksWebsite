import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { getOrderById } from "@/lib/userStore";
import { sendAdminMessage } from "@/lib/adminMessages";
import { createThread, deleteThread, replyDomain } from "@/lib/emailThreadsStore";
import { listOptedOut } from "@/lib/contacts";
import { logAdminAction } from "@/lib/adminLogs";
import type { EmailDesign } from "@/lib/emailFrames";
import { recordScheduledEmail, scheduleTimeError } from "@/lib/scheduledEmails";

export const runtime = "nodejs";

type SendEmailRequest = {
  recipients: Array<{ email: string; name?: string }>;
  subject: string;
  /** Plain text; rendered into the shared email layout on the server. */
  message: string;
  /** Signed by Josh & Cori with the signature image. */
  personal?: boolean;
  template?: string;
  orderId?: string;
  trackingNumber?: string;
  /** Send inside an email frame; the message becomes an optional note within it. */
  design?: EmailDesign | null;
  /** ISO time to send at instead of now (Resend holds it until then). */
  scheduleAt?: string | null;
};

function cleanDesign(design: SendEmailRequest["design"]): EmailDesign | null {
  if (!design?.frameId) return null;
  return {
    frameId: String(design.frameId),
    headline: String(design.headline ?? "").trim(),
    offer: String(design.offer ?? "").trim() || undefined,
    code: String(design.code ?? "").trim().toUpperCase() || undefined,
    endsText: String(design.endsText ?? "").trim() || undefined,
    ctaLabel: String(design.ctaLabel ?? "").trim() || undefined,
    ctaUrl: String(design.ctaUrl ?? "").trim() || "/shop",
    productSlugs: (Array.isArray(design.productSlugs) ? design.productSlugs : []).map(String).slice(0, 3),
    pickupNote: design.pickupNote !== false,
  };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  const isAdmin = await isAdminAuthed();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as SendEmailRequest;
    const subject = body.subject?.trim();
    const message = body.message?.trim() ?? "";
    const personal = !!body.personal;
    const design = cleanDesign(body.design);

    if (design && !design.headline) {
      return NextResponse.json({ error: "A framed email needs a headline" }, { status: 400 });
    }
    if (!subject || (!message && !design)) {
      return NextResponse.json({ error: "Subject and message are required" }, { status: 400 });
    }
    const scheduledAt = body.scheduleAt ? new Date(body.scheduleAt) : undefined;
    const timeError = scheduledAt && scheduleTimeError(scheduledAt);
    if (timeError) {
      return NextResponse.json({ error: timeError }, { status: 400 });
    }

    const seen = new Set<string>();
    const recipients = (Array.isArray(body.recipients) ? body.recipients : []).filter((r) => {
      const email = r?.email?.trim().toLowerCase();
      if (!email || !EMAIL.test(email) || seen.has(email)) return false;
      seen.add(email);
      return true;
    });
    if (recipients.length === 0) {
      return NextResponse.json({ error: "No valid recipients" }, { status: 400 });
    }

    // Mass emails skip anyone who unsubscribed (here or in the newsletter); a one-to-one
    // email is a direct message and always goes out.
    const bulk = recipients.length > 1;
    let skippedUnsubscribed = 0;
    if (bulk) {
      const optedOut = await listOptedOut();
      const before = recipients.length;
      recipients.splice(0, recipients.length, ...recipients.filter((r) => !optedOut.has(r.email.trim().toLowerCase())));
      skippedUnsubscribed = before - recipients.length;
      if (recipients.length === 0) {
        return NextResponse.json({ error: "Everyone selected has unsubscribed" }, { status: 400 });
      }
    }

    // A one-to-one email becomes a conversation so the customer's reply shows up in admin.
    // Mass emails stay one-way (replies go to contact@).
    const thread =
      !bulk
        ? await createThread({
            customerEmail: recipients[0].email.trim(),
            customerName: recipients[0].name,
            subject,
            personal,
          })
        : null;

    const results = { success: 0, failed: 0, errors: [] as string[] };
    const resendIds: string[] = [];
    for (const recipient of recipients) {
      try {
        const resendId = await sendAdminMessage({
          to: recipient.email.trim(),
          subject,
          message,
          personal,
          threadId: thread?.id,
          orderId: body.orderId || undefined,
          bulk,
          design,
          scheduledAt,
        });
        if (resendId) resendIds.push(resendId);
        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push(`${recipient.email}: ${err instanceof Error ? err.message : String(err)}`);
        console.error(`[Admin Email] Failed to send to ${recipient.email}:`, err);
      }
    }
    if (thread && results.success === 0) await deleteThread(thread.id);
    if (scheduledAt && results.success > 0) {
      await recordScheduledEmail({
        subject,
        recipientsLabel: bulk
          ? `${results.success} contacts`
          : recipients[0].name?.trim() || recipients[0].email.trim(),
        recipientCount: results.success,
        scheduledAt,
        resendIds,
        threadId: thread?.id,
      });
    }

    await logAdminAction({
      action: "email.send",
      adminEmail: "admin",
      ip,
      userAgent,
      success: results.failed === 0,
      details: {
        template: body.template,
        recipientCount: recipients.length,
        subject,
        personal,
        scheduledAt: scheduledAt?.toISOString(),
        threadId: results.success > 0 ? thread?.id : undefined,
        successCount: results.success,
        failedCount: results.failed,
        orderId: body.orderId,
        trackingNumber: body.trackingNumber,
      },
    });

    return NextResponse.json({
      success: results.success > 0,
      sent: results.success,
      failed: results.failed,
      total: recipients.length,
      errors: results.errors,
      threadId: results.success > 0 ? thread?.id ?? null : null,
      repliesTracked: !!(thread && replyDomain()),
      skippedUnsubscribed,
      scheduledAt: scheduledAt?.toISOString() ?? null,
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
    return NextResponse.json({ error: "Failed to send email", details: String(error) }, { status: 500 });
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
