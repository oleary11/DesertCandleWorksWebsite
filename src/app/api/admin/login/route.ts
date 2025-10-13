import { NextRequest, NextResponse } from "next/server";
import { createAdminSession } from "@/lib/adminSession";

export async function POST(req: NextRequest) {
  const { password, next } = await req.json().catch(() => ({}));
  const ok = typeof password === "string" && password === process.env.ADMIN_PASSWORD;
  if (!ok) return NextResponse.json({ error: "Invalid password" }, { status: 401 });

  await createAdminSession();

  const dest = new URL(next || "/admin", req.url);
  return NextResponse.redirect(dest, { status: 303 });
}
