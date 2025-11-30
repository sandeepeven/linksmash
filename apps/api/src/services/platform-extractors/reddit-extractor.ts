/**
 * Reddit Extractor
 *
 * This file provides a metadata extractor for Reddit posts and comments.
 * Uses Reddit's JSON API endpoint by appending .json to URLs.
 */

import { fetch } from "undici";
import { BaseExtractor } from "./base-extractor";
import { ParsedMetadata } from "../../utils/og-parser";
import { resolveUrl } from "../../utils/url-validator";
import { isPlatform } from "../../utils/platform-detector";
import { scrapeMetadata } from "../scraper.service";
import { load, CheerioAPI } from "cheerio";

/**
 * Reddit JSON API response structure
 */
interface RedditListing {
  kind: string;
  data: {
    children: Array<{
      kind: string;
      data: RedditPost;
    }>;
  };
}

interface RedditPost {
  title?: string;
  selftext?: string;
  url?: string;
  thumbnail?: string;
  preview?: {
    images?: Array<{
      source?: {
        url?: string;
      };
    }>;
  };
  author?: string;
  subreddit?: string;
  score?: number;
  num_comments?: number;
}

/**
 * Reddit metadata extractor using Reddit JSON API
 */
export class RedditExtractor extends BaseExtractor {
  /**
   * Checks if this extractor can handle the given URL
   *
   * @param url - The URL to check
   * @returns boolean - True if URL is a Reddit URL
   */
  canHandle(url: string): boolean {
    return isPlatform(url, "reddit");
  }

  /**
   * Extracts metadata from Reddit post/page
   *
   * @param url - The Reddit URL to extract metadata from
   * @returns Promise<ParsedMetadata> - Extracted metadata
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
        // HTML fetching/parsing failed, continue to JSON API fallback
      }

      // Fallback to Reddit JSON API
      try {
        // Remove trailing slash and append .json
        const jsonUrl = url.replace(/\/$/, "") + ".json";

        const response = await fetch(jsonUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        });

        if (response.ok) {
          const data = (await response.json()) as RedditListing[];
          if (
            data &&
            Array.isArray(data) &&
            data.length > 0 &&
            data[0]?.data?.children?.length > 0
          ) {
            const post = data[0].data.children[0].data;
            return this.parseRedditPost(post, url);
          }
        }
      } catch {
        // JSON API failed, continue to URL extraction fallback
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
   * Parses Reddit post data into ParsedMetadata format
   *
   * @param post - Reddit post data
   * @param originalUrl - Original Reddit URL
   * @returns ParsedMetadata - Parsed metadata
   */
  private parseRedditPost(
    post: RedditPost,
    originalUrl: string
  ): ParsedMetadata {
    // Build title
    let title = post.title || null;
    if (title && post.subreddit) {
      title = `r/${post.subreddit}: ${title}`;
    }

    // Build description from selftext or post info
    let description = post.selftext || null;
    if (!description && post.author) {
      description = `Posted by u/${post.author}`;
      if (post.num_comments !== undefined) {
        description += ` • ${post.num_comments} comments`;
      }
    }

    // Extract image from preview or thumbnail
    let image: string | null = null;
    if (post.preview?.images?.[0]?.source?.url) {
      // Reddit preview URLs are HTML encoded
      const imageUrl = post.preview.images[0].source.url
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");
      image = resolveUrl(imageUrl, originalUrl);
    } else if (post.thumbnail && post.thumbnail.startsWith("http")) {
      image = resolveUrl(post.thumbnail, originalUrl);
    }

    return {
      title: title,
      description: description,
      image: image,
      url: originalUrl,
    };
  }

  /**
   * Extracts metadata from Reddit HTML content
   *
   * @param $ - Cheerio instance
   * @param url - Original URL
   * @returns ParsedMetadata - Extracted metadata
   */
  private extractFromHtml($: CheerioAPI, url: string): ParsedMetadata {
    // Extract title from Open Graph, Twitter Card, or page title
    let title =
      $('meta[property="og:title"]').attr("content") ||
      $('meta[name="twitter:title"]').attr("content") ||
      $("title").text().trim() ||
      null;

    // Clean up Reddit default title if it's just the generic one
    if (title && title === "Reddit - The heart of the internet") {
      // Try to find a more specific title from h1 or other elements
      const h1Title = $("h1").first().text().trim();
      if (h1Title && h1Title.length > 0) {
        title = h1Title;
      } else {
        // Try to extract from URL if we have a post URL
        const urlMetadata = this.extractFromUrl(url);
        if (urlMetadata.title && urlMetadata.title !== "Reddit Content") {
          title = urlMetadata.title;
        }
      }
    }

    // Extract description from Open Graph, Twitter Card, or meta description
    const description =
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="twitter:description"]').attr("content") ||
      $('meta[name="description"]').attr("content") ||
      null;

    // Extract image from Open Graph, Twitter Card, or other sources
    let image: string | null = null;
    const ogImage =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content") ||
      $('meta[name="twitter:image:src"]').attr("content") ||
      null;

    if (ogImage) {
      image = resolveUrl(ogImage, url);
    } else {
      // Fallback: try to find image in content
      const img = $('img[src*="reddit"]').first().attr("src");
      if (img) {
        image = resolveUrl(img, url);
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
   * Extracts metadata from Reddit URL structure
   * Reddit URLs are like: /r/subreddit/comments/postid/title/
   *
   * @param url - The Reddit URL
   * @returns ParsedMetadata - Extracted metadata
   */
  private extractFromUrl(url: string): ParsedMetadata {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split("/").filter((p) => p);

      // Look for subreddit in path: /r/{subreddit}/...
      const rIndex = pathParts.indexOf("r");
      if (rIndex !== -1 && pathParts[rIndex + 1]) {
        const subreddit = pathParts[rIndex + 1];
        // Try to extract title from URL path if available
        const title =
          pathParts.length > rIndex + 3
            ? pathParts
                .slice(rIndex + 3)
                .join(" ")
                .replace(/-/g, " ")
                .replace(/\b\w/g, (l) => l.toUpperCase())
            : null;

        return {
          title: title || `r/${subreddit}`,
          description: `Post from r/${subreddit}`,
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
   * Fetches HTML content from Reddit URL
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
