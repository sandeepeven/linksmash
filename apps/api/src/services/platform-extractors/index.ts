/**
 * Platform Extractor Registry
 *
 * This file provides the main registry and factory for all platform-specific metadata extractors.
 * Routes URLs to appropriate extractors based on platform detection.
 */

import { IPlatformExtractor } from "./base-extractor";
import { DefaultExtractor } from "./default-extractor";
import { BlockedExtractor } from "./blocked-extractor";
import { RedditExtractor } from "./reddit-extractor";
import { OEmbedExtractorFactory } from "./oembed-extractor";
import { InstagramExtractor } from "./instagram-extractor";
import { FacebookExtractor } from "./facebook-extractor";
import { FlipkartExtractor } from "./flipkart-extractor";
import { BlinkItExtractor } from "./blinkit-extractor";
import { ZeptoExtractor } from "./zepto-extractor";
import { SwiggyExtractor } from "./swiggy-extractor";
import { detectPlatform } from "../../utils/platform-detector";

/**
 * Platform extractor registry
 * Maps platform names to their extractor instances
 */
class PlatformExtractorRegistry {
  private extractors: Map<string, IPlatformExtractor> = new Map();
  private defaultExtractor: IPlatformExtractor;

  constructor() {
    // Initialize default extractor (fallback)
    this.defaultExtractor = new DefaultExtractor();

    // Initialize oEmbed extractors
    this.register("youtube", OEmbedExtractorFactory.createYouTube());
    this.register("spotify", OEmbedExtractorFactory.createSpotify());
    this.register("twitter", OEmbedExtractorFactory.createTwitter());

    // Initialize Instagram extractor (uses HTML scraping, then URL extraction, then default scraper)
    this.register("instagram", new InstagramExtractor());

    // Initialize Facebook extractor (uses HTML scraping, then URL extraction, then default scraper)
    this.register("facebook", new FacebookExtractor());

    // Initialize custom extractors
    this.register("reddit", new RedditExtractor());
    this.register("flipkart", new FlipkartExtractor());
    this.register("blinkit", new BlinkItExtractor());
    this.register("zepto", new ZeptoExtractor());
    this.register("swiggy", new SwiggyExtractor());
    this.register("instamart", new SwiggyExtractor());

    // Initialize blocked extractors
    this.register("netflix", new BlockedExtractor("netflix"));
  }

  /**
   * Registers an extractor for a platform
   *
   * @param platform - Platform name
   * @param extractor - Extractor instance
   */
  private register(platform: string, extractor: IPlatformExtractor): void {
    this.extractors.set(platform.toLowerCase(), extractor);
  }

  /**
   * Gets the appropriate extractor for a URL
   * Detects platform and returns matching extractor or default
   *
   * @param url - The URL to get extractor for
   * @returns IPlatformExtractor - Appropriate extractor instance
   */
  getExtractor(url: string): IPlatformExtractor {
    const platform = detectPlatform(url);
    if (!platform) {
      return this.defaultExtractor;
    }

    const extractor = this.extractors.get(platform.toLowerCase());
    if (extractor && extractor.canHandle(url)) {
      return extractor;
    }

    // Fallback to default extractor
    return this.defaultExtractor;
  }

  /**
   * Gets extractor by platform name
   *
   * @param platform - Platform name
   * @returns IPlatformExtractor | null - Extractor instance or null
   */
  getExtractorByPlatform(platform: string): IPlatformExtractor | null {
    const extractor = this.extractors.get(platform.toLowerCase());
    return extractor || null;
  }
}

// Singleton instance
const registry = new PlatformExtractorRegistry();

/**
 * Gets the appropriate extractor for a URL
 * This is the main factory function used by the metadata service
 *
 * @param url - The URL to get extractor for
 * @returns IPlatformExtractor - Appropriate extractor instance
 */
export function getExtractorForUrl(url: string): IPlatformExtractor {
  return registry.getExtractor(url);
}

/**
 * Gets extractor by platform name
 *
 * @param platform - Platform name
 * @returns IPlatformExtractor | null - Extractor instance or null
 */
export function getExtractorByPlatform(
  platform: string
): IPlatformExtractor | null {
  return registry.getExtractorByPlatform(platform);
}

// Export all extractor types for testing or advanced usage
export { IPlatformExtractor, BaseExtractor } from "./base-extractor";
export { DefaultExtractor } from "./default-extractor";
export { BlockedExtractor } from "./blocked-extractor";
export { RedditExtractor } from "./reddit-extractor";
export { OEmbedExtractor, OEmbedExtractorFactory } from "./oembed-extractor";
export { InstagramExtractor } from "./instagram-extractor";
export { FacebookExtractor } from "./facebook-extractor";
export { FlipkartExtractor } from "./flipkart-extractor";
export { BlinkItExtractor } from "./blinkit-extractor";
export { ZeptoExtractor } from "./zepto-extractor";
export { SwiggyExtractor } from "./swiggy-extractor";
