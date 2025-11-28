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
  console.log("===========================\n");

  // Send actual email with Resend
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set - email not sent");
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    await resend.emails.send({
      from: 'Desert Candle Works <onboarding@resend.dev>', // Use your verified domain once set up
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
