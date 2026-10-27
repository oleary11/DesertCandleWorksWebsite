// Email "frames": festive artwork (a header illustration and a footer border) plus a
// matched colour set that wrap a message from /admin/emails. Content (headline, an
// optional offer + code, the note, featured products) is real text and links laid
// out inside the frame, so it stays sharp and editable. Pure string builders with no
// server imports, so the Compose preview renders exactly what gets sent.

import { DEFAULT_BASE_URL, emailFooter, escapeHtml, messageToHtml } from "@/lib/emailLayout";

export type EmailFrame = {
  id: string;
  name: string;
  /** Wide artwork across the top (about 2:1). */
  headerImageUrl: string;
  /** Optional border artwork across the bottom; its background should be cardColor. */
  footerImageUrl?: string | null;
  /** Small label above the headline, e.g. "Fall in Scottsdale". */
  eyebrow?: string | null;
  /** Heading over the featured products. */
  productsHeading?: string | null;
  pageColor: string;
  cardColor: string;
  /** Behind the offer coupon. */
  panelColor: string;
  /** Buttons, coupon border, code. */
  accentColor: string;
  /** Eyebrow and the local pickup box. */
  secondaryColor: string;
  textColor: string;
  /** Built into the code (not editable or deletable from admin). */
  builtIn?: boolean;
};

/** What goes inside the frame for one email. */
export type EmailDesign = {
  frameId: string;
  headline: string;
  /** e.g. "Buy one, get the second 50% off". Empty = no coupon. */
  offer?: string;
  code?: string;
  /** e.g. "Ends Sunday, November 15" */
  endsText?: string;
  ctaLabel?: string;
  /** Absolute, or a path on the site like /shop */
  ctaUrl?: string;
  /** Up to three products to feature, by slug. */
  productSlugs: string[];
  /** Adds the free Scottsdale pickup line. */
  pickupNote: boolean;
};

export type FramedProduct = { name: string; imageUrl?: string; url: string; priceText?: string };

export const BUILT_IN_FRAMES: EmailFrame[] = [
  {
    id: "fall",
    name: "Fall",
    headerImageUrl: "/email-frames/fall-header.jpg",
    footerImageUrl: "/email-frames/fall-footer.jpg",
    eyebrow: "Fall in Scottsdale",
    productsHeading: "Picked for fall",
    pageColor: "#4a2618",
    cardColor: "#fdf8ef",
    panelColor: "#f6ead3",
    accentColor: "#9c4221",
    secondaryColor: "#5a6438",
    textColor: "#211a16",
    builtIn: true,
  },
  {
    id: "christmas",
    name: "Christmas",
    headerImageUrl: "/email-frames/xmas-header.jpg",
    footerImageUrl: "/email-frames/xmas-footer.jpg",
    eyebrow: "Happy holidays from Scottsdale",
    productsHeading: "Gifts they'll love",
    pageColor: "#1f3b2c",
    cardColor: "#fbf6ec",
    panelColor: "#f3e8d6",
    accentColor: "#8e1b26",
    secondaryColor: "#1f3b2c",
    textColor: "#211a16",
    builtIn: true,
  },
];

export const DEFAULT_DESIGN: EmailDesign = {
  frameId: "fall",
  headline: "Candle season is finally here",
  offer: "Buy one, get the second 50% off",
  code: "GIFTEARLY",
  endsText: "Ends Sunday, November 15",
  ctaLabel: "Shop the sale",
  ctaUrl: "/shop",
  productSlugs: [],
  pickupNote: true,
};

const MUTED = "#6f655e";

function absolute(baseUrl: string, url: string) {
  return /^https?:\/\//i.test(url) ? url : `${baseUrl}${url.startsWith("/") ? url : `/${url}`}`;
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
  /** Where /images and /email-frames load from (the site, or the admin origin for previews). */
  assetBaseUrl?: string;
  unsubscribeUrl?: string;
}): { html: string; text: string } {
  const f = frame;
  const cta = absolute(baseUrl, design.ctaUrl || "/shop");
  const ctaLabel = design.ctaLabel?.trim() || "";
  const offer = design.offer?.trim() || "";
  const preheader =
    [offer, design.code ? `Code ${design.code}` : "", design.endsText].filter(Boolean).join(". ") ||
    message.trim().split(/\r?\n/)[0]?.slice(0, 120) ||
    subject;
  const featured = products.slice(0, 3);

  const button = ctaLabel
    ? `<a href="${escapeHtml(cta)}" style="display:inline-block;background:${f.accentColor};color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:700;text-decoration:none;padding:15px 34px;border-radius:9px;">${escapeHtml(ctaLabel)}</a>`
    : "";

  const coupon = offer
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${f.panelColor};border:2px dashed ${f.accentColor};border-radius:14px;">
        <tr>
          <td align="center" style="padding:26px 22px 24px;">
            <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:33px;color:${f.textColor};">${escapeHtml(offer)}</div>
            ${
              design.code
                ? `<div style="margin-top:16px;font-family:Arial,sans-serif;font-size:12px;line-height:18px;color:${MUTED};">Use code at checkout</div>
                   <div style="display:inline-block;margin-top:6px;padding:10px 20px;background:${f.cardColor};border:1px solid ${f.accentColor}33;border-radius:8px;font-family:'Courier New',Courier,monospace;font-size:24px;line-height:28px;font-weight:700;letter-spacing:4px;color:${f.accentColor};">${escapeHtml(design.code)}</div>`
                : ""
            }
            ${
              design.endsText
                ? `<div style="margin-top:14px;font-family:Arial,sans-serif;font-size:13px;line-height:19px;font-weight:700;color:${f.accentColor};">${escapeHtml(design.endsText)}</div>`
                : ""
            }
            ${button ? `<div style="margin-top:22px;">${button}</div>` : ""}
          </td>
        </tr>
      </table>`
    : button
      ? `<div style="text-align:center;">${button}</div>`
      : "";

  // Inline-block cards: three across on desktop, they wrap and stack on phones.
  const productCards = featured
    .map((p) => {
      const image = p.imageUrl
        ? `<img src="${escapeHtml(absolute(assetBaseUrl, p.imageUrl))}" width="180" height="180" alt="${escapeHtml(p.name)}" style="display:block;width:180px;height:180px;object-fit:cover;border-radius:12px;">`
        : `<div style="width:180px;height:180px;border-radius:12px;background:${f.panelColor};"></div>`;
      const price = p.priceText
        ? `<div style="margin-top:2px;font-family:Arial,sans-serif;font-size:13px;line-height:18px;color:${MUTED};">${escapeHtml(p.priceText)}</div>`
        : "";
      return `
      <div style="display:inline-block;vertical-align:top;width:180px;margin:0 6px 18px;text-align:left;">
        <a href="${escapeHtml(absolute(baseUrl, p.url))}" style="text-decoration:none;color:${f.textColor};">
          ${image}
          <div style="margin-top:10px;font-family:Arial,sans-serif;font-size:14px;line-height:19px;font-weight:700;color:${f.textColor};">${escapeHtml(p.name)}</div>
          ${price}
        </a>
      </div>`;
    })
    .join("");

  const rows = [
    // Wordmark above the artwork (the logo file has a light background that vanishes here)
    `<tr>
      <td align="center" style="padding:18px 24px 16px;">
        <a href="${escapeHtml(baseUrl)}" style="text-decoration:none;font-family:Georgia,'Times New Roman',serif;font-size:21px;line-height:26px;letter-spacing:.4px;color:${f.textColor};">Desert Candle Works</a>
      </td>
    </tr>`,
    `<tr><td><img src="${escapeHtml(absolute(assetBaseUrl, f.headerImageUrl))}" width="640" alt="" style="display:block;width:100%;max-width:640px;height:auto;border:0;"></td></tr>`,
    `<tr>
      <td align="center" style="padding:36px 34px 6px;">
        ${
          f.eyebrow
            ? `<div style="font-family:Arial,sans-serif;font-size:12px;line-height:18px;letter-spacing:2px;text-transform:uppercase;color:${f.secondaryColor};font-weight:700;">${escapeHtml(f.eyebrow)}</div>`
            : ""
        }
        <h1 style="margin:${f.eyebrow ? "10px" : "0"} 0 0;font-family:Georgia,'Times New Roman',serif;font-size:36px;line-height:43px;font-weight:400;color:${f.textColor};">${escapeHtml(design.headline)}</h1>
      </td>
    </tr>`,
    coupon ? `<tr><td style="padding:26px 34px 0;">${coupon}</td></tr>` : "",
    message.trim()
      ? `<tr><td style="padding:30px 38px 0;font-family:Arial,sans-serif;font-size:15px;line-height:25px;color:${f.textColor};">${messageToHtml(message)}</td></tr>`
      : "",
    featured.length
      ? `<tr>
          <td style="padding:34px 22px 0;">
            <div style="padding:0 12px 14px;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:28px;color:${f.textColor};">${escapeHtml(f.productsHeading || "Featured favorites")}</div>
            <div style="text-align:center;font-size:0;">${productCards}</div>
          </td>
        </tr>`
      : "",
    design.pickupNote
      ? `<tr>
          <td style="padding:${featured.length ? "6px" : "30px"} 34px 0;">
            <div style="background:${f.secondaryColor};border-radius:12px;padding:16px 20px;font-family:Arial,sans-serif;font-size:14px;line-height:21px;color:#f4f1e6;">
              <strong style="color:#ffffff;">Local to the Valley?</strong> Choose free pickup in Scottsdale at checkout.
            </div>
          </td>
        </tr>`
      : "",
    personal
      ? `<tr>
          <td style="padding:26px 34px 0;">
            <img src="${escapeHtml(`${assetBaseUrl}/images/email-signature.png`)}" width="300" alt="Josh &amp; Cori, Desert Candle Works, 480-442-7764, @desertcandleworks" style="display:block;width:300px;max-width:100%;height:auto;border:0;">
          </td>
        </tr>`
      : "",
    `<tr><td>${emailFooter(baseUrl, unsubscribeUrl)}</td></tr>`,
    f.footerImageUrl
      ? `<tr><td><img src="${escapeHtml(absolute(assetBaseUrl, f.footerImageUrl))}" width="640" alt="" style="display:block;width:100%;max-width:640px;height:auto;border:0;"></td></tr>`
      : "",
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
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:${f.cardColor};border-radius:16px;overflow:hidden;">
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
    design.code ? `Use code ${design.code} at checkout.` : "",
    design.endsText ?? "",
    ctaLabel ? `${ctaLabel}: ${cta}` : "",
    "",
    message.trim(),
    "",
    ...(featured.length
      ? [
          `${f.productsHeading || "Featured favorites"}:`,
          ...featured.map((p) => `- ${p.name}${p.priceText ? ` (${p.priceText})` : ""}: ${absolute(baseUrl, p.url)}`),
          "",
        ]
      : []),
    design.pickupNote ? "Local to the Valley? Choose free pickup in Scottsdale at checkout." : "",
    "",
    ...(personal ? ["Josh & Cori", "Desert Candle Works, 480-442-7764, @desertcandleworks", ""] : []),
    "Desert Candle Works, Scottsdale, Arizona",
    "contact@desertcandleworks.com, desertcandleworks.com",
    ...(unsubscribeUrl ? ["", `Unsubscribe: ${unsubscribeUrl}`] : []),
  ];
  // Drop empty optional lines and collapse repeated blank lines.
  const text = lines
    .filter((line, i) => line !== "" || (i > 0 && lines[i - 1] !== ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { html, text };
}
