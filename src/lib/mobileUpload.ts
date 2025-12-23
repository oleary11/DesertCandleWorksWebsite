// Mobile upload token management for QR code image uploads
import { db } from "@/lib/db/client";
import { mobileUploadSessions } from "@/lib/db/schema";
import crypto from "crypto";
import { eq, lt } from "drizzle-orm";

const UPLOAD_TOKEN_TTL = 5 * 60; // 5 minutes

export type MobileUploadSession = {
  token: string;
  createdAt: string;
  expiresAt: string;
  uploadedImages: string[]; // Vercel Blob URLs
  completed: boolean;
};

/**
 * Create a new mobile upload session with a unique token
 */
export async function createUploadSession(): Promise<MobileUploadSession> {
  const token = crypto.randomBytes(32).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + UPLOAD_TOKEN_TTL * 1000);

  await db.insert(mobileUploadSessions).values({
    token,
    uploadedImages: [],
    completed: false,
    expiresAt,
  });

  const session: MobileUploadSession = {
    token,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    uploadedImages: [],
    completed: false,
  };

  return session;
}

/**
 * Get an upload session by token
 */
export async function getUploadSession(
  token: string
): Promise<MobileUploadSession | null> {
  const [session] = await db
    .select()
    .from(mobileUploadSessions)
    .where(eq(mobileUploadSessions.token, token))
    .limit(1);

  if (!session) return null;

  // Check if session has expired
  if (new Date(session.expiresAt) < new Date()) {
    // Clean up expired session
    await db.delete(mobileUploadSessions).where(eq(mobileUploadSessions.token, token));
    return null;
  }

  return {
    token: session.token,
    createdAt: session.createdAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    uploadedImages: session.uploadedImages as string[],
    completed: session.completed,
  };
}

/**
 * Add an uploaded image URL to the session
 */
export async function addUploadedImage(
  token: string,
  imageUrl: string
): Promise<boolean> {
  const session = await getUploadSession(token);
  if (!session) return false;

  const updatedImages = [...session.uploadedImages, imageUrl];

  await db
    .update(mobileUploadSessions)
    .set({ uploadedImages: updatedImages })
    .where(eq(mobileUploadSessions.token, token));

  return true;
}

/**
 * Mark session as completed (stop accepting uploads)
 */
export async function completeUploadSession(token: string): Promise<boolean> {
  const session = await getUploadSession(token);
  if (!session) return false;

  await db
    .update(mobileUploadSessions)
    .set({ completed: true })
    .where(eq(mobileUploadSessions.token, token));

  return true;
}

/**
 * Delete an upload session
 */
export async function deleteUploadSession(token: string): Promise<void> {
  await db.delete(mobileUploadSessions).where(eq(mobileUploadSessions.token, token));
}

/**
 * Clean up expired sessions (call periodically via cron)
 */
export async function cleanupExpiredUploadSessions(): Promise<number> {
  const result = await db
    .delete(mobileUploadSessions)
    .where(lt(mobileUploadSessions.expiresAt, new Date()));

  return result.rowCount ?? 0;
}
