import { sendEmail } from "@/lib/email";
import type { Refund } from "@/lib/refundStore";
import type { Order } from "@/lib/userStore";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function reasonLabel(reason: Refund["reason"]): string {
  return {
    customer_request: "Customer request",
    damaged_product: "Damaged product",
    wrong_item_sent: "Wrong item sent",
    quality_issue: "Quality issue",
    shipping_delay: "Shipping delay",
    duplicate_order: "Duplicate order",
    other: "Other",
  }[reason];
}

export async function sendRefundConfirmationEmail(
  order: Order,
  refund: Refund,
): Promise<void> {
  const { createInvoiceAccessToken } = await import("@/lib/userStore");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const invoiceUrl = order.isGuest
    ? `${baseUrl}/invoice/view?token=${encodeURIComponent(
        (await createInvoiceAccessToken(order.id)).token,
      )}`
    : `${baseUrl}/account/invoice/${encodeURIComponent(order.id)}`;
  const logoUrl = `${baseUrl}/images/logo.png`;
  const orderLabel = order.id.startsWith("cs_") ? order.id.slice(-10) : order.id;

  const itemsHtml = refund.items
    .map(
      (item) => `
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #eadfce;color:#2f2924;font:600 14px/1.45 Arial,sans-serif;">
            ${escapeHtml(item.productName)}
            <div style="color:#807467;font-size:12px;font-weight:400;margin-top:3px;">Quantity ${item.quantity}</div>
          </td>
          <td style="padding:14px 0;border-bottom:1px solid #eadfce;color:#2f2924;font:700 14px/1.45 Arial,sans-serif;text-align:right;">
            ${money(item.refundAmountCents)}
          </td>
        </tr>`,
    )
    .join("");

  const html = `<!doctype html>
  <html>
    <body style="margin:0;background:#f5f0e8;color:#2f2924;">
      <div style="display:none;max-height:0;overflow:hidden;">Your ${money(refund.amountCents)} refund has been submitted.</div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f0e8;padding:28px 12px;">
        <tr><td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fffdf9;border:1px solid #e3d6c3;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(66,48,28,.08);">
            <tr>
              <td align="center" style="padding:30px 28px 22px;background:#27231f;">
                <img src="${escapeHtml(logoUrl)}" width="84" height="84" alt="Desert Candle Works" style="display:block;width:84px;height:84px;object-fit:contain;border-radius:16px;">
                <div style="color:#d7b276;font:700 12px/1.4 Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;margin-top:14px;">Refund confirmation</div>
                <h1 style="color:#fffdf9;font:500 30px/1.2 Georgia,serif;margin:8px 0 0;">Your refund is on its way</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 34px;">
                <p style="margin:0 0 20px;color:#51483f;font:15px/1.65 Arial,sans-serif;">
                  We’ve submitted a refund of <strong>${money(refund.amountCents)}</strong> to your original payment method for order <strong>${escapeHtml(orderLabel)}</strong>.
                </p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4ecdf;border-radius:12px;margin:0 0 24px;">
                  <tr>
                    <td style="padding:18px 20px;color:#6f6255;font:12px/1.5 Arial,sans-serif;text-transform:uppercase;letter-spacing:1px;">Refund amount</td>
                    <td style="padding:18px 20px;color:#2f2924;font:700 24px/1.2 Georgia,serif;text-align:right;">${money(refund.amountCents)}</td>
                  </tr>
                  <tr>
                    <td style="padding:0 20px 18px;color:#6f6255;font:13px/1.5 Arial,sans-serif;">Reason</td>
                    <td style="padding:0 20px 18px;color:#2f2924;font:600 13px/1.5 Arial,sans-serif;text-align:right;">${escapeHtml(reasonLabel(refund.reason))}</td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  ${itemsHtml}
                </table>
                <p style="margin:24px 0;color:#6f6255;font:14px/1.65 Arial,sans-serif;">
                  Most banks post refunds within 5–10 business days. Processing time is controlled by your bank or card issuer.
                </p>
                <div style="text-align:center;margin:26px 0 8px;">
                  <a href="${escapeHtml(invoiceUrl)}" style="display:inline-block;background:#b88746;color:#fff;text-decoration:none;border-radius:9px;padding:14px 25px;font:700 14px/1 Arial,sans-serif;">View order invoice</a>
                </div>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:22px 28px;background:#eee4d5;color:#75695d;font:12px/1.65 Arial,sans-serif;">
                Questions? Reply to this email or contact
                <a href="mailto:contact@desertcandleworks.com" style="color:#8a642f;">contact@desertcandleworks.com</a><br>
                Desert Candle Works · Scottsdale, Arizona
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
  </html>`;

  await sendEmail({
    to: order.email,
    subject: `Your ${money(refund.amountCents)} refund from Desert Candle Works`,
    html,
    text: [
      "Your refund is on its way",
      "",
      `We submitted ${money(refund.amountCents)} to your original payment method for order ${orderLabel}.`,
      `Reason: ${reasonLabel(refund.reason)}`,
      "Most banks post refunds within 5–10 business days.",
      "",
      `View your order invoice: ${invoiceUrl}`,
      "Questions? contact@desertcandleworks.com",
    ].join("\n"),
  });
}
