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
 * @param orderId - The order ID to send invoice for
 * @param customEmail - Optional custom email to override the order's email (for manual sales)
 */
export async function sendOrderInvoiceEmail(orderId: string, customEmail?: string): Promise<void> {
  const { getOrderById, createInvoiceAccessToken } = await import("@/lib/userStore");
  const order = await getOrderById(orderId);

  if (!order) {
    throw new Error("Order not found");
  }

  // Use custom email if provided, otherwise use order email
  const recipientEmail = customEmail || order.email;

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
  const itemsHtml = order.items.map((item: { productName: string; sizeName?: string; quantity: number; priceCents: number }) => {
    const displayName = item.sizeName ? `${item.productName} - ${item.sizeName}` : item.productName;
    return `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${displayName}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${(item.priceCents / 100).toFixed(2)}</td>
    </tr>
  `;
  }).join('');

  const itemsText = order.items.map((item: { productName: string; sizeName?: string; quantity: number; priceCents: number }) => {
    const displayName = item.sizeName ? `${item.productName} - ${item.sizeName}` : item.productName;
    return `${displayName} x${item.quantity} - $${(item.priceCents / 100).toFixed(2)}`;
  }).join('\n');

  // Calculate totals
  const subtotal = order.productSubtotalCents ?? order.totalCents;
  const shipping = order.shippingCents ?? 0;
  const tax = order.taxCents ?? 0;
  const total = order.totalCents;

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
              <strong>Order #${orderId}</strong><br>
              <span style="color: #666; font-size: 14px;">${new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Phoenix' })}</span>
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
                <span style="font-weight: 500;">${shipping === 0 ? 'FREE' : `$${(shipping / 100).toFixed(2)}`}</span>
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
              Questions? Contact us at <a href="mailto:contact@desertcandleworks.com" style="color: #d4a574;">contact@desertcandleworks.com</a>
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

Order #${orderId}
Date: ${new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Phoenix' })}

ORDER ITEMS:
${itemsText}

TOTALS:
Subtotal: $${(subtotal / 100).toFixed(2)}
Shipping: ${shipping === 0 ? 'FREE' : `$${(shipping / 100).toFixed(2)}`}
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

Questions? Contact us at contact@desertcandleworks.com

© ${new Date().getFullYear()} Desert Candle Works. All rights reserved.
Scottsdale, AZ | www.desertcandleworks.com
  `;

  await sendEmail({
    to: recipientEmail,
    subject: `Order Confirmation #${orderId} - Desert Candle Works`,
    html,
    text,
  });
}

/**
 * Send shipping confirmation email with USPS tracking
 * @param orderId - The order ID
 * @param trackingNumber - USPS tracking number
 */
export async function sendShippingConfirmationEmail(orderId: string, trackingNumber: string): Promise<void> {
  const { getOrderById } = await import("@/lib/userStore");
  const order = await getOrderById(orderId);

  if (!order) {
    throw new Error("Order not found");
  }

  const recipientEmail = order.email;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  // USPS tracking URL
  const trackingUrl = `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`;

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
          .tracking-box { background: #f0f9ff; border: 2px solid #3b82f6; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
          .tracking-number { font-size: 24px; font-weight: bold; color: #1e40af; font-family: 'Courier New', monospace; letter-spacing: 2px; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
          .shipping-info { background: #fef3c7; border-left: 4px solid #d4a574; border-radius: 4px; padding: 15px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; color: #333;">Desert Candle Works</h1>
            <p style="margin: 10px 0 0 0; color: #666;">Your order is on its way!</p>
          </div>
          <div class="content">
            <h2>📦 Shipped!</h2>
            <p>Great news! Your order has been shipped via USPS and is on its way to you.</p>

            <p style="margin: 20px 0;">
              <strong>Order #${orderId}</strong><br>
              <span style="color: #666; font-size: 14px;">Shipped on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </p>

            <div class="tracking-box">
              <p style="margin: 0 0 10px 0; color: #1e40af; font-weight: 600;">USPS Tracking Number</p>
              <div class="tracking-number">${trackingNumber}</div>
              <p style="margin: 15px 0 0 0;">
                <a href="${trackingUrl}" class="button">Track Your Package</a>
              </p>
            </div>

            ${order.shippingAddress ? `
            <div style="margin: 20px 0;">
              <h3 style="font-size: 16px; margin-bottom: 10px;">Shipping To:</h3>
              <div style="color: #666; font-size: 14px; line-height: 1.8;">
                ${order.shippingAddress.name ? `<strong>${order.shippingAddress.name}</strong><br>` : ''}
                ${order.shippingAddress.line1 || ''}<br>
                ${order.shippingAddress.line2 ? `${order.shippingAddress.line2}<br>` : ''}
                ${order.shippingAddress.city ? `${order.shippingAddress.city}, ` : ''}${order.shippingAddress.state || ''} ${order.shippingAddress.postalCode || ''}<br>
                ${order.shippingAddress.country || ''}
              </div>
            </div>
            ` : ''}

            <div class="shipping-info">
              <p style="margin: 0 0 10px 0; color: #92400e;">
                <strong>📬 Estimated Delivery</strong>
              </p>
              <p style="margin: 0; font-size: 14px; color: #92400e;">
                USPS Flat Rate shipping typically arrives within <strong>2-3 business days</strong> from the ship date. You can track your package in real-time using the tracking number above.
              </p>
            </div>

            <p style="font-size: 14px; color: #666; margin-top: 20px;">
              <strong>What's in your package?</strong><br>
              ${order.items.map((item: { productName: string; quantity: number }) => `${item.productName} (x${item.quantity})`).join('<br>')}
            </p>

            <p style="font-size: 14px; color: #666; margin-top: 20px;">
              Questions about your delivery? Contact us at <a href="mailto:contact@desertcandleworks.com" style="color: #d4a574;">contact@desertcandleworks.com</a>
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
Desert Candle Works - Your Order Has Shipped!

📦 Great news! Your order has been shipped via USPS and is on its way to you.

Order #${orderId}
Shipped on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

USPS TRACKING NUMBER:
${trackingNumber}

Track your package:
${trackingUrl}

${order.shippingAddress ? `
SHIPPING TO:
${order.shippingAddress.name || ''}
${order.shippingAddress.line1 || ''}
${order.shippingAddress.line2 || ''}
${order.shippingAddress.city ? `${order.shippingAddress.city}, ` : ''}${order.shippingAddress.state || ''} ${order.shippingAddress.postalCode || ''}
${order.shippingAddress.country || ''}
` : ''}

📬 ESTIMATED DELIVERY:
USPS Flat Rate shipping typically arrives within 2-3 business days from the ship date. You can track your package in real-time using the tracking number above.

WHAT'S IN YOUR PACKAGE:
${order.items.map((item: { productName: string; quantity: number }) => `- ${item.productName} (x${item.quantity})`).join('\n')}

Questions about your delivery? Contact us at contact@desertcandleworks.com

© ${new Date().getFullYear()} Desert Candle Works. All rights reserved.
Scottsdale, AZ | www.desertcandleworks.com
  `;

  await sendEmail({
    to: recipientEmail,
    subject: `📦 Your Order Has Shipped! #${orderId} - Desert Candle Works`,
    html,
    text,
  });
}

/**
 * Send delivery confirmation email
 * @param orderId - The order ID
 * @param trackingNumber - USPS tracking number
 */
export async function sendDeliveryConfirmationEmail(orderId: string, trackingNumber: string): Promise<void> {
  const { getOrderById } = await import("@/lib/userStore");
  const order = await getOrderById(orderId);

  if (!order) {
    throw new Error("Order not found");
  }

  const recipientEmail = order.email;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

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
          .delivery-box { background: #f0fdf4; border: 2px solid #22c55e; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
          .thank-you { background: #fef3c7; border-left: 4px solid #d4a574; border-radius: 4px; padding: 15px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; color: #333;">Desert Candle Works</h1>
            <p style="margin: 10px 0 0 0; color: #666;">Your order has been delivered!</p>
          </div>
          <div class="content">
            <h2>✅ Delivered!</h2>
            <p>Your Desert Candle Works order has been successfully delivered!</p>

            <p style="margin: 20px 0;">
              <strong>Order #${orderId}</strong><br>
              <span style="color: #666; font-size: 14px;">Delivered on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </p>

            <div class="delivery-box">
              <div style="font-size: 48px; margin-bottom: 10px;">📬</div>
              <p style="margin: 0; font-size: 18px; font-weight: 600; color: #15803d;">
                Package Delivered!
              </p>
              <p style="margin: 10px 0 0 0; color: #166534; font-size: 14px;">
                Tracking #${trackingNumber}
              </p>
            </div>

            <div class="thank-you">
              <p style="margin: 0 0 10px 0; color: #92400e;">
                <strong>🕯️ Enjoy Your Candles!</strong>
              </p>
              <p style="margin: 0; font-size: 14px; color: #92400e;">
                We hope you love your hand-poured candles! Each one is crafted with care right here in Scottsdale, Arizona.
              </p>
            </div>

            <p style="font-size: 14px; color: #666;">
              <strong>Your Order:</strong><br>
              ${order.items.map((item: { productName: string; quantity: number }) => `${item.productName} (x${item.quantity})`).join('<br>')}
            </p>

            ${!order.isGuest ? `
            <div style="margin: 20px 0; padding: 15px; background: #fef3c7; border-left: 4px solid #d4a574; border-radius: 4px;">
              <p style="margin: 0; color: #92400e;">
                <strong>💡 Don't forget!</strong><br>
                <span style="font-size: 14px;">You earned <strong>${order.pointsEarned} points</strong> on this order. Use them on your next purchase!</span>
              </p>
            </div>
            ` : `
            <div style="margin: 20px 0; padding: 15px; background: #fef3c7; border-left: 4px solid #d4a574; border-radius: 4px;">
              <p style="margin: 0 0 10px 0; color: #92400e;">
                <strong>💡 Love our candles?</strong>
              </p>
              <p style="margin: 0; font-size: 14px; color: #92400e;">
                Create an account to earn points on your next purchase! You could have earned <strong>${order.pointsEarned} points</strong> on this order.
              </p>
              <p style="margin: 10px 0 0 0;">
                <a href="${baseUrl}/account/register" style="color: #d4a574; font-weight: 600;">Create Account →</a>
              </p>
            </div>
            `}

            <div style="margin: 30px 0; padding: 20px; background: #f0f9ff; border: 2px solid #3b82f6; border-radius: 8px; text-align: center;">
              <p style="margin: 0 0 10px 0; font-size: 16px; font-weight: 600; color: #1e40af;">
                ⭐ Love Your Candles?
              </p>
              <p style="margin: 0 0 15px 0; font-size: 14px; color: #1e40af;">
                We'd love to hear from you! Leave us a review and help others discover our hand-poured candles.
              </p>
              <a href="https://g.page/r/CQcLSwY5Vml0EBM/review" style="display: inline-block; padding: 12px 30px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px;">Leave a Review</a>
            </div>

            <p style="font-size: 14px; color: #666; margin-top: 20px;">
              Questions or feedback? Contact us at <a href="mailto:contact@desertcandleworks.com" style="color: #d4a574;">contact@desertcandleworks.com</a>
            </p>

            <p style="text-align: center;">
              <a href="${baseUrl}/products" class="button">Shop More Candles</a>
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
Desert Candle Works - Your Order Has Been Delivered!

✅ Your Desert Candle Works order has been successfully delivered!

Order #${orderId}
Delivered on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

📬 PACKAGE DELIVERED!
Tracking #${trackingNumber}

🕯️ ENJOY YOUR CANDLES!
We hope you love your hand-poured candles! Each one is crafted with care right here in Scottsdale, Arizona.

YOUR ORDER:
${order.items.map((item: { productName: string; quantity: number }) => `- ${item.productName} (x${item.quantity})`).join('\n')}

${!order.isGuest ? `
💡 Don't forget! You earned ${order.pointsEarned} points on this order. Use them on your next purchase!
` : `
💡 Love our candles? Create an account to earn points on your next purchase! You could have earned ${order.pointsEarned} points on this order.
Create account: ${baseUrl}/account/register
`}

⭐ LOVE YOUR CANDLES?
We'd love to hear from you! Leave us a review and help others discover our hand-poured candles.

Leave a Review: https://g.page/r/CQcLSwY5Vml0EBM/review

Questions or feedback? Contact us at contact@desertcandleworks.com

Shop more candles: ${baseUrl}/products

© ${new Date().getFullYear()} Desert Candle Works. All rights reserved.
Scottsdale, AZ | www.desertcandleworks.com
  `;

  await sendEmail({
    to: recipientEmail,
    subject: `✅ Delivered! Order #${orderId} - Desert Candle Works`,
    html,
    text,
  });
}
