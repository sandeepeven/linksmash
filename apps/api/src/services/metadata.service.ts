/**
 * Metadata Service
 *
 * This file orchestrates the scraper and cache services to provide
 * a unified interface for fetching link metadata.
 * Handles cache lookups, scraping, and response formatting.
 */

import { scrapeMetadata } from "./scraper.service";
import {
  getCachedMetadata,
  setCachedMetadata,
  isCacheAvailable,
} from "./cache.service";
import { normalizeUrl } from "../utils/url-validator";
import { MetadataResponse } from "../types/metadata.types";
import { ParsedMetadata } from "../utils/og-parser";

/**
 * Detects a tag based on hostname
 * Simple implementation - can be enhanced later
 *
 * @param url - The URL to detect tag for
 * @param metadata - Optional metadata for tag detection
 * @returns string | null - The detected tag
 */
function detectTag(
  url: string,
  metadata?: { title?: string | null; description?: string | null }
): string | null {
  try {
    const urlObj = new URL(url);
    let hostname = urlObj.hostname.toLowerCase();
    if (hostname.startsWith("www.")) {
      hostname = hostname.substring(4);
    }

    // Simple tag detection based on hostname
    const hostnameParts = hostname.split(".");
    if (hostnameParts.length > 0) {
      return hostnameParts[0];
    }

    return "general";
  } catch {
    return "general";
  }
}

/**
 * Converts ParsedMetadata to MetadataResponse format
 *
 * @param url - The original URL
 * @param parsedMetadata - The parsed metadata from scraper
 * @returns MetadataResponse - Formatted response
 */
function formatMetadataResponse(
  url: string,
  parsedMetadata: ParsedMetadata
): MetadataResponse {
  const hasMetadata =
    Boolean(parsedMetadata.title && parsedMetadata.title.trim() !== "") ||
    Boolean(
      parsedMetadata.description && parsedMetadata.description.trim() !== ""
    ) ||
    Boolean(parsedMetadata.image && parsedMetadata.image.trim() !== "");

  const tag = detectTag(url, {
    title: parsedMetadata.title,
    description: parsedMetadata.description,
  });

  return {
    url: parsedMetadata.url || url,
    title: hasMetadata ? parsedMetadata.title : null,
    description: hasMetadata ? parsedMetadata.description : null,
    image: hasMetadata ? parsedMetadata.image : null,
    tag: hasMetadata ? tag : "untitled",
    metadataFetched: hasMetadata,
  };
}

/**
 * Fetches metadata for a URL, checking cache first and scraping if needed
 *
 * @param url - The URL to fetch metadata for
 * @returns Promise<MetadataResponse> - The metadata response
 * @throws Error if URL is invalid or scraping fails
 */
export async function fetchMetadata(url: string): Promise<MetadataResponse> {
  const normalizedUrl = normalizeUrl(url);

  // Try to get from cache first
  if (isCacheAvailable()) {
    const cached = await getCachedMetadata(normalizedUrl);
    if (cached) {
      console.log(`Cache hit for URL: ${normalizedUrl}`);
      return formatMetadataResponse(normalizedUrl, cached);
    }
  }

  // Cache miss - scrape the URL
  console.log(`Scraping URL: ${normalizedUrl}`);
  const parsedMetadata = await scrapeMetadata(normalizedUrl);

  // Store in cache
  if (isCacheAvailable()) {
    await setCachedMetadata(normalizedUrl, parsedMetadata);
  }

  // Format and return response
  return formatMetadataResponse(normalizedUrl, parsedMetadata);
}
