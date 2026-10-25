/**
 * One-off: pull all Desert Candle Works emails from Resend into the email_log table
 * (the "Sent" tab in /admin/emails). Safe to re-run; it only adds or refreshes rows.
 *
 * Usage: npx tsx scripts/backfill-email-log.ts
 */
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const { syncFromResend } = await import("../src/lib/emailLog");
  const result = await syncFromResend({ maxPages: 500 });
  console.log(`Checked ${result.pages} pages; ${result.seen} Desert Candle Works emails logged.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
