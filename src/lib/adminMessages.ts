// Sends a message written on /admin/emails in the shared order-email layout, and
// records it in the customer's conversation when it belongs to one.

import { sendEmailWithId } from "@/lib/email";
import { DEFAULT_BASE_URL, renderMessageEmail } from "@/lib/emailLayout";
import {
  addMessage,
  replyAddressFor,
  threadHeaders,
} from "@/lib/emailThreadsStore";
import { unsubscribeHeaders, unsubscribePageUrl } from "@/lib/unsubscribe";
import { renderFramedEmail, type EmailDesign } from "@/lib/emailFrames";
import { getFrame } from "@/lib/emailFramesStore";
import { resolvePromoProducts } from "@/lib/promoProducts";

const CONTACT_ADDRESS = "contact@desertcandleworks.com";

export async function sendAdminMessage(input: {
  to: string;
  subject: string;
  message: string;
  personal: boolean;
  /** Conversation to file this under; replies are routed back to it. */
  threadId?: string;
  /** Message-ID of the customer email we're answering, to keep their mail client's thread. */
  inReplyTo?: string | null;
  /** Order picked on the compose form, so the email shows up under that order. */
  orderId?: string;
  /** Mass email: adds an unsubscribe link and Gmail's one-click unsubscribe headers. */
  bulk?: boolean;
  /** Send inside a festive frame (lib/emailFrames.ts) instead of the standard letter. */
  design?: EmailDesign | null;
  /** Have Resend send it at this time instead of now. */
  scheduledAt?: Date;
}): Promise<string | null> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || DEFAULT_BASE_URL;
  const unsubscribeUrl = input.bulk ? unsubscribePageUrl(input.to) : undefined;
  const frame = input.design ? await getFrame(input.design.frameId) : null;
  if (input.design && !frame)
    throw new Error(`Email frame "${input.design.frameId}" not found`);
  const { html, text } =
    input.design && frame
      ? renderFramedEmail({
          subject: input.subject,
          message: input.message,
          personal: input.personal,
          frame,
          design: input.design,
          products: await resolvePromoProducts(input.design.productSlugs ?? []),
          baseUrl,
          unsubscribeUrl,
        })
      : renderMessageEmail({
          subject: input.subject,
          message: input.message,
          personal: input.personal,
          baseUrl,
          unsubscribeUrl,
        });

  const replyTo =
    (input.threadId && replyAddressFor(input.threadId)) || CONTACT_ADDRESS;
  const from = input.personal
    ? `Josh & Cori | Desert Candle Works <${CONTACT_ADDRESS}>`
    : "Desert Candle Works <noreply@desertcandleworks.com>";

  const resendId = await sendEmailWithId({
    to: input.to,
    from,
    replyTo,
    subject: input.subject,
    html,
    text,
    category: "message",
    orderId: input.orderId,
    scheduledAt: input.scheduledAt,
    // In a conversation, contact@ gets a hidden copy so our side shows in the inbox
    // thread next to the customer's replies.
    ...(input.threadId
      ? {
          bcc: CONTACT_ADDRESS,
          headers: threadHeaders(input.threadId, input.inReplyTo),
        }
      : input.bulk
        ? { headers: unsubscribeHeaders(input.to) }
        : input.inReplyTo
          ? {
              headers: {
                "In-Reply-To": input.inReplyTo,
                References: input.inReplyTo,
              },
            }
          : {}),
  });

  if (input.threadId) {
    await addMessage({
      threadId: input.threadId,
      direction: "out",
      fromEmail: input.personal
        ? CONTACT_ADDRESS
        : "noreply@desertcandleworks.com",
      subject: input.subject,
      // Promotions show in the conversation as a one-line summary plus the note.
      bodyText: input.design
        ? [
            `[${[input.design.headline, input.design.offer, input.design.code ? `code ${input.design.code}` : ""].filter(Boolean).join(": ")}]`,
            input.message.trim(),
          ]
            .filter(Boolean)
            .join("\n\n")
        : input.message.trim(),
      resendId,
    });
  }
  return resendId;
}
