// Splits an email frame's flat illustration (transparent background) into two
// transparent layers: the part above the colour panel, and the part that falls into
// the panel's top. Nothing is baked in (no white card, no panel colour), so phone mail
// apps that recolour emails in dark mode can't leave a white block or a mismatched
// panel edge; the art just floats on whatever colours they use. The email lays the
// second layer inside the top of the HTML panel. Used for built-in frames (scripts)
// and for frames uploaded from /admin/emails.

import sharp from "sharp";

/** Image width; emails show it at half size (600px) for sharp retina rendering. */
export const ART_WIDTH = 1200;
/** Panel inset from the card edge, in image pixels (halve for email px). Must match the
 *  panel width in lib/emailFrames.ts (40 of 1200 each side = 93.334%). */
export const PANEL_INSET = 40;

/** Sum of alpha along a row, optionally only within [x0, x1). */
function rowAlpha(alpha: Buffer, width: number, y: number, x0 = 0, x1 = width) {
  let sum = 0;
  for (let x = x0; x < x1; x++) sum += alpha[y * width + x];
  return sum;
}

/** Emptiest row in [from, to), so the cut slices as little artwork as possible. */
function emptiestRow(alpha: Buffer, width: number, from: number, to: number, x0?: number, x1?: number) {
  let best = Infinity;
  let row = from;
  for (let y = from; y < to; y++) {
    const sum = rowAlpha(alpha, width, y, x0, x1);
    if (sum < best) {
      best = sum;
      row = y;
    }
  }
  return row;
}

const even = (n: number) => n - (n % 2); // whole pixels at half size, so no hairline seams

export async function splitFrameArt(art: Buffer): Promise<{ top: Buffer; panel: Buffer }> {
  const resized = await sharp(art).ensureAlpha().resize({ width: ART_WIDTH }).png().toBuffer();
  const { width, height } = await sharp(resized).metadata();
  if (!width || !height) throw new Error("Could not read the artwork");
  const { data: alpha } = await sharp(resized).extractChannel("alpha").raw().toBuffer({ resolveWithObject: true });

  // Panel top: around 60% down, on a row where little crosses the side margins (those
  // bits can't continue into the inset panel below).
  const marginAlpha = (y: number) =>
    rowAlpha(alpha, width, y, 0, PANEL_INSET) + rowAlpha(alpha, width, y, width - PANEL_INSET, width);
  let panelTop = Math.round(height * 0.6);
  let best = Infinity;
  for (let y = Math.round(height * 0.55); y < Math.round(height * 0.65); y++) {
    const score = marginAlpha(y) * 4 + rowAlpha(alpha, width, y);
    if (score < best) {
      best = score;
      panelTop = y;
    }
  }
  panelTop = even(panelTop);

  // How far the leaves fall into the panel: cut on the emptiest row.
  const bottom = even(emptiestRow(alpha, width, Math.min(height - 1, panelTop + 120), Math.min(height, panelTop + 260), PANEL_INSET, width - PANEL_INSET));

  const pngOpts = { palette: true, quality: 90, effort: 10, compressionLevel: 9 } as const;
  const top = await sharp(resized).extract({ left: 0, top: 0, width, height: panelTop }).png(pngOpts).toBuffer();
  const panel = await sharp(resized)
    .extract({ left: PANEL_INSET, top: panelTop, width: width - PANEL_INSET * 2, height: bottom - panelTop })
    .png(pngOpts)
    .toBuffer();
  return { top, panel };
}
