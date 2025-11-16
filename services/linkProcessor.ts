/**
 * Link Processor Service
 *
 * This file provides the main processing logic for links based on the new strategy:
 * 1. Parse text with links to get description ready for metadata
 * 2. Parse the link to get website name and use it as metadata title
 * 3. Determine if link preview API should be called based on platform
 * 4. Handle special cases for various apps
 */

import { LinkData } from "../types/link";
import {
  parseLink,
  parseBlinkItStyle,
  parseFlipkartStyle,
  extractHostname,
} from "./linkParser";
import { shouldUseLinkPreview, getDefaultImageUrl } from "./platformConfig";
import { detectHostnameTag } from "./hostnameTagDetection";
import { fetchLinkMetadata } from "./metadata";

/**
 * Processes a shared link or text+link combination
 *
 * @param input - The shared text or URL
 * @param apiKey - Optional API key for link preview
 * @param attachedImages - Optional array of attached image URIs
 * @returns Promise<LinkData> - Processed link data
 */
export async function processLink(
  input: string,
  apiKey?: string,
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

  // Handle platform-specific parsing
  if (hostname) {
    const lowerHostname = hostname.toLowerCase();

    // BlinkIt pattern
    if (lowerHostname.includes("blinkit")) {
      const blinkItParsed = parseBlinkItStyle(input, url);
      title = blinkItParsed.title;
      description = blinkItParsed.description;
    }
    // Flipkart pattern
    else if (lowerHostname.includes("flipkart")) {
      const flipkartParsed = parseFlipkartStyle(input, url);
      title = flipkartParsed.title;
      description = flipkartParsed.description;
    }
  }

  // Step 3: Check if we should use link preview API
  const useLinkPreview = shouldUseLinkPreview(url);
  const defaultImageUrl = getDefaultImageUrl(url);

  // Step 4: Fetch metadata from link preview API if needed
  if (useLinkPreview && apiKey) {
    try {
      const apiMetadata = await fetchLinkMetadata(url, apiKey);

      // Merge API metadata with parsed data
      // Prefer parsed title/description if they exist, otherwise use API data
      title = apiMetadata.title || title || null;
      description = apiMetadata.description || description || null;
      image = apiMetadata.image || defaultImageUrl || null;
    } catch (error) {
      console.warn("Link preview API failed, using parsed data:", error);
      // Continue with parsed data if API fails
      image = defaultImageUrl || null;
    }
  } else {
    // Use default image URL if available
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
    metadataFetched: useLinkPreview && apiKey ? true : false,
  };

  return linkData;
}

/**
 * Processes a link without API key (fallback mode)
 * Uses only parsing strategy without link preview API
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
