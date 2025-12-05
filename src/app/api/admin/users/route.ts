import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, requireSuperAdmin } from "@/lib/adminSession";
import {
  createAdminUser,
  listAdminUsers,
  hasSuperAdmin,
} from "@/lib/adminUsers";
import { logAdminAction } from "@/lib/adminLogs";

export const runtime = "nodejs";

/**
 * GET /api/admin/users - List all admin users
 * Requires super_admin role
 */
export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  try {
    const session = await requireSuperAdmin();

    const users = await listAdminUsers();

    return NextResponse.json({ users });
  } catch (error) {
    await logAdminAction({
      action: "admin-user.list",
      ip,
      userAgent,
      success: false,
      details: { error: String(error) },
    });

    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }
}

/**
 * POST /api/admin/users - Create new admin user
 * Requires super_admin role
 * Special case: If no super admin exists, allow first user creation
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  const body = await req.json().catch(() => ({}));
  const { email, password, role = "admin" } = body;

  // Validate input
  if (!email || !password) {
    await logAdminAction({
      action: "admin-user.create",
      ip,
      userAgent,
      success: false,
      details: { reason: "missing_fields" },
    });

    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  // Check if this is the first super admin setup
  const hasSuperAdminUser = await hasSuperAdmin();
  console.log("[Admin Setup] hasSuperAdmin check:", hasSuperAdminUser);

  if (!hasSuperAdminUser) {
    // First user creation - allow without authentication
    // This user MUST be a super_admin
    console.log("[Admin Setup] Creating first super admin user - no authentication required");

    try {
      const result = await createAdminUser(email, password, "super_admin");

      await logAdminAction({
        action: "admin-user.create",
        adminEmail: email,
        ip,
        userAgent,
        success: true,
        details: {
          email,
          role: "super_admin",
          firstSetup: true,
        },
      });

      return NextResponse.json({
        success: true,
        user: result.user,
        twoFactorSetup: result.twoFactorSetup,
        message: "First super admin created successfully. Please save your 2FA backup codes!",
      });
    } catch (error) {
      await logAdminAction({
        action: "admin-user.create",
        adminEmail: email,
        ip,
        userAgent,
        success: false,
        details: { error: error instanceof Error ? error.message : String(error), firstSetup: true },
      });

      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to create admin user" },
        { status: 400 }
      );
    }
  }

  // For subsequent user creation, require super_admin role
  try {
    const session = await requireSuperAdmin();

    const result = await createAdminUser(email, password, role);

    await logAdminAction({
      action: "admin-user.create",
      adminEmail: session.email,
      ip,
      userAgent,
      success: true,
      details: {
        newUserEmail: email,
        newUserRole: role,
        createdBy: session.email,
      },
    });

    return NextResponse.json({
      success: true,
      user: result.user,
      twoFactorSetup: result.twoFactorSetup,
      message: "Admin user created successfully. Provide the 2FA QR code and backup codes to the new admin.",
    });
  } catch (error) {
    const session = await getAdminSession();

    await logAdminAction({
      action: "admin-user.create",
      adminEmail: session?.email,
      ip,
      userAgent,
      success: false,
      details: { error: error instanceof Error ? error.message : String(error) },
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unauthorized: Super admin access required" },
      { status: 401 }
    );
  }
}
