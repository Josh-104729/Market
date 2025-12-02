import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private isConfigured = false;

  constructor() {
    // Check if Twilio credentials are configured
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

    if (twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
      this.isConfigured = true;
      this.logger.log('SMS service (Twilio) configured successfully');
    } else {
      this.logger.warn(
        'SMS service is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to enable SMS sending.',
      );
      this.logger.warn('In development mode, verification codes will be logged to the console.');
    }
  }

  async sendVerificationCode(phoneNumber: string, code: string) {
    // If Twilio is configured, send the SMS
    if (this.isConfigured) {
      try {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

        // Try to import twilio (optional dependency)
        let twilio;
        try {
          twilio = require('twilio');
        } catch (importError) {
          this.logger.error(
            'Twilio package not found. Install it with: npm install twilio',
          );
          throw new Error('Twilio package not installed');
        }

        const client = twilio(accountSid, authToken);

        await client.messages.create({
          body: `Your verification code is: ${code}`,
          from: twilioPhoneNumber,
          to: phoneNumber,
        });

        this.logger.log(`Verification code sent via SMS to ${phoneNumber}`);
        return;
      } catch (error) {
        this.logger.error(`Error sending SMS to ${phoneNumber}:`, error.message);
        // Fall through to development mode logging
      }
    }

    // Development mode: Log the verification code
    // This ensures the flow continues even if SMS isn't configured
    this.logger.warn(`[DEV MODE] SMS service not configured. Verification code for ${phoneNumber}: ${code}`);
    this.logger.warn('In development, you can use this code to verify the phone number.');
  }
}

