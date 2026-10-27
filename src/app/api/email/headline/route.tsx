import fs from "fs";
import path from "path";
import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

// Script headline for framed emails, drawn in the site's Megastina script font.
// Email clients can't load custom fonts, so the headline is sent as an image of the
// real text (with the text as alt). GET /api/email/headline?t=Autumn%20Sale&c=fffaf2

const WIDTH = 1040; // shown at 520px in the email: 2x for sharp retina text
const fonts = new Map<string, ArrayBuffer>();

function loadFont(file: string): ArrayBuffer {
  let font = fonts.get(file);
  if (!font) {
    const buf = fs.readFileSync(path.join(process.cwd(), "public", "fonts", file));
    font = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    fonts.set(file, font);
  }
  return font;
}

export async function GET(req: NextRequest) {
  const text = (req.nextUrl.searchParams.get("t") ?? "").trim().slice(0, 60) || "Desert Candle Works";
  const colorParam = req.nextUrl.searchParams.get("c") ?? "";
  const color = /^[0-9a-f]{6}$/i.test(colorParam) ? `#${colorParam}` : "#fffaf2";

  // Shrink the lettering until it fits one line (Megastina averages ~0.5em per
  // character, wider for capitals and "&"); past the minimum size, wrap and make room.
  const usable = WIDTH - 60;
  const CHAR_EM = 0.5;
  const size = Math.max(96, Math.min(170, Math.floor(usable / (text.length * CHAR_EM))));
  const lines = Math.min(3, Math.ceil((text.length * CHAR_EM * size) / usable));
  const height = Math.round(lines * size * 1.12 + size * 0.4);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          fontFamily: "Megastina",
          fontSize: size,
          lineHeight: 1.05,
          color,
          padding: "0 10px",
          // Megastina is a hairline script; a same-colour halo thickens the strokes so the
          // headline still reads at phone size.
          textShadow: [2.4, -2.4].flatMap((d) => [`${d}px 0 0 ${color}`, `0 ${d}px 0 ${color}`]).join(", "),
        }}
      >
        {text}
      </div>
    ),
    {
      width: WIDTH,
      height,
      fonts: [{ name: "Megastina", data: loadFont("Megastina.ttf"), weight: 400, style: "normal" }],
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    }
  );
}
