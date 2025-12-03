# Environment Variables Setup

This guide explains how to configure the API URL for the Expo app.

## Problem

When running the Expo app with `npm start`, the `EXPO_PUBLIC_API_URL` environment variable needs to be set correctly. The app cannot use `localhost` or `0.0.0.0` because:

- On physical devices: `localhost` refers to the device itself, not your development machine
- On emulators: `0.0.0.0` may not resolve correctly

## Solution

Use your machine's **local IP address** instead of `localhost`.

## Quick Setup (Automated)

Run the setup script to configure your API URL:

```bash
cd apps/expo
npm run setup:env
```

This interactive script will:
1. Ask you to choose between Development, Production (App Runner), or Custom URL
2. For Development: Automatically detect your local IP address
3. For Production: Prompt you to enter your App Runner URL
4. Create a `.env` file with the configured `EXPO_PUBLIC_API_URL`
5. Prompt you if a `.env` file already exists

## Manual Setup

### Step 1: Find Your Local IP Address

**macOS/Linux:**
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**Windows:**
```bash
ipconfig
```
Look for "IPv4 Address" under your active network adapter.

### Step 2: Create `.env` File

Create a file named `.env` in the `apps/expo` directory:

```bash
cd apps/expo
touch .env
```

### Step 3: Add API URL

Add the following line to `.env` (replace `YOUR_IP` with your actual IP):

```env
EXPO_PUBLIC_API_URL=http://YOUR_IP:8080
```

Example:
```env
EXPO_PUBLIC_API_URL=http://192.168.1.100:8080
```

### Step 4: Restart Expo

After creating or updating the `.env` file, **restart the Expo development server**:

1. Stop the current server (Ctrl+C)
2. Run `npm start` again

Environment variables are loaded when Metro bundler starts, so a restart is required.

## Verification

The app will log a warning if `EXPO_PUBLIC_API_URL` is not set:

```
⚠️  EXPO_PUBLIC_API_URL not set. Using default http://0.0.0.0:8080 which may not work on physical devices.
```

If you see this warning, make sure:
1. The `.env` file exists in `apps/expo/`
2. It contains `EXPO_PUBLIC_API_URL=http://YOUR_IP:8080`
3. You've restarted the Expo server after creating/updating the file

## Production (App Runner)

For production builds using AWS App Runner, set `EXPO_PUBLIC_API_URL` to your App Runner service URL.

### Option 1: Using Setup Script (Recommended)

```bash
cd apps/expo
npm run setup:env
# Select option 2 (Production)
# Enter your App Runner URL when prompted
```

### Option 2: Manual Setup

1. Get your App Runner URL from AWS Console:
   - Go to AWS App Runner Console
   - Click on your service
   - Copy the "Default domain" (format: `https://xxxxx.ap-south-1.awsapprunner.com`)

2. Create or update `.env` file in `apps/expo/`:

```env
EXPO_PUBLIC_API_URL=https://xxxxx.ap-south-1.awsapprunner.com
```

3. Restart Expo development server

### Example App Runner URL Format

```
https://xxxxx.ap-south-1.awsapprunner.com
```

Replace `xxxxx` with your actual App Runner service ID.

## Troubleshooting

### API requests still fail

1. **Check your IP address**: Make sure you're using the correct IP (not `127.0.0.1` or `localhost`)
2. **Verify API server is running**: Ensure your backend API is running on the specified port
3. **Check firewall**: Make sure your firewall allows connections on the API port
4. **Same network**: Ensure your device/emulator is on the same network as your development machine
5. **Restart Expo**: Always restart Expo after changing `.env` files

### Environment variable not loading

- Make sure the variable is prefixed with `EXPO_PUBLIC_`
- Ensure the `.env` file is in `apps/expo/` directory (not the root)
- Restart the Expo development server after creating/updating `.env`
- Check that `app.config.js` exists (we converted from `app.json` to support env vars)

## Notes

- The `.env` file is gitignored and should not be committed
- Use `.env.example` as a template (if it exists)
- Environment variables are embedded at build/bundle time, so changes require a restart

