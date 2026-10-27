// Email "frames": a festive poster-style design that wraps a message from /admin/emails.
// A frame is a flat illustration falling into a bold colour panel plus a matched colour
// set. The art is two transparent layers (lib/frameArt.ts): one above the panel and one
// laid inside its top, with no backgrounds baked in, so it survives phone dark modes. The content (script headline,
// offer, code, note, one button, optional products) sits inside the panel as real text
// and links. Pure string builders with no server imports, so the Compose preview
// renders exactly what gets sent.

import { DEFAULT_BASE_URL, escapeHtml, messageToHtml } from "@/lib/emailLayout";

export type EmailFrame = {
  id: string;
  name: string;
  /** Transparent illustration above the panel, 1200px wide (shown at 600). */
  headerImageUrl: string;
  /** Transparent continuation (falling leaves) laid inside the top of the panel. */
  panelArtUrl?: string | null;
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
    headerImageUrl: "/email-frames/fall-top.png",
    panelArtUrl: "/email-frames/fall-panel.png",
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
    headerImageUrl: "/email-frames/christmas-top.png",
    panelArtUrl: "/email-frames/christmas-panel.png",
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

// Dark design, used by mail apps that support prefers-color-scheme (Apple Mail, iPhone
// Mail, Outlook for Mac). Gmail's apps ignore it and recolour on their own, which the
// transparent art copes with. Classes are prefixed so they can't clash.
const DARK_STYLES = `
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  @media (prefers-color-scheme: dark) {
    .dcw-page { background: #120d0a !important; }
    .dcw-card { background: #231a14 !important; }
    .dcw-ink { color: #f3ebe2 !important; }
    .dcw-muted { color: #b3a79d !important; }
    .dcw-link { color: #f2c48f !important; }
    .dcw-sig-light { display: none !important; }
    .dcw-sig-dark { display: block !important; }
  }
`;

function absolute(baseUrl: string, url: string) {
  return /^https?:\/\//i.test(url) ? url : `${baseUrl}${url.startsWith("/") ? url : `/${url}`}`;
}

/**
 * Site link from an email: tagged as email traffic (so orders are credited to it) and,
 * when there's a promo code, opening with the code applied (?promo=, see cart).
 */
export function emailLink(baseUrl: string, url: string, campaign: string, code?: string) {
  const link = new URL(absolute(baseUrl, url));
  if (!/(^|\.)desertcandleworks\.com$|^localhost$/i.test(link.hostname)) return link.toString();
  link.searchParams.set("utm_source", "email");
  link.searchParams.set("utm_medium", "email");
  link.searchParams.set("utm_campaign", campaign);
  if (code) link.searchParams.set("promo", code);
  return link.toString();
}

const campaignSlug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "email";

/** URL of the script-font headline image (see app/api/email/headline). */
export function headlineImageUrl(assetBaseUrl: string, text: string, color: string) {
  // v= busts the year-long image cache whenever the lettering style changes.
  return `${assetBaseUrl}/api/email/headline?t=${encodeURIComponent(text.trim())}&c=${color.replace("#", "")}&v=2`;
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
  const ctaLabel = design.ctaLabel?.trim() || "";
  const offer = design.offer?.trim() || "";
  const code = design.code?.trim() || "";
  const campaign = campaignSlug(code || design.headline || subject);
  const cta = emailLink(baseUrl, design.ctaUrl || "/shop", campaign, code || undefined);
  const ends = design.endsText?.trim() || "";
  const preheader =
    [offer, code ? `Use code ${code}` : "", ends].filter(Boolean).join(". ") ||
    message.trim().split(/\r?\n/)[0]?.slice(0, 120) ||
    subject;
  const featured = products.slice(0, 3);
  const sans = "font-family:Arial,Helvetica,sans-serif;";

  const panelParts = [
    `<div style="${sans}font-size:11px;line-height:16px;letter-spacing:3px;text-transform:uppercase;color:${f.panelTextColor};opacity:.85;">Desert Candle Works</div>`,
    `<img src="${escapeHtml(headlineImageUrl(assetBaseUrl, design.headline, f.panelTextColor))}" width="520" alt="${escapeHtml(design.headline)}" style="display:block;width:100%;max-width:520px;height:auto;margin:4px auto 0;border:0;color:${f.panelTextColor};font-family:Georgia,serif;font-size:40px;line-height:46px;">`,
    offer
      ? `<div style="${sans}margin-top:4px;font-size:15px;line-height:22px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${f.panelTextColor};">${escapeHtml(offer)}</div>`
      : "",
    code || ends
      ? `<div style="margin-top:20px;">
          ${
            code
              ? `<div style="${sans}font-size:11px;line-height:16px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:${f.panelTextColor};opacity:.9;">Your code</div>
                 <a href="${escapeHtml(cta)}" style="display:inline-block;margin-top:8px;background:${f.panelTextColor};color:${f.panelColor};border-radius:12px;padding:13px 30px;${sans}font-size:26px;line-height:30px;font-weight:800;letter-spacing:6px;text-decoration:none;">${escapeHtml(code)}</a>
                 ${ctaLabel ? `<div style="${sans}margin-top:8px;font-size:12px;line-height:17px;color:${f.panelTextColor};opacity:.9;">Applied automatically when you shop from this email</div>` : ""}`
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
        <a href="${escapeHtml(emailLink(baseUrl, p.url, campaign, code || undefined))}" style="text-decoration:none;">
          ${
            p.imageUrl
              ? `<img src="${escapeHtml(absolute(assetBaseUrl, p.imageUrl))}" width="170" height="170" alt="${escapeHtml(p.name)}" style="display:block;width:170px;height:170px;object-fit:cover;border-radius:12px;border:0;">`
              : ""
          }
          <div class="dcw-ink" style="${sans}margin-top:8px;font-size:13px;line-height:18px;font-weight:700;color:${INK};">${escapeHtml(p.name)}</div>
          ${p.priceText ? `<div class="dcw-link" style="${sans}font-size:12px;line-height:17px;color:${f.linkColor};">${escapeHtml(p.priceText)}</div>` : ""}
        </a>
      </div>`
    )
    .join("");

  const footerLinks = [
    `<a class="dcw-link" href="${escapeHtml(emailLink(baseUrl, "/shop", campaign, code || undefined))}" style="color:${f.linkColor};text-decoration:none;">Shop</a>`,
    `<a class="dcw-link" href="mailto:contact@desertcandleworks.com" style="color:${f.linkColor};text-decoration:none;">Contact</a>`,
    unsubscribeUrl ? `<a class="dcw-link" href="${escapeHtml(unsubscribeUrl)}" style="color:${f.linkColor};text-decoration:none;">Unsubscribe</a>` : "",
  ]
    .filter(Boolean)
    .join(`<span class="dcw-muted" style="color:${MUTED};">&nbsp;&nbsp;&middot;&nbsp;&nbsp;</span>`);

  const rows = [
    `<tr><td style="padding:0;line-height:0;font-size:0;"><img src="${escapeHtml(absolute(assetBaseUrl, f.headerImageUrl))}" width="600" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0;"></td></tr>`,
    `<tr>
      <td align="center" style="padding:0;">
        <!-- Inset 40px of 1200 each side, matching where the art's panel layer was cut, so the
             falling leaves continue straight into the panel at any screen width. -->
        <table role="presentation" width="93.334%" align="center" cellspacing="0" cellpadding="0" border="0" style="width:93.334%;margin:0 auto;background:${f.panelColor};border-radius:18px;">
          ${
            f.panelArtUrl
              ? `<tr><td style="padding:0;line-height:0;font-size:0;"><img src="${escapeHtml(absolute(assetBaseUrl, f.panelArtUrl))}" width="560" alt="" style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:18px 18px 0 0;"></td></tr>`
              : ""
          }
          <tr><td align="center" style="padding:${f.panelArtUrl ? "0" : "26px"} 18px 36px;text-align:center;">${panelParts.join("\n")}</td></tr>
        </table>
      </td>
    </tr>`,
    featured.length
      ? `<tr>
          <td align="center" style="padding:30px 14px 4px;text-align:center;">
            <div class="dcw-ink" style="padding-bottom:14px;font-family:Georgia,'Times New Roman',serif;font-size:21px;line-height:27px;color:${INK};">${escapeHtml(f.productsHeading || "Featured favorites")}</div>
            <div style="font-size:0;">${productCards}</div>
          </td>
        </tr>`
      : "",
    personal
      ? `<tr><td align="center" style="padding:${featured.length ? "6px" : "28px"} 20px 0;">
          <img class="dcw-sig-light" src="${escapeHtml(`${assetBaseUrl}/images/email-signature.png`)}" width="260" alt="Josh &amp; Cori, Desert Candle Works, 480-442-7764, @desertcandleworks" style="display:block;width:260px;max-width:100%;height:auto;border:0;margin:0 auto;">
          <img class="dcw-sig-dark" src="${escapeHtml(`${assetBaseUrl}/images/email-signature-dark.png`)}" width="260" alt="" style="display:none;width:260px;max-width:100%;height:auto;border:0;margin:0 auto;">
        </td></tr>`
      : "",
    `<tr>
      <td align="center" style="padding:24px 20px 26px;text-align:center;${sans}">
        <div style="font-size:12px;line-height:18px;font-weight:700;">${footerLinks}</div>
        <div class="dcw-muted" style="margin-top:8px;font-size:11px;line-height:16px;color:${MUTED};">Desert Candle Works &middot; Scottsdale, Arizona</div>
      </td>
    </tr>`,
  ];

  const html = `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="color-scheme" content="light dark">
        <meta name="supported-color-schemes" content="light dark">
        <title>${escapeHtml(subject)}</title>
        <style>${DARK_STYLES}</style>
      </head>
      <body class="dcw-page" style="margin:0;padding:0;background:${f.pageColor};">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
        <table class="dcw-page" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${f.pageColor};">
          <tr>
            <td align="center" style="padding:28px 10px 40px;">
              <table class="dcw-card" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:${f.cardColor};border-radius:14px;overflow:hidden;">
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
          ...featured.map((p) => `- ${p.name}${p.priceText ? ` (${p.priceText})` : ""}: ${emailLink(baseUrl, p.url, campaign, code || undefined)}`),
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
