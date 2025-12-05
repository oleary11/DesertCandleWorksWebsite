import { NextRequest, NextResponse } from "next/server";
import { destroyAdminSession } from "@/lib/adminSession";
import { logAdminAction } from "@/lib/adminLogs";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  await logAdminAction({
    action: "logout",
    adminEmail: "admin",
    ip,
    userAgent,
    success: true,
  });

  await destroyAdminSession();
  return NextResponse.redirect(new URL("/admin/login", process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"), { status: 303 });
}