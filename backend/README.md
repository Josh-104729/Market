# Market Backend

Black Market Backend API built with NestJS, TypeScript, and TypeORM.

## Installation

```bash
npm install
```

## Running the app

```bash
# development
npm run start:dev

# production mode
npm run start:prod
```

## Database

Make sure MySQL is running and the database `market` exists.

## Environment Variables

Create a `.env` file in the backend directory with the following variables:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your-password
DB_DATABASE=market

# JWT Configuration
JWT_SECRET=your-secret-key-change-in-production

# Email Configuration (SMTP)
# For Gmail, you need to:
# 1. Enable 2-Step Verification on your Google account
# 2. Generate an App Password: https://support.google.com/accounts/answer/185833
# 3. Use the App Password (not your regular password) as SMTP_PASS
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@market.com

# SMS Configuration (Twilio - Optional)
# For production, configure Twilio to send SMS verification codes
# Get credentials from: https://www.twilio.com/
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Frontend URL (for email verification links)
FRONTEND_URL=http://localhost:5173

# Server Configuration
PORT=3000
```

### Email Configuration

**Important:** The email service will attempt to send verification emails when configured. If credentials are not configured, it will log the verification URL to the console (useful for development).

**For Gmail:**
1. Enable 2-Step Verification on your Google account
2. Go to [Google App Passwords](https://support.google.com/accounts/answer/185833)
3. Generate an App Password for "Mail"
4. Use this App Password (not your regular password) as `SMTP_PASS`

**For Production:** Consider using services like SendGrid, AWS SES, or Mailgun for better deliverability.

### SMS Configuration

**Important:** The SMS service will attempt to send verification codes when configured. If Twilio credentials are not configured, it will log the verification code to the console (useful for development).

**For Twilio:**
1. Sign up for a Twilio account at https://www.twilio.com/
2. Get your Account SID and Auth Token from the Twilio Console
3. Get a phone number from Twilio
4. Set the environment variables: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER`
5. Install Twilio package: `npm install twilio`

**For Production:** Consider using AWS SNS, Twilio, or other SMS providers for reliable delivery.

**Note:** Both email and SMS services work in both development and production modes. In development, if credentials aren't configured, verification URLs and codes are logged to the console for testing purposes.

