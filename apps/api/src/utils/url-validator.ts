/**
 * URL Validator Utility
 *
 * This file provides functions for validating and normalizing URLs.
 * Ensures URLs are properly formatted and safe to fetch.
 */

/**
 * Validates if a string is a valid URL
 *
 * @param urlString - The string to validate as a URL
 * @returns boolean - True if the string is a valid URL, false otherwise
 */
export function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Normalizes a URL by trimming whitespace and ensuring proper format
 *
 * @param urlString - The URL string to normalize
 * @returns string - The normalized URL
 * @throws Error if URL is invalid after normalization
 */
export function normalizeUrl(urlString: string): string {
  if (!urlString || typeof urlString !== "string") {
    throw new Error("URL is required and must be a string");
  }

  const trimmedUrl = urlString.trim();
  if (!trimmedUrl) {
    throw new Error("URL cannot be empty");
  }

  if (!isValidUrl(trimmedUrl)) {
    throw new Error(`Invalid URL format: ${trimmedUrl}`);
  }

  return trimmedUrl;
}

/**
 * Resolves a relative URL to an absolute URL based on a base URL
 *
 * @param relativeUrl - The relative URL to resolve
 * @param baseUrl - The base URL to resolve against
 * @returns string - The absolute URL
 */
export function resolveUrl(relativeUrl: string, baseUrl: string): string {
  try {
    return new URL(relativeUrl, baseUrl).href;
  } catch {
    return relativeUrl;
  }
}

