/**
 * Open Graph Parser Utility
 *
 * This file provides functions for parsing Open Graph meta tags from HTML.
 * Intelligently extracts title, description, and image from HTML content using
 * hierarchical fallback strategies when Open Graph tags are missing or incomplete.
 */

import { load, CheerioAPI } from "cheerio";
import type { Element } from "domhandler";
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
 * Extracts title from HTML using hierarchical fallback strategy
 * Fallback order: og:title → <title> → <h1> → meta[name="title"] → first prominent heading
 *
 * @param $ - Cheerio instance with loaded HTML
 * @returns string | null - Extracted title or null if not found
 */
function extractTitle($: CheerioAPI): string | null {
  // 1. Try Open Graph title
  const ogTitle =
    $('meta[property="og:title"]').attr("content") ||
    $('meta[name="og:title"]').attr("content");
  if (ogTitle && ogTitle.trim()) {
    return ogTitle.trim();
  }

  // 2. Try <title> tag
  const titleTag = $("title").text().trim();
  if (titleTag) {
    return titleTag;
  }

  // 3. Try first <h1> tag
  const h1 = $("h1").first().text().trim();
  if (h1) {
    return h1;
  }

  // 4. Try meta[name="title"]
  const metaTitle = $('meta[name="title"]').attr("content");
  if (metaTitle && metaTitle.trim()) {
    return metaTitle.trim();
  }

  // 5. Try first prominent heading (h2-h6 in hierarchy order)
  for (let level = 2; level <= 6; level++) {
    const heading = $(`h${level}`).first().text().trim();
    if (heading) {
      return heading;
    }
  }

  return null;
}

/**
 * Finds the first paragraph with meaningful content
 * Excludes navigation/menu text and prefers content in main areas
 *
 * @param $ - Cheerio instance with loaded HTML
 * @returns string | null - Meaningful paragraph text or null if not found
 */
function findMeaningfulParagraph($: CheerioAPI): string | null {
  const MIN_LENGTH = 50;
  const NAV_KEYWORDS = [
    "home",
    "about",
    "contact",
    "menu",
    "navigation",
    "nav",
    "skip",
    "skip to",
  ];

  // Prefer paragraphs in main content areas
  const contentSelectors = ["main p", "article p", "section p", "body > p"];
  for (const selector of contentSelectors) {
    const paragraphs = $(selector);
    for (let i = 0; i < paragraphs.length; i++) {
      const text = $(paragraphs[i]).text().trim();
      if (text.length >= MIN_LENGTH && !isNavText(text, NAV_KEYWORDS)) {
        return text;
      }
    }
  }

  // Fallback to any paragraph
  const paragraphs = $("p");
  for (let i = 0; i < paragraphs.length; i++) {
    const text = $(paragraphs[i]).text().trim();
    if (text.length >= MIN_LENGTH && !isNavText(text, NAV_KEYWORDS)) {
      return text;
    }
  }

  return null;
}

/**
 * Checks if text appears to be navigation/menu text
 *
 * @param text - The text to check
 * @param navKeywords - Array of navigation keywords to check for
 * @returns boolean - True if text appears to be navigation text
 */
function isNavText(text: string, navKeywords: string[]): boolean {
  const lowerText = text.toLowerCase();
  return navKeywords.some((keyword) => lowerText.includes(keyword));
}

/**
 * Extracts meaningful aria-label from main content elements
 *
 * @param $ - Cheerio instance with loaded HTML
 * @returns string | null - Meaningful aria-label or null if not found
 */
function extractAriaLabel($: CheerioAPI): string | null {
  const MIN_LENGTH = 30;
  const contentSelectors = [
    "[aria-label]",
    "main [aria-label]",
    "article [aria-label]",
    "[role='main'] [aria-label]",
  ];

  for (const selector of contentSelectors) {
    const elements = $(selector);
    for (let i = 0; i < elements.length; i++) {
      const ariaLabel = $(elements[i]).attr("aria-label");
      if (ariaLabel && ariaLabel.trim().length >= MIN_LENGTH) {
        return ariaLabel.trim();
      }
    }
  }

  return null;
}

/**
 * Extracts description from HTML using hierarchical fallback strategy
 * Fallback order: og:description → meta description → meaningful <p> → keywords → <title> → aria-label
 *
 * @param $ - Cheerio instance with loaded HTML
 * @returns string | null - Extracted description or null if not found
 */
function extractDescription($: CheerioAPI): string | null {
  // 1. Try Open Graph description
  const ogDescription =
    $('meta[property="og:description"]').attr("content") ||
    $('meta[name="og:description"]').attr("content");
  if (ogDescription && ogDescription.trim()) {
    return ogDescription.trim();
  }

  // 2. Try meta[name="description"]
  const metaDescription = $('meta[name="description"]').attr("content");
  if (metaDescription && metaDescription.trim()) {
    return metaDescription.trim();
  }

  // 3. Try first meaningful paragraph
  const meaningfulParagraph = findMeaningfulParagraph($);
  if (meaningfulParagraph) {
    return meaningfulParagraph;
  }

  // 4. Try meta keywords (format as description)
  const keywords = $('meta[name="keywords"]').attr("content");
  if (keywords && keywords.trim()) {
    return keywords.trim();
  }

  // 5. Try <title> tag as last resort
  const titleTag = $("title").text().trim();
  if (titleTag && titleTag.length >= 20) {
    return titleTag;
  }

  // 6. Try meaningful aria-label
  const ariaLabel = extractAriaLabel($);
  if (ariaLabel) {
    return ariaLabel;
  }

  return null;
}

/**
 * Checks if an image element is likely a logo based on various criteria
 *
 * @param imgElement - The image element to check
 * @param $ - Cheerio instance with loaded HTML
 * @returns boolean - True if image is likely a logo
 */
function isLikelyLogo(imgElement: Element, $: CheerioAPI): boolean {
  const $img = $(imgElement);
  const src = $img.attr("src") || "";
  const classAttr = ($img.attr("class") || "").toLowerCase();
  const idAttr = ($img.attr("id") || "").toLowerCase();
  const altAttr = ($img.attr("alt") || "").toLowerCase();

  // Check for logo keywords in class/id/alt
  const logoKeywords = ["logo", "brand", "icon", "favicon"];
  if (
    logoKeywords.some(
      (keyword) =>
        classAttr.includes(keyword) ||
        idAttr.includes(keyword) ||
        altAttr.includes(keyword)
    )
  ) {
    return true;
  }

  // Check for favicon/icon patterns in src
  const faviconPatterns = [
    "/favicon",
    "icon.",
    "logo.",
    "brand.",
    ".ico",
    "apple-touch-icon",
  ];
  if (faviconPatterns.some((pattern) => src.toLowerCase().includes(pattern))) {
    return true;
  }

  // Check if image is in header/footer/nav
  const ancestors = $img.parents().toArray();
  const parentElement = $img.parent().get(0);
  const allAncestors = parentElement
    ? [parentElement, ...ancestors]
    : ancestors;
  const tagNames = allAncestors
    .map((a) => a.tagName?.toLowerCase() || "")
    .filter(Boolean);

  if (
    tagNames.some((tag) =>
      ["header", "footer", "nav", "navigation"].includes(tag)
    )
  ) {
    return true;
  }

  // Check image size (small images are likely logos/icons)
  const width = parseInt($img.attr("width") || "0");
  const height = parseInt($img.attr("height") || "0");
  if (width > 0 && height > 0 && (width < 200 || height < 200)) {
    return true;
  }

  return false;
}

/**
 * Finds the largest/first meaningful image in the body, excluding logos
 *
 * @param $ - Cheerio instance with loaded HTML
 * @param baseUrl - The base URL for resolving relative URLs
 * @returns string | null - Image URL or null if not found
 */
function findMeaningfulImage($: CheerioAPI, baseUrl: string): string | null {
  const images = $("body img").toArray();
  const validImages: Array<{ element: Element; size: number; index: number }> =
    [];

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const $img = $(img);

    // Skip logos
    if (isLikelyLogo(img, $)) {
      continue;
    }

    // Get image source
    const src = $img.attr("src") || $img.attr("data-src");
    if (!src) {
      continue;
    }

    // Calculate size score (width * height, or estimate based on attributes)
    const width = parseInt($img.attr("width") || "0");
    const height = parseInt($img.attr("height") || "0");
    let size = 0;

    if (width > 0 && height > 0) {
      size = width * height;
    } else {
      // If no dimensions, give it a default size based on position
      // Earlier images get higher priority
      size = 10000 - i * 10;
    }

    validImages.push({
      element: img,
      size: size,
      index: i,
    });
  }

  if (validImages.length === 0) {
    return null;
  }

  // Sort by size (largest first), then by position (earlier first)
  validImages.sort((a, b) => {
    if (b.size !== a.size) {
      return b.size - a.size;
    }
    return a.index - b.index;
  });

  // Get the best image
  const bestImage = validImages[0];
  const src =
    $(bestImage.element).attr("src") || $(bestImage.element).attr("data-src");
  if (src) {
    return resolveUrl(src, baseUrl);
  }

  return null;
}

/**
 * Extracts image from HTML using hierarchical fallback strategy
 * Fallback order: og:image → meaningful <img> in body (excluding logos)
 *
 * @param $ - Cheerio instance with loaded HTML
 * @param baseUrl - The base URL for resolving relative URLs
 * @returns string | null - Image URL or null if not found
 */
function extractImage($: CheerioAPI, baseUrl: string): string | null {
  // 1. Try Open Graph image
  const ogImage =
    $('meta[property="og:image"]').attr("content") ||
    $('meta[name="og:image"]').attr("content");
  if (ogImage && ogImage.trim()) {
    return resolveUrl(ogImage.trim(), baseUrl);
  }

  // 2. Try to find meaningful image in body
  const meaningfulImage = findMeaningfulImage($, baseUrl);
  if (meaningfulImage) {
    return meaningfulImage;
  }

  return null;
}

/**
 * Parses Open Graph tags from HTML content with intelligent fallback strategies
 * Uses hierarchical extraction for title, description, and image when Open Graph tags are missing
 *
 * @param html - The HTML content to parse
 * @param baseUrl - The base URL for resolving relative image URLs
 * @returns ParsedMetadata - Extracted metadata from HTML
 */
export function parseOpenGraphTags(
  html: string,
  baseUrl: string
): ParsedMetadata {
  const $ = load(html);

  // Extract metadata using intelligent helper functions
  const title = extractTitle($);
  const description = extractDescription($);
  const image = extractImage($, baseUrl);

  // Extract Open Graph URL
  const ogUrl =
    $('meta[property="og:url"]').attr("content") ||
    $('meta[name="og:url"]').attr("content") ||
    null;

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
  return text.replace(/\s+/g, " ").replace(/\n+/g, " ").trim();
}
