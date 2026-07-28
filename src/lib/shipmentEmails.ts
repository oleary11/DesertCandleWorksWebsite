import { sendEmail } from "@/lib/email";
import { listResolvedProducts } from "@/lib/resolvedProducts";
import {
  createInvoiceAccessToken,
  getOrderById,
  type Order,
} from "@/lib/userStore";
import { getPrimaryImage } from "@/lib/products";

export type ShipmentEmailDetails = {
  trackingNumber: string;
  trackingUrl?: string;
  carrierName?: string;
  serviceName?: string;
  estimatedDelivery?: string;
  statusDetails?: string;
  deliveredAt?: string;
  deliveryLocation?: string;
};

const COLORS = {
  ink: "#211a16",
  muted: "#6f655e",
  cream: "#f7f2eb",
  sand: "#eadfce",
  gold: "#b97835",
  goldDark: "#8f5520",
  white: "#ffffff",
  green: "#256b4b",
  greenSoft: "#e9f4ee",
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(cents?: number): string {
  return `$${((cents || 0) / 100).toFixed(2)}`;
}

function absoluteUrl(baseUrl: string, value?: string): string | undefined {
  if (!value) return undefined;
  if (/^data:/i.test(value)) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  return `${baseUrl}${value.startsWith("/") ? value : `/${value}`}`;
}

function humanDate(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

async function buildEmailContext(orderId: string) {
  const order = await getOrderById(orderId);
  if (!order) throw new Error(`Order ${orderId} not found`);

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "https://www.desertcandleworks.com";
  let invoiceUrl: string;
  if (order.isGuest) {
    const token = await createInvoiceAccessToken(orderId);
    invoiceUrl = `${baseUrl}/invoice/view?token=${encodeURIComponent(token.token)}`;
  } else {
    invoiceUrl = `${baseUrl}/account/invoice/${encodeURIComponent(orderId)}`;
  }

  const products = await listResolvedProducts();
  const productMap = new Map(products.map(product => [product.slug, product]));
  const items = order.items.map(item => {
    const product = productMap.get(item.productSlug);
    return {
      ...item,
      imageUrl: absoluteUrl(baseUrl, product ? getPrimaryImage(product) : undefined),
    };
  });

  return {
    order,
    items,
    baseUrl,
    invoiceUrl,
    logoUrl: `${baseUrl}/images/logo.png`,
  };
}

function header(logoUrl: string, preheader: string): string {
  return `
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ${escapeHtml(preheader)}
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${COLORS.ink};">
      <tr>
        <td align="center" style="padding:28px 24px 24px;">
          <img src="${escapeHtml(logoUrl)}" width="92" height="92" alt="Desert Candle Works" style="display:block;width:92px;height:92px;object-fit:contain;border:0;border-radius:18px;margin:0 auto 10px;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:30px;letter-spacing:.4px;color:${COLORS.white};">
            Desert Candle Works
          </div>
          <div style="font-family:Arial,sans-serif;font-size:11px;line-height:18px;letter-spacing:2.2px;text-transform:uppercase;color:${COLORS.sand};margin-top:5px;">
            Handcrafted in Scottsdale
          </div>
        </td>
      </tr>
    </table>
  `;
}

function orderItems(
  items: Array<Order["items"][number] & { imageUrl?: string }>
): string {
  return items
    .map(item => {
      const variant = [item.sizeName, item.variantId]
        .filter(Boolean)
        .join(" · ");
      return `
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid ${COLORS.sand};vertical-align:middle;width:76px;">
            ${
              item.imageUrl
                ? `<img src="${escapeHtml(item.imageUrl)}" width="64" height="64" alt="${escapeHtml(item.productName)}" style="display:block;width:64px;height:64px;border-radius:10px;object-fit:cover;border:1px solid ${COLORS.sand};">`
                : `<div style="width:64px;height:64px;border-radius:10px;background:${COLORS.cream};border:1px solid ${COLORS.sand};"></div>`
            }
          </td>
          <td style="padding:14px 12px;border-bottom:1px solid ${COLORS.sand};vertical-align:middle;">
            <div style="font-family:Arial,sans-serif;font-size:15px;line-height:21px;font-weight:700;color:${COLORS.ink};">
              ${escapeHtml(item.productName)}
            </div>
            ${
              variant
                ? `<div style="font-family:Arial,sans-serif;font-size:12px;line-height:18px;color:${COLORS.muted};margin-top:2px;">${escapeHtml(variant)}</div>`
                : ""
            }
            <div style="font-family:Arial,sans-serif;font-size:12px;line-height:18px;color:${COLORS.muted};margin-top:2px;">
              Quantity ${item.quantity}
            </div>
          </td>
          <td align="right" style="padding:14px 0;border-bottom:1px solid ${COLORS.sand};vertical-align:middle;font-family:Arial,sans-serif;font-size:14px;font-weight:700;color:${COLORS.ink};white-space:nowrap;">
            ${money(item.priceCents)}
          </td>
        </tr>
      `;
    })
    .join("");
}

function totals(order: Order): string {
  const discountCents = Math.max(
    0,
    (order.productSubtotalCents || 0) +
      (order.shippingCents || 0) +
      (order.taxCents || 0) -
      order.totalCents
  );
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-family:Arial,sans-serif;font-size:13px;line-height:21px;color:${COLORS.muted};">
      <tr><td style="padding:3px 0;">Subtotal</td><td align="right" style="padding:3px 0;">${money(order.productSubtotalCents)}</td></tr>
      <tr><td style="padding:3px 0;">Shipping</td><td align="right" style="padding:3px 0;">${order.shippingCents === 0 ? "Free" : money(order.shippingCents)}</td></tr>
      <tr><td style="padding:3px 0;">Tax</td><td align="right" style="padding:3px 0;">${money(order.taxCents)}</td></tr>
      ${discountCents > 0 ? `<tr><td style="padding:3px 0;color:${COLORS.green};">Discount</td><td align="right" style="padding:3px 0;color:${COLORS.green};">−${money(discountCents)}</td></tr>` : ""}
      <tr>
        <td style="padding:10px 0 0;border-top:1px solid ${COLORS.sand};font-size:16px;font-weight:700;color:${COLORS.ink};">Total</td>
        <td align="right" style="padding:10px 0 0;border-top:1px solid ${COLORS.sand};font-size:16px;font-weight:700;color:${COLORS.ink};">${money(order.totalCents)}</td>
      </tr>
    </table>
  `;
}

function address(order: Order): string {
  const value = order.shippingAddress;
  if (!value) return "";
  const cityLine = [value.city, value.state, value.postalCode]
    .filter(Boolean)
    .join(" ");
  return `
    <div style="font-family:Arial,sans-serif;font-size:13px;line-height:20px;color:${COLORS.muted};">
      ${value.name ? `<strong style="color:${COLORS.ink};">${escapeHtml(value.name)}</strong><br>` : ""}
      ${escapeHtml(value.line1)}<br>
      ${value.line2 ? `${escapeHtml(value.line2)}<br>` : ""}
      ${escapeHtml(cityLine)}<br>
      ${escapeHtml(value.country || "US")}
    </div>
  `;
}

function footer(baseUrl: string): string {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td align="center" style="padding:28px 24px;font-family:Arial,sans-serif;font-size:12px;line-height:19px;color:${COLORS.muted};">
          Questions? We are happy to help.<br>
          <a href="mailto:contact@desertcandleworks.com" style="color:${COLORS.goldDark};text-decoration:none;font-weight:700;">contact@desertcandleworks.com</a>
          &nbsp;·&nbsp;
          <a href="${escapeHtml(baseUrl)}" style="color:${COLORS.goldDark};text-decoration:none;font-weight:700;">desertcandleworks.com</a>
          <div style="margin-top:14px;color:#958a82;">
            Desert Candle Works · Scottsdale, Arizona<br>
            © ${new Date().getFullYear()} Desert Candle Works
          </div>
        </td>
      </tr>
    </table>
  `;
}

function detailsCard(details: ShipmentEmailDetails): string {
  const eta = humanDate(details.estimatedDelivery);
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${COLORS.cream};border:1px solid ${COLORS.sand};border-radius:12px;">
      <tr>
        <td style="padding:20px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="font-family:Arial,sans-serif;font-size:11px;line-height:17px;letter-spacing:1.4px;text-transform:uppercase;color:${COLORS.muted};">Carrier</td>
              <td align="right" style="font-family:Arial,sans-serif;font-size:14px;line-height:20px;font-weight:700;color:${COLORS.ink};">${escapeHtml(details.carrierName || "Carrier")}</td>
            </tr>
            ${
              details.serviceName
                ? `<tr><td style="padding-top:8px;font-family:Arial,sans-serif;font-size:11px;line-height:17px;letter-spacing:1.4px;text-transform:uppercase;color:${COLORS.muted};">Service</td><td align="right" style="padding-top:8px;font-family:Arial,sans-serif;font-size:14px;line-height:20px;color:${COLORS.ink};">${escapeHtml(details.serviceName)}</td></tr>`
                : ""
            }
            <tr>
              <td style="padding-top:8px;font-family:Arial,sans-serif;font-size:11px;line-height:17px;letter-spacing:1.4px;text-transform:uppercase;color:${COLORS.muted};">Tracking</td>
              <td align="right" style="padding-top:8px;font-family:Arial,sans-serif;font-size:13px;line-height:20px;font-weight:700;color:${COLORS.ink};">${escapeHtml(details.trackingNumber)}</td>
            </tr>
            ${
              eta
                ? `<tr><td style="padding-top:8px;font-family:Arial,sans-serif;font-size:11px;line-height:17px;letter-spacing:1.4px;text-transform:uppercase;color:${COLORS.muted};">Estimated delivery</td><td align="right" style="padding-top:8px;font-family:Arial,sans-serif;font-size:13px;line-height:20px;color:${COLORS.ink};">${escapeHtml(eta)}</td></tr>`
                : ""
            }
          </table>
        </td>
      </tr>
    </table>
  `;
}

function textSummary(order: Order, details: ShipmentEmailDetails, invoiceUrl: string) {
  return [
    `Order #${order.id}`,
    `${details.carrierName || "Carrier"} tracking: ${details.trackingNumber}`,
    details.serviceName ? `Service: ${details.serviceName}` : "",
    details.estimatedDelivery
      ? `Estimated delivery: ${humanDate(details.estimatedDelivery)}`
      : "",
    details.trackingUrl ? `Track package: ${details.trackingUrl}` : "",
    `View invoice: ${invoiceUrl}`,
    "",
    "Items:",
    ...order.items.map(item => `${item.quantity}× ${item.productName}`),
    "",
    `Order total: ${money(order.totalCents)}`,
    "",
    "Questions? contact@desertcandleworks.com",
  ]
    .filter(value => value !== "")
    .join("\n");
}

export async function sendPremiumShippingEmail(
  orderId: string,
  details: ShipmentEmailDetails
): Promise<void> {
  const { order, items, baseUrl, invoiceUrl, logoUrl } =
    await buildEmailContext(orderId);
  const trackUrl =
    details.trackingUrl ||
    `https://www.google.com/search?q=${encodeURIComponent(`${details.carrierName || ""} tracking ${details.trackingNumber}`)}`;

  const html = `
    <!doctype html>
    <html lang="en">
      <body style="margin:0;padding:0;background:${COLORS.cream};">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${COLORS.cream};">
          <tr>
            <td align="center" style="padding:24px 10px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:${COLORS.white};border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(33,26,22,.08);">
                <tr><td>${header(logoUrl, `Order ${orderId} is on its way.`)}</td></tr>
                <tr>
                  <td style="padding:38px 34px 8px;">
                    <div style="font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:42px;color:${COLORS.ink};text-align:center;">Your order is on the way</div>
                    <div style="font-family:Arial,sans-serif;font-size:15px;line-height:24px;color:${COLORS.muted};text-align:center;margin-top:12px;">
                      Your handcrafted pieces have left our studio. Follow their journey using the tracking details below.
                    </div>
                    <div style="font-family:Arial,sans-serif;font-size:12px;line-height:18px;color:${COLORS.goldDark};text-align:center;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-top:16px;">Order ${escapeHtml(orderId)}</div>
                  </td>
                </tr>
                <tr><td style="padding:24px 34px 0;">${detailsCard(details)}</td></tr>
                <tr>
                  <td align="center" style="padding:22px 34px 8px;">
                    <a href="${escapeHtml(trackUrl)}" style="display:inline-block;background:${COLORS.gold};color:${COLORS.white};font-family:Arial,sans-serif;font-size:14px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:8px;">Track your package</a>
                  </td>
                </tr>
                ${
                  details.statusDetails
                    ? `<tr><td style="padding:16px 34px 0;font-family:Arial,sans-serif;font-size:13px;line-height:21px;color:${COLORS.muted};text-align:center;">${escapeHtml(details.statusDetails)}</td></tr>`
                    : ""
                }
                <tr>
                  <td style="padding:32px 34px 0;">
                    <div style="font-family:Arial,sans-serif;font-size:12px;line-height:18px;letter-spacing:1.5px;text-transform:uppercase;color:${COLORS.goldDark};font-weight:700;margin-bottom:4px;">Inside your shipment</div>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${orderItems(items)}</table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:26px 34px 0;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td width="52%" style="vertical-align:top;padding-right:20px;">
                          <div style="font-family:Arial,sans-serif;font-size:11px;line-height:17px;letter-spacing:1.4px;text-transform:uppercase;color:${COLORS.goldDark};font-weight:700;margin-bottom:8px;">Shipping to</div>
                          ${address(order)}
                        </td>
                        <td width="48%" style="vertical-align:top;">${totals(order)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:32px 34px 4px;">
                    <a href="${escapeHtml(invoiceUrl)}" style="display:inline-block;border:1px solid ${COLORS.gold};color:${COLORS.goldDark};font-family:Arial,sans-serif;font-size:14px;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:8px;">Open order invoice</a>
                  </td>
                </tr>
                <tr><td>${footer(baseUrl)}</td></tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  await sendEmail({
    to: order.email,
    subject: `Your Desert Candle Works order is on the way · ${orderId}`,
    html,
    text: `Your Desert Candle Works order is on the way.\n\n${textSummary(order, details, invoiceUrl)}`,
  });
}

export async function sendPremiumDeliveryEmail(
  orderId: string,
  details: ShipmentEmailDetails
): Promise<void> {
  const { order, items, baseUrl, invoiceUrl, logoUrl } =
    await buildEmailContext(orderId);
  const deliveredDate = humanDate(details.deliveredAt) || humanDate(new Date().toISOString());

  const html = `
    <!doctype html>
    <html lang="en">
      <body style="margin:0;padding:0;background:${COLORS.cream};">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${COLORS.cream};">
          <tr>
            <td align="center" style="padding:24px 10px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:${COLORS.white};border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(33,26,22,.08);">
                <tr><td>${header(logoUrl, `Order ${orderId} has been delivered.`)}</td></tr>
                <tr>
                  <td style="padding:38px 34px 10px;text-align:center;">
                    <div style="display:inline-block;background:${COLORS.greenSoft};color:${COLORS.green};font-family:Arial,sans-serif;font-size:11px;line-height:18px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:7px 12px;border-radius:999px;">Delivered</div>
                    <div style="font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:42px;color:${COLORS.ink};margin-top:18px;">Your order has arrived</div>
                    <div style="font-family:Arial,sans-serif;font-size:15px;line-height:24px;color:${COLORS.muted};margin-top:12px;">
                      We hope your new Desert Candle Works pieces feel right at home.
                    </div>
                    <div style="font-family:Arial,sans-serif;font-size:12px;line-height:18px;color:${COLORS.goldDark};font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-top:16px;">Order ${escapeHtml(orderId)} · ${escapeHtml(deliveredDate)}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 34px 0;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${COLORS.greenSoft};border:1px solid #cfe7da;border-radius:12px;">
                      <tr>
                        <td style="padding:20px;font-family:Arial,sans-serif;font-size:13px;line-height:21px;color:${COLORS.green};">
                          <strong style="font-size:15px;">Package delivered</strong><br>
                          Tracking ${escapeHtml(details.trackingNumber)}
                          ${details.deliveryLocation ? `<br>${escapeHtml(details.deliveryLocation)}` : ""}
                          ${details.statusDetails ? `<br>${escapeHtml(details.statusDetails)}` : ""}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px 34px 0;">
                    <div style="font-family:Arial,sans-serif;font-size:12px;line-height:18px;letter-spacing:1.5px;text-transform:uppercase;color:${COLORS.goldDark};font-weight:700;margin-bottom:4px;">Delivered with care</div>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${orderItems(items)}</table>
                  </td>
                </tr>
                <tr><td style="padding:26px 34px 0;">${totals(order)}</td></tr>
                <tr>
                  <td align="center" style="padding:30px 34px 0;">
                    <a href="${escapeHtml(invoiceUrl)}" style="display:inline-block;background:${COLORS.gold};color:${COLORS.white};font-family:Arial,sans-serif;font-size:14px;font-weight:700;text-decoration:none;padding:14px 26px;border-radius:8px;margin:0 5px 10px;">Open order invoice</a>
                    <a href="${escapeHtml(baseUrl)}/shop" style="display:inline-block;border:1px solid ${COLORS.gold};color:${COLORS.goldDark};font-family:Arial,sans-serif;font-size:14px;font-weight:700;text-decoration:none;padding:13px 26px;border-radius:8px;margin:0 5px 10px;">Visit the shop</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:26px 34px 0;">
                    <div style="background:${COLORS.cream};border-radius:12px;padding:20px;text-align:center;font-family:Arial,sans-serif;font-size:13px;line-height:21px;color:${COLORS.muted};">
                      Love what arrived? Your review helps a small Scottsdale studio grow.<br>
                      <a href="https://g.page/r/CQcLSwY5Vml0EBM/review" style="color:${COLORS.goldDark};font-weight:700;text-decoration:none;">Share your experience</a>
                    </div>
                  </td>
                </tr>
                <tr><td>${footer(baseUrl)}</td></tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  await sendEmail({
    to: order.email,
    subject: `Delivered · Desert Candle Works order ${orderId}`,
    html,
    text: `Your Desert Candle Works order has been delivered.\n\n${textSummary(order, details, invoiceUrl)}`,
  });
}
