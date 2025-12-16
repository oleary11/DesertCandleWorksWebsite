// TikTok Shop API integration utilities
import { kv } from "@vercel/kv";

const TIKTOK_SHOP_TOKEN_KEY = "tiktok:shop:token";
const TIKTOK_API_BASE = "https://open.tiktokapis.com/v2";

export interface TikTokShopTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp
  refreshExpiresAt: number; // Unix timestamp
  scope: string;
}

/**
 * Get the OAuth authorization URL for TikTok Shop
 */
export function getTikTokAuthUrl(redirectUri: string): string {
  const appKey = process.env.TIKTOK_SHOP_APP_KEY;
  if (!appKey) {
    throw new Error("TIKTOK_SHOP_APP_KEY not configured");
  }

  // TikTok Shop requires specific scopes for seller operations
  const scopes = [
    "seller.base",
    "seller.product.write",
    "seller.product.read",
    "seller.stock.write",
    "seller.stock.read",
    "seller.order.read",
  ].join(",");

  const params = new URLSearchParams({
    client_key: appKey,
    response_type: "code",
    scope: scopes,
    redirect_uri: redirectUri,
    state: generateRandomState(),
  });

  return `https://services.tiktokshop.com/open/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<TikTokShopTokens> {
  const appKey = process.env.TIKTOK_SHOP_APP_KEY;
  const appSecret = process.env.TIKTOK_SHOP_APP_SECRET;

  if (!appKey || !appSecret) {
    throw new Error("TikTok Shop credentials not configured");
  }

  const response = await fetch(`${TIKTOK_API_BASE}/oauth/token/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    },
    body: JSON.stringify({
      client_key: appKey,
      client_secret: appSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error("[TikTok Shop] Token exchange failed:", error);
    throw new Error(`Failed to exchange code for token: ${JSON.stringify(error)}`);
  }

  const data = await response.json();

  const tokens: TikTokShopTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    refreshExpiresAt: Date.now() + data.refresh_expires_in * 1000,
    scope: data.scope,
  };

  // Store tokens in Redis
  await kv.set(TIKTOK_SHOP_TOKEN_KEY, JSON.stringify(tokens));

  return tokens;
}

/**
 * Refresh the access token
 */
export async function refreshAccessToken(): Promise<TikTokShopTokens> {
  const appKey = process.env.TIKTOK_SHOP_APP_KEY;
  const appSecret = process.env.TIKTOK_SHOP_APP_SECRET;

  if (!appKey || !appSecret) {
    throw new Error("TikTok Shop credentials not configured");
  }

  const storedTokens = await getStoredTokens();
  if (!storedTokens) {
    throw new Error("No tokens stored - authorization required");
  }

  const response = await fetch(`${TIKTOK_API_BASE}/oauth/token/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    },
    body: JSON.stringify({
      client_key: appKey,
      client_secret: appSecret,
      refresh_token: storedTokens.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error("[TikTok Shop] Token refresh failed:", error);
    throw new Error(`Failed to refresh token: ${JSON.stringify(error)}`);
  }

  const data = await response.json();

  const tokens: TikTokShopTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    refreshExpiresAt: Date.now() + data.refresh_expires_in * 1000,
    scope: data.scope,
  };

  await kv.set(TIKTOK_SHOP_TOKEN_KEY, JSON.stringify(tokens));

  return tokens;
}

/**
 * Get stored tokens from Redis
 */
export async function getStoredTokens(): Promise<TikTokShopTokens | null> {
  const tokensJson = await kv.get<string>(TIKTOK_SHOP_TOKEN_KEY);
  if (!tokensJson) return null;

  return JSON.parse(tokensJson);
}

/**
 * Get a valid access token (refreshes if needed)
 */
export async function getValidAccessToken(): Promise<string> {
  const tokens = await getStoredTokens();

  if (!tokens) {
    throw new Error("TikTok Shop not authorized - please connect your account");
  }

  // Check if token is expired or will expire in the next 5 minutes
  const expiryBuffer = 5 * 60 * 1000; // 5 minutes
  if (Date.now() + expiryBuffer >= tokens.expiresAt) {
    // Token is expired or about to expire, refresh it
    const refreshedTokens = await refreshAccessToken();
    return refreshedTokens.accessToken;
  }

  return tokens.accessToken;
}

/**
 * Check if TikTok Shop is connected
 */
export async function isTikTokShopConnected(): Promise<boolean> {
  const tokens = await getStoredTokens();
  return tokens !== null;
}

/**
 * Disconnect TikTok Shop
 */
export async function disconnectTikTokShop(): Promise<void> {
  await kv.del(TIKTOK_SHOP_TOKEN_KEY);
}

/**
 * Generate random state for OAuth security
 */
function generateRandomState(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
