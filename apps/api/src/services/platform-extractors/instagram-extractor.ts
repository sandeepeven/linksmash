/**
 * Instagram Extractor
 *
 * This file provides a metadata extractor for Instagram posts and reels.
 * Instagram's oEmbed API requires Facebook Graph API authentication, so this
 * extractor scrapes the page directly to extract Open Graph metadata.
 */

import { BaseExtractor } from "./base-extractor";
import { ParsedMetadata } from "../../utils/og-parser";
import { scrapeMetadata } from "../scraper.service";
import { load, CheerioAPI } from "cheerio";
import { fetch } from "undici";
import { isPlatform } from "../../utils/platform-detector";
import { resolveUrl } from "../../utils/url-validator";

/**
 * Instagram metadata extractor that scrapes Open Graph tags
 * Uses HTML scraping first, then URL extraction, then default scraper
 */
export class InstagramExtractor extends BaseExtractor {
  /**
   * Checks if this extractor can handle the given URL
   *
   * @param url - The URL to check
   * @returns boolean - True if URL is an Instagram URL
   */
  canHandle(url: string): boolean {
    return isPlatform(url, "instagram");
  }

  /**
   * Extracts metadata from Instagram post/reel page
   * Tries HTML scraping first, then URL extraction, then default scraper
   *
   * @param url - The Instagram URL to extract metadata from
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
   * Extracts metadata from Instagram HTML content
   * Instagram includes Open Graph tags in the page
   *
   * @param $ - Cheerio instance
   * @param url - Original URL
   * @returns ParsedMetadata - Extracted metadata
   */
  private extractFromHtml($: CheerioAPI, url: string): ParsedMetadata {
    // Extract Open Graph title and decode HTML entities
    let title =
      $('meta[property="og:title"]').attr("content") ||
      $('meta[name="og:title"]').attr("content") ||
      $('meta[name="twitter:title"]').attr("content") ||
      null;

    // Decode HTML entities
    if (title) {
      title = this.decodeHtmlEntities(title);

      // Clean up Instagram title format
      // Instagram titles are like: "Username on Instagram: \"Caption text\""
      // Pattern: "FarmHouseHub on Instagram: \"Let's Live Once Again...\""
      const instagramMatch = title.match(
        /^(.+?)\s+on Instagram:\s*"?(.+?)"?$/i
      );
      if (instagramMatch && instagramMatch[2]) {
        // Extract just the caption part
        title = instagramMatch[2].trim();
      } else {
        // Try pattern with colon separator
        const colonMatch = title.match(/^.+?:\s*"?(.+?)"?$/);
        if (colonMatch && colonMatch[1]) {
          title = colonMatch[1].trim();
        } else {
          // Try simpler pattern - remove "on Instagram:"
          title = title.replace(/\s+on Instagram:\s*"?/i, "").trim();
        }
      }

      // Remove leading/trailing quotes if present
      title = title.replace(/^["'](.+?)["']$/, "$1").trim();

      // If title is just "Instagram" or empty after cleaning, discard it
      if (title.toLowerCase() === "instagram" || title.length === 0) {
        title = null;
      }
    } else {
      const captionEl = $("h1, h2, span")
        .filter((i, el) => $(el).text().length > 30)
        .first();
      title = captionEl.text().trim() || $("title").text().trim();
    }

    // Extract Open Graph description and decode HTML entities
    let description =
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="og:description"]').attr("content") ||
      $('meta[name="twitter:description"]').attr("content") ||
      null;

    // Clean up Instagram description format
    // Instagram descriptions are like: "2,740 likes, 138 comments - username on Date: \"Caption\""
    if (description) {
      description = this.decodeHtmlEntities(description);

      // Try to extract the caption part (after the colon and quote)
      // Pattern: "X likes, Y comments - username on Date: \"Caption\""
      const captionMatch = description.match(/:\s*"([^"]+)"?$/);
      if (captionMatch && captionMatch[1]) {
        description = captionMatch[1].trim();
      } else {
        // Try alternative pattern without date
        const altMatch = description.match(/:\s*"?(.+?)"?$/);
        if (altMatch && altMatch[1]) {
          description = altMatch[1].trim();
        } else {
          // If no caption found, clean up the full description
          description = description
            .replace(
              /^(\d+[,\s]*likes?[,\s]*\d+[,\s]*comments?[,\s]*-[,\s]*[^:]+:\s*)?/i,
              ""
            )
            .replace(/^["']/, "")
            .replace(/["']$/, "")
            .trim();
        }
      }
    } else {
      const blocks = $("span, div")
        .map((i, el) => $(el).text().trim())
        .get()
        .filter((txt) => txt.length > 50)
        .sort((a, b) => b.length - a.length);

      description = blocks[0] || null;
    }

    // Extract Open Graph image
    let image: string | null = null;
    const ogImage =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content") ||
      null;
    if (ogImage) {
      // Decode HTML entities in image URL
      const decodedImageUrl = this.decodeHtmlEntities(ogImage);
      image = resolveUrl(decodedImageUrl, url);
    }

    return {
      title: title,
      description: description || null,
      image: image,
      url: url,
    };
  }

  /**
   * Decodes HTML entities in a string
   * Handles both named entities and numeric entities
   *
   * @param text - Text with HTML entities
   * @returns string - Decoded text
   */
  private decodeHtmlEntities(text: string): string {
    if (!text) return text;

    // Decode numeric entities first (hex and decimal)
    text = text.replace(/&#x([0-9A-Fa-f]+);/g, (match, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });

    text = text.replace(/&#(\d+);/g, (match, dec) => {
      return String.fromCharCode(parseInt(dec, 10));
    });

    // Decode named entities
    const entityMap: Record<string, string> = {
      "&amp;": "&",
      "&lt;": "<",
      "&gt;": ">",
      "&quot;": '"',
      "&apos;": "'",
      "&nbsp;": " ",
    };

    for (const [entity, char] of Object.entries(entityMap)) {
      text = text.replace(new RegExp(entity, "g"), char);
    }

    return text;
  }

  /**
   * Fetches HTML content from Instagram URL
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

  /**
   * Extracts metadata from Instagram URL structure
   * Instagram URLs are like: /p/{postid}/ or /reel/{reelid}/
   *
   * @param url - The Instagram URL
   * @returns ParsedMetadata - Extracted metadata
   */
  private extractFromUrl(url: string): ParsedMetadata {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split("/").filter((p) => p);

      // Instagram URLs can be /p/{id}/, /reel/{id}/, /tv/{id}/
      if (pathParts.length >= 2) {
        const type = pathParts[0]; // 'p', 'reel', 'tv'
        const id = pathParts[1];

        let title: string | null = null;
        if (type === "p") {
          title = "Instagram Post";
        } else if (type === "reel") {
          title = "Instagram Reel";
        } else if (type === "tv") {
          title = "Instagram TV";
        } else {
          title = "Instagram Content";
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
}
