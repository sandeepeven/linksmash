/**
 * Base Extractor
 *
 * This file defines the base interface/abstract class for all platform-specific metadata extractors.
 * Provides common utilities and error handling patterns for all extractors.
 */

import { ParsedMetadata } from "../../utils/og-parser";

/**
 * Base interface that all platform extractors must implement
 * Defines the contract for extracting metadata from platform-specific URLs
 */
export interface IPlatformExtractor {
  /**
   * Checks if this extractor can handle the given URL
   *
   * @param url - The URL to check
   * @returns boolean - True if this extractor can handle the URL
   */
  canHandle(url: string): boolean;

  /**
   * Extracts metadata from the given URL
   *
   * @param url - The URL to extract metadata from
   * @returns Promise<ParsedMetadata> - Extracted metadata
   * @throws Error if extraction fails
   */
  extract(url: string): Promise<ParsedMetadata>;
}

/**
 * Base abstract class for platform extractors
 * Provides common utilities and error handling
 */
export abstract class BaseExtractor implements IPlatformExtractor {
  /**
   * Checks if this extractor can handle the given URL
   * Must be implemented by each platform extractor
   *
   * @param url - The URL to check
   * @returns boolean - True if this extractor can handle the URL
   */
  abstract canHandle(url: string): boolean;

  /**
   * Extracts metadata from the given URL
   * Must be implemented by each platform extractor
   *
   * @param url - The URL to extract metadata from
   * @returns Promise<ParsedMetadata> - Extracted metadata
   * @throws Error if extraction fails
   */
  abstract extract(url: string): Promise<ParsedMetadata>;

  /**
   * Normalizes a URL by removing common tracking parameters and fragments
   *
   * @param url - The URL to normalize
   * @returns string - Normalized URL
   */
  protected normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      // Remove common tracking parameters
      const trackingParams = [
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content",
        "fbclid",
        "gclid",
        "ref",
        "source",
      ];
      trackingParams.forEach((param) => urlObj.searchParams.delete(param));
      return urlObj.href;
    } catch {
      return url;
    }
  }

  /**
   * Validates that required fields are present in metadata
   *
   * @param metadata - The metadata to validate
   * @returns boolean - True if metadata has at least one field populated
   */
  protected isValidMetadata(metadata: ParsedMetadata): boolean {
    return !!(
      (metadata.title && metadata.title.trim()) ||
      (metadata.description && metadata.description.trim()) ||
      (metadata.image && metadata.image.trim())
    );
  }

  /**
   * Creates a default metadata object with just the URL
   *
   * @param url - The URL
   * @returns ParsedMetadata - Default metadata object
   */
  protected createDefaultMetadata(url: string): ParsedMetadata {
    return {
      title: null,
      description: null,
      image: null,
      url: url,
    };
  }
}

