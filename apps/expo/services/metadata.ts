/**
 * Metadata Service
 *
 * This file provides functions for fetching metadata from URLs using client-side HTML parsing.
 * It extracts title, description, and image from shared links by fetching the HTML
 * and parsing it directly in the app.
 */

import { LinkData } from "../types/link";
import { detectHostnameTag } from "./hostnameTagDetection";
import { parseHTML, ParsedMetadata } from "./htmlParser";

/**
 * Timeout duration for fetch requests in milliseconds
 */
const FETCH_TIMEOUT = 10000; // 10 seconds

/**
 * Fetches metadata (title, description, image) from a URL by parsing HTML client-side
 *
 * @param url - The URL to fetch metadata for
 * @returns Promise<LinkData> - Link data object with metadata
 * @throws Error if URL is invalid or fetch fails
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
    let urlObj: URL;
    try {
      urlObj = new URL(trimmedUrl);
      if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
        throw new Error(`Invalid URL format: ${trimmedUrl}`);
      }
    } catch {
      throw new Error(`Invalid URL format: ${trimmedUrl}`);
    }

    // Fetch HTML content with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    let html: string;
    try {
      const response = await fetch(trimmedUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Handle specific HTTP error codes
        if (response.status === 400) {
          throw new Error("Invalid URL. Please check the URL format.");
        } else if (response.status === 404) {
          throw new Error("Page not found. The URL may be incorrect or the page may have been removed.");
        } else if (response.status === 403) {
          throw new Error("Access forbidden. The website may be blocking requests.");
        } else if (response.status >= 500) {
          throw new Error("Server error. Please try again later.");
        } else {
          throw new Error(
            `Failed to fetch page with status ${response.status}`
          );
        }
      }

      // Check if response is HTML
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/html")) {
        console.warn(
          `Response is not HTML (content-type: ${contentType}). Attempting to parse anyway.`
        );
      }

      html = await response.text();
    } catch (fetchError: any) {
      clearTimeout(timeoutId);

      // Handle AbortError (timeout)
      if (fetchError.name === "AbortError") {
        throw new Error(
          "Request timed out. Please check your internet connection and try again."
        );
      }

      // Handle network errors
      if (fetchError.message?.includes("Network request failed")) {
        throw new Error(
          "Network error. Please check your internet connection and try again."
        );
      }

      // Re-throw other fetch errors
      throw fetchError;
    }

    // Parse HTML to extract metadata
    let parsedMetadata: ParsedMetadata;
    try {
      parsedMetadata = parseHTML(html, trimmedUrl);
    } catch (parseError) {
      console.error("Error parsing HTML:", parseError);
      throw new Error("Failed to parse HTML content from the URL.");
    }

    // Detect tag based on hostname with fallback to category
    const detectedTag = detectHostnameTag(
      parsedMetadata.url || trimmedUrl,
      {
        title: parsedMetadata.title,
        description: parsedMetadata.description,
      }
    );

    // Determine if metadata was successfully fetched
    const hasMetadata =
      Boolean(parsedMetadata.title && parsedMetadata.title.trim() !== "") ||
      Boolean(
        parsedMetadata.description &&
          parsedMetadata.description.trim() !== ""
      ) ||
      Boolean(parsedMetadata.image && parsedMetadata.image.trim() !== "");

    // Build link data
    const linkData: LinkData = {
      url: parsedMetadata.url || trimmedUrl,
      title: parsedMetadata.title || null,
      description: parsedMetadata.description || null,
      image: parsedMetadata.image || null,
      tag: hasMetadata ? detectedTag || "Untitled" : "Untitled",
      sharedImages: [],
      createdAt: new Date().toISOString(),
      metadataFetched: hasMetadata,
    };

    return linkData;
  } catch (error) {
    console.error("Error fetching link metadata:", error);

    // Return link data with metadata fetch failed flag
    // This allows the app to still save the URL even if metadata fetch fails
    // Still try to detect tag from URL alone (hostname-based with fallback)
    const detectedTag = detectHostnameTag(url.trim());

    const linkData: LinkData = {
      url: url.trim(),
      title: null,
      description: null,
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
