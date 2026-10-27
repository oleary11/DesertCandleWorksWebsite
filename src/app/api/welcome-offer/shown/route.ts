import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

export const runtime = "nodejs";

/** The welcome popup opened for someone; counted for the results on /admin/promotions. */
export async function POST() {
  try {
    await kv.incr("welcome:stats:shown");
    await kv.set("welcome:stats:since", new Date().toISOString(), { nx: true });
  } catch (error) {
    console.warn("[Welcome offer] Couldn't count a view:", error);
  }
  return NextResponse.json({ ok: true });
}
