/**
 * Metadata Service
 *
 * This file provides functions for fetching metadata from URLs using the backend API.
 * It extracts title, description, and image from shared links.
 * Uses new parsing strategy based on platform configuration and link types.
 */

import { LinkData } from "../types/link";
import { detectHostnameTag } from "./hostnameTagDetection";

/**
 * Backend API base URL
 *
 * In development:
 * - Use your machine's local IP address (not localhost or 0.0.0.0)
 * - Find your IP: On macOS/Linux run `ifconfig`, on Windows run `ipconfig`
 * - Example: http://192.168.1.100:8080
 * - React Native/Expo cannot use localhost as it refers to the device itself
 *
 * In production:
 * - Use your deployed backend URL
 *
 * Set this via EXPO_PUBLIC_API_URL environment variable in a .env file
 * or export it before running `npm start`
 */
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://0.0.0.0:8080";

// Warn if using default URL (which won't work on physical devices)
if (!process.env.EXPO_PUBLIC_API_URL) {
  console.warn(
    "⚠️  EXPO_PUBLIC_API_URL not set. Using default http://0.0.0.0:8080 which may not work.\n" +
      "   Setup options:\n" +
      "   1. Run: npm run setup:env (in apps/expo directory)\n" +
      "   2. Create .env file with: EXPO_PUBLIC_API_URL=http://YOUR_LOCAL_IP:8080\n" +
      "   3. For production: EXPO_PUBLIC_API_URL=https://your-app-runner-url.awsapprunner.com"
  );
} else {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (apiUrl.startsWith("https://")) {
    console.log(`✅ Using production API: ${apiUrl}`);
  } else {
    console.log(`✅ Using development API: ${apiUrl}`);
  }
}

/**
 * Timeout duration for API requests in milliseconds
 */
const API_TIMEOUT = 10000; // 10 seconds

/**
 * Fetches metadata (title, description, image) from a URL using the backend API
 *
 * @param url - The URL to fetch metadata for
 * @returns Promise<LinkData> - Link data object with metadata
 * @throws Error if API request fails
 */
export async function fetchLinkMetadata(url: string): Promise<LinkData> {
  try {
    // Validate URL format
    if (!url || typeof url !== "string") {
      throw new Error("URL is required and must be a string");
    }

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      throw new Error("URL cannot be empty");
    }

    // Validate URL format
    try {
      const urlObj = new URL(trimmedUrl);
      if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
        throw new Error(`Invalid URL format: ${trimmedUrl}`);
      }
    } catch {
      throw new Error(`Invalid URL format: ${trimmedUrl}`);
    }

    // Construct API endpoint URL
    console.log("API base url:", API_BASE_URL);
    const apiUrl = `${API_BASE_URL}/api/metadata?url=${encodeURIComponent(
      trimmedUrl
    )}`;
    console.log("API called:", apiUrl);
    // Fetch metadata from API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    try {
      const response = await fetch(apiUrl, {
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Handle specific HTTP error codes
        if (response.status === 400) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.message || "Invalid URL. Please check the URL format."
          );
        } else if (response.status === 502) {
          throw new Error(
            "Failed to fetch metadata. The requested URL may be inaccessible."
          );
        } else if (response.status === 504) {
          throw new Error(
            "Request timed out. Please check your internet connection and try again."
          );
        } else if (response.status >= 500) {
          throw new Error("Server error. Please try again later.");
        } else {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.message ||
              `API request failed with status ${response.status}`
          );
        }
      }

      let data: LinkData;
      try {
        data = await response.json();
      } catch (jsonError) {
        throw new Error("Invalid JSON response from API");
      }

      // Detect tag based on hostname (p0) with fallback to category
      const detectedTag = detectHostnameTag(data.url || trimmedUrl, {
        title: data.title,
        description: data.description,
      });

      // Use detected tag if backend didn't provide one or if it's "Untitled"
      if (!data.tag || data.tag === "Untitled") {
        data.tag = detectedTag || "Untitled";
      }

      // Ensure sharedImages and createdAt are set
      const linkData: LinkData = {
        url: data.url || trimmedUrl,
        title: data.title,
        description: data.description,
        image: data.image,
        tag: data.tag,
        sharedImages: data.sharedImages || [],
        createdAt: data.createdAt || new Date().toISOString(),
        metadataFetched: data.metadataFetched,
      };

      return linkData;
    } catch (fetchError: any) {
      clearTimeout(timeoutId);

      // Handle AbortError (timeout)
      if (fetchError.name === "AbortError") {
        throw new Error(
          "API request timed out. Please check your internet connection and try again."
        );
      }

      // Re-throw other fetch errors
      throw fetchError;
    }
  } catch (error) {
    console.error("Error fetching link metadata:", error);

    // Return link data with metadata fetch failed flag
    // This allows the app to still save the URL even if metadata fetch fails
    // Still try to detect tag from URL alone (hostname-based with fallback)
    const detectedTag = detectHostnameTag(url.trim());

    const linkData: LinkData = {
      url: url.trim(),
      title: "",
      description: "",
      image: null,
      tag: detectedTag || "Untitled",
      sharedImages: [],
      createdAt: new Date().toISOString(),
      metadataFetched: false,
    };

    // Re-throw the error for the caller to handle if needed
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Unknown error occurred while fetching link metadata");
  }
}

