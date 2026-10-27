import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminSession";
import { validateEmail } from "@/lib/validation";
import {
  GIFT_CARD_MAX,
  createGiftCard,
  getGiftCard,
  listGiftCards,
  sendGiftCardEmail,
  voidGiftCard,
} from "@/lib/giftCards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ giftCards: await listGiftCards() });
}

/** POST { amount, recipientEmail, recipientName?, message?, sendEmail }: issue store credit. */
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const amount = Math.round(Number(body.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount < 1 || amount > GIFT_CARD_MAX) {
    return NextResponse.json({ error: `Amount must be $1 to $${GIFT_CARD_MAX}` }, { status: 400 });
  }
  const email = validateEmail(typeof body.recipientEmail === "string" ? body.recipientEmail : "");
  if (!email.valid) return NextResponse.json({ error: "Enter the recipient's email" }, { status: 400 });
  const card = await createGiftCard({
    amountCents: Math.round(amount * 100),
    source: "admin",
    recipientEmail: email.normalized,
    recipientName: typeof body.recipientName === "string" ? body.recipientName.trim() || undefined : undefined,
    message: typeof body.message === "string" ? body.message.trim() || undefined : undefined,
    purchaserName: "Josh & Cori",
  });
  if (body.sendEmail !== false) await sendGiftCardEmail(card);
  return NextResponse.json({ giftCard: card }, { status: 201 });
}

/** PATCH { id, action: "resend" | "void" } */
export async function PATCH(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { id?: string; action?: string };
  const card = body.id ? await getGiftCard(body.id) : null;
  if (!card) return NextResponse.json({ error: "Gift card not found" }, { status: 404 });
  if (body.action === "resend") {
    await sendGiftCardEmail({ ...card, sendAt: null });
  } else if (body.action === "void") {
    await voidGiftCard(card.id);
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
