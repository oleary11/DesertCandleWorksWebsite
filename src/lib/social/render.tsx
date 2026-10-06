import { ImageResponse } from "next/og";
import { put } from "@vercel/blob";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { absoluteUrl } from "./content";

// Slideshows are 4:5, the tallest feed ratio Instagram allows. Reels are 9:16.
export const SLIDE_W = 1080;
export const SLIDE_H = 1350;
export const REEL_W = 1080;
export const REEL_H = 1920;

// Brand palette from the homepage (home.module.css).
const INK = "#3f2a21";
const CREAM = "#fbf6f0";

type Font = { name: string; data: ArrayBuffer; weight: 400 | 800; style: "normal" };
let fontsPromise: Promise<Font[]> | null = null;

/**
 * A font from Google Fonts: Young Serif (the site's heading face) for slides, Inter ExtraBold for
 * memes. Without a browser UA Google serves TTF, which satori needs.
 */
async function loadGoogleFont(family: string): Promise<ArrayBuffer> {
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}`)).text();
  const url = css.match(/src: url\((.+?)\) format/)?.[1];
  if (!url) throw new Error(`Could not load font ${family}`);
  return (await fetch(url)).arrayBuffer();
}

function loadLocalFont(file: string): ArrayBuffer {
  const buf = fs.readFileSync(path.join(process.cwd(), "public", "fonts", file));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

function getFonts(): Promise<Font[]> {
  fontsPromise ??= Promise.all([loadGoogleFont("Young Serif"), loadGoogleFont("Inter:wght@800")]).then(([serif, inter]) => [
    { name: "Young Serif", data: serif, weight: 400, style: "normal" },
    { name: "Inter", data: inter, weight: 800, style: "normal" },
    { name: "Megastina", data: loadLocalFont("Megastina.ttf"), weight: 400, style: "normal" },
  ]);
  fontsPromise.catch(() => (fontsPromise = null));
  return fontsPromise;
}

export async function fetchImage(url: string): Promise<Buffer> {
  const res = await fetch(absoluteUrl(url));
  if (!res.ok) throw new Error(`Could not download image ${url} (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

/** Crops to the target size around the most interesting region (the candle), upscaling small photos. */
export async function cropTo(buf: Buffer, width: number, height: number): Promise<Buffer> {
  return sharp(buf)
    .rotate()
    .resize({ width, height, fit: "cover", position: sharp.strategy.attention })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
}

/** A tighter shot of the same photo (about 1.6x in on the candle), so a reused photo reads as a new angle. */
export async function detailCrop(buf: Buffer, width: number, height: number): Promise<Buffer> {
  const zw = Math.round(width * 1.6);
  const zh = Math.round(height * 1.6);
  const zoomed = await sharp(buf)
    .rotate()
    .resize({ width: zw, height: zh, fit: "cover", position: sharp.strategy.attention })
    .toBuffer();
  // The attention crop already centers the candle; cut the middle, nudged up so the flame and label stay in.
  return sharp(zoomed)
    .extract({ left: Math.round((zw - width) / 2), top: Math.round((zh - height) * 0.25), width, height })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
}

/**
 * Fits a whole image (e.g. a generated meme with text near its edges) into the frame without
 * cropping, padding with a color sampled from its corner so the bars blend in.
 */
export async function fitTo(buf: Buffer, width: number, height: number): Promise<Buffer> {
  const { dominant } = await sharp(buf).extract({ left: 0, top: 0, width: 16, height: 16 }).stats();
  return sharp(buf)
    .resize({ width, height, fit: "contain", background: { r: dominant.r, g: dominant.g, b: dominant.b } })
    .flatten({ background: { r: dominant.r, g: dominant.g, b: dominant.b } })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
}

export async function uploadToBlob(pathname: string, data: Buffer, contentType: string): Promise<string> {
  const blob = await put(pathname, data, { access: "public", contentType, addRandomSuffix: true });
  return blob.url;
}

/** Copies a remote file (e.g. a fal output, which fal only keeps temporarily) into Blob. */
export async function copyToBlob(url: string, pathname: string, contentType: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not download ${url} (${res.status})`);
  return uploadToBlob(pathname, Buffer.from(await res.arrayBuffer()), contentType);
}

export type SlideVariant = "cover" | "content" | "label"; // label = collection slide showing just the product name

function headlineSize(text: string, variant: SlideVariant): number {
  const n = text.length;
  if (variant === "label") return n <= 28 ? 50 : 42;
  if (variant === "cover") return n <= 18 ? 92 : n <= 32 ? 78 : 64;
  return n <= 18 ? 72 : n <= 32 ? 62 : 52;
}

function Slide({ photo, headline, body, variant }: { photo: string; headline: string; body?: string; variant: SlideVariant }) {
  return (
    <div style={{ width: SLIDE_W, height: SLIDE_H, display: "flex", position: "relative", background: INK }}>
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img src={photo} width={SLIDE_W} height={SLIDE_H} style={{ position: "absolute", top: 0, left: 0 }} />
      {headline || body ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: variant === "cover" ? 620 : variant === "label" ? 380 : 520,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            padding: "0 72px 120px",
            gap: 18,
            backgroundImage: "linear-gradient(to bottom, rgba(63,42,33,0), rgba(63,42,33,0.55) 45%, rgba(40,26,20,0.82))",
          }}
        >
          {headline ? (
            <span
              style={{
                display: "flex",
                fontFamily: "Young Serif",
                fontSize: headlineSize(headline, variant),
                lineHeight: 1.12,
                color: CREAM,
                letterSpacing: -0.5,
              }}
            >
              {headline}
            </span>
          ) : null}
          {body ? (
            <span style={{ display: "flex", fontFamily: "Young Serif", fontSize: 34, lineHeight: 1.35, color: "rgba(251,246,240,0.88)" }}>
              {body}
            </span>
          ) : null}
        </div>
      ) : null}
      <span
        style={{
          position: "absolute",
          right: 64,
          bottom: 44,
          display: "flex",
          fontFamily: "Megastina",
          fontSize: 44,
          color: "rgba(251,246,240,0.85)",
        }}
      >
        Desert Candle Works
      </span>
    </div>
  );
}

/** Renders one slideshow slide: the photo (already cropped to 4:5) with brand text laid over it. Returns JPEG. */
export async function renderSlide(photoJpeg: Buffer, headline: string, body: string | undefined, variant: SlideVariant): Promise<Buffer> {
  const fonts = await getFonts();
  const photo = `data:image/jpeg;base64,${photoJpeg.toString("base64")}`;
  const png = new ImageResponse(<Slide photo={photo} headline={headline} body={body} variant={variant} />, {
    width: SLIDE_W,
    height: SLIDE_H,
    fonts,
  });
  // Instagram only accepts JPEG for image posts.
  return sharp(Buffer.from(await png.arrayBuffer())).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
}
