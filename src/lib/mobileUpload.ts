// Mobile upload token management for QR code image uploads
import { kv } from "@vercel/kv";
import crypto from "crypto";

const UPLOAD_TOKEN_PREFIX = "mobile:upload:";
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

  const session: MobileUploadSession = {
    token,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    uploadedImages: [],
    completed: false,
  };

  await kv.set(`${UPLOAD_TOKEN_PREFIX}${token}`, session, {
    ex: UPLOAD_TOKEN_TTL,
  });

  return session;
}

/**
 * Get an upload session by token
 */
export async function getUploadSession(
  token: string
): Promise<MobileUploadSession | null> {
  const session = await kv.get<MobileUploadSession>(
    `${UPLOAD_TOKEN_PREFIX}${token}`
  );
  return session;
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

  session.uploadedImages.push(imageUrl);

  // Refresh TTL when images are added
  await kv.set(`${UPLOAD_TOKEN_PREFIX}${token}`, session, {
    ex: UPLOAD_TOKEN_TTL,
  });

  return true;
}

/**
 * Mark session as completed (stop accepting uploads)
 */
export async function completeUploadSession(token: string): Promise<boolean> {
  const session = await getUploadSession(token);
  if (!session) return false;

  session.completed = true;

  await kv.set(`${UPLOAD_TOKEN_PREFIX}${token}`, session, {
    ex: UPLOAD_TOKEN_TTL,
  });

  return true;
}

/**
 * Delete an upload session
 */
export async function deleteUploadSession(token: string): Promise<void> {
  await kv.del(`${UPLOAD_TOKEN_PREFIX}${token}`);
}
