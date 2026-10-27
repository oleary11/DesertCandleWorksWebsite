// Where a visitor came from, shared by the browser (tracker, cart) and the server
// (/go links, checkout). Stored in the `_dcw_src` cookie for 30 days and copied onto
// the order at checkout so sales can be credited to Instagram, Google, an email, etc.

export const SOURCE_COOKIE = "_dcw_src";
export const PROMO_STORAGE_KEY = "dcw_promo";
export const SOURCE_MAX_AGE = 30 * 24 * 60 * 60; // seconds

export type VisitSource = {
  /** e.g. instagram, google, email, tiktok, qr, direct */
  source: string;
  /** e.g. social, organic, email, print, referral, paid */
  medium?: string;
  campaign?: string;
  /** Tracking link id when the visit came through /go/<slug> */
  linkId?: string;
  /** How it was learned: a tracking link, utm tags, or the referring site */
  via: "link" | "utm" | "referrer";
};

export const SOURCE_PRESETS: { value: string; label: string; medium: string }[] = [
  { value: "instagram", label: "Instagram", medium: "social" },
  { value: "tiktok", label: "TikTok", medium: "social" },
  { value: "facebook", label: "Facebook", medium: "social" },
  { value: "pinterest", label: "Pinterest", medium: "social" },
  { value: "google", label: "Google (Business profile, ads)", medium: "organic" },
  { value: "email", label: "Email", medium: "email" },
  { value: "qr", label: "QR code (booth, flyer, packaging)", medium: "print" },
  { value: "partner", label: "Partner or shop", medium: "referral" },
  { value: "other", label: "Other", medium: "other" },
];

export function sourceLabel(source: string): string {
  return (
    SOURCE_PRESETS.find((p) => p.value === source)?.label.replace(/ \(.*\)$/, "") ??
    (source === "direct" ? "Direct / unknown" : source.charAt(0).toUpperCase() + source.slice(1))
  );
}

const clean = (v: unknown, max = 60) =>
  typeof v === "string" ? v.trim().toLowerCase().replace(/[^a-z0-9._ -]/g, "").slice(0, max) || undefined : undefined;

export function encodeSource(src: VisitSource): string {
  const params = new URLSearchParams();
  params.set("s", src.source);
  if (src.medium) params.set("m", src.medium);
  if (src.campaign) params.set("c", src.campaign);
  if (src.linkId) params.set("l", src.linkId);
  params.set("v", src.via);
  return params.toString();
}

export function decodeSource(raw: string | undefined | null): VisitSource | null {
  if (!raw) return null;
  try {
    const params = new URLSearchParams(decodeURIComponent(raw));
    const source = clean(params.get("s"));
    if (!source) return null;
    const via = params.get("v");
    const linkId = params.get("l") ?? undefined;
    return {
      source,
      medium: clean(params.get("m")),
      campaign: clean(params.get("c"), 80),
      linkId: linkId && /^[0-9a-f-]{36}$/i.test(linkId) ? linkId : undefined,
      via: via === "link" || via === "utm" ? via : "referrer",
    };
  } catch {
    return null;
  }
}

/** Source from utm_* query parameters, if present. */
export function sourceFromUtm(search: URLSearchParams): VisitSource | null {
  const source = clean(search.get("utm_source"));
  if (!source) return null;
  return { source, medium: clean(search.get("utm_medium")), campaign: clean(search.get("utm_campaign"), 80), via: "utm" };
}

/** Source from the referring site (Google search, Instagram app, etc.). */
export function sourceFromReferrer(referrer: string, ownHost: string): VisitSource | null {
  let host: string;
  try {
    host = new URL(referrer).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
  if (!host || host === ownHost.replace(/^www\./, "") || host.endsWith("desertcandleworks.com")) return null;
  // Order matters: webmail hosts before the search engines they share a domain with.
  const known: [RegExp, string, string][] = [
    [/(^|\.)(mail\.google\.com|outlook\.live\.com|mail\.yahoo\.com)$/, "email", "email"],
    [/(^|\.)google\./, "google", "organic"],
    [/(^|\.)bing\.com$/, "bing", "organic"],
    [/(^|\.)duckduckgo\.com$/, "duckduckgo", "organic"],
    [/(^|\.)yahoo\./, "yahoo", "organic"],
    [/(^|\.)instagram\.com$/, "instagram", "social"],
    [/(^|\.)(facebook\.com|fb\.com|fb\.me|m\.facebook\.com|l\.facebook\.com)$/, "facebook", "social"],
    [/(^|\.)tiktok\.com$/, "tiktok", "social"],
    [/(^|\.)pinterest\./, "pinterest", "social"],
    [/(^|\.)(t\.co|twitter\.com|x\.com)$/, "x", "social"],
    [/(^|\.)reddit\.com$/, "reddit", "social"],
  ];
  for (const [pattern, source, medium] of known) if (pattern.test(host)) return { source, medium, via: "referrer" };
  return { source: host.slice(0, 60), medium: "referral", via: "referrer" };
}
