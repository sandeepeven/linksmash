/**
 * Metadata Service
 *
 * This file orchestrates the scraper and cache services to provide
 * a unified interface for fetching link metadata.
 * Handles cache lookups, platform-specific extraction, and response formatting.
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
import { getExtractorForUrl } from "./platform-extractors";

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
 * Fetches metadata for a URL, checking cache first and using platform-specific extractor if needed
 *
 * @param url - The URL to fetch metadata for
 * @returns Promise<MetadataResponse> - The metadata response
 * @throws Error if URL is invalid or extraction fails
 */
export async function fetchMetadata(url: string): Promise<MetadataResponse> {
  const normalizedUrl = normalizeUrl(url);

  // Try to get from cache first
  // if (isCacheAvailable()) {
  //   const cached = await getCachedMetadata(normalizedUrl);
  //   if (cached) {
  //     console.log(`Cache hit for URL: ${normalizedUrl}`);
  //     return formatMetadataResponse(normalizedUrl, cached);
  //   }
  // }

  // Cache miss - use platform-specific extractor
  console.log(`Extracting metadata for URL: ${normalizedUrl}`);
  let parsedMetadata: ParsedMetadata;

  try {
    // Get the appropriate platform extractor
    const extractor = getExtractorForUrl(normalizedUrl);
    const extractorName = extractor.constructor.name;
    console.log(`Using extractor: ${extractorName} for URL: ${normalizedUrl}`);

    // Extract metadata using platform-specific extractor
    parsedMetadata = await extractor.extract(normalizedUrl);
    console.log(
      `Extractor result - Title: ${
        parsedMetadata.title
      }, Has image: ${!!parsedMetadata.image}`
    );

    // If platform extractor didn't get meaningful data, try default scraper as fallback
    if (
      !parsedMetadata.title &&
      !parsedMetadata.description &&
      !parsedMetadata.image
    ) {
      console.log(
        `Platform extractor returned empty metadata, trying default scraper`
      );
      parsedMetadata = await scrapeMetadata(normalizedUrl);
    }
  } catch (error) {
    // If platform extractor fails, fallback to default scraper
    console.warn(
      `Platform extractor failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }, falling back to default scraper`
    );
    try {
      parsedMetadata = await scrapeMetadata(normalizedUrl);
    } catch (fallbackError) {
      // If default scraper also fails, re-throw the original error
      throw error;
    }
  }

  // Store in cache
  if (isCacheAvailable()) {
    await setCachedMetadata(normalizedUrl, parsedMetadata);
  }

  // Format and return response
  return formatMetadataResponse(normalizedUrl, parsedMetadata);
}
