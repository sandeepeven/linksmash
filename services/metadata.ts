/**
 * Metadata Service
 *
 * This file provides functions for fetching metadata from URLs using the my.linkpreview.net API.
 * It extracts title, description, and image from shared links.
 * Uses new parsing strategy based on platform configuration and link types.
 */

import { LinkData, LinkPreviewResponse } from "../types/link";
import { detectHostnameTag } from "./hostnameTagDetection";

/**
 * API endpoint for linkpreview API
 */
const API_BASE_URL = "https://api.linkpreview.net";

/**
 * Fetches metadata (title, description, image) from a URL using my.linkpreview.net API
 *
 * @param url - The URL to fetch metadata for
 * @param apiKey - The API key for my.linkpreview.net service
 * @returns Promise<LinkData> - Link data object with metadata
 * @throws Error if API request fails or API key is invalid
 */
/**
 * Timeout duration for API requests in milliseconds
 */
const API_TIMEOUT = 10000; // 10 seconds

export async function fetchLinkMetadata(
  url: string,
  apiKey: string
): Promise<LinkData> {
  try {
    // Validate URL format
    if (!url || typeof url !== "string") {
      throw new Error("URL is required and must be a string");
    }

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      throw new Error("URL cannot be empty");
    }

    if (!isValidUrl(trimmedUrl)) {
      throw new Error(`Invalid URL format: ${trimmedUrl}`);
    }

    // Validate API key
    if (!apiKey || typeof apiKey !== "string" || apiKey.trim() === "") {
      throw new Error("API key is required and must be a valid string");
    }

    // Construct API endpoint URL (API key via header as per docs)
    const apiUrl = `${API_BASE_URL}/?q=${encodeURIComponent(trimmedUrl)}`;

    // Fetch metadata from API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    try {
      const response = await fetch(apiUrl, {
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "X-Linkpreview-Api-Key": apiKey.trim(),
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Handle specific HTTP error codes
        if (response.status === 401) {
          throw new Error(
            "Invalid API key. Please check your API key configuration."
          );
        } else if (response.status === 403) {
          throw new Error(
            "API access forbidden. Please check your API key permissions."
          );
        } else if (response.status === 429) {
          throw new Error("API rate limit exceeded. Please try again later.");
        } else if (response.status >= 500) {
          throw new Error("API server error. Please try again later.");
        } else {
          throw new Error(
            `API request failed with status ${response.status}: ${response.statusText}`
          );
        }
      }

      let data: LinkPreviewResponse;
      try {
        data = await response.json();
      } catch (jsonError) {
        throw new Error("Invalid JSON response from API");
      }

      // Check if API returned an error
      if (data.error) {
        const errorMessage =
          typeof data.error === "string" ? data.error : "Unknown API error";
        throw new Error(`API error: ${errorMessage}`);
      }

      // Extract metadata from API response
      // Detect tag based on hostname (p0) with fallback to category
      const detectedTag = detectHostnameTag(trimmedUrl, {
        title: data.title,
        description: data.description,
      });

      const hasMetadata =
        Boolean(data.title && data.title.trim() !== "") ||
        Boolean(data.description && data.description.trim() !== "") ||
        Boolean(data.image && data.image.trim() !== "");

      const linkData: LinkData = {
        url: data.url || trimmedUrl,
        title: hasMetadata ? data.title || null : "",
        description: hasMetadata ? data.description || null : "",
        image: hasMetadata ? data.image || null : null,
        tag: hasMetadata ? detectedTag : "Untitled",
        sharedImages: [],
        createdAt: new Date().toISOString(),
        metadataFetched: hasMetadata,
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

/**
 * Validates if a string is a valid URL
 *
 * @param urlString - The string to validate as a URL
 * @returns boolean - True if the string is a valid URL, false otherwise
 */
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
