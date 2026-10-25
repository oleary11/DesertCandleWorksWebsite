// Sends a message written on /admin/emails in the shared order-email layout, and
// records it in the customer's conversation when it belongs to one.

import { sendEmailWithId } from "@/lib/email";
import { DEFAULT_BASE_URL, renderMessageEmail } from "@/lib/emailLayout";
import { addMessage, replyAddressFor, threadHeaders } from "@/lib/emailThreadsStore";

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
}): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || DEFAULT_BASE_URL;
  const { html, text } = renderMessageEmail({
    subject: input.subject,
    message: input.message,
    personal: input.personal,
    baseUrl,
  });

  const replyTo = (input.threadId && replyAddressFor(input.threadId)) || CONTACT_ADDRESS;
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
    // In a conversation, contact@ gets a hidden copy so our side shows in the inbox
    // thread next to the customer's replies.
    ...(input.threadId
      ? { bcc: CONTACT_ADDRESS, headers: threadHeaders(input.threadId, input.inReplyTo) }
      : input.inReplyTo
        ? { headers: { "In-Reply-To": input.inReplyTo, References: input.inReplyTo } }
        : {}),
  });

  if (input.threadId) {
    await addMessage({
      threadId: input.threadId,
      direction: "out",
      fromEmail: input.personal ? CONTACT_ADDRESS : "noreply@desertcandleworks.com",
      subject: input.subject,
      bodyText: input.message.trim(),
      resendId,
    });
  }
}
