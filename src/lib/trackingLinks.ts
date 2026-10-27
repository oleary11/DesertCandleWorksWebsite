// Tracking links (desertcandleworks.com/go/<slug>) and order attribution. Each link
// counts clicks, tags the visitor's source for 30 days (attributionShared.ts), can carry
// a promo code that auto-applies in the cart, and gets credit for the orders that follow.

import { sql as dsql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { SOURCE_PRESETS, type VisitSource } from "@/lib/attributionShared";

// Same as drizzle/0019_tracking_links.sql, so the feature works before that migration is run.
const ENSURE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "tracking_links" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "slug" varchar(80) NOT NULL UNIQUE,
    "name" varchar(120) NOT NULL,
    "destination" text NOT NULL DEFAULT '/',
    "source" varchar(40) NOT NULL,
    "medium" varchar(40),
    "campaign" varchar(80),
    "promo_code" varchar(50),
    "clicks" integer NOT NULL DEFAULT 0,
    "last_click_at" timestamp with time zone,
    "archived" boolean NOT NULL DEFAULT false,
    "created_at" timestamp with time zone NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS "order_attribution" (
    "order_id" varchar(255) PRIMARY KEY,
    "source" varchar(60) NOT NULL,
    "medium" varchar(40),
    "campaign" varchar(80),
    "link_id" uuid,
    "via" varchar(10),
    "created_at" timestamp with time zone NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS "order_attribution_link_idx" ON "order_attribution" ("link_id")`,
  `CREATE INDEX IF NOT EXISTS "order_attribution_source_idx" ON "order_attribution" ("source")`,
];

let ensured: Promise<void> | null = null;
function ensureTables(): Promise<void> {
  ensured ??= (async () => {
    for (const statement of ENSURE_STATEMENTS) await db.execute(dsql.raw(statement));
  })().catch((err) => {
    ensured = null;
    throw err;
  });
  return ensured;
}

export type TrackingLink = {
  id: string;
  slug: string;
  name: string;
  destination: string;
  source: string;
  medium: string | null;
  campaign: string | null;
  promoCode: string | null;
  clicks: number;
  lastClickAt: string | null;
  archived: boolean;
  createdAt: string;
};

export type TrackingLinkWithStats = TrackingLink & { orders: number; revenueCents: number };

type Row = {
  id: string;
  slug: string;
  name: string;
  destination: string;
  source: string;
  medium: string | null;
  campaign: string | null;
  promo_code: string | null;
  clicks: number;
  last_click_at: string | null;
  archived: boolean;
  created_at: string;
  orders?: number;
  revenue_cents?: number;
};

const iso = (v: string | Date | null) => (v ? new Date(v).toISOString() : null);
const fromRow = (r: Row): TrackingLinkWithStats => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  destination: r.destination,
  source: r.source,
  medium: r.medium,
  campaign: r.campaign,
  promoCode: r.promo_code,
  clicks: Number(r.clicks),
  lastClickAt: iso(r.last_click_at),
  archived: r.archived,
  createdAt: iso(r.created_at)!,
  orders: Number(r.orders ?? 0),
  revenueCents: Number(r.revenue_cents ?? 0),
});

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Keeps destinations on our own site (no open redirects). */
export function cleanDestination(value: string): string {
  const v = (value || "/").trim();
  try {
    const url = new URL(v, "https://www.desertcandleworks.com");
    if (!/(^|\.)desertcandleworks\.com$/i.test(url.hostname)) return "/";
    return `${url.pathname}${url.search}` || "/";
  } catch {
    return "/";
  }
}

export async function listLinks(): Promise<TrackingLinkWithStats[]> {
  await ensureTables();
  const result = await db.execute(dsql`
    SELECT l.*, count(o.id)::int AS orders, coalesce(sum(o.total_cents), 0)::int AS revenue_cents
    FROM tracking_links l
    LEFT JOIN order_attribution a ON a.link_id = l.id
    LEFT JOIN orders o ON o.id = a.order_id AND o.status <> 'cancelled'
    GROUP BY l.id
    ORDER BY l.archived, l.created_at DESC
  `);
  return (result.rows as Row[]).map(fromRow);
}

export async function createLink(input: {
  name: string;
  slug?: string;
  destination?: string;
  source: string;
  campaign?: string;
  promoCode?: string;
}): Promise<TrackingLink> {
  await ensureTables();
  const name = input.name?.trim();
  if (!name) throw new Error("Give the link a name");
  const slug = slugify(input.slug || name);
  if (!SLUG.test(slug)) throw new Error("The short link can only use letters, numbers and dashes");
  const source = slugify(input.source || "other") || "other";
  const medium = SOURCE_PRESETS.find((p) => p.value === source)?.medium ?? "other";
  const campaign = input.campaign?.trim() ? slugify(input.campaign) : null;
  const promoCode = input.promoCode?.trim().toUpperCase() || null;
  const destination = cleanDestination(input.destination || "/shop");

  const taken = await db.execute(dsql`SELECT 1 FROM tracking_links WHERE slug = ${slug}`);
  if (taken.rows.length) throw new Error(`desertcandleworks.com/go/${slug} is already used; pick another short link`);

  const result = await db.execute(dsql`
    INSERT INTO tracking_links (slug, name, destination, source, medium, campaign, promo_code)
    VALUES (${slug}, ${name}, ${destination}, ${source}, ${medium}, ${campaign}, ${promoCode})
    RETURNING *
  `);
  return fromRow(result.rows[0] as Row);
}

export async function setLinkArchived(id: string, archived: boolean): Promise<void> {
  await ensureTables();
  await db.execute(dsql`UPDATE tracking_links SET archived = ${archived} WHERE id::text = ${id}`);
}

/** Looks up a live link for /go/<slug> and counts the click. */
export async function recordClick(slug: string): Promise<TrackingLink | null> {
  await ensureTables();
  const result = await db.execute(dsql`
    UPDATE tracking_links SET clicks = clicks + 1, last_click_at = now()
    WHERE slug = ${slug} AND archived = false
    RETURNING *
  `);
  const row = result.rows[0] as Row | undefined;
  return row ? fromRow(row) : null;
}

/** Credits an order to where the buyer came from (called from the Stripe webhook). */
export async function recordOrderAttribution(orderId: string, src: VisitSource | null): Promise<void> {
  try {
    await ensureTables();
    const s = src ?? { source: "direct", via: "referrer" as const };
    await db.execute(dsql`
      INSERT INTO order_attribution (order_id, source, medium, campaign, link_id, via)
      VALUES (${orderId}, ${s.source}, ${s.medium ?? null}, ${s.campaign ?? null}, ${s.linkId ?? null}, ${s.via})
      ON CONFLICT (order_id) DO NOTHING
    `);
  } catch (err) {
    console.error("[Attribution] Could not record order source:", err);
  }
}

/** Orders and revenue by source over the last `days` days (website orders only). */
export async function salesBySource(days: number): Promise<{ source: string; orders: number; revenueCents: number }[]> {
  await ensureTables();
  const result = await db.execute(dsql`
    SELECT coalesce(a.source, 'untracked') AS source, count(*)::int AS orders, coalesce(sum(o.total_cents), 0)::int AS revenue_cents
    FROM orders o
    LEFT JOIN order_attribution a ON a.order_id = o.id
    WHERE o.status <> 'cancelled'
      AND o.created_at > now() - make_interval(days => ${days})
      AND (o.payment_method = 'stripe' OR o.payment_method IS NULL)
    GROUP BY 1
    ORDER BY revenue_cents DESC
  `);
  return (result.rows as { source: string; orders: number; revenue_cents: number }[]).map((r) => ({
    source: r.source,
    orders: Number(r.orders),
    revenueCents: Number(r.revenue_cents),
  }));
}
