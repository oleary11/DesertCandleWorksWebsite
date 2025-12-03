// Email sending utility
import { Resend } from 'resend';

type EmailOptions = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

/**
 * Send email using Resend
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  // Log to console for development
  console.log("\n========== EMAIL ==========");
  console.log(`To: ${options.to}`);
  console.log(`Subject: ${options.subject}`);
  if (options.text) {
    console.log("\n--- Text Content ---");
    console.log(options.text);
  }
  console.log("===========================\n");

  // Send actual email with Resend
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set - email not sent (shown above)");
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    await resend.emails.send({
      from: 'Desert Candle Works <noreply@desertcandleworks.com>',
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
    console.log(`✓ Email sent to ${options.to}`);
  } catch (error) {
    console.error("Failed to send email:", error);
    throw error;
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const resetUrl = `${baseUrl}/account/reset-password?token=${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 20px; background: white; }
          .button { display: inline-block; padding: 12px 24px; background: #d4a574; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; color: #333;">Desert Candle Works</h1>
          </div>
          <div class="content">
            <h2>Reset Your Password</h2>
            <p>We received a request to reset your password. Click the button below to choose a new password:</p>
            <p style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">${resetUrl}</p>
            <p><strong>This link will expire in 1 hour.</strong></p>
            <p>If you didn't request a password reset, you can safely ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Desert Candle Works. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
Desert Candle Works - Reset Your Password

We received a request to reset your password. Visit the link below to choose a new password:

${resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email.

© ${new Date().getFullYear()} Desert Candle Works. All rights reserved.
  `;

  await sendEmail({
    to: email,
    subject: "Reset Your Password - Desert Candle Works",
    html,
    text,
  });
}

/**
 * Send email verification email
 */
export async function sendEmailVerification(email: string, token: string): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const verifyUrl = `${baseUrl}/account/verify-email?token=${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 20px; background: white; }
          .button { display: inline-block; padding: 12px 24px; background: #d4a574; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; color: #333;">Desert Candle Works</h1>
          </div>
          <div class="content">
            <h2>Verify Your Email</h2>
            <p>Thanks for creating an account! Please verify your email address by clicking the button below:</p>
            <p style="text-align: center;">
              <a href="${verifyUrl}" class="button">Verify Email</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">${verifyUrl}</p>
            <p><strong>This link will expire in 24 hours.</strong></p>
            <p>Once verified, you'll be able to earn and redeem points on your purchases!</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Desert Candle Works. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
Desert Candle Works - Verify Your Email

Thanks for creating an account! Please verify your email address by visiting:

${verifyUrl}

This link will expire in 24 hours.

Once verified, you'll be able to earn and redeem points on your purchases!

© ${new Date().getFullYear()} Desert Candle Works. All rights reserved.
  `;

  await sendEmail({
    to: email,
    subject: "Verify Your Email - Desert Candle Works",
    html,
    text,
  });
}

/**
 * Send order invoice email (for both guests and registered users)
 */
export async function sendOrderInvoiceEmail(orderId: string): Promise<void> {
  const { getOrderById, createInvoiceAccessToken } = await import("@/lib/userStore");
  const order = await getOrderById(orderId);

  if (!order) {
    throw new Error("Order not found");
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  // Generate invoice URL
  let invoiceUrl: string;

  if (order.isGuest) {
    // For guests, create access token for secure invoice view
    const accessToken = await createInvoiceAccessToken(orderId);
    invoiceUrl = `${baseUrl}/invoice/view?token=${accessToken.token}`;
  } else {
    // For registered users, link to their account invoice
    invoiceUrl = `${baseUrl}/account/invoice/${orderId}`;
  }

  // Format order items for email
  const itemsHtml = order.items.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.productName}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${(item.priceCents / 100).toFixed(2)}</td>
    </tr>
  `).join('');

  const itemsText = order.items.map(item =>
    `${item.productName} x${item.quantity} - $${(item.priceCents / 100).toFixed(2)}`
  ).join('\n');

  // Calculate totals
  const subtotal = order.totalCents;
  const shipping = 799; // $7.99 - TODO: Get from order metadata
  const tax = 0; // Not calculated yet
  const total = subtotal + shipping + tax;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 20px; background: white; border: 1px solid #e5e7eb; }
          .button { display: inline-block; padding: 12px 24px; background: #d4a574; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .totals { margin-top: 20px; padding-top: 20px; border-top: 2px solid #e5e7eb; }
          .totals-row { display: flex; justify-content: space-between; padding: 8px 0; }
          .totals-row.final { font-size: 18px; font-weight: bold; padding-top: 12px; border-top: 2px solid #e5e7eb; margin-top: 8px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; color: #333;">Desert Candle Works</h1>
            <p style="margin: 10px 0 0 0; color: #666;">Thank you for your order!</p>
          </div>
          <div class="content">
            <h2>Order Confirmation</h2>
            <p>Hi${order.isGuest ? '' : ' there'},</p>
            <p>Thank you for your purchase! Your order has been confirmed and will be processed shortly.</p>

            <p style="margin: 20px 0;">
              <strong>Order #${orderId.slice(0, 8).toUpperCase()}</strong><br>
              <span style="color: #666; font-size: 14px;">${new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </p>

            <table>
              <thead>
                <tr style="background: #f8f9fa;">
                  <th style="padding: 12px; text-align: left; font-weight: 600;">Item</th>
                  <th style="padding: 12px; text-align: center; font-weight: 600;">Qty</th>
                  <th style="padding: 12px; text-align: right; font-weight: 600;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <div class="totals">
              <div class="totals-row">
                <span style="color: #666;">Subtotal:</span>
                <span style="font-weight: 500;">$${(subtotal / 100).toFixed(2)}</span>
              </div>
              <div class="totals-row">
                <span style="color: #666;">Shipping:</span>
                <span style="font-weight: 500;">$${(shipping / 100).toFixed(2)}</span>
              </div>
              ${tax > 0 ? `
              <div class="totals-row">
                <span style="color: #666;">Tax:</span>
                <span style="font-weight: 500;">$${(tax / 100).toFixed(2)}</span>
              </div>
              ` : ''}
              <div class="totals-row final">
                <span>Total:</span>
                <span>$${(total / 100).toFixed(2)}</span>
              </div>
            </div>

            ${!order.isGuest && order.pointsEarned > 0 ? `
            <div style="margin: 20px 0; padding: 15px; background: #fef3c7; border-left: 4px solid #d4a574; border-radius: 4px;">
              <p style="margin: 0; color: #92400e;">
                <strong>🎉 You earned ${order.pointsEarned} points!</strong><br>
                <span style="font-size: 14px;">Use them on your next purchase for discounts.</span>
              </p>
            </div>
            ` : ''}

            ${order.isGuest ? `
            <div style="margin: 20px 0; padding: 15px; background: #fef3c7; border-left: 4px solid #d4a574; border-radius: 4px;">
              <p style="margin: 0 0 10px 0; color: #92400e;">
                <strong>💡 Want to earn rewards?</strong>
              </p>
              <p style="margin: 0; font-size: 14px; color: #92400e;">
                Create an account to earn points on future purchases and get access to exclusive perks! You could have earned <strong>${order.pointsEarned} points</strong> on this order.
              </p>
              <p style="margin: 10px 0 0 0;">
                <a href="${baseUrl}/account/register" style="color: #d4a574; font-weight: 600;">Create Account →</a>
              </p>
              <p style="margin: 10px 0 0 0; font-size: 12px; color: #92400e;">
                We've added you to our mailing list to keep you updated on new scents and exclusive offers.
              </p>
            </div>
            ` : ''}

            <p style="text-align: center;">
              <a href="${invoiceUrl}" class="button">View Full Invoice</a>
            </p>

            <p style="font-size: 14px; color: #666;">
              <strong>What's next?</strong><br>
              Your order will be processed and shipped within 2-3 business days. You'll receive a shipping confirmation email with tracking information once your order ships.
            </p>

            <p style="font-size: 14px; color: #666;">
              Questions? Contact us at <a href="mailto:support@desertcandleworks.com" style="color: #d4a574;">support@desertcandleworks.com</a>
            </p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Desert Candle Works. All rights reserved.</p>
            <p style="margin-top: 10px;">Scottsdale, AZ | www.desertcandleworks.com</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
Desert Candle Works - Order Confirmation

Thank you for your order!

Order #${orderId.slice(0, 8).toUpperCase()}
Date: ${new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

ORDER ITEMS:
${itemsText}

TOTALS:
Subtotal: $${(subtotal / 100).toFixed(2)}
Shipping: $${(shipping / 100).toFixed(2)}
${tax > 0 ? `Tax: $${(tax / 100).toFixed(2)}\n` : ''}Total: $${(total / 100).toFixed(2)}

${!order.isGuest && order.pointsEarned > 0 ? `
🎉 You earned ${order.pointsEarned} points!
Use them on your next purchase for discounts.
` : ''}

${order.isGuest ? `
💡 Want to earn rewards?
Create an account to earn points on future purchases! You could have earned ${order.pointsEarned} points on this order.
Create account: ${baseUrl}/account/register

We've added you to our mailing list to keep you updated on new scents and exclusive offers.
` : ''}

View your full invoice:
${invoiceUrl}

WHAT'S NEXT?
Your order will be processed and shipped within 2-3 business days. You'll receive a shipping confirmation email with tracking information once your order ships.

Questions? Contact us at support@desertcandleworks.com

© ${new Date().getFullYear()} Desert Candle Works. All rights reserved.
Scottsdale, AZ | www.desertcandleworks.com
  `;

  await sendEmail({
    to: order.email,
    subject: `Order Confirmation #${orderId.slice(0, 8).toUpperCase()} - Desert Candle Works`,
    html,
    text,
  });
}
