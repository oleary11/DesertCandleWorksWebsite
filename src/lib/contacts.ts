// One contact list for /admin/emails, merged by email address from every place we
// collect customers: website and in-person orders, accounts, the newsletter
// (Buttondown) and Square's customer directory. Square only shares contacts the buyer
// gave the seller; emails typed in just for a Square receipt stay hidden by Square.

import { sql as dsql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { listUnsubscribed } from "@/lib/unsubscribe";

export type ContactSource = "website" | "in_person" | "account" | "newsletter" | "square";

export type Contact = {
  email: string;
  name: string | null;
  phone: string | null;
  location: string | null;
  sources: ContactSource[];
  orders: number;
  spentCents: number;
  lastOrderAt: string | null;
  firstSeenAt: string | null;
  /** Unsubscribed here, in the newsletter or in Square: skipped by mass emails. */
  optedOut: boolean;
};

type Partial = Omit<Contact, "sources"> & { sources: Set<ContactSource> };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function earliest(a: string | null, b: string | null) {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

// External lists change rarely; cache them briefly so the page stays fast.
const cache = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}

type ButtondownSubscriber = {
  email_address: string;
  type?: string;
  creation_date?: string;
  unsubscription_date?: string | null;
  /** The welcome popup saves { phone } here. */
  metadata?: Record<string, unknown> | null;
};

async function newsletterSubscribers(): Promise<ButtondownSubscriber[]> {
  const key = process.env.BUTTONDOWN_API_KEY;
  if (!key) return [];
  return cached("buttondown", async () => {
    const all: ButtondownSubscriber[] = [];
    let url: string | null = "https://api.buttondown.email/v1/subscribers?page=1";
    for (let page = 0; url && page < 50; page++) {
      const res: Response = await fetch(url, { headers: { Authorization: `Token ${key}` }, cache: "no-store" });
      if (!res.ok) throw new Error(`Buttondown ${res.status}`);
      const data = (await res.json()) as { results: ButtondownSubscriber[]; next: string | null };
      all.push(...data.results);
      url = data.next;
    }
    return all;
  });
}

type SquareCustomer = {
  id: string;
  given_name?: string;
  family_name?: string;
  email_address?: string;
  phone_number?: string;
  created_at?: string;
  preferences?: { email_unsubscribed?: boolean };
};

async function squareCustomers(): Promise<SquareCustomer[]> {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) return [];
  const base =
    process.env.SQUARE_ENVIRONMENT === "sandbox" ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";
  return cached("square", async () => {
    const all: SquareCustomer[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 50; page++) {
      const url = `${base}/v2/customers?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, "Square-Version": "2025-01-23" },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Square ${res.status}`);
      const data = (await res.json()) as { customers?: SquareCustomer[]; cursor?: string };
      all.push(...(data.customers ?? []));
      cursor = data.cursor;
      if (!cursor) break;
    }
    return all;
  });
}

/** Every address that mass emails must skip. */
export async function listOptedOut(): Promise<Set<string>> {
  const optedOut = await listUnsubscribed();
  const [newsletter, square] = await Promise.all([
    newsletterSubscribers().catch(() => []),
    squareCustomers().catch(() => []),
  ]);
  for (const s of newsletter) {
    if (s.unsubscription_date || s.type === "unsubscribed" || s.type === "removed") {
      optedOut.add(s.email_address.trim().toLowerCase());
    }
  }
  for (const c of square) {
    if (c.email_address && c.preferences?.email_unsubscribed) optedOut.add(c.email_address.trim().toLowerCase());
  }
  return optedOut;
}

export async function listContacts(): Promise<{ contacts: Contact[]; warnings: string[] }> {
  const warnings: string[] = [];
  const byEmail = new Map<string, Partial>();
  const get = (rawEmail: string): Partial | null => {
    const email = rawEmail.trim().toLowerCase();
    if (!EMAIL.test(email) || email.endsWith("@admin.local")) return null;
    let contact = byEmail.get(email);
    if (!contact) {
      contact = {
        email,
        name: null,
        phone: null,
        location: null,
        sources: new Set(),
        orders: 0,
        spentCents: 0,
        lastOrderAt: null,
        firstSeenAt: null,
        optedOut: false,
      };
      byEmail.set(email, contact);
    }
    return contact;
  };

  // Orders: the richest source (name, phone, city, spend). Newest values win.
  const orderRows = await db.execute(dsql`
    SELECT lower(email) AS email,
           count(*)::int AS orders,
           coalesce(sum(total_cents), 0)::int AS spent,
           max(created_at) AS last_at,
           min(created_at) AS first_at,
           (array_agg(shipping_name ORDER BY created_at DESC) FILTER (WHERE shipping_name IS NOT NULL))[1] AS name,
           (array_agg(phone ORDER BY created_at DESC) FILTER (WHERE phone IS NOT NULL AND phone <> ''))[1] AS phone,
           (array_agg(concat_ws(', ', shipping_city, shipping_state) ORDER BY created_at DESC)
              FILTER (WHERE shipping_city IS NOT NULL))[1] AS location,
           bool_or(payment_method IS NULL OR payment_method = 'stripe') AS website,
           bool_or(payment_method IN ('cash', 'card', 'square', 'other')) AS in_person
    FROM orders
    WHERE status <> 'cancelled'
    GROUP BY lower(email)
  `);
  for (const row of orderRows.rows as Array<Record<string, unknown>>) {
    const contact = get(String(row.email));
    if (!contact) continue;
    contact.orders = Number(row.orders);
    contact.spentCents = Number(row.spent);
    contact.lastOrderAt = row.last_at ? new Date(String(row.last_at)).toISOString() : null;
    contact.firstSeenAt = row.first_at ? new Date(String(row.first_at)).toISOString() : null;
    contact.name = (row.name as string | null) || contact.name;
    contact.phone = (row.phone as string | null) || contact.phone;
    contact.location = (row.location as string | null) || contact.location;
    if (row.website) contact.sources.add("website");
    if (row.in_person) contact.sources.add("in_person");
  }

  const userRows = await db.execute(dsql`SELECT email, first_name, last_name, created_at FROM users`);
  for (const row of userRows.rows as Array<Record<string, unknown>>) {
    const contact = get(String(row.email));
    if (!contact) continue;
    contact.sources.add("account");
    contact.name ||= `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || null;
    contact.firstSeenAt = earliest(contact.firstSeenAt, row.created_at ? new Date(String(row.created_at)).toISOString() : null);
  }

  try {
    for (const s of await newsletterSubscribers()) {
      const contact = get(s.email_address);
      if (!contact) continue;
      contact.sources.add("newsletter");
      if (typeof s.metadata?.phone === "string") contact.phone ||= s.metadata.phone;
      contact.firstSeenAt = earliest(contact.firstSeenAt, s.creation_date ?? null);
      if (s.unsubscription_date || s.type === "unsubscribed" || s.type === "removed") contact.optedOut = true;
    }
  } catch (err) {
    warnings.push("Couldn't load newsletter signups from Buttondown.");
    console.error("[Contacts] Buttondown failed:", err);
  }

  try {
    for (const c of await squareCustomers()) {
      if (!c.email_address) continue; // Square hides receipt-only contacts; nothing to email
      const contact = get(c.email_address);
      if (!contact) continue;
      contact.sources.add("square");
      contact.name ||= [c.given_name, c.family_name].filter(Boolean).join(" ") || null;
      contact.phone ||= c.phone_number ?? null;
      contact.firstSeenAt = earliest(contact.firstSeenAt, c.created_at ?? null);
      if (c.preferences?.email_unsubscribed) contact.optedOut = true;
    }
  } catch (err) {
    warnings.push("Couldn't load Square customers.");
    console.error("[Contacts] Square failed:", err);
  }

  const unsubscribed = await listUnsubscribed();
  const contacts = [...byEmail.values()].map((c) => ({
    ...c,
    optedOut: c.optedOut || unsubscribed.has(c.email),
    sources: [...c.sources],
  }));
  contacts.sort(
    (a, b) =>
      (b.lastOrderAt ?? b.firstSeenAt ?? "").localeCompare(a.lastOrderAt ?? a.firstSeenAt ?? "") ||
      (a.name ?? a.email).localeCompare(b.name ?? b.email)
  );
  return { contacts, warnings };
}
