// Email "frames": a festive poster-style design that wraps a message from /admin/emails.
// A frame is a flat illustration falling into a bold colour panel (the header image,
// built by lib/frameArt.ts) plus a matched colour set. The content (script headline,
// offer, code, note, one button, optional products) sits inside the panel as real text
// and links. Pure string builders with no server imports, so the Compose preview
// renders exactly what gets sent.

import { DEFAULT_BASE_URL, escapeHtml, messageToHtml } from "@/lib/emailLayout";

export type EmailFrame = {
  id: string;
  name: string;
  /** Illustration + top of the panel, 1200px wide (shown at 600). */
  headerImageUrl: string;
  /** The original transparent illustration the header was built from. */
  artImageUrl?: string | null;
  /** Heading over featured products. */
  productsHeading?: string | null;
  pageColor: string;
  cardColor: string;
  panelColor: string;
  panelTextColor: string;
  buttonColor: string;
  buttonTextColor: string;
  /** Product names and footer links on the card. */
  linkColor: string;
  /** Built into the code (not editable or deletable from admin). */
  builtIn?: boolean;
};

/** What goes inside the frame for one email. */
export type EmailDesign = {
  frameId: string;
  /** Drawn in the script font. */
  headline: string;
  /** e.g. "Buy one, get the second 50% off". Shown as a bold line. */
  offer?: string;
  code?: string;
  /** e.g. "Ends Sunday, November 15" */
  endsText?: string;
  ctaLabel?: string;
  /** Absolute, or a path on the site like /shop */
  ctaUrl?: string;
  /** Up to three products to feature under the panel, by slug. */
  productSlugs: string[];
  /** Adds "Free local pickup in Scottsdale" under the button. */
  pickupNote: boolean;
};

export type FramedProduct = { name: string; imageUrl?: string; url: string; priceText?: string };

export const BUILT_IN_FRAMES: EmailFrame[] = [
  {
    id: "fall",
    name: "Fall",
    headerImageUrl: "/email-frames/fall-poster.jpg",
    productsHeading: "Picked for fall",
    pageColor: "#6b3f22",
    cardColor: "#ffffff",
    panelColor: "#d9622b",
    panelTextColor: "#fffaf2",
    buttonColor: "#4a2618",
    buttonTextColor: "#fffaf2",
    linkColor: "#a8431f",
    builtIn: true,
  },
  {
    id: "christmas",
    name: "Christmas",
    headerImageUrl: "/email-frames/christmas-poster.jpg",
    productsHeading: "Gifts they'll love",
    pageColor: "#1f3b2c",
    cardColor: "#ffffff",
    panelColor: "#9e1b2c",
    panelTextColor: "#fff8ee",
    buttonColor: "#1f3b2c",
    buttonTextColor: "#fff8ee",
    linkColor: "#9e1b2c",
    builtIn: true,
  },
];

export const DEFAULT_DESIGN: EmailDesign = {
  frameId: "fall",
  headline: "Autumn Sale",
  offer: "Buy one, get the second 50% off",
  code: "GIFTEARLY",
  endsText: "Ends Sunday, November 15",
  ctaLabel: "Shop the sale",
  ctaUrl: "/shop",
  productSlugs: [],
  pickupNote: true,
};

const INK = "#211a16";
const MUTED = "#8a7f77";

function absolute(baseUrl: string, url: string) {
  return /^https?:\/\//i.test(url) ? url : `${baseUrl}${url.startsWith("/") ? url : `/${url}`}`;
}

/** URL of the script-font headline image (see app/api/email/headline). */
export function headlineImageUrl(assetBaseUrl: string, text: string, color: string) {
  return `${assetBaseUrl}/api/email/headline?t=${encodeURIComponent(text.trim())}&c=${color.replace("#", "")}`;
}

export function renderFramedEmail({
  subject,
  message,
  personal,
  frame,
  design,
  products,
  baseUrl = DEFAULT_BASE_URL,
  assetBaseUrl = baseUrl,
  unsubscribeUrl,
}: {
  subject: string;
  message: string;
  personal: boolean;
  frame: EmailFrame;
  design: EmailDesign;
  products: FramedProduct[];
  baseUrl?: string;
  /** Where images load from (the site, or the admin origin for previews). */
  assetBaseUrl?: string;
  unsubscribeUrl?: string;
}): { html: string; text: string } {
  const f = frame;
  const cta = absolute(baseUrl, design.ctaUrl || "/shop");
  const ctaLabel = design.ctaLabel?.trim() || "";
  const offer = design.offer?.trim() || "";
  const code = design.code?.trim() || "";
  const ends = design.endsText?.trim() || "";
  const preheader =
    [offer, code ? `Use code ${code}` : "", ends].filter(Boolean).join(". ") ||
    message.trim().split(/\r?\n/)[0]?.slice(0, 120) ||
    subject;
  const featured = products.slice(0, 3);
  const sans = "font-family:Arial,Helvetica,sans-serif;";

  const panelParts = [
    `<div style="${sans}font-size:11px;line-height:16px;letter-spacing:3px;text-transform:uppercase;color:${f.panelTextColor};opacity:.85;">Desert Candle Works</div>`,
    `<img src="${escapeHtml(headlineImageUrl(assetBaseUrl, design.headline, f.panelTextColor))}" width="520" alt="${escapeHtml(design.headline)}" style="display:block;width:100%;max-width:520px;height:auto;margin:6px auto 0;border:0;color:${f.panelTextColor};font-family:Georgia,serif;font-size:40px;line-height:46px;">`,
    offer
      ? `<div style="${sans}margin-top:6px;font-size:19px;line-height:26px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:${f.panelTextColor};">${escapeHtml(offer)}</div>`
      : "",
    code || ends
      ? `<div style="margin-top:16px;">
          ${
            code
              ? `<span style="display:inline-block;border:2px dashed ${f.panelTextColor};border-radius:8px;padding:7px 16px;font-family:'Courier New',Courier,monospace;font-size:20px;line-height:24px;font-weight:700;letter-spacing:3px;color:${f.panelTextColor};">${escapeHtml(code)}</span>`
              : ""
          }
          ${ends ? `<div style="${sans}margin-top:10px;font-size:13px;line-height:18px;font-weight:700;color:${f.panelTextColor};">${escapeHtml(ends)}</div>` : ""}
        </div>`
      : "",
    message.trim()
      ? `<div style="${sans}margin:20px auto 0;max-width:440px;font-size:15px;line-height:24px;color:${f.panelTextColor};">${messageToHtml(message)}</div>`
      : "",
    ctaLabel
      ? `<div style="margin-top:26px;"><a href="${escapeHtml(cta)}" style="display:inline-block;background:${f.buttonColor};color:${f.buttonTextColor};${sans}font-size:15px;line-height:20px;font-weight:700;text-decoration:none;padding:14px 34px;border-radius:999px;">${escapeHtml(ctaLabel)}</a></div>`
      : "",
    design.pickupNote
      ? `<div style="${sans}margin-top:14px;font-size:12px;line-height:18px;color:${f.panelTextColor};opacity:.85;">Free local pickup in Scottsdale</div>`
      : "",
  ].filter(Boolean);

  const productCards = featured
    .map(
      (p) => `
      <div style="display:inline-block;vertical-align:top;width:170px;margin:0 6px 16px;text-align:center;">
        <a href="${escapeHtml(absolute(baseUrl, p.url))}" style="text-decoration:none;">
          ${
            p.imageUrl
              ? `<img src="${escapeHtml(absolute(assetBaseUrl, p.imageUrl))}" width="170" height="170" alt="${escapeHtml(p.name)}" style="display:block;width:170px;height:170px;object-fit:cover;border-radius:12px;border:0;">`
              : ""
          }
          <div style="${sans}margin-top:8px;font-size:13px;line-height:18px;font-weight:700;color:${INK};">${escapeHtml(p.name)}</div>
          ${p.priceText ? `<div style="${sans}font-size:12px;line-height:17px;color:${f.linkColor};">${escapeHtml(p.priceText)}</div>` : ""}
        </a>
      </div>`
    )
    .join("");

  const footerLinks = [
    `<a href="${escapeHtml(absolute(baseUrl, "/shop"))}" style="color:${f.linkColor};text-decoration:none;">Shop</a>`,
    `<a href="mailto:contact@desertcandleworks.com" style="color:${f.linkColor};text-decoration:none;">Contact</a>`,
    unsubscribeUrl ? `<a href="${escapeHtml(unsubscribeUrl)}" style="color:${f.linkColor};text-decoration:none;">Unsubscribe</a>` : "",
  ]
    .filter(Boolean)
    .join(`<span style="color:${MUTED};">&nbsp;&nbsp;&middot;&nbsp;&nbsp;</span>`);

  const rows = [
    `<tr><td style="padding:0;line-height:0;font-size:0;"><img src="${escapeHtml(absolute(assetBaseUrl, f.headerImageUrl))}" width="600" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0;"></td></tr>`,
    `<tr>
      <td style="padding:0 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${f.panelColor};border-radius:0 0 18px 18px;">
          <tr><td align="center" style="padding:10px 30px 38px;text-align:center;">${panelParts.join("\n")}</td></tr>
        </table>
      </td>
    </tr>`,
    featured.length
      ? `<tr>
          <td align="center" style="padding:30px 14px 4px;text-align:center;">
            <div style="padding-bottom:14px;font-family:Georgia,'Times New Roman',serif;font-size:21px;line-height:27px;color:${INK};">${escapeHtml(f.productsHeading || "Featured favorites")}</div>
            <div style="font-size:0;">${productCards}</div>
          </td>
        </tr>`
      : "",
    personal
      ? `<tr><td align="center" style="padding:${featured.length ? "6px" : "28px"} 20px 0;"><img src="${escapeHtml(`${assetBaseUrl}/images/email-signature.png`)}" width="260" alt="Josh &amp; Cori, Desert Candle Works, 480-442-7764, @desertcandleworks" style="display:block;width:260px;max-width:100%;height:auto;border:0;margin:0 auto;"></td></tr>`
      : "",
    `<tr>
      <td align="center" style="padding:24px 20px 26px;text-align:center;${sans}">
        <div style="font-size:12px;line-height:18px;font-weight:700;">${footerLinks}</div>
        <div style="margin-top:8px;font-size:11px;line-height:16px;color:${MUTED};">Desert Candle Works &middot; Scottsdale, Arizona</div>
      </td>
    </tr>`,
  ];

  const html = `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${escapeHtml(subject)}</title>
      </head>
      <body style="margin:0;padding:0;background:${f.pageColor};">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${f.pageColor};">
          <tr>
            <td align="center" style="padding:28px 10px 40px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:${f.cardColor};border-radius:14px;overflow:hidden;">
                ${rows.filter(Boolean).join("\n")}
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const lines = [
    design.headline,
    "",
    offer,
    code ? `Use code ${code} at checkout.` : "",
    ends,
    "",
    message.trim(),
    "",
    ctaLabel ? `${ctaLabel}: ${cta}` : "",
    design.pickupNote ? "Free local pickup in Scottsdale." : "",
    "",
    ...(featured.length
      ? [
          `${f.productsHeading || "Featured favorites"}:`,
          ...featured.map((p) => `- ${p.name}${p.priceText ? ` (${p.priceText})` : ""}: ${absolute(baseUrl, p.url)}`),
          "",
        ]
      : []),
    ...(personal ? ["Josh & Cori", "Desert Candle Works, 480-442-7764, @desertcandleworks", ""] : []),
    "Desert Candle Works, Scottsdale, Arizona",
    "contact@desertcandleworks.com, desertcandleworks.com",
    ...(unsubscribeUrl ? ["", `Unsubscribe: ${unsubscribeUrl}`] : []),
  ];
  const text = lines
    .filter((line, i) => line !== "" || (i > 0 && lines[i - 1] !== ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { html, text };
}
