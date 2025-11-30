/**
 * Swiggy Extractor
 *
 * This file provides a metadata extractor for Swiggy restaurant pages
 * and Instamart item pages.
 * Handles both restaurant URLs and Instamart item URLs.
 */

import { BaseExtractor } from "./base-extractor";
import { ParsedMetadata } from "../../utils/og-parser";
import { scrapeMetadata } from "../scraper.service";
import { load, CheerioAPI } from "cheerio";
import { fetch } from "undici";
import { isPlatform } from "../../utils/platform-detector";
import { resolveUrl } from "../../utils/url-validator";

/**
 * Swiggy/Instamart metadata extractor
 */
export class SwiggyExtractor extends BaseExtractor {
  /**
   * Checks if this extractor can handle the given URL
   *
   * @param url - The URL to check
   * @returns boolean - True if URL is a Swiggy or Instamart URL
   */
  canHandle(url: string): boolean {
    return isPlatform(url, "swiggy") || isPlatform(url, "instamart");
  }

  /**
   * Extracts metadata from Swiggy/Instamart page
   *
   * @param url - The Swiggy/Instamart URL to extract metadata from
   * @returns Promise<ParsedMetadata> - Extracted metadata
   */
  async extract(url: string): Promise<ParsedMetadata> {
    try {
      const isInstamart = url.includes("/instamart/");

      if (isInstamart) {
        // Handle Instamart item URLs: try HTML scraping first
        try {
          const html = await this.fetchHtml(url);
          const $ = load(html);
          const htmlMetadata = this.extractFromHtml($, url, true);

          // If we got meaningful data from HTML, try to enhance with URL metadata
          if (this.isValidMetadata(htmlMetadata)) {
            const urlMetadata = this.extractInstamartFromUrl(url);
            return {
              title: htmlMetadata.title || urlMetadata.title,
              description: htmlMetadata.description || urlMetadata.description,
              image: htmlMetadata.image || urlMetadata.image,
              url: url,
            };
          }
        } catch {
          // HTML fetching/parsing failed, continue to URL extraction fallback
        }

        // Fallback to extracting from URL structure: /instamart/item/{id}
        const urlMetadata = this.extractInstamartFromUrl(url);
        if (urlMetadata.title) {
          return urlMetadata;
        }
      } else {
        // For Swiggy restaurant pages, try scraping
        try {
          const html = await this.fetchHtml(url);
          const $ = load(html);
          const htmlMetadata = this.extractFromHtml($, url, false);

          if (this.isValidMetadata(htmlMetadata)) {
            return htmlMetadata;
          }
        } catch {
          // Continue to fallback
        }
      }

      // Fallback to default scraper
      return await scrapeMetadata(url);
    } catch (error) {
      // If custom extraction fails, fall back to default scraper
      return await scrapeMetadata(url);
    }
  }

  /**
   * Extracts Instamart metadata from URL structure
   *
   * @param url - The Instamart URL
   * @returns ParsedMetadata - Extracted metadata
   */
  private extractInstamartFromUrl(url: string): ParsedMetadata {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split("/").filter((p) => p);

      // Look for /instamart/item/{id} pattern
      const itemIndex = pathParts.indexOf("item");
      if (itemIndex !== -1) {
        // Try to extract meaningful info from URL
        return {
          title: "Instamart Item",
          description: null,
          image: null,
          url: url,
        };
      }
    } catch {
      // Ignore URL parsing errors
    }

    return this.createDefaultMetadata(url);
  }

  /**
   * Extracts metadata from HTML content
   *
   * @param $ - Cheerio instance
   * @param url - Original URL
   * @param isInstamart - Whether this is an Instamart URL
   * @returns ParsedMetadata - Extracted metadata
   */
  private extractFromHtml(
    $: CheerioAPI,
    url: string,
    isInstamart: boolean
  ): ParsedMetadata {
    const title =
      $('meta[property="og:title"]').attr("content") ||
      $("h1").first().text().trim() ||
      (isInstamart ? "Instamart Item" : "Swiggy Restaurant") ||
      null;

    const description =
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="description"]').attr("content") ||
      null;

    let image: string | null = null;
    const ogImage = $('meta[property="og:image"]').attr("content");
    if (ogImage) {
      image = resolveUrl(ogImage, url);
    } else {
      // Try to find restaurant/item image
      const itemImage = $('img[class*="image"], img[alt*="restaurant"]')
        .first()
        .attr("src");
      if (itemImage) {
        image = resolveUrl(itemImage, url);
      }
    }

    return {
      title: title,
      description: description,
      image: image,
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
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.text();
  }
}
