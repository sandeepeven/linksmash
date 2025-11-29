/**
 * Scraper Service
 *
 * This file provides web scraping functionality to fetch and parse HTML content.
 * Uses undici for HTTP requests and cheerio for HTML parsing.
 * Extracts Open Graph metadata from web pages.
 */

import { fetch } from "undici";
import { parseOpenGraphTags, ParsedMetadata } from "../utils/og-parser";
import { normalizeUrl } from "../utils/url-validator";

/**
 * Timeout duration for HTTP requests in milliseconds
 */
const REQUEST_TIMEOUT = 10000; // 10 seconds

/**
 * User-Agent string to mimic a browser request
 */
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Fetches HTML content from a URL and extracts Open Graph metadata
 *
 * @param url - The URL to scrape
 * @returns Promise<ParsedMetadata> - Extracted metadata from the page
 * @throws Error if the request fails or times out
 */
export async function scrapeMetadata(url: string): Promise<ParsedMetadata> {
  const normalizedUrl = normalizeUrl(url);

  // Create AbortController for timeout handling
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    // Fetch the HTML content
    // Note: undici fetch handles redirects automatically with redirect: "follow"
    // maxRedirects is not a standard fetch option, undici follows redirects by default
    const response = await fetch(normalizedUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
      redirect: "follow",
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(
        `HTTP request failed with status ${response.status}: ${response.statusText}`
      );
    }

    // Get the final URL after redirects
    const finalUrl = response.url || normalizedUrl;

    // Read the HTML content
    const html = await response.text();

    if (!html || html.trim().length === 0) {
      throw new Error("Empty response from server");
    }

    // Parse Open Graph tags from HTML
    const metadata = parseOpenGraphTags(html, finalUrl);

    return metadata;
  } catch (error: any) {
    clearTimeout(timeoutId);

    // Handle AbortError (timeout)
    if (error.name === "AbortError") {
      throw new Error(
        "Request timed out. Please check your internet connection and try again."
      );
    }

    // Handle fetch errors
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error(
        `Failed to fetch URL: ${error.message}. Please check if the URL is accessible.`
      );
    }

    // Re-throw other errors
    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Unknown error occurred while scraping metadata");
  }
}

