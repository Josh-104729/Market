# Railway Deployment Guide

This guide will help you deploy the OmniMart backend to Railway.

## Prerequisites

1. A Railway account (sign up at https://railway.app)
2. A MySQL database (Railway provides MySQL service)
3. Environment variables configured (see below)

## Step 1: Create a New Project on Railway

1. Log in to Railway dashboard
2. Click "New Project"
3. Select "Deploy from GitHub repo" (recommended) or "Empty Project"

## Step 2: Add MySQL Database

1. In your Railway project, click "New" → "Database" → "MySQL"
2. Railway will automatically create a MySQL database
3. Note the connection details (you'll need them for environment variables)

## Step 3: Configure Environment Variables

In your Railway project, go to the "Variables" tab and add the following environment variables:

### Required Database Variables
```
DB_HOST=<your-mysql-host>
DB_PORT=3306
DB_USERNAME=<your-mysql-username>
DB_PASSWORD=<your-mysql-password>
DB_DATABASE=<your-mysql-database>
DB_SYNCHRONIZE=false
DB_LOGGING=false
```

**Important:** Set `DB_SYNCHRONIZE=false` in production to prevent automatic schema changes.

### Required Application Variables
```
NODE_ENV=production
PORT=3000
JWT_SECRET=<generate-a-strong-secret-key>
WALLET_ENCRYPTION_KEY=<generate-a-64-character-hex-string>
```

### CORS Configuration
```
CORS_ORIGINS=https://your-frontend-domain.com,https://your-admin-domain.com
FRONTEND_URL=https://your-frontend-domain.com
```

### Email Configuration (SMTP)
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@omnimart.com
```

**Note:** For Gmail, you need to use an App Password. See: https://support.google.com/accounts/answer/185833

### Storage Configuration (Backblaze B2)
```
B2_APPLICATION_KEY_ID=<your-b2-key-id>
B2_APPLICATION_KEY=<your-b2-application-key>
B2_BUCKET_ID=<your-b2-bucket-id>
B2_BUCKET_NAME=<your-b2-bucket-name>
B2_PUBLIC_URL=<your-b2-public-url>
```

### Blockchain Configuration (Optional but recommended)

#### Tron (TRC20)
```
TRON_FULL_NODE=https://api.trongrid.io
TRON_SOLIDITY_NODE=https://api.trongrid.io
TRON_EVENT_SERVER=https://api.trongrid.io
TRON_GRID_URL=https://api.trongrid.io
TRON_MASTER_WALLET_ADDRESS=<your-tron-wallet-address>
TRON_MASTER_WALLET_PRIVATE_KEY=<your-tron-wallet-private-key>
```

#### Polygon
```
POLYGON_RPC_URL=https://polygon-rpc.com
POLYGON_MASTER_WALLET_ADDRESS=<your-polygon-wallet-address>
POLYGON_MASTER_WALLET_PRIVATE_KEY=<your-polygon-wallet-private-key>
```

### Referral System Configuration (Optional)
```
REFERRAL_SIGNUP_REWARD_AMOUNT=0
REFERRAL_PURCHASE_REWARD_PERCENTAGE=5
REFERRAL_PURCHASE_REWARD_FIXED=0
REFERRAL_SIGNUP_REWARD_ENABLED=false
REFERRAL_PURCHASE_REWARD_ENABLED=true
```

### SMS Configuration (Optional - Twilio)
```
TWILIO_ACCOUNT_SID=<your-twilio-account-sid>
TWILIO_AUTH_TOKEN=<your-twilio-auth-token>
TWILIO_PHONE_NUMBER=<your-twilio-phone-number>
```

## Step 4: Deploy

### Option A: Deploy from GitHub (Recommended)

1. Connect your GitHub repository to Railway
2. Railway will automatically detect the backend folder
3. Set the root directory to `backend` in Railway settings
4. Railway will automatically build and deploy on every push

### Option B: Deploy via Railway CLI

1. Install Railway CLI: `npm i -g @railway/cli`
2. Login: `railway login`
3. Initialize: `railway init`
4. Link to project: `railway link`
5. Deploy: `railway up`

## Step 5: Configure Build Settings

In Railway project settings, ensure:
- **Root Directory:** `backend`
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm run start:prod`

Railway should auto-detect these from `railway.json`, but you can verify in settings.

## Step 6: Set Up Custom Domain (Optional)

1. In Railway project settings, go to "Settings" → "Domains"
2. Click "Generate Domain" or add your custom domain
3. Update your `CORS_ORIGINS` environment variable to include the new domain

## Step 7: Database Migration

Before deploying, ensure your database schema is up to date:

1. **Option 1:** Use TypeORM migrations (recommended)
   - Create migration files in your codebase
   - Run migrations manually or via Railway CLI

2. **Option 2:** Use synchronize (development only)
   - Set `DB_SYNCHRONIZE=true` temporarily
   - Let TypeORM create tables
   - **IMPORTANT:** Set back to `false` immediately after

## Step 8: Verify Deployment

1. Check Railway logs to ensure the app started successfully
2. Visit your Railway domain: `https://your-app.railway.app/api`
3. Test API endpoints to verify everything works

## Troubleshooting

### Build Failures
- Check Railway logs for specific error messages
- Ensure all dependencies are in `package.json` (not just devDependencies)
- Verify Node.js version compatibility

### Database Connection Issues
- Verify database credentials in Railway variables
- Check that database is accessible from Railway's network
- Ensure database exists and user has proper permissions

### CORS Errors
- Verify `CORS_ORIGINS` includes your frontend domain
- Check that domains match exactly (including protocol: https://)
- Ensure no trailing slashes in CORS_ORIGINS

### Port Issues
- Railway automatically sets `PORT` environment variable
- Your app should use `process.env.PORT || 3000`
- Don't hardcode port numbers

### Environment Variables Not Loading
- Verify variables are set in Railway dashboard
- Check variable names match exactly (case-sensitive)
- Restart deployment after adding new variables

## Monitoring

Railway provides:
- Real-time logs in the dashboard
- Metrics and usage statistics
- Automatic restarts on failure

## Security Best Practices

1. **Never commit secrets:** Use Railway environment variables
2. **Use strong secrets:** Generate random strings for JWT_SECRET and encryption keys
3. **Enable HTTPS:** Railway provides SSL certificates automatically
4. **Set DB_SYNCHRONIZE=false:** Prevent accidental schema changes
5. **Review CORS origins:** Only allow trusted domains
6. **Rotate secrets regularly:** Update JWT_SECRET and encryption keys periodically

## Generating Secure Secrets

### JWT Secret
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Wallet Encryption Key
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Support

For Railway-specific issues, check:
- Railway Documentation: https://docs.railway.app
- Railway Discord: https://discord.gg/railway

For application-specific issues, check the application logs in Railway dashboard.

