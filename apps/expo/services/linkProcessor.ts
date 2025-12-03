/**
 * Link Processor Service
 *
 * This file provides the main processing logic for links:
 * 1. Parse text with links to get description ready for metadata
 * 2. Parse the link to get website name and use it as metadata title
 * 3. Fetch metadata from the backend API
 * 4. Handle special cases for various apps
 */

import { LinkData } from "../types/link";
import { parseLink, parseBlinkItStyle, parseFlipkartStyle } from "./linkParser";
import { getDefaultImageUrl } from "./platformConfig";
import { detectHostnameTag } from "./hostnameTagDetection";
import { fetchLinkMetadata } from "./metadata";

/**
 * Processes a shared link or text+link combination
 * Always fetches metadata from the backend API
 *
 * @param input - The shared text or URL
 * @param attachedImages - Optional array of attached image URIs
 * @returns Promise<LinkData> - Processed link data
 */
export async function processLink(
  input: string,
  attachedImages: string[] = []
): Promise<LinkData> {
  // Step 1: Parse the text with links to get description ready for metadata
  const parsed = parseLink(input);
  const url = parsed.url;
  const hostname = parsed.hostname;

  if (!url) {
    throw new Error("No valid URL found in shared content");
  }

  // Step 2: Determine platform-specific parsing
  let title = parsed.title;
  let description = parsed.description;
  let image: string | null = null;

  // Step 3: Get default image URL as fallback
  const defaultImageUrl = getDefaultImageUrl(url);

  // Step 4: Always fetch metadata from backend API
  try {
    const apiMetadata = await fetchLinkMetadata(url);

    // Merge API metadata with parsed data
    // Prefer parsed title/description if they exist, otherwise use API data
    title = apiMetadata.title || title || null;
    description = apiMetadata.description || description || null;
    image = apiMetadata.image || defaultImageUrl || null;
  } catch (error) {
    console.warn("Metadata API failed, using parsed data:", error);
    // Continue with parsed data if API fails
    image = defaultImageUrl || null;
  }

  // Step 5: Detect tag (p0: hostname-based, fallback to category)
  const tag =
    detectHostnameTag(url, {
      title: title || null,
      description: description || null,
    }) || "general";

  // Step 6: Build final link data
  const linkData: LinkData = {
    url: url.trim(),
    title: title || null,
    description: description || null,
    image: image,
    tag: tag,
    sharedImages: attachedImages || [],
    createdAt: new Date().toISOString(),
    metadataFetched: true,
  };

  return linkData;
}

/**
 * Processes a link without API (fallback mode)
 * Uses only parsing strategy without metadata API
 * Used as a fallback when API calls fail
 *
 * @param input - The shared text or URL
 * @param attachedImages - Optional array of attached image URIs
 * @returns LinkData - Processed link data
 */
export function processLinkWithoutAPI(
  input: string,
  attachedImages: string[] = []
): LinkData {
  const parsed = parseLink(input);
  const url = parsed.url;
  const hostname = parsed.hostname;

  if (!url) {
    throw new Error("No valid URL found in shared content");
  }

  // Handle platform-specific parsing
  let title = parsed.title;
  let description = parsed.description;

  if (hostname) {
    const lowerHostname = hostname.toLowerCase();

    if (lowerHostname.includes("blinkit")) {
      const blinkItParsed = parseBlinkItStyle(input, url);
      title = blinkItParsed.title;
      description = blinkItParsed.description;
    } else if (lowerHostname.includes("flipkart")) {
      const flipkartParsed = parseFlipkartStyle(input, url);
      title = flipkartParsed.title;
      description = flipkartParsed.description;
    }
  }

  // Detect tag
  const tag =
    detectHostnameTag(url, {
      title: title || null,
      description: description || null,
    }) || "general";

  // Get default image if available
  const defaultImageUrl = getDefaultImageUrl(url);

  return {
    url: url.trim(),
    title: title || null,
    description: description || null,
    image: defaultImageUrl,
    tag: tag,
    sharedImages: attachedImages || [],
    createdAt: new Date().toISOString(),
    metadataFetched: false,
  };
}
