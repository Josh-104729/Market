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
        greetingTimeout: 10000,  // Timeout for receiving SMTP greeting (10 seconds)
        socketTimeout: 10000, 
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
      from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@omnimart.com',
      to: email,
      subject: 'Verify Your Email Address',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #10b981; font-size: 28px; margin: 0;">OmniMart</h1>
            <p style="color: #666; font-size: 14px; margin-top: 5px;">Anyone can sell anything and buy anything</p>
          </div>
          <h2 style="color: #333;">Email Verification</h2>
          <p>Thank you for signing up to OmniMart! Please click the link below to verify your email address:</p>
          <a href="${verificationUrl}" style="display: inline-block; padding: 12px 24px; background-color: #10b981; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0;">
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
        console.log(error);
        console.log(error.code);
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

  async sendTwoFactorCode(email: string, code: string) {
    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@omnimart.com',
      to: email,
      subject: 'Your OmniMart 2FA Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #10b981; font-size: 28px; margin: 0;">OmniMart</h1>
            <p style="color: #666; font-size: 14px; margin-top: 5px;">Anyone can sell anything and buy anything</p>
          </div>
          <h2 style="color: #333;">Two-Factor Authentication Code</h2>
          <p>Your verification code is:</p>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; border-radius: 4px;">
            ${code}
          </div>
          <p style="color: #666; font-size: 12px;">This code will expire in 10 minutes.</p>
          <p style="color: #666; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
        </div>
      `,
    };

    // If email service is configured, send the email
    if (this.isConfigured && this.transporter) {
      try {
        await this.transporter.sendMail(mailOptions);
        this.logger.log(`2FA code email sent to ${email}`);
        return;
      } catch (error) {
        this.logger.error(`Error sending 2FA email to ${email}:`, error.message);
        if (error.code === 'EAUTH') {
          this.logger.error(
            'Authentication failed. Please check your SMTP credentials. For Gmail, make sure you are using an App Password.',
          );
        }
        // Fall through to development mode logging
      }
    }

    // Development mode: Log the code
    this.logger.warn(
      `[DEV MODE] Email service not configured. 2FA code email would be sent to ${email}`,
    );
    this.logger.warn(`[DEV MODE] 2FA Code: ${code}`);
    this.logger.warn('In development, you can use this code to verify 2FA.');
  }

  async sendNotificationReminderEmail(
    email: string,
    lastNotification: { title: string; message: string },
    unreadCount: number,
  ) {
    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@omnimart.com',
      to: email,
      subject: `You have ${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''} on OmniMart`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #10b981; font-size: 28px; margin: 0;">OmniMart</h1>
            <p style="color: #666; font-size: 14px; margin-top: 5px;">Anyone can sell anything and buy anything</p>
          </div>
          <h2 style="color: #333;">You have ${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}</h2>
          <p>You haven't checked your notifications in a while. Here's your latest notification:</p>
          <div style="background-color: #f4f4f4; padding: 20px; border-radius: 4px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">${lastNotification.title}</h3>
            <p style="color: #666; margin-bottom: 0;">${lastNotification.message}</p>
          </div>
          <p>You have <strong>${unreadCount}</strong> unread notification${unreadCount !== 1 ? 's' : ''} waiting for you.</p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/notifications" style="display: inline-block; padding: 12px 24px; background-color: #10b981; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0;">
            View All Notifications
          </a>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            This is an automated reminder. You can manage your notification preferences in your account settings.
          </p>
        </div>
      `,
    };

    // If email service is configured, send the email
    if (this.isConfigured && this.transporter) {
      try {
        await this.transporter.sendMail(mailOptions);
        this.logger.log(`Notification reminder email sent to ${email}`);
        return;
      } catch (error) {
        this.logger.error(`Error sending notification reminder email to ${email}:`, error.message);
        if (error.code === 'EAUTH') {
          this.logger.error(
            'Authentication failed. Please check your SMTP credentials. For Gmail, make sure you are using an App Password.',
          );
        }
        // Fall through to development mode logging
      }
    }

    // Development mode: Log the notification reminder
    this.logger.warn(
      `[DEV MODE] Email service not configured. Notification reminder email would be sent to ${email}`,
    );
    this.logger.warn(`[DEV MODE] Last Notification: ${lastNotification.title} - ${lastNotification.message}`);
    this.logger.warn(`[DEV MODE] Unread Count: ${unreadCount}`);
  }
}

