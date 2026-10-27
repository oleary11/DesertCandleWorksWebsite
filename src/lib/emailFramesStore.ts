// Custom email frames uploaded from /admin/emails, alongside the built-in ones. An
// upload is a transparent illustration plus colours; the header image (illustration
// falling into the top of the colour panel) is composited here and stored in Blob.

import { put } from "@vercel/blob";
import { sql as dsql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { BUILT_IN_FRAMES, type EmailFrame } from "@/lib/emailFrames";
import { composeFrameHeader } from "@/lib/frameArt";

// Same as drizzle/0018_email_frames.sql, so the feature works before that migration is run.
const ENSURE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "email_frames" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" varchar(100) NOT NULL,
    "header_image_url" text NOT NULL,
    "art_image_url" text,
    "products_heading" varchar(120),
    "page_color" varchar(9) NOT NULL,
    "card_color" varchar(9) NOT NULL,
    "panel_color" varchar(9) NOT NULL,
    "panel_text_color" varchar(9) NOT NULL,
    "button_color" varchar(9) NOT NULL,
    "button_text_color" varchar(9) NOT NULL,
    "link_color" varchar(9) NOT NULL,
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
  art_image_url: string | null;
  products_heading: string | null;
  page_color: string;
  card_color: string;
  panel_color: string;
  panel_text_color: string;
  button_color: string;
  button_text_color: string;
  link_color: string;
};

const fromRow = (r: Row): EmailFrame => ({
  id: r.id,
  name: r.name,
  headerImageUrl: r.header_image_url,
  artImageUrl: r.art_image_url,
  productsHeading: r.products_heading,
  pageColor: r.page_color,
  cardColor: r.card_color,
  panelColor: r.panel_color,
  panelTextColor: r.panel_text_color,
  buttonColor: r.button_color,
  buttonTextColor: r.button_text_color,
  linkColor: r.link_color,
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
const COLOR_KEYS = [
  "pageColor",
  "cardColor",
  "panelColor",
  "panelTextColor",
  "buttonColor",
  "buttonTextColor",
  "linkColor",
] as const;

export type NewFrame = Pick<EmailFrame, "name" | "productsHeading" | (typeof COLOR_KEYS)[number]> & {
  /** Uploaded illustration with a transparent background. */
  artImageUrl: string;
};

export async function createFrame(input: NewFrame): Promise<EmailFrame> {
  await ensureTable();
  for (const key of COLOR_KEYS) {
    if (!HEX.test(input[key] ?? "")) throw new Error(`${key} must be a colour like #a1b2c3`);
  }
  if (!input.name?.trim() || !input.artImageUrl) throw new Error("A frame needs a name and artwork");

  const artRes = await fetch(input.artImageUrl);
  if (!artRes.ok) throw new Error("Couldn't load the uploaded artwork");
  const header = await composeFrameHeader(Buffer.from(await artRes.arrayBuffer()), input);
  const blob = await put(`email-frames/${crypto.randomUUID()}.jpg`, header, { access: "public", contentType: "image/jpeg" });

  const result = await db.execute(dsql`
    INSERT INTO email_frames (name, header_image_url, art_image_url, products_heading, page_color, card_color,
      panel_color, panel_text_color, button_color, button_text_color, link_color)
    VALUES (${input.name.trim()}, ${blob.url}, ${input.artImageUrl}, ${input.productsHeading || null}, ${input.pageColor},
      ${input.cardColor}, ${input.panelColor}, ${input.panelTextColor}, ${input.buttonColor}, ${input.buttonTextColor},
      ${input.linkColor})
    RETURNING *
  `);
  return fromRow(result.rows[0] as Row);
}

export async function deleteFrame(id: string): Promise<void> {
  if (BUILT_IN_FRAMES.some((f) => f.id === id)) throw new Error("Built-in frames can't be deleted");
  await ensureTable();
  await db.execute(dsql`DELETE FROM email_frames WHERE id::text = ${id}`);
}
