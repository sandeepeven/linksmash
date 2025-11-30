/**
 * oEmbed Extractor
 *
 * This file provides a generic oEmbed metadata extractor for platforms
 * that support the oEmbed standard (YouTube, Spotify, Instagram, Twitter).
 * Uses the oEmbed API to fetch structured metadata.
 */

import { fetch } from "undici";
import { BaseExtractor, IPlatformExtractor } from "./base-extractor";
import { ParsedMetadata } from "../../utils/og-parser";
import { resolveUrl } from "../../utils/url-validator";

/**
 * oEmbed API endpoint configuration
 */
interface OEmbedConfig {
  endpoint: string;
  urlParam: string;
  format?: string;
  accessToken?: string;
  appId?: string;
  appSecret?: string;
}

/**
 * oEmbed response structure
 */
interface OEmbedResponse {
  title?: string;
  description?: string;
  author_name?: string;
  author_url?: string;
  thumbnail_url?: string;
  thumbnail_width?: number;
  thumbnail_height?: number;
  html?: string;
  url?: string;
  type?: string;
  provider_name?: string;
}

/**
 * Generic oEmbed extractor that works with any oEmbed-compatible platform
 */
export class OEmbedExtractor extends BaseExtractor {
  private platform: string;
  private config: OEmbedConfig;

  /**
   * Creates a new oEmbed extractor for a specific platform
   *
   * @param platform - Platform name (e.g., 'youtube', 'spotify')
   * @param config - oEmbed API configuration
   */
  constructor(platform: string, config: OEmbedConfig) {
    super();
    this.platform = platform;
    this.config = config;
  }

  /**
   * Checks if this extractor can handle the given URL
   *
   * @param url - The URL to check
   * @returns boolean - True if URL matches platform patterns
   */
  canHandle(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();

      switch (this.platform) {
        case "youtube":
          return (
            hostname.includes("youtube.com") || hostname.includes("youtu.be")
          );
        case "spotify":
          return hostname.includes("spotify.com");
        case "instagram":
          return hostname.includes("instagram.com");
        case "facebook":
          return hostname.includes("facebook.com");
        case "twitter":
          return hostname.includes("twitter.com") || hostname.includes("x.com");
        default:
          return false;
      }
    } catch {
      return false;
    }
  }

  /**
   * Extracts metadata using oEmbed API
   *
   * @param url - The URL to extract metadata from
   * @returns Promise<ParsedMetadata> - Extracted metadata
   */
  async extract(url: string): Promise<ParsedMetadata> {
    const normalizedUrl = this.normalizeUrl(url);
    const oembedUrl = this.buildOEmbedUrl(normalizedUrl);
    try {
      const response = await fetch(oembedUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      if (!response.ok) {
        throw new Error(
          `oEmbed API returned status ${response.status}: ${response.statusText}`
        );
      }

      const data = (await response.json()) as OEmbedResponse;

      return this.parseOEmbedResponse(data, normalizedUrl);
    } catch (error) {
      throw new Error(
        `Failed to fetch oEmbed data for ${this.platform}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Builds the oEmbed API URL
   *
   * @param url - The target URL
   * @returns string - The oEmbed API URL
   */
  private buildOEmbedUrl(url: string): string {
    const urlObj = new URL(this.config.endpoint);
    urlObj.searchParams.set(this.config.urlParam, url);

    if (this.config.format) {
      urlObj.searchParams.set("format", this.config.format);
    }

    // For Facebook Graph API, prefer access token, otherwise use app_id and app_secret
    if (this.config.accessToken) {
      urlObj.searchParams.set("access_token", this.config.accessToken);
    } else if (this.config.appId && this.config.appSecret) {
      // For Facebook Graph API, we can use app_id and app_secret
      // Note: This generates a client credentials token
      urlObj.searchParams.set("app_id", this.config.appId);
      urlObj.searchParams.set("app_secret", this.config.appSecret);
    } else if (this.config.appId) {
      // Some endpoints may accept just app_id
      urlObj.searchParams.set("app_id", this.config.appId);
    }

    return urlObj.href;
  }

  /**
   * Parses oEmbed response into ParsedMetadata format
   *
   * @param data - oEmbed response data
   * @param originalUrl - Original URL
   * @returns ParsedMetadata - Parsed metadata
   */
  private parseOEmbedResponse(
    data: OEmbedResponse,
    originalUrl: string
  ): ParsedMetadata {
    const metadata: ParsedMetadata = {
      title: data.title || null,
      description: this.buildDescription(data),
      image: data.thumbnail_url
        ? resolveUrl(data.thumbnail_url, originalUrl)
        : null,
      url: originalUrl,
    };

    return metadata;
  }

  /**
   * Builds description from oEmbed response
   *
   * @param data - oEmbed response data
   * @returns string | null - Description text
   */
  private buildDescription(data: OEmbedResponse): string | null {
    if (data.description) {
      return data.description;
    }

    // Build description from available fields
    const parts: string[] = [];
    if (data.author_name) {
      parts.push(`By ${data.author_name}`);
    }
    if (data.provider_name) {
      parts.push(`on ${data.provider_name}`);
    }

    return parts.length > 0 ? parts.join(" ") : null;
  }
}

/**
 * Creates oEmbed extractor instances for supported platforms
 */
export class OEmbedExtractorFactory {
  /**
   * Creates a YouTube oEmbed extractor
   *
   * @returns OEmbedExtractor - YouTube extractor instance
   */
  static createYouTube(): OEmbedExtractor {
    return new OEmbedExtractor("youtube", {
      endpoint: "https://www.youtube.com/oembed",
      urlParam: "url",
      format: "json",
    });
  }

  /**
   * Creates a Spotify oEmbed extractor
   *
   * @returns OEmbedExtractor - Spotify extractor instance
   */
  static createSpotify(): OEmbedExtractor {
    return new OEmbedExtractor("spotify", {
      endpoint: "https://embed.spotify.com/oembed/",
      urlParam: "url",
    });
  }

  /**
   * Creates an Instagram oEmbed extractor
   * Note: Instagram oEmbed requires Facebook Graph API authentication
   *
   * @param accessToken - Optional Facebook Graph API access token
   * @param appId - Optional Facebook App ID
   * @param appSecret - Optional Facebook App Secret (requires appId)
   * @returns OEmbedExtractor - Instagram extractor instance
   */
  static createInstagram(
    accessToken?: string,
    appId?: string,
    appSecret?: string
  ): OEmbedExtractor {
    // Instagram oEmbed via Facebook Graph API
    const hasAuth = accessToken || (appId && appSecret);
    console.log("hasAuth", hasAuth);
    return new OEmbedExtractor("instagram", {
      endpoint: hasAuth
        ? `https://graph.facebook.com/v18.0/instagram_oembed`
        : "https://api.instagram.com/oembed/",
      urlParam: "url",
      accessToken: accessToken,
      appId: appId,
      appSecret: appSecret,
    });
  }

  /**
   * Creates a Facebook oEmbed extractor
   * Note: Facebook oEmbed requires Facebook Graph API authentication
   *
   * @param accessToken - Optional Facebook Graph API access token
   * @param appId - Optional Facebook App ID
   * @param appSecret - Optional Facebook App Secret (requires appId)
   * @returns OEmbedExtractor - Facebook extractor instance
   */
  static createFacebook(
    accessToken?: string,
    appId?: string,
    appSecret?: string
  ): OEmbedExtractor {
    // Facebook oEmbed via Facebook Graph API
    const hasAuth = accessToken || (appId && appSecret);
    return new OEmbedExtractor("facebook", {
      endpoint: hasAuth
        ? `https://graph.facebook.com/v18.0/oembed_post`
        : "https://www.facebook.com/plugins/post/oembed.json/",
      urlParam: "url",
      accessToken: accessToken,
      appId: appId,
      appSecret: appSecret,
    });
  }

  /**
   * Creates a Twitter/X oEmbed extractor
   *
   * @returns OEmbedExtractor - Twitter extractor instance
   */
  static createTwitter(): OEmbedExtractor {
    return new OEmbedExtractor("twitter", {
      endpoint: "https://publish.twitter.com/oembed",
      urlParam: "url",
    });
  }
}
