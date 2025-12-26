# OmniMart Backend

OmniMart Backend API built with NestJS, TypeScript, and TypeORM. Powers the universal marketplace where anyone can sell anything and buy anything.

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
SMTP_FROM=noreply@omnimart.com

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

# Wallet Encryption (recommended in production)
WALLET_ENCRYPTION_KEY=change-me
# Optional: comma-separated previous keys for decrypting old wallets
WALLET_ENCRYPTION_KEY_FALLBACKS=

# TRON (USDT TRC20) - required for TRC20 charge/withdraw + temp-wallet sweep
TRON_MASTER_WALLET_ADDRESS=
TRON_MASTER_WALLET_PRIVATE_KEY=
# Optional: TronGrid API key for higher rate limits
TRON_PRO_API_KEY=

# Polygon (USDC) - required for USDC Polygon charge/withdraw + temp-wallet sweep
POLYGON_RPC_URL=
POLYGON_MASTER_WALLET_ADDRESS=
POLYGON_MASTER_WALLET_PRIVATE_KEY=
# Optional override (defaults to mainnet USDC on Polygon)
POLYGON_USDC_CONTRACT_ADDRESS=0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174
# Optional: how much MATIC to top up temp wallets with for gas before sweeping USDC
POLYGON_TEMP_WALLET_GAS_TOPUP_MATIC=0.05
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

