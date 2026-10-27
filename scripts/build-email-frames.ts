/**
 * Rebuilds the built-in email frame art (public/email-frames/<id>-top.png and
 * <id>-panel.png) from the transparent illustrations in design/email-frames, using the
 * same split as frames uploaded in admin. Run after changing the art.
 *
 * Usage: npx tsx scripts/build-email-frames.ts
 */
import fs from "fs";
import path from "path";
import { splitFrameArt } from "../src/lib/frameArt";
import { BUILT_IN_FRAMES } from "../src/lib/emailFrames";

// Each frame's art is design/email-frames/<id>-art.png (Christmas predates the naming).
const artFile = (id: string) => (id === "christmas" ? "xmas-art.png" : `${id}-art.png`);

async function main() {
  for (const frame of BUILT_IN_FRAMES) {
    const { top, panel } = await splitFrameArt(fs.readFileSync(path.join("design", "email-frames", artFile(frame.id))));
    for (const [url, buf] of [
      [frame.headerImageUrl, top],
      [frame.panelArtUrl!, panel],
    ] as const) {
      const file = path.join("public", url);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, buf);
      console.log(`${frame.id}: ${file} (${Math.round(buf.length / 1024)} KB)`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
