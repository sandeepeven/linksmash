# LinkSmash API Deployment Guide - AWS App Runner

This guide walks you through deploying the LinkSmash backend API to AWS App Runner.

## Prerequisites

- AWS account with App Runner access
- GitHub repository (or AWS CodeCommit) with your code
- AWS CLI configured (optional, for CLI deployment)

## Step-by-Step Deployment

### Step 1: Prepare Your Repository

1. **Ensure all files are committed:**
   ```bash
   git add .
   git commit -m "Add deployment files for AWS App Runner"
   git push origin main
   ```

2. **Verify the Dockerfile exists:**
   - Location: `apps/api/Dockerfile`
   - The Dockerfile is already created and ready to use

### Step 2: Create App Runner Service via AWS Console

1. **Navigate to AWS App Runner:**
   - Go to [AWS Console](https://console.aws.amazon.com/)
   - Search for "App Runner" in the services search bar
   - Click on "App Runner"

2. **Create a new service:**
   - Click "Create service" button

3. **Source and deployment:**
   - **Source type:** Choose "Source code repository"
   - **Connect to GitHub:** Click "Add new" if not connected
     - Authorize AWS to access your GitHub account
     - Select your repository: `LinkSmash`
     - Select branch: `main` (or your deployment branch)
   - **Deployment trigger:** Choose "Automatic" (deploys on every push)

4. **Configure build:**
   - **Build type:** Select "Docker"
   - **Dockerfile path:** `apps/api/Dockerfile`
   - **Docker build context:** `/` (root of repository)
   - **Build command:** Leave empty (Dockerfile handles it)
   - **Port:** `3001`

5. **Configure service:**
   - **Service name:** `linksmash-api` (or your preferred name)
   - **Virtual CPU:** 0.25 vCPU (minimum, adjust as needed)
   - **Memory:** 0.5 GB (minimum, adjust as needed)
   - **Auto scaling:** 
     - Min instances: 1
     - Max instances: 5 (adjust based on traffic)

6. **Configure environment variables:**
   Click "Add environment variable" and add:
   - `NODE_ENV` = `production`
   - `HOST` = `0.0.0.0`
   - `PORT` = `3001`
   - `LOG_LEVEL` = `info`
   - `REDIS_URL` = (optional) Your Redis connection string if using Redis
     - Example: `redis://your-redis-host:6379`
     - Or leave empty if not using Redis (app will work without it)

7. **Review and create:**
   - Review all settings
   - Click "Create & deploy"

### Step 3: Wait for Deployment

1. **Monitor deployment:**
   - App Runner will build and deploy your service
   - This typically takes 5-10 minutes
   - Watch the "Events" tab for progress

2. **Check service status:**
   - Wait until status shows "Running"
   - Note the service URL (format: `https://xxxxx.us-east-1.awsapprunner.com`)

### Step 4: Test Your API

1. **Get your service URL:**
   - In App Runner console, click on your service
   - Copy the "Default domain" URL (e.g., `https://xxxxx.us-east-1.awsapprunner.com`)

2. **Test health endpoint:**
   ```bash
   curl https://your-service-url.awsapprunner.com/health
   ```
   Should return: `{"status":"ok","timestamp":"..."}`

3. **Test metadata endpoint:**
   ```bash
   curl "https://your-service-url.awsapprunner.com/api/metadata?url=https://example.com"
   ```
   Should return metadata JSON

### Step 5: Update Expo App Configuration

1. **Update API URL in Expo app:**
   - Open `apps/expo/services/metadata.ts`
   - The app uses `EXPO_PUBLIC_API_URL` environment variable
   - You can set this in your Expo build configuration

2. **For development:**
   - Create `.env` file in `apps/expo/` (if using expo-env):
     ```
     EXPO_PUBLIC_API_URL=https://your-service-url.awsapprunner.com
     ```
   - Or set it when running:
     ```bash
     EXPO_PUBLIC_API_URL=https://your-service-url.awsapprunner.com npm start
     ```

3. **For production builds:**
   - Set `EXPO_PUBLIC_API_URL` in your EAS build configuration
   - Or update `apps/expo/app.json` to include it in `extra`:
     ```json
     "extra": {
       "apiUrl": "https://your-service-url.awsapprunner.com"
     }
     ```
   - Then update `apps/expo/services/metadata.ts` to read from `Constants.expoConfig.extra.apiUrl`

### Step 6: Configure CORS (if needed)

The API already has CORS configured to allow all origins. If you need to restrict it:

1. **Update CORS in `apps/api/src/app.ts`:**
   ```typescript
   await app.register(cors, {
     origin: ['https://your-expo-app-domain.com'], // Specific origins
     credentials: true,
   });
   ```

2. **Redeploy:**
   - Push changes to trigger automatic deployment

## Optional: Redis Setup

If you want to use Redis for caching:

### Option 1: AWS ElastiCache
1. Create ElastiCache Redis cluster in AWS
2. Get connection endpoint
3. Set `REDIS_URL` in App Runner environment variables

### Option 2: Upstash (Serverless Redis)
1. Sign up at [upstash.com](https://upstash.com)
2. Create Redis database
3. Copy connection URL
4. Set `REDIS_URL` in App Runner environment variables

### Option 3: Redis Cloud
1. Sign up at [redis.com/cloud](https://redis.com/cloud)
2. Create free database
3. Copy connection URL
4. Set `REDIS_URL` in App Runner environment variables

**Note:** The API works without Redis - it just won't cache responses.

## Monitoring and Logs

1. **View logs:**
   - In App Runner console, click on your service
   - Go to "Logs" tab
   - View real-time logs

2. **Set up CloudWatch alarms:**
   - Monitor service health
   - Set up alerts for errors

## Updating the Service

1. **Automatic updates:**
   - Push to your GitHub branch
   - App Runner automatically detects and deploys

2. **Manual updates:**
   - In App Runner console, click "Deploy" → "Deploy latest revision"

## Cost Estimation

- **Minimum configuration (0.25 vCPU, 0.5 GB):**
  - ~$7-10/month for 1 instance running 24/7
  - Additional costs for traffic and scaling

- **Recommended for production:**
  - 0.5 vCPU, 1 GB: ~$15-20/month
  - Scales automatically based on traffic

## Troubleshooting

### Service won't start
- Check logs in App Runner console
- Verify Dockerfile builds correctly locally
- Ensure PORT environment variable is set

### API returns 502/504 errors
- Check service logs
- Verify Redis connection (if using)
- Check external URL fetching (some sites block scrapers)

### CORS errors in Expo app
- Verify CORS configuration in `apps/api/src/app.ts`
- Check that API URL is correct in Expo app

## Next Steps

1. ✅ Deploy API to App Runner
2. ✅ Test API endpoints
3. ✅ Update Expo app with production API URL
4. ✅ Test Expo app with production API
5. ⚠️ Set up Redis (optional)
6. ⚠️ Configure custom domain (optional)
7. ⚠️ Set up monitoring and alerts

## Support

For issues:
- Check AWS App Runner documentation
- Review service logs
- Verify environment variables are set correctly

