/**
 * BlinkIt Extractor
 *
 * This file provides a metadata extractor for BlinkIt product pages.
 * Parses URL structure: /prn/{product-name}/prid/{product-id}
 */

import { BaseExtractor } from "./base-extractor";
import { ParsedMetadata } from "../../utils/og-parser";
import { scrapeMetadata } from "../scraper.service";
import { load, CheerioAPI } from "cheerio";
import { fetch } from "undici";
import { isPlatform } from "../../utils/platform-detector";
import { resolveUrl } from "../../utils/url-validator";

/**
 * BlinkIt product metadata extractor
 */
export class BlinkItExtractor extends BaseExtractor {
  /**
   * Checks if this extractor can handle the given URL
   *
   * @param url - The URL to check
   * @returns boolean - True if URL is a BlinkIt URL
   */
  canHandle(url: string): boolean {
    return isPlatform(url, "blinkit");
  }

  /**
   * Extracts metadata from BlinkIt product page
   *
   * @param url - The BlinkIt URL to extract metadata from
   * @returns Promise<ParsedMetadata> - Extracted metadata
   */
  async extract(url: string): Promise<ParsedMetadata> {
    try {
      // Extract product name from URL structure: /prn/{product-name}/prid/{id}
      const urlMetadata = this.extractFromUrl(url);
      if (urlMetadata.title) {
        // Try to enhance with HTML scraping
        try {
          const html = await this.fetchHtml(url);
          const $ = load(html);
          const htmlMetadata = this.extractFromHtml($, url);

          // Merge URL and HTML metadata, preferring HTML if available
          return {
            title: htmlMetadata.title || urlMetadata.title,
            description: htmlMetadata.description || urlMetadata.description,
            image: htmlMetadata.image || urlMetadata.image,
            url: url,
          };
        } catch {
          // If HTML fetch fails, return URL metadata
          return urlMetadata;
        }
      }

      // Fallback to scraping
      return await scrapeMetadata(url);
    } catch (error) {
      // If custom extraction fails, fall back to default scraper
      return await scrapeMetadata(url);
    }
  }

  /**
   * Extracts metadata from BlinkIt URL structure
   *
   * @param url - The BlinkIt URL
   * @returns ParsedMetadata - Extracted metadata
   */
  private extractFromUrl(url: string): ParsedMetadata {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split("/").filter((p) => p);

      // Look for /prn/{product-name} pattern
      const prnIndex = pathParts.indexOf("prn");
      if (prnIndex !== -1 && pathParts[prnIndex + 1]) {
        const productName = pathParts[prnIndex + 1]
          .replace(/-/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase());

        return {
          title: productName,
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
   * @returns ParsedMetadata - Extracted metadata
   */
  private extractFromHtml($: CheerioAPI, url: string): ParsedMetadata {
    const title =
      $('meta[property="og:title"]').attr("content") ||
      $('h1[class*="product"], h1[class*="Product"]')
        .first()
        .text()
        .trim() ||
      $("h1").first().text().trim() ||
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
      const productImage = $('img[class*="product"], img[alt*="product"]')
        .first()
        .attr("src");
      if (productImage) {
        image = resolveUrl(productImage, url);
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
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.text();
  }
}

