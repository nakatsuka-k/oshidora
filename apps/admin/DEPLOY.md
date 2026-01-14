# Admin Deployment (oshidra-admin to admin.oshidra.com)

## Requirement: Kousuke@teqst.co.jp Account Only

To prevent accidental deployments from other accounts, always use Kousuke@teqst.co.jp's credentials.

## Setup (One-time)

1. Get your Cloudflare API Token from Kousuke@teqst.co.jp's account:
   - Go to https://dash.cloudflare.com/profile/api-tokens
   - Create a token with Pages access

2. Create `.env.local` in this directory:
   ```
   CLOUDFLARE_API_TOKEN=<your-token-from-step-1>
   ```

3. Add to `.gitignore`:
   ```
   .env.local
   ```

## Deploy

```bash
# Build and deploy (automatically uses Kousuke account via API token)
npm run deploy
```

This will:
1. Build the web app (`npm run export:web`)
2. Deploy to oshidra-admin project under Kousuke's account

## Verification

After deployment, verify at: https://admin.oshidra.com

