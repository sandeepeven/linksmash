# Deploy to AWS App Runner - Step by Step Guide

## Prerequisites

✅ Docker image pushed to ECR (you've already done this with `deploy-to-ecr.sh`)
✅ ECR repository: `667819665864.dkr.ecr.ap-south-1.amazonaws.com/linksmash-api`

## Step-by-Step Deployment

### Step 1: Go to AWS App Runner Console

1. Navigate to: https://console.aws.amazon.com/apprunner
2. Make sure you're in the **ap-south-1** region (Mumbai)
3. Click **"Create service"** button

### Step 2: Configure Source

1. **Source type:** Select **"Container registry"** (NOT "Source code repository")
2. **Provider:** Select **"Amazon ECR"**
3. **Container image URI:**
   - Click **"Browse"** button
   - Select your repository: `linksmash-api`
   - Select image tag: **`latest`** (or the tag you pushed)
   - The URI should show: `667819665864.dkr.ecr.ap-south-1.amazonaws.com/linksmash-api:latest`
4. **Deployment trigger:**
   - Select **"Automatic"** (deploys when you push new images)
   - OR **"Manual"** if you want to control when to deploy

Click **"Next"**

### Step 3: Configure Service

1. **Service name:** `linksmash-api` (or your preferred name)

2. **Virtual CPU:**

   - Select **0.25 vCPU** (minimum, good for testing)
   - Or **0.5 vCPU** for better performance

3. **Memory:**

   - Select **0.5 GB** (minimum)
   - Or **1 GB** for better performance

4. **Auto scaling configuration:**
   - **Min size:** `1` (always keep 1 instance running)
   - **Max size:** `5` (scale up to 5 instances under load)
   - **Concurrency:** `100` (requests per instance)

Click **"Next"**

### Step 4: Configure Service Settings

1. **Port:** Enter `3001` (this is the port your API listens on)

2. **Start command:** Leave **empty** (Dockerfile CMD handles it)

3. **Health check:**
   - **Path:** `/health` (your health check endpoint)
   - **Interval:** `10` seconds
   - **Timeout:** `5` seconds
   - **Healthy threshold:** `1`
   - **Unhealthy threshold:** `5`

Click **"Next"**

### Step 5: Add Environment Variables

Click **"Add environment variable"** and add each of these:

| Variable Name | Value           | Required    | Description                                |
| ------------- | --------------- | ----------- | ------------------------------------------ |
| `NODE_ENV`    | `production`    | ✅ Yes      | Sets Node.js environment                   |
| `HOST`        | `0.0.0.0`       | ✅ Yes      | Server bind address                        |
| `PORT`        | `80`            | ✅ Yes      | Server port (must match port above)        |
| `LOG_LEVEL`   | `info`          | ⚠️ Optional | Logging level (info, debug, warn, error)   |
| `REDIS_URL`   | _(leave empty)_ | ❌ Optional | Redis connection URL (only if using Redis) |

**Required Variables (add these):**

```
NODE_ENV = production
HOST = 0.0.0.0
PORT = 80
```

**Optional Variables:**

```
LOG_LEVEL = info
REDIS_URL = (leave empty if not using Redis)
```

**Note:** The API works fine without Redis - it just won't cache responses.

Click **"Next"**

### Step 6: Review and Create

1. Review all your settings:

   - ✅ Source: Container registry (ECR)
   - ✅ Image: linksmash-api:latest
   - ✅ Port: 80
   - ✅ Environment variables set
   - ✅ Auto scaling configured

2. Click **"Create & deploy"**

### Step 7: Wait for Deployment

1. You'll see the deployment progress:

   - **Provisioning** → **Building** → **Deploying** → **Running**

2. This takes **5-10 minutes** the first time

3. Watch the **"Events"** tab for progress updates

4. When status shows **"Running"**, your service is ready!

### Step 8: Get Your Service URL

1. Once status is **"Running"**, click on your service name

2. Find the **"Default domain"** section

   - Format: `https://xxxxx.ap-south-1.awsapprunner.com`
   - This is your API URL!

3. Copy this URL - you'll need it for your Expo app

### Step 9: Test Your API

Test the endpoints:

```bash
# Health check
curl https://your-service-url.ap-south-1.awsapprunner.com/health

# Should return: {"status":"ok","timestamp":"..."}

# Test metadata endpoint
curl "https://your-service-url.ap-south-1.awsapprunner.com/api/metadata?url=https://example.com"

# Should return metadata JSON
```

### Step 10: Update Expo App

Update your Expo app to use the production API:

**Option 1: Environment Variable (Recommended)**

```bash
# Set when running
EXPO_PUBLIC_API_URL=https://your-service-url.ap-south-1.awsapprunner.com npm start
```

**Option 2: Update Code**
Edit `apps/expo/services/metadata.ts` line 18-19:

```typescript
const API_BASE_URL = "https://your-service-url.ap-south-1.awsapprunner.com";
```

## Environment Variables Summary

### Required (Must Add):

- ✅ `NODE_ENV=production`
- ✅ `HOST=0.0.0.0`
- ✅ `PORT=3001`

### Optional:

- ⚠️ `LOG_LEVEL=info` (defaults to "info" if not set)
- ❌ `REDIS_URL` (only if using Redis for caching)

## Updating Your Service

When you push a new Docker image to ECR:

1. **If you selected "Automatic" deployment:**

   - App Runner detects the new image
   - Automatically deploys it (takes 5-10 minutes)

2. **If you selected "Manual" deployment:**
   - Go to your App Runner service
   - Click **"Deploy"** → **"Deploy latest revision"**

## Cost Estimate

- **Minimum (0.25 vCPU, 0.5 GB, 1 instance):** ~$7-10/month
- **Recommended (0.5 vCPU, 1 GB, 1 instance):** ~$15-20/month
- Scales automatically based on traffic

## Troubleshooting

### Service won't start

- Check App Runner logs (click "Logs" tab)
- Verify PORT environment variable matches the port setting (3001)
- Check that all required environment variables are set

### Health check failing

- Verify health check path is `/health`
- Check service logs for errors
- Ensure the API is listening on the correct port

### Can't access service

- Wait for deployment to complete (status should be "Running")
- Check that the service URL is correct
- Verify CORS is configured (already set to allow all origins)

## Next Steps

1. ✅ Deploy to App Runner
2. ✅ Test API endpoints
3. ✅ Update Expo app with production API URL
4. ✅ Test Expo app with production API
5. ⚠️ (Optional) Set up Redis for caching
6. ⚠️ (Optional) Configure custom domain
