// The "10% off when you sign up" offer in the welcome popup (components/WelcomePopup).
// Every signup gets its own single-use code (e.g. WELCOME-7K3F2Q), sent only by email, so
// the discount needs a real inbox and a code shared online only works once. Each code is
// an ordinary promotion, visible on /admin/promotions.

import { kv } from "@vercel/kv";
import { sendEmailWithId } from "@/lib/email";
import { DEFAULT_BASE_URL, renderMessageEmail } from "@/lib/emailLayout";
import { emailLink } from "@/lib/emailFrames";
import type { Promotion } from "@/lib/promotions";
import { createPromotion, getPromotionByCode } from "@/lib/promotionsStore";
import { unsubscribeHeaders, unsubscribePageUrl } from "@/lib/unsubscribe";

export const WELCOME_PERCENT = 10;
/** How long a welcome code works after signing up. */
const CODE_VALID_DAYS = 30;

/** The offer, or null when it's switched off (set WELCOME_OFFER_OFF=1 in Vercel). */
export function getWelcomeOffer(): { percent: number } | null {
  return process.env.WELCOME_OFFER_OFF === "1" ? null : { percent: WELCOME_PERCENT };
}

const usable = (p: Promotion | null): p is Promotion =>
  !!p && p.active && p.currentRedemptions < (p.maxRedemptions ?? 1) && (!p.expiresAt || new Date(p.expiresAt).getTime() > Date.now());

function randomCode(): string {
  // No 0/O or 1/I, so it can be typed from the email without mix-ups.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `WELCOME-${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")}`;
}

/** This address's welcome code: the one they already have if it's still unused, else a new one. */
export async function issueWelcomeCode(email: string, percent: number): Promise<Promotion> {
  const key = `welcome:code:${email}`;
  const existing = await kv.get<string>(key);
  if (existing) {
    const promotion = await getPromotionByCode(existing);
    if (usable(promotion)) return promotion;
    // Used or expired: one welcome discount per address.
    if (promotion) throw new Error("This email has already used its welcome discount.");
  }

  let code = randomCode();
  while (await getPromotionByCode(code)) code = randomCode();
  const now = new Date();
  const promotion: Promotion = {
    id: `promo_${now.getTime()}_${code.slice(-6).toLowerCase()}`,
    code,
    name: `Welcome code: ${email}`,
    description: `${percent}% off for signing up from the popup on the site. One use.`,
    trigger: "code_required",
    type: "percentage",
    discountPercent: percent,
    maxRedemptions: 1,
    userTargeting: "all",
    expiresAt: new Date(now.getTime() + CODE_VALID_DAYS * 86_400_000).toISOString(),
    active: true,
    currentRedemptions: 0,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  await createPromotion(promotion);
  await kv.set(key, code);
  return promotion;
}

/** Emails their code with a link that opens the shop with it applied. */
export async function sendWelcomeEmail(email: string, promotion: Promotion): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || DEFAULT_BASE_URL;
  const percent = promotion.discountPercent ?? WELCOME_PERCENT;
  const shop = emailLink(baseUrl, "/shop", "welcome", promotion.code);
  const ends = promotion.expiresAt
    ? new Date(promotion.expiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "America/Phoenix" })
    : null;
  const subject = `Your ${percent}% off code is inside`;
  // The code and a "shop with it applied" button follow the message.
  const message = [
    "Thanks for joining the Desert Candle Works list!",
    "",
    "Every candle is hand-poured in Scottsdale with natural coconut apricot wax, in a liquor bottle we rescued and cut by hand. We'll send new scents, restocks and the occasional sale. No spam, promise.",
    "",
    `Here's ${percent}% off your order, ${ends ? `good for one order through ${ends}` : "good for one order"}. The button opens the shop with it already applied.`,
  ].join("\n");
  const unsubscribeUrl = unsubscribePageUrl(email);
  const { html, text } = renderMessageEmail({
    subject,
    message,
    personal: false,
    baseUrl,
    unsubscribeUrl,
    code: promotion.code,
    button: { label: `Shop with ${percent}% off`, url: shop },
  });
  await sendEmailWithId({
    to: email,
    subject,
    html,
    text,
    replyTo: "contact@desertcandleworks.com",
    category: "message",
    headers: unsubscribeHeaders(email),
  });
}
