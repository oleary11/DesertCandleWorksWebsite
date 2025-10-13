import { NextResponse } from "next/server";
import { destroyAdminSession } from "@/lib/adminSession";

export async function POST() {
  await destroyAdminSession();
  return NextResponse.redirect(new URL("/admin/login", process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"), { status: 303 });
}