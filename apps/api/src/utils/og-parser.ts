/**
 * Open Graph Parser Utility
 *
 * This file provides functions for parsing Open Graph meta tags from HTML.
 * Extracts og:title, og:description, og:image, and og:url from HTML content.
 */

import { load } from "cheerio";
import { resolveUrl } from "./url-validator";

/**
 * Interface for parsed Open Graph metadata
 */
export interface ParsedMetadata {
  title: string | null;
  description: string | null;
  image: string | null;
  url: string | null;
}

/**
 * Parses Open Graph tags from HTML content
 *
 * @param html - The HTML content to parse
 * @param baseUrl - The base URL for resolving relative image URLs
 * @returns ParsedMetadata - Extracted metadata from Open Graph tags
 */
export function parseOpenGraphTags(
  html: string,
  baseUrl: string
): ParsedMetadata {
  const $ = load(html);

  // Extract Open Graph tags
  const ogTitle =
    $('meta[property="og:title"]').attr("content") ||
    $('meta[name="og:title"]').attr("content") ||
    null;

  const ogDescription =
    $('meta[property="og:description"]').attr("content") ||
    $('meta[name="og:description"]').attr("content") ||
    null;

  const ogImage =
    $('meta[property="og:image"]').attr("content") ||
    $('meta[name="og:image"]').attr("content") ||
    null;

  const ogUrl =
    $('meta[property="og:url"]').attr("content") ||
    $('meta[name="og:url"]').attr("content") ||
    null;

  // Fallback to standard meta tags if Open Graph tags are not present
  const title =
    ogTitle ||
    $("title").text().trim() ||
    $('meta[name="title"]').attr("content") ||
    null;

  const description =
    ogDescription ||
    $('meta[name="description"]').attr("content") ||
    null;

  // Resolve relative image URLs to absolute URLs
  let image: string | null = null;
  if (ogImage) {
    image = resolveUrl(ogImage, baseUrl);
  } else {
    // Fallback: try to find the first image in the content
    const firstImage = $("img").first().attr("src");
    if (firstImage) {
      image = resolveUrl(firstImage, baseUrl);
    }
  }

  // Clean and sanitize text content
  const cleanTitle = title ? sanitizeText(title) : null;
  const cleanDescription = description ? sanitizeText(description) : null;

  return {
    title: cleanTitle,
    description: cleanDescription,
    image,
    url: ogUrl || baseUrl,
  };
}

/**
 * Sanitizes text by removing extra whitespace and newlines
 *
 * @param text - The text to sanitize
 * @returns string - The sanitized text
 */
function sanitizeText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\n+/g, " ")
    .trim();
}

