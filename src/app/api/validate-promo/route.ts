import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { validatePromotion } from "@/lib/promotionValidator";
import { getPromotionByCode } from "@/lib/promotionsStore";
import { getUserSession } from "@/lib/userSession";

export const runtime = "nodejs";

type PromoAttempt = {
  timestamp: number;
  ip: string;
  sessionId: string;
};

/**
 * POST /api/validate-promo
 * Validates a promo code with anti-Honey protection via rate limiting and behavioral detection
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code, sessionId, subtotalCents } = body;

    // Validate input
    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { valid: false, error: "Promo code is required" },
        { status: 400 }
      );
    }

    if (code.length > 50) {
      return NextResponse.json(
        { valid: false, error: "Invalid promo code" },
        { status: 400 }
      );
    }

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json(
        { valid: false, error: "Invalid session" },
        { status: 400 }
      );
    }

    // Get IP address
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
               req.headers.get("x-real-ip") ||
               "unknown";

    // 1. Check if session is blocked
    const blockedKey = `promo:blocked:${sessionId}`;
    const isBlocked = await kv.get(blockedKey);
    if (isBlocked) {
      return NextResponse.json(
        { valid: false, error: "Too many attempts. Please try again later." },
        { status: 429 }
      );
    }

    // 2. Rate limiting by IP (max 5 attempts per hour)
    const ipKey = `promo:attempts:ip:${ip}`;
    const ipAttempts = (await kv.get<number>(ipKey)) || 0;

    if (ipAttempts > 5) {
      return NextResponse.json(
        { valid: false, error: "Too many attempts from your IP. Please try again later." },
        { status: 429 }
      );
    }

    await kv.incr(ipKey);
    await kv.expire(ipKey, 3600); // 1 hour

    // 3. Rate limiting by session (max 3 attempts per hour)
    const sessionKey = `promo:attempts:session:${sessionId}`;
    const sessionAttempts = (await kv.get<number>(sessionKey)) || 0;

    if (sessionAttempts > 3) {
      return NextResponse.json(
        { valid: false, error: "Too many attempts. Please try again later." },
        { status: 429 }
      );
    }

    await kv.incr(sessionKey);
    await kv.expire(sessionKey, 3600); // 1 hour

    // 4. Detect rapid-fire testing (Honey behavior)
    const attemptsKey = `promo:rapid:${sessionId}`;
    const recentAttempts = (await kv.lrange<PromoAttempt>(attemptsKey, 0, -1)) || [];

    const now = Date.now();
    const recentInLast10Seconds = recentAttempts.filter(
      (a) => now - a.timestamp < 10000
    );

    if (recentInLast10Seconds.length > 3) {
      // More than 3 attempts in 10 seconds = bot behavior, block session
      await kv.setex(blockedKey, 3600, "blocked");
      console.warn(`[Promo] Suspicious activity detected from session ${sessionId} (IP: ${ip})`);
      return NextResponse.json(
        { valid: false, error: "Suspicious activity detected. Please try again later." },
        { status: 429 }
      );
    }

    // Log this attempt
    await kv.lpush(attemptsKey, {
      timestamp: now,
      ip,
      sessionId,
    });
    await kv.expire(attemptsKey, 60); // Keep for 1 minute

    // 5. Look up the promo code
    const promotion = await getPromotionByCode(code.toUpperCase());

    if (!promotion) {
      return NextResponse.json(
        { valid: false, error: "Invalid promo code" },
        { status: 400 }
      );
    }

    // 6. Validate the promotion using existing validator
    const userSession = await getUserSession();
    const userId = userSession?.userId;

    const validation = await validatePromotion(promotion.id, {
      userId,
      isGuest: !userId,
      cartItems: [], // Full cart validation happens at checkout
      subtotalCents: subtotalCents || 0,
    });

    if (!validation.valid) {
      return NextResponse.json(
        { valid: false, error: validation.error || "Promotion is not valid" },
        { status: 400 }
      );
    }

    // Success - return promotion details
    return NextResponse.json({
      valid: true,
      promotionId: promotion.id,
      discountAmountCents: validation.discountAmountCents || 0,
      discountPercent: validation.discountPercent,
    });
  } catch (error) {
    console.error("[Promo Validation] Error:", error);
    return NextResponse.json(
      { valid: false, error: "Failed to validate promo code" },
      { status: 500 }
    );
  }
}
