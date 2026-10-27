// Builds an email frame's header image: a flat illustration with a transparent
// background laid over a white card, with the top of the bold colour panel drawn in so
// leaves (or stars) fall into it. The email's HTML panel continues below the image in
// the same colour, so the two meet seamlessly. Used for built-in frames (scripts) and
// for frames uploaded from /admin/emails.

import sharp from "sharp";

/** Image width; emails show it at half size (600px) for sharp retina rendering. */
export const ART_WIDTH = 1200;
/** Panel inset from the card edge and corner radius, in image pixels (halve for email px). */
export const PANEL_INSET = 40;
export const PANEL_RADIUS = 36;

export async function composeFrameHeader(
  art: Buffer,
  { cardColor, panelColor }: { cardColor: string; panelColor: string }
): Promise<Buffer> {
  const resized = await sharp(art).ensureAlpha().resize({ width: ART_WIDTH }).png().toBuffer();
  const { width, height } = await sharp(resized).metadata();
  if (!width || !height) throw new Error("Could not read the artwork");

  // Panel starts 60% of the way down the artwork.
  const panelTop = Math.round(height * 0.6);

  // Cut the image on the emptiest row a little below the panel's top edge, so no leaf
  // is sliced in half where the HTML panel takes over.
  const { data } = await sharp(resized).extractChannel("alpha").raw().toBuffer({ resolveWithObject: true });
  const from = Math.min(height - 1, panelTop + 150);
  const to = Math.min(height, panelTop + 300);
  let cut = to;
  let best = Infinity;
  for (let y = from; y < to; y++) {
    let sum = 0;
    for (let x = 0; x < width; x++) sum += data[y * width + x];
    if (sum < best) {
      best = sum;
      cut = y;
    }
  }

  // Even height, so at half size the image ends on a whole pixel and no hairline shows
  // where the HTML panel takes over.
  cut -= cut % 2;

  const panel = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${PANEL_INSET}" y="${panelTop}" width="${width - PANEL_INSET * 2}" height="${height - panelTop + PANEL_RADIUS}"
        rx="${PANEL_RADIUS}" ry="${PANEL_RADIUS}" fill="${panelColor}"/>
    </svg>`
  );

  // Composite first, then crop in a second pass (sharp would otherwise crop first).
  const full = await sharp({ create: { width, height, channels: 3, background: cardColor } })
    .composite([{ input: panel }, { input: resized }])
    .png()
    .toBuffer();
  return sharp(full)
    .extract({ left: 0, top: 0, width, height: cut })
    .jpeg({ quality: 86, progressive: true, mozjpeg: true })
    .toBuffer();
}
