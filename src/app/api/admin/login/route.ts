import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const ctype = req.headers.get("content-type") || "";
  let password = "";
  let next = "/admin";

  if (ctype.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as { password?: string; next?: string };
    password = (body.password ?? "").toString();
    next = (body.next ?? "/admin").toString();
  } else {
    const form = await req.formData();
    password = (form.get("password") ?? "").toString();
    next = (form.get("next") ?? "/admin").toString();
  }

  const expected = process.env.ADMIN_PASSWORD || "";
  if (!expected) {
    return NextResponse.json(
      { error: "Admin password not configured on server" },
      { status: 500 }
    );
  }

  if (password !== expected) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  // Set the admin cookie for the whole site
  const res = NextResponse.json({ redirect: next });
  res.cookies.set("dcw_admin", "1", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: true,         // keep true on Vercel (HTTPS)
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return res;
}