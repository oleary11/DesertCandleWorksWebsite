import { NextRequest, NextResponse } from "next/server";
import { cleanupExpiredUserSessions } from "@/lib/userSession";
import { cleanupExpiredAdminSessions } from "@/lib/adminSession";
import { cleanupExpiredUploadSessions } from "@/lib/mobileUpload";

export const runtime = "nodejs";

/**
 * GET /api/cron/cleanup-sessions
 * Cron job to clean up expired sessions from Postgres
 *
 * Runs daily via Vercel Cron to remove stale session data
 */
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[Cron] Starting session cleanup...");

    // Clean up all expired sessions in parallel
    const [userSessionsDeleted, adminSessionsDeleted, uploadSessionsDeleted] = await Promise.all([
      cleanupExpiredUserSessions(),
      cleanupExpiredAdminSessions(),
      cleanupExpiredUploadSessions(),
    ]);

    const totalDeleted = userSessionsDeleted + adminSessionsDeleted + uploadSessionsDeleted;

    console.log(`[Cron] Session cleanup complete:`, {
      userSessions: userSessionsDeleted,
      adminSessions: adminSessionsDeleted,
      uploadSessions: uploadSessionsDeleted,
      total: totalDeleted,
    });

    return NextResponse.json({
      success: true,
      deleted: {
        userSessions: userSessionsDeleted,
        adminSessions: adminSessionsDeleted,
        uploadSessions: uploadSessionsDeleted,
        total: totalDeleted,
      },
    });
  } catch (error) {
    console.error("[Cron] Session cleanup error:", error);
    return NextResponse.json(
      { error: "Failed to cleanup sessions", details: String(error) },
      { status: 500 }
    );
  }
}
