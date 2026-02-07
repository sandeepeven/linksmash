/**
 * Link Processor Service
 *
 * This file provides the main processing logic for links:
 * 1. Parse text with links to get description ready for metadata
 * 2. Parse the link to get website name and use it as metadata title
 * 3. Handle special cases for various apps
 */

import { LinkData } from "../types/link";
import { parseLink, parseBlinkItStyle, parseFlipkartStyle } from "./linkParser";
import { getDefaultImageUrl } from "./platformConfig";
import { detectHostnameTag } from "./hostnameTagDetection";

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

  if (!url) {
    throw new Error("No valid URL found in shared content");
  }

  // Handle platform-specific parsing
  let title = parsed.title;
  let description = parsed.description;

  if (parsed.hostname) {
    const lowerHostname = parsed.hostname.toLowerCase();

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
    folderId: null,
    sharedImages: attachedImages || [],
    createdAt: new Date().toISOString(),
    metadataFetched: false,
  };
}
