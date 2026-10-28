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
}


module.exports = {
  expo: {
    name: "LinkSmash",
    slug: "LinkSmash",
    version: "1.1.3",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    // Deep-link scheme, required by expo-share-intent
    scheme: "linksmash",
    plugins: [
      [
        "expo-share-intent",
        {
          // Text + URLs, plus a single image (e.g. product screenshots)
          androidIntentFilters: ["text/*", "image/*"],
          androidMultiIntentFilters: ["image/*"],
          // iOS share extension needs an App Group + the xcode patch-package
          // patch (see expo-share-intent README). Enable once that is set up.
          disableIOS: true,
        },
      ],
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
      package: "com.x0089.LinkSmash",
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    extra: {
      eas: {
        projectId: "1be44366-1c91-4617-93ed-aac555d5860e",
      },
    },
  },
};

