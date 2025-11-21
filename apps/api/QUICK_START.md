# Quick Start - AWS App Runner Deployment

## TL;DR - 5 Steps to Deploy

1. **Push code to GitHub**
   ```bash
   git add .
   git commit -m "Add deployment files"
   git push origin main
   ```

2. **Go to AWS App Runner Console**
   - Navigate to: https://console.aws.amazon.com/apprunner
   - Click "Create service"

3. **Configure Service**
   - **Source:** Connect GitHub → Select `LinkSmash` repo → Branch `main`
   - **Build:** Docker → Dockerfile path: `apps/api/Dockerfile`
   - **Port:** `3001`
   - **Service name:** `linksmash-api`

4. **Set Environment Variables**
   ```
   NODE_ENV=production
   HOST=0.0.0.0
   PORT=3001
   LOG_LEVEL=info
   REDIS_URL=(optional - leave empty if not using Redis)
   ```

5. **Deploy & Get URL**
   - Click "Create & deploy"
   - Wait 5-10 minutes
   - Copy the service URL (e.g., `https://xxxxx.awsapprunner.com`)

## Update Expo App

After deployment, update your Expo app to use the production API:

**Option 1: Environment Variable (Recommended)**
```bash
# In apps/expo/.env or set when running
EXPO_PUBLIC_API_URL=https://your-service-url.awsapprunner.com
```

**Option 2: Update metadata.ts directly**
Edit `apps/expo/services/metadata.ts` line 18-19:
```typescript
const API_BASE_URL = "https://your-service-url.awsapprunner.com";
```

## Test Your API

```bash
# Health check
curl https://your-service-url.awsapprunner.com/health

# Metadata endpoint
curl "https://your-service-url.awsapprunner.com/api/metadata?url=https://example.com"
```

## Full Documentation

See `/DEPLOYMENT.md` for detailed instructions.

