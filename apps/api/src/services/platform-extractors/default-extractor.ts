/**
 * Default Extractor
 *
 * This file provides the default metadata extractor that uses the intelligent
 * HTML parser for platforms that support Open Graph tags or standard HTML metadata.
 * This is used as a fallback for Amazon, LinkedIn, and general websites.
 */

import { BaseExtractor } from "./base-extractor";
import { ParsedMetadata } from "../../utils/og-parser";
import { scrapeMetadata } from "../scraper.service";

/**
 * Default extractor that uses intelligent HTML parsing
 * Wraps the existing parseOpenGraphTags functionality
 */
export class DefaultExtractor extends BaseExtractor {
  /**
   * Default extractor can handle any URL
   * It's used as a fallback for platforms without specific extractors
   *
   * @param url - The URL to check
   * @returns boolean - Always returns true
   */
  canHandle(url: string): boolean {
    return true; // Default extractor handles all URLs
  }

  /**
   * Extracts metadata using the intelligent HTML parser
   *
   * @param url - The URL to extract metadata from
   * @returns Promise<ParsedMetadata> - Extracted metadata
   */
  async extract(url: string): Promise<ParsedMetadata> {
    // Use the existing scraper service which internally uses parseOpenGraphTags
    return await scrapeMetadata(url);
  }
}

