/**
 * Expo App Configuration
 *
 * This file dynamically loads environment variables and configures the Expo app.
 * Environment variables prefixed with EXPO_PUBLIC_ are automatically available in the app.
 */

// Load environment variables from .env file if it exists
// Expo SDK 49+ automatically loads .env files, but we use dotenv for explicit loading
// This ensures variables are available when the config is evaluated
// We load from the current directory (apps/expo) to ensure correct path resolution
// 
// For EAS builds: Environment variables are set in eas.json and available via process.env
// For local development: Load from .env file
const path = require("path");
try {
  require("dotenv").config({ path: path.resolve(__dirname, ".env") });
} catch (e) {
  // dotenv is optional - Expo SDK 49+ loads .env files automatically
  // But explicit loading ensures it works when running from root via nx
}

// Get API URL from environment variable
// Priority: process.env.EXPO_PUBLIC_API_URL (from eas.json or .env) > default
const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://0.0.0.0:8080";

module.exports = {
  expo: {
    name: "LinkSmash",
    slug: "LinkSmash",
    version: "1.0.10",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    plugins: [
      "./plugins/withMainActivityOnNewIntent",
      "./plugins/withFixedIntentFilters",
    ],
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.x0089.LinkSmash",
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      intentFilters: [
        {
          action: "android.intent.action.SEND",
          category: ["android.intent.category.DEFAULT"],
          data: [
            { mimeType: "text/plain" },
            { mimeType: "text/html" },
            { mimeType: "image/*" },
            { mimeType: "video/*" },
          ],
        },
        {
          action: "android.intent.action.SEND_MULTIPLE",
          category: ["android.intent.category.DEFAULT"],
          data: [{ mimeType: "image/*" }, { mimeType: "video/*" }],
        },
      ],
      launchMode: "singleTop",
      package: "com.x0089.LinkSmash",
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    extra: {
      eas: {
        projectId: "1be44366-1c91-4617-93ed-aac555d5860e",
      },
      // Expose API URL to the app via expo-constants
      // This is set from environment variables (eas.json for builds, .env for local dev)
      apiUrl: API_URL,
    },
  },
};

