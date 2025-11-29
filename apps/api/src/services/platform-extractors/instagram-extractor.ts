/**
 * Instagram Extractor
 *
 * This file provides a metadata extractor for Instagram posts and reels.
 * Uses insta-fetcher package for better metadata extraction with fallback to manual scraping.
 */

import { BaseExtractor } from "./base-extractor";
import { ParsedMetadata } from "../../utils/og-parser";
import { scrapeMetadata } from "../scraper.service";
import { load, CheerioAPI } from "cheerio";
import { fetch } from "undici";
import { isPlatform } from "../../utils/platform-detector";
import { resolveUrl } from "../../utils/url-validator";

// Try to import insta-fetcher, but handle gracefully if not available
let igApi: any = null;
let instaFetcherAvailable = false;

try {
  const instaFetcher = require("insta-fetcher");
  igApi = instaFetcher.igApi;
  instaFetcherAvailable = true;
  console.log("insta-fetcher package is available");
} catch (error) {
  console.warn(
    "insta-fetcher package not available, using fallback scraping method"
  );
}

/**
 * Instagram metadata extractor using insta-fetcher package
 */
export class InstagramExtractor extends BaseExtractor {
  private ig: any = null;

  constructor() {
    super();
    // Initialize insta-fetcher if available and cookie is provided
    if (instaFetcherAvailable && igApi) {
      const instagramCookie = process.env.INSTAGRAM_SESSION_COOKIE;
      if (instagramCookie) {
        try {
          this.ig = new igApi(instagramCookie);
          console.log("Instagram extractor initialized with insta-fetcher");
        } catch (error) {
          console.warn(
            `Failed to initialize insta-fetcher: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
        }
      } else {
        console.warn(
          "INSTAGRAM_SESSION_COOKIE not set, insta-fetcher will use default behavior"
        );
      }
    }
  }

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
   * Tries insta-fetcher first, falls back to manual scraping if needed
   *
   * @param url - The Instagram URL to extract metadata from
   * @returns Promise<ParsedMetadata> - Extracted metadata
   */
  async extract(url: string): Promise<ParsedMetadata> {
    // Try insta-fetcher first if available
    if (instaFetcherAvailable && igApi) {
      try {
        const metadata = await this.extractWithInstaFetcher(url);
        if (this.isValidMetadata(metadata)) {
          console.log(
            `Instagram extractor (insta-fetcher) - Title: ${
              metadata.title
            }, Image: ${metadata.image ? "present" : "missing"}`
          );
          return metadata;
        }
      } catch (error) {
        console.warn(
          `insta-fetcher extraction failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }, trying fallback method`
        );
      }
    }

    // Fallback to manual scraping method
    try {
      const metadata = await this.extractWithManualScraping(url);
      if (this.isValidMetadata(metadata)) {
        console.log(
          `Instagram extractor (manual) - Title: ${metadata.title}, Image: ${
            metadata.image ? "present" : "missing"
          }`
        );
        return metadata;
      }
    } catch (error) {
      console.warn(
        `Manual Instagram extraction failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }

    // Final fallback to default scraper
    console.warn(
      "All Instagram extraction methods failed, falling back to default scraper"
    );
    return await scrapeMetadata(url);
  }

  /**
   * Extracts metadata using insta-fetcher package
   *
   * @param url - The Instagram URL
   * @returns Promise<ParsedMetadata> - Extracted metadata
   */
  private async extractWithInstaFetcher(url: string): Promise<ParsedMetadata> {
    // Initialize igApi instance if not already initialized
    let igInstance = this.ig;
    if (!igInstance && igApi) {
      // Try with cookie from env first, or without cookie for public posts
      const cookie = process.env.INSTAGRAM_SESSION_COOKIE;
      try {
        if (cookie) {
          igInstance = new igApi(cookie);
        } else {
          // Try without cookie (may work for public posts)
          igInstance = new igApi();
        }
      } catch (error) {
        throw new Error(
          `Failed to initialize insta-fetcher: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }

    if (!igInstance) {
      throw new Error("insta-fetcher not properly initialized");
    }

    // Fetch post data using insta-fetcher
    const postData: any = await igInstance.fetchPost(url);

    // Extract metadata from post data
    // insta-fetcher returns IPostModels which may have different structures
    const caption =
      postData?.caption || postData?.text || postData?.description || null;
    const images = postData?.images || postData?.image_urls || [];
    const imageUrl =
      images?.[0] ||
      postData?.image ||
      postData?.thumbnail ||
      postData?.display_url ||
      null;

    const metadata: ParsedMetadata = {
      title: caption,
      description: caption,
      image: imageUrl,
      url: url,
    };

    return metadata;
  }

  /**
   * Extracts metadata using manual scraping (fallback method)
   *
   * @param url - The Instagram URL
   * @returns Promise<ParsedMetadata> - Extracted metadata
   */
  private async extractWithManualScraping(
    url: string
  ): Promise<ParsedMetadata> {
    // Fetch the Instagram page
    const html = await this.fetchHtml(url);
    const $ = load(html);

    // Extract Open Graph metadata
    return this.extractFromHtml($, url);
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
      null;

    // Log raw title for debugging
    if (title) {
      console.log(`Instagram raw title: ${title.substring(0, 100)}`);
    }

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

      console.log(
        `Instagram cleaned title: ${title ? title.substring(0, 100) : "null"}`
      );
    }

    // Extract Open Graph description and decode HTML entities
    let description =
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="og:description"]').attr("content") ||
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
    }

    // Extract Open Graph image
    let image: string | null = null;
    const ogImage = $('meta[property="og:image"]').attr("content");
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
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
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
