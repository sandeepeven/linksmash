/**
 * Flipkart Extractor
 *
 * This file provides a metadata extractor for Flipkart product pages.
 * Parses URL parameters and scrapes product-specific metadata.
 */

import { BaseExtractor } from "./base-extractor";
import { ParsedMetadata } from "../../utils/og-parser";
import { scrapeMetadata } from "../scraper.service";
import { load, CheerioAPI } from "cheerio";
import { fetch } from "undici";
import { isPlatform } from "../../utils/platform-detector";
import { resolveUrl } from "../../utils/url-validator";

/**
 * Flipkart product metadata extractor
 */
export class FlipkartExtractor extends BaseExtractor {
  /**
   * Checks if this extractor can handle the given URL
   *
   * @param url - The URL to check
   * @returns boolean - True if URL is a Flipkart URL
   */
  canHandle(url: string): boolean {
    return isPlatform(url, "flipkart");
  }

  /**
   * Extracts metadata from Flipkart product page
   *
   * @param url - The Flipkart URL to extract metadata from
   * @returns Promise<ParsedMetadata> - Extracted metadata
   */
  async extract(url: string): Promise<ParsedMetadata> {
    try {
      // Try to extract from URL parameters first
      const urlMetadata = this.extractFromUrl(url);
      if (urlMetadata.title) {
        return urlMetadata;
      }

      // Fallback to scraping the page
      const html = await this.fetchHtml(url);
      const $ = load(html);

      // Try to extract product information from common Flipkart selectors
      const metadata = this.extractFromHtml($, url);

      // If we got meaningful data, return it
      if (this.isValidMetadata(metadata)) {
        return metadata;
      }

      // Final fallback: use default scraper
      return await scrapeMetadata(url);
    } catch (error) {
      // If custom extraction fails, fall back to default scraper
      return await scrapeMetadata(url);
    }
  }

  /**
   * Extracts metadata from Flipkart URL parameters
   *
   * @param url - The Flipkart URL
   * @returns ParsedMetadata - Extracted metadata
   */
  private extractFromUrl(url: string): ParsedMetadata {
    try {
      const urlObj = new URL(url);
      const textParam = urlObj.searchParams.get("text");

      if (textParam) {
        // Decode the text parameter which often contains product name
        const decodedText = decodeURIComponent(textParam);
        return {
          title: decodedText || null,
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
    // Try common Flipkart meta tags and selectors
    const title =
      $('meta[property="og:title"]').attr("content") ||
      $('h1[class*="product"]').first().text().trim() ||
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
      // Try to find product image
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

