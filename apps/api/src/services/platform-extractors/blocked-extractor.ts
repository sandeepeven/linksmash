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
import { scrapeMetadata } from "../scraper.service";
import { load, CheerioAPI } from "cheerio";
import { fetch } from "undici";
import { resolveUrl } from "../../utils/url-validator";

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
   * Extracts metadata for blocked platforms
   * Tries HTML scraping first, then falls back to minimal metadata
   *
   * @param url - The URL to extract metadata from
   * @returns Promise<ParsedMetadata> - Extracted or minimal metadata
   */
  async extract(url: string): Promise<ParsedMetadata> {
    try {
      // Try HTML scraping first
      try {
        const html = await this.fetchHtml(url);
        const $ = load(html);

        // Extract Open Graph metadata from HTML
        const metadata = this.extractFromHtml($, url);

        // If we got meaningful data, return it
        if (this.isValidMetadata(metadata)) {
          return metadata;
        }
      } catch {
        // HTML fetching/parsing failed, continue to URL extraction fallback
      }

      // Fallback to extracting from URL structure
      const urlMetadata = this.extractFromUrl(url);
      if (urlMetadata.title) {
        return urlMetadata;
      }

      // Final fallback to default scraper
      return await scrapeMetadata(url);
    } catch (error) {
      // If all extraction methods fail, return minimal metadata
      return this.getMinimalMetadata(url);
    }
  }

  /**
   * Extracts metadata from HTML content
   *
   * @param $ - Cheerio instance
   * @param url - Original URL
   * @returns ParsedMetadata - Extracted metadata
   */
  private extractFromHtml($: CheerioAPI, url: string): ParsedMetadata {
    const title =
      $('meta[property="og:title"]').attr("content") ||
      $("title").first().text().trim() ||
      null;

    const description =
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="description"]').attr("content") ||
      null;

    let image: string | null = null;
    const ogImage = $('meta[property="og:image"]').attr("content");
    if (ogImage) {
      image = resolveUrl(ogImage, url);
    }

    return {
      title: title,
      description: description,
      image: image,
      url: url,
    };
  }

  /**
   * Extracts metadata from URL structure
   *
   * @param url - The URL
   * @returns ParsedMetadata - Extracted metadata
   */
  private extractFromUrl(url: string): ParsedMetadata {
    const platformName =
      this.platform.charAt(0).toUpperCase() + this.platform.slice(1);

    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split("/").filter((p) => p);

      // Try to extract meaningful info from URL path
      if (pathParts.length > 0) {
        const lastPart = pathParts[pathParts.length - 1];
        const title = lastPart
          .replace(/-/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase());

        return {
          title: title || `${platformName} Content`,
          description: `Content from ${platformName}`,
          image: PLATFORM_IMAGES[this.platform] || null,
          url: url,
        };
      }
    } catch {
      // Ignore URL parsing errors
    }

    return this.getMinimalMetadata(url);
  }

  /**
   * Returns minimal metadata for blocked platforms
   *
   * @param url - The URL
   * @returns ParsedMetadata - Minimal metadata
   */
  private getMinimalMetadata(url: string): ParsedMetadata {
    const platformName =
      this.platform.charAt(0).toUpperCase() + this.platform.slice(1);

    return {
      title: `${platformName} Content`,
      description: `Content from ${platformName}`,
      image: PLATFORM_IMAGES[this.platform] || null,
      url: url,
    };
  }

  /**
   * Fetches HTML content from URL
   *
   * @param url - The URL to fetch
   * @returns Promise<string> - HTML content
   */
  private async fetchHtml(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Dest": "document",
        "Upgrade-Insecure-Requests": "1",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.text();
  }
}

