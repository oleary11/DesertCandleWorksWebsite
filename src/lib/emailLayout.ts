// Shared look for every customer email: cream page, white card, dark logo header,
// gold accents. Pure string builders with no server imports, so the admin
// "Send emails" page can render the exact same HTML for its live preview.

export const COLORS = {
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

export const DEFAULT_BASE_URL = "https://www.desertcandleworks.com";

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function emailHeader(logoUrl: string, preheader: string): string {
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

export function emailFooter(baseUrl: string, unsubscribeUrl?: string): string {
  const unsubscribe = unsubscribeUrl
    ? `<br><a href="${escapeHtml(unsubscribeUrl)}" style="color:#958a82;">Unsubscribe from these emails</a>`
    : "";
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
            © ${new Date().getFullYear()} Desert Candle Works${unsubscribe}
          </div>
        </td>
      </tr>
    </table>
  `;
}

/** Escapes plain text, keeps line breaks and turns bare URLs into links. */
export function messageToHtml(message: string): string {
  return escapeHtml(message.trim())
    .replace(
      /(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g,
      `<a href="$1" style="color:${COLORS.goldDark};font-weight:700;">$1</a>`
    )
    .replace(/\r?\n/g, "<br>");
}

/**
 * A one-off message from the admin "Send emails" page, in the order-email layout.
 * `personal` signs it from Josh & Cori with the signature image.
 * `assetBaseUrl` is where /images/* are loaded from (the site, or the admin's
 * own origin for the in-page preview).
 */
export function renderMessageEmail({
  subject,
  message,
  personal,
  baseUrl = DEFAULT_BASE_URL,
  assetBaseUrl = baseUrl,
  unsubscribeUrl,
}: {
  subject: string;
  message: string;
  personal: boolean;
  baseUrl?: string;
  assetBaseUrl?: string;
  /** Mass emails only: adds an unsubscribe link to the footer. */
  unsubscribeUrl?: string;
}): { html: string; text: string } {
  const preheader = message.trim().split(/\r?\n/)[0]?.slice(0, 120) || subject;
  const signature = personal
    ? `
                <tr>
                  <td style="padding:6px 34px 8px;">
                    <img src="${escapeHtml(`${assetBaseUrl}/images/email-signature.png`)}" width="320" alt="Josh &amp; Cori · Desert Candle Works · 480-442-7764 · @desertcandleworks" style="display:block;width:320px;max-width:100%;height:auto;border:0;">
                  </td>
                </tr>`
    : "";

  const html = `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${escapeHtml(subject)}</title>
      </head>
      <body style="margin:0;padding:0;background:${COLORS.cream};">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${COLORS.cream};">
          <tr>
            <td align="center" style="padding:24px 10px 36px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:${COLORS.white};border:1px solid ${COLORS.sand};border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(33,26,22,.08);">
                <tr><td>${emailHeader(`${assetBaseUrl}/images/logo.png`, preheader)}</td></tr>
                <tr>
                  <td style="padding:34px 34px ${personal ? "18px" : "26px"};font-family:Arial,sans-serif;font-size:15px;line-height:25px;color:${COLORS.ink};">
                    ${messageToHtml(message)}
                  </td>
                </tr>${signature}
                <tr><td style="padding:0 34px;"><div style="border-top:1px solid ${COLORS.sand};"></div></td></tr>
                <tr><td>${emailFooter(baseUrl, unsubscribeUrl)}</td></tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const text = [
    message.trim(),
    "",
    ...(personal
      ? ["Josh & Cori", "Desert Candle Works", "www.desertcandleworks.com", "480-442-7764", "Instagram: @desertcandleworks", ""]
      : []),
    "—",
    "Desert Candle Works · Scottsdale, Arizona",
    "contact@desertcandleworks.com · desertcandleworks.com",
    ...(unsubscribeUrl ? ["", `Unsubscribe: ${unsubscribeUrl}`] : []),
  ].join("\n");

  return { html, text };
}
