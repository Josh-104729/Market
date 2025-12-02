import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter;
  private readonly logger = new Logger(EmailService.name);
  private isConfigured = false;

  constructor() {
    // Check if email credentials are configured
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpUser || !smtpPass || smtpUser === 'your-email@gmail.com' || smtpPass === 'your-app-password') {
      this.logger.warn(
        'Email service is not configured. Set SMTP_USER and SMTP_PASS environment variables to enable email sending.',
      );
      this.logger.warn(
        'For Gmail, you need to use an App Password. See: https://support.google.com/accounts/answer/185833',
      );
      this.isConfigured = false;
      return;
    }

    // Configure nodemailer
    // For development, you can use Gmail or other SMTP services
    // For production, use proper email service like SendGrid, AWS SES, etc.
    try {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false, // true for 465, false for other ports
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
      this.isConfigured = true;
      this.logger.log('Email service configured successfully');
    } catch (error) {
      this.logger.error('Failed to configure email service:', error);
      this.isConfigured = false;
    }
  }

  async sendVerificationEmail(email: string, verificationUrl: string) {
    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@market.com',
      to: email,
      subject: 'Verify Your Email Address',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Email Verification</h2>
          <p>Thank you for signing up! Please click the link below to verify your email address:</p>
          <a href="${verificationUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0;">
            Verify Email
          </a>
          <p>Or copy and paste this URL into your browser:</p>
          <p style="color: #666; word-break: break-all;">${verificationUrl}</p>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            This link will expire in 24 hours. If you didn't create an account, please ignore this email.
          </p>
        </div>
      `,
    };

    // If email service is configured, send the email
    if (this.isConfigured && this.transporter) {
      try {
        await this.transporter.sendMail(mailOptions);
        this.logger.log(`Verification email sent to ${email}`);
        return;
      } catch (error) {
        this.logger.error(`Error sending email to ${email}:`, error.message);
        if (error.code === 'EAUTH') {
          this.logger.error(
            'Authentication failed. Please check your SMTP credentials. For Gmail, make sure you are using an App Password.',
          );
        }
        // Fall through to development mode logging
      }
    }

    // Development mode: Log the verification URL
    // This ensures the flow continues even if email isn't configured
    this.logger.warn(
      `[DEV MODE] Email service not configured. Verification email would be sent to ${email}`,
    );
    this.logger.warn(`[DEV MODE] Verification URL: ${verificationUrl}`);
    this.logger.warn('In development, you can manually verify by visiting the URL above.');
  }
}

