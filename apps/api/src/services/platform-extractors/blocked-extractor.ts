/**
 * Blocked Extractor
 *
 * This file provides a metadata extractor for platforms that block scraping
 * or don't provide accessible metadata (e.g., Netflix).
 * Returns minimal metadata with default platform images.
 */

import { BaseExtractor } from "./base-extractor";
import { ParsedMetadata } from "../../utils/og-parser";
import { extractHostname } from "../../utils/platform-detector";
import { isPlatform } from "../../utils/platform-detector";

/**
 * Platform default images mapping
 */
const PLATFORM_IMAGES: Record<string, string> = {
  netflix:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Netflix_icon.svg/1024px-Netflix_icon.svg.png",
};

/**
 * Extractor for blocked platforms that return minimal metadata
 */
export class BlockedExtractor extends BaseExtractor {
  private platform: string;

  /**
   * Creates a new blocked extractor for a specific platform
   *
   * @param platform - Platform name
   */
  constructor(platform: string) {
    super();
    this.platform = platform;
  }

  /**
   * Checks if this extractor can handle the given URL
   *
   * @param url - The URL to check
   * @returns boolean - True if URL matches platform
   */
  canHandle(url: string): boolean {
    return isPlatform(url, this.platform);
  }

  /**
   * Extracts minimal metadata for blocked platforms
   *
   * @param url - The URL to extract metadata from
   * @returns Promise<ParsedMetadata> - Minimal metadata with default image
   */
  async extract(url: string): Promise<ParsedMetadata> {
    // Extract basic info from URL if possible
    const hostname = extractHostname(url) || "";
    const platformName =
      this.platform.charAt(0).toUpperCase() + this.platform.slice(1);

    return {
      title: `${platformName} Content`,
      description: `Content from ${platformName}`,
      image: PLATFORM_IMAGES[this.platform] || null,
      url: url,
    };
  }
}

