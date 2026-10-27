// Custom email frames uploaded from /admin/emails, alongside the built-in ones.

import { sql as dsql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { BUILT_IN_FRAMES, type EmailFrame } from "@/lib/emailFrames";

// Same as drizzle/0017_email_frames.sql, so the feature works before that migration is run.
const ENSURE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "email_frames" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" varchar(100) NOT NULL,
    "header_image_url" text NOT NULL,
    "footer_image_url" text,
    "eyebrow" varchar(120),
    "products_heading" varchar(120),
    "page_color" varchar(9) NOT NULL,
    "card_color" varchar(9) NOT NULL,
    "panel_color" varchar(9) NOT NULL,
    "accent_color" varchar(9) NOT NULL,
    "secondary_color" varchar(9) NOT NULL,
    "text_color" varchar(9) NOT NULL,
    "created_at" timestamp with time zone NOT NULL DEFAULT now()
  )`,
];

let ensured: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  ensured ??= (async () => {
    for (const statement of ENSURE_STATEMENTS) await db.execute(dsql.raw(statement));
  })().catch((err) => {
    ensured = null;
    throw err;
  });
  return ensured;
}

type Row = {
  id: string;
  name: string;
  header_image_url: string;
  footer_image_url: string | null;
  eyebrow: string | null;
  products_heading: string | null;
  page_color: string;
  card_color: string;
  panel_color: string;
  accent_color: string;
  secondary_color: string;
  text_color: string;
};

const fromRow = (r: Row): EmailFrame => ({
  id: r.id,
  name: r.name,
  headerImageUrl: r.header_image_url,
  footerImageUrl: r.footer_image_url,
  eyebrow: r.eyebrow,
  productsHeading: r.products_heading,
  pageColor: r.page_color,
  cardColor: r.card_color,
  panelColor: r.panel_color,
  accentColor: r.accent_color,
  secondaryColor: r.secondary_color,
  textColor: r.text_color,
});

export async function listFrames(): Promise<EmailFrame[]> {
  await ensureTable();
  const result = await db.execute(dsql`SELECT * FROM email_frames ORDER BY created_at`);
  return [...BUILT_IN_FRAMES, ...(result.rows as Row[]).map(fromRow)];
}

export async function getFrame(id: string): Promise<EmailFrame | null> {
  return (await listFrames()).find((f) => f.id === id) ?? null;
}

const HEX = /^#[0-9a-f]{6}$/i;

export async function createFrame(input: Omit<EmailFrame, "id" | "builtIn">): Promise<EmailFrame> {
  await ensureTable();
  for (const key of ["pageColor", "cardColor", "panelColor", "accentColor", "secondaryColor", "textColor"] as const) {
    if (!HEX.test(input[key])) throw new Error(`${key} must be a colour like #a1b2c3`);
  }
  if (!input.name.trim() || !input.headerImageUrl) throw new Error("A frame needs a name and header artwork");
  const result = await db.execute(dsql`
    INSERT INTO email_frames (name, header_image_url, footer_image_url, eyebrow, products_heading,
      page_color, card_color, panel_color, accent_color, secondary_color, text_color)
    VALUES (${input.name.trim()}, ${input.headerImageUrl}, ${input.footerImageUrl || null}, ${input.eyebrow || null},
      ${input.productsHeading || null}, ${input.pageColor}, ${input.cardColor}, ${input.panelColor},
      ${input.accentColor}, ${input.secondaryColor}, ${input.textColor})
    RETURNING *
  `);
  return fromRow(result.rows[0] as Row);
}

export async function deleteFrame(id: string): Promise<void> {
  if (BUILT_IN_FRAMES.some((f) => f.id === id)) throw new Error("Built-in frames can't be deleted");
  await ensureTable();
  await db.execute(dsql`DELETE FROM email_frames WHERE id::text = ${id}`);
}
