/**
 * Facebook Extractor
 *
 * This file provides a metadata extractor for Facebook posts and pages.
 * Uses Facebook Graph API oEmbed first, then falls back to HTML scraping,
 * then URL extraction.
 */

import { BaseExtractor } from "./base-extractor";
import { ParsedMetadata } from "../../utils/og-parser";
import { scrapeMetadata } from "../scraper.service";
import { load, CheerioAPI } from "cheerio";
import { fetch } from "undici";
import { isPlatform } from "../../utils/platform-detector";
import { resolveUrl } from "../../utils/url-validator";

/**
 * Facebook metadata extractor that scrapes Open Graph tags
 * Uses HTML scraping first, then URL extraction, then default scraper
 */
export class FacebookExtractor extends BaseExtractor {

  /**
   * Checks if this extractor can handle the given URL
   *
   * @param url - The URL to check
   * @returns boolean - True if URL is a Facebook URL
   */
  canHandle(url: string): boolean {
    return isPlatform(url, "facebook");
  }

  /**
   * Extracts metadata from Facebook post/page
   * Tries HTML scraping first, then URL extraction, then default scraper
   *
   * @param url - The Facebook URL to extract metadata from
   * @returns Promise<ParsedMetadata> - Extracted metadata
   */
  async extract(url: string): Promise<ParsedMetadata> {
    try {
      // Try HTML scraping first
      try {
        const html = await this.fetchHtml(url);
        const $ = load(html);

        // Extract Open Graph metadata
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
      // If all extraction methods fail, fall back to default scraper
      return await scrapeMetadata(url);
    }
  }

  /**
   * Extracts metadata from Facebook HTML content
   * Facebook includes Open Graph tags in the page
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
   * Extracts metadata from Facebook URL structure
   * Facebook URLs are like: /username/posts/{id}/ or /pages/{id}/
   *
   * @param url - The Facebook URL
   * @returns ParsedMetadata - Extracted metadata
   */
  private extractFromUrl(url: string): ParsedMetadata {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split("/").filter((p) => p);

      // Facebook URLs can be /username/posts/{id}/, /pages/{id}/, /groups/{id}/
      if (pathParts.length > 0) {
        const firstPart = pathParts[0];
        let title: string | null = null;

        if (firstPart === "pages" && pathParts.length > 1) {
          title = "Facebook Page";
        } else if (firstPart === "groups" && pathParts.length > 1) {
          title = "Facebook Group";
        } else if (firstPart === "events" && pathParts.length > 1) {
          title = "Facebook Event";
        } else if (pathParts.length >= 2 && pathParts[1] === "posts") {
          title = "Facebook Post";
        } else if (pathParts.length > 0) {
          // Try to extract username or page name
          const name = pathParts[0].replace(/-/g, " ");
          title = name.charAt(0).toUpperCase() + name.slice(1);
        } else {
          title = "Facebook Content";
        }

        return {
          title: title,
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
   * Fetches HTML content from Facebook URL
   * Uses appropriate headers to mimic a browser request
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

