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
   * Extracts metadata from Reddit using JSON API
   *
   * @param url - The Reddit URL to extract metadata from
   * @returns Promise<ParsedMetadata> - Extracted metadata
   */
  async extract(url: string): Promise<ParsedMetadata> {
    // Remove trailing slash and append .json
    const jsonUrl = url.replace(/\/$/, "") + ".json";

    try {
      const response = await fetch(jsonUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Reddit API returned status ${response.status}: ${response.statusText}`
        );
      }

      const data = (await response.json()) as RedditListing[];
      if (!data || !Array.isArray(data) || data.length === 0) {
        throw new Error("Invalid Reddit JSON response");
      }

      // Reddit returns array with listing data
      const listing = data[0];
      if (
        !listing ||
        !listing.data ||
        !listing.data.children ||
        listing.data.children.length === 0
      ) {
        throw new Error("No post data found in Reddit response");
      }

      const post = listing.data.children[0].data;
      return this.parseRedditPost(post, url);
    } catch (error) {
      throw new Error(
        `Failed to fetch Reddit metadata: ${error instanceof Error ? error.message : "Unknown error"}`
      );
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
}

