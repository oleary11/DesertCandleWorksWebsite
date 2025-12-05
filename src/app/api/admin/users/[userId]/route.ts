import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin, getAdminSession } from "@/lib/adminSession";
import {
  getAdminUser,
  deactivateAdminUser,
  reactivateAdminUser,
  deleteAdminUser,
  changeAdminPassword,
  regenerateAdminTwoFactor,
} from "@/lib/adminUsers";
import { logAdminAction } from "@/lib/adminLogs";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

/**
 * PATCH /api/admin/users/[userId] - Update admin user
 * Supports: deactivate, reactivate, changePassword, regenerate2FA
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  try {
    const session = await requireSuperAdmin();
    const { userId } = await context.params;
    const body = await req.json();
    const { action, newPassword } = body;

    const targetUser = await getAdminUser(userId);
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    switch (action) {
      case "deactivate":
        await deactivateAdminUser(userId);
        await logAdminAction({
          action: "admin-user.deactivate",
          adminEmail: session.email,
          ip,
          userAgent,
          success: true,
          details: {
            targetEmail: targetUser.email,
            performedBy: session.email,
          },
        });
        return NextResponse.json({ success: true, message: "User deactivated" });

      case "reactivate":
        await reactivateAdminUser(userId);
        await logAdminAction({
          action: "admin-user.reactivate",
          adminEmail: session.email,
          ip,
          userAgent,
          success: true,
          details: {
            targetEmail: targetUser.email,
            performedBy: session.email,
          },
        });
        return NextResponse.json({ success: true, message: "User reactivated" });

      case "changePassword":
        if (!newPassword) {
          return NextResponse.json(
            { error: "New password required" },
            { status: 400 }
          );
        }
        await changeAdminPassword(userId, newPassword);
        await logAdminAction({
          action: "admin-user.password-change",
          adminEmail: session.email,
          ip,
          userAgent,
          success: true,
          details: {
            targetEmail: targetUser.email,
            performedBy: session.email,
          },
        });
        return NextResponse.json({
          success: true,
          message: "Password changed successfully",
        });

      case "regenerate2FA":
        const twoFactorSetup = await regenerateAdminTwoFactor(userId);
        if (!twoFactorSetup) {
          return NextResponse.json({ error: "Failed to regenerate 2FA" }, { status: 500 });
        }
        await logAdminAction({
          action: "admin-user.2fa-regenerate",
          adminEmail: session.email,
          ip,
          userAgent,
          success: true,
          details: {
            targetEmail: targetUser.email,
            performedBy: session.email,
          },
        });
        return NextResponse.json({
          success: true,
          twoFactorSetup,
          message: "2FA regenerated successfully",
        });

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    const session = await getAdminSession();
    await logAdminAction({
      action: "admin-user.update",
      adminEmail: session?.email,
      ip,
      userAgent,
      success: false,
      details: { error: String(error) },
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unauthorized" },
      { status: 401 }
    );
  }
}

/**
 * DELETE /api/admin/users/[userId] - Permanently delete admin user
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  try {
    const session = await requireSuperAdmin();
    const { userId } = await context.params;

    // Prevent self-deletion
    if (userId === session.userId) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 }
      );
    }

    const targetUser = await getAdminUser(userId);
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await deleteAdminUser(userId);

    await logAdminAction({
      action: "admin-user.delete",
      adminEmail: session.email,
      ip,
      userAgent,
      success: true,
      details: {
        deletedEmail: targetUser.email,
        deletedRole: targetUser.role,
        performedBy: session.email,
      },
    });

    return NextResponse.json({ success: true, message: "User deleted permanently" });
  } catch (error) {
    const session = await getAdminSession();
    await logAdminAction({
      action: "admin-user.delete",
      adminEmail: session?.email,
      ip,
      userAgent,
      success: false,
      details: { error: String(error) },
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unauthorized" },
      { status: 401 }
    );
  }
}
