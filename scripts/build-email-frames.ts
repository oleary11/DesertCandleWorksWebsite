/**
 * Rebuilds the built-in email frame headers (public/email-frames/*-header.jpg) from the
 * transparent illustrations in design/email-frames, using the same compositing as
 * frames uploaded in admin. Run after changing the art or colours in lib/emailFrames.ts.
 *
 * Usage: npx tsx scripts/build-email-frames.ts
 */
import fs from "fs";
import path from "path";
import { composeFrameHeader } from "../src/lib/frameArt";
import { BUILT_IN_FRAMES } from "../src/lib/emailFrames";

const ART: Record<string, string> = { fall: "fall-art.png", christmas: "xmas-art.png" };

async function main() {
  for (const frame of BUILT_IN_FRAMES) {
    const art = fs.readFileSync(path.join("design", "email-frames", ART[frame.id]));
    const out = await composeFrameHeader(art, frame);
    const file = path.join("public", frame.headerImageUrl);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, out);
    console.log(`${frame.id}: ${file} (${Math.round(out.length / 1024)} KB)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
