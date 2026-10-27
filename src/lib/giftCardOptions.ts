// Gift card amounts and limits, shared by the gift card page and the server
// (kept out of lib/giftCards.ts, which has server-only imports).

export const GIFT_CARD_AMOUNTS = [25, 50, 75, 100];
export const GIFT_CARD_MIN = 10;
export const GIFT_CARD_MAX = 500;
/** Furthest ahead a gift card email can be scheduled (Resend holds scheduled email up to 30 days). */
export const GIFT_CARD_MAX_SEND_DAYS = 30;
