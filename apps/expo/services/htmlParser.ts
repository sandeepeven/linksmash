/**
 * HTML Parser Service
 *
 * This file provides functions for parsing HTML content to extract metadata.
 * It extracts title, description, and image from HTML using Open Graph tags
 * and hierarchical fallback strategies when OG tags are missing.
 * Works entirely client-side without requiring a backend API.
 */

/**
 * Interface for parsed metadata from HTML
 */
export interface ParsedMetadata {
  title: string | null;
  description: string | null;
  image: string | null;
  url: string | null;
}

/**
 * Resolves a relative URL to an absolute URL based on a base URL
 *
 * @param url - The URL to resolve (may be relative or absolute)
 * @param baseUrl - The base URL to resolve against
 * @returns string - The resolved absolute URL
 */
function resolveUrl(url: string, baseUrl: string): string {
  if (!url || !baseUrl) {
    return url;
  }

  // If URL is already absolute (starts with http:// or https://), return as is
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  try {
    const base = new URL(baseUrl);
    
    // If URL starts with //, prepend the protocol
    if (url.startsWith("//")) {
      return `${base.protocol}${url}`;
    }

    // If URL starts with /, it's an absolute path on the same domain
    if (url.startsWith("/")) {
      return `${base.protocol}//${base.host}${url}`;
    }

    // Otherwise, it's a relative URL
    return new URL(url, baseUrl).toString();
  } catch {
    // If URL parsing fails, return the original URL
    return url;
  }
}

/**
 * Sanitizes text by removing extra whitespace and newlines
 *
 * @param text - The text to sanitize
 * @returns string - The sanitized text
 */
function sanitizeText(text: string): string {
  if (!text) {
    return "";
  }
  return text.replace(/\s+/g, " ").replace(/\n+/g, " ").trim();
}

/**
 * Extracts content from a meta tag using regex
 *
 * @param html - The HTML content
 * @param property - The property name (e.g., "og:title")
 * @param name - Alternative name attribute (e.g., "description")
 * @returns string | null - The extracted content or null if not found
 */
function extractMetaTag(
  html: string,
  property?: string,
  name?: string
): string | null {
  if (!html) {
    return null;
  }

  // Try property attribute first
  if (property) {
    const propertyRegex = new RegExp(
      `<meta\\s+(?:property|name)=["']${property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']\\s+content=["']([^"']+)["']`,
      "i"
    );
    const propertyMatch = html.match(propertyRegex);
    if (propertyMatch && propertyMatch[1]) {
      return sanitizeText(propertyMatch[1]);
    }
  }

  // Try name attribute as fallback
  if (name) {
    const nameRegex = new RegExp(
      `<meta\\s+name=["']${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']\\s+content=["']([^"']+)["']`,
      "i"
    );
    const nameMatch = html.match(nameRegex);
    if (nameMatch && nameMatch[1]) {
      return sanitizeText(nameMatch[1]);
    }
  }

  return null;
}

/**
 * Extracts title from HTML using hierarchical fallback strategy
 * Fallback order: og:title → twitter:title → <title> → <h1> → first prominent heading
 *
 * @param html - The HTML content
 * @returns string | null - Extracted title or null if not found
 */
function extractTitle(html: string): string | null {
  if (!html) {
    return null;
  }

  // 1. Try Open Graph title
  const ogTitle = extractMetaTag(html, "og:title");
  if (ogTitle) {
    return ogTitle;
  }

  // 2. Try Twitter title
  const twitterTitle = extractMetaTag(html, "twitter:title");
  if (twitterTitle) {
    return twitterTitle;
  }

  // 3. Try <title> tag
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    return sanitizeText(titleMatch[1]);
  }

  // 4. Try first <h1> tag
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match && h1Match[1]) {
    return sanitizeText(h1Match[1]);
  }

  // 5. Try first prominent heading (h2-h6 in hierarchy order)
  for (let level = 2; level <= 6; level++) {
    const headingMatch = new RegExp(`<h${level}[^>]*>([^<]+)<\/h${level}>`, "i");
    const match = html.match(headingMatch);
    if (match && match[1]) {
      return sanitizeText(match[1]);
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
 * Finds the first paragraph with meaningful content
 * Excludes navigation/menu text and prefers content in main areas
 *
 * @param html - The HTML content
 * @returns string | null - Meaningful paragraph text or null if not found
 */
function findMeaningfulParagraph(html: string): string | null {
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

  // Try to find paragraphs in main content areas first
  const mainContentRegex = /<(?:main|article|section)[^>]*>[\s\S]*?<p[^>]*>([^<]+)<\/p>/i;
  const mainMatch = html.match(mainContentRegex);
  if (mainMatch && mainMatch[1]) {
    const text = sanitizeText(mainMatch[1]);
    if (text.length >= MIN_LENGTH && !isNavText(text, NAV_KEYWORDS)) {
      return text;
    }
  }

  // Fallback to any paragraph
  const paragraphRegex = /<p[^>]*>([^<]+)<\/p>/gi;
  let match;
  while ((match = paragraphRegex.exec(html)) !== null) {
    const text = sanitizeText(match[1]);
    if (text.length >= MIN_LENGTH && !isNavText(text, NAV_KEYWORDS)) {
      return text;
    }
  }

  return null;
}

/**
 * Extracts description from HTML using hierarchical fallback strategy
 * Fallback order: og:description → twitter:description → meta description → meaningful <p> → keywords → <title>
 *
 * @param html - The HTML content
 * @returns string | null - Extracted description or null if not found
 */
function extractDescription(html: string): string | null {
  if (!html) {
    return null;
  }

  // 1. Try Open Graph description
  const ogDescription = extractMetaTag(html, "og:description");
  if (ogDescription) {
    return ogDescription;
  }

  // 2. Try Twitter description
  const twitterDescription = extractMetaTag(html, "twitter:description");
  if (twitterDescription) {
    return twitterDescription;
  }

  // 3. Try meta[name="description"]
  const metaDescription = extractMetaTag(html, undefined, "description");
  if (metaDescription) {
    return metaDescription;
  }

  // 4. Try first meaningful paragraph
  const meaningfulParagraph = findMeaningfulParagraph(html);
  if (meaningfulParagraph) {
    return meaningfulParagraph;
  }

  // 5. Try meta keywords (format as description)
  const keywords = extractMetaTag(html, undefined, "keywords");
  if (keywords) {
    return keywords;
  }

  // 6. Try <title> tag as last resort (if it's long enough)
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    const title = sanitizeText(titleMatch[1]);
    if (title.length >= 20) {
      return title;
    }
  }

  return null;
}

/**
 * Checks if an image URL is likely a logo based on various criteria
 *
 * @param imageUrl - The image URL to check
 * @param html - The HTML content (for context)
 * @returns boolean - True if image is likely a logo
 */
function isLikelyLogo(imageUrl: string, html: string): boolean {
  if (!imageUrl) {
    return false;
  }

  const lowerUrl = imageUrl.toLowerCase();
  const logoKeywords = ["logo", "brand", "icon", "favicon"];
  const faviconPatterns = [
    "/favicon",
    "icon.",
    "logo.",
    "brand.",
    ".ico",
    "apple-touch-icon",
  ];

  // Check for logo keywords in URL
  if (logoKeywords.some((keyword) => lowerUrl.includes(keyword))) {
    return true;
  }

  // Check for favicon/icon patterns in URL
  if (faviconPatterns.some((pattern) => lowerUrl.includes(pattern))) {
    return true;
  }

  // Check if image is in header/footer/nav (by checking surrounding HTML)
  const imageIndex = html.indexOf(imageUrl);
  if (imageIndex !== -1) {
    const beforeImage = html.substring(Math.max(0, imageIndex - 500), imageIndex);
    const afterImage = html.substring(
      imageIndex,
      Math.min(html.length, imageIndex + 500)
    );
    const context = (beforeImage + afterImage).toLowerCase();
    if (
      context.includes("<header") ||
      context.includes("</header>") ||
      context.includes("<footer") ||
      context.includes("</footer>") ||
      context.includes("<nav") ||
      context.includes("</nav>")
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Finds the largest/first meaningful image in the body, excluding logos
 *
 * @param html - The HTML content
 * @param baseUrl - The base URL for resolving relative URLs
 * @returns string | null - Image URL or null if not found
 */
function findMeaningfulImage(html: string, baseUrl: string): string | null {
  if (!html) {
    return null;
  }

  // Extract all img tags
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const images: string[] = [];
  let match;

  while ((match = imgRegex.exec(html)) !== null) {
    if (match[1]) {
      images.push(match[1]);
    }
  }

  // Also check data-src (lazy loading)
  const dataSrcRegex = /<img[^>]+data-src=["']([^"']+)["'][^>]*>/gi;
  while ((match = dataSrcRegex.exec(html)) !== null) {
    if (match[1] && !images.includes(match[1])) {
      images.push(match[1]);
    }
  }

  // Filter out logos and find the best image
  for (const imgUrl of images) {
    if (!isLikelyLogo(imgUrl, html)) {
      return resolveUrl(imgUrl, baseUrl);
    }
  }

  // If all images are logos, return the first one anyway
  if (images.length > 0) {
    return resolveUrl(images[0], baseUrl);
  }

  return null;
}

/**
 * Extracts image from HTML using hierarchical fallback strategy
 * Fallback order: og:image → twitter:image → meaningful <img> in body (excluding logos)
 *
 * @param html - The HTML content
 * @param baseUrl - The base URL for resolving relative URLs
 * @returns string | null - Image URL or null if not found
 */
function extractImage(html: string, baseUrl: string): string | null {
  if (!html || !baseUrl) {
    return null;
  }

  // 1. Try Open Graph image
  const ogImage = extractMetaTag(html, "og:image");
  if (ogImage) {
    return resolveUrl(ogImage, baseUrl);
  }

  // 2. Try Twitter image
  const twitterImage = extractMetaTag(html, "twitter:image");
  if (twitterImage) {
    return resolveUrl(twitterImage, baseUrl);
  }

  // 3. Try to find meaningful image in body
  const meaningfulImage = findMeaningfulImage(html, baseUrl);
  if (meaningfulImage) {
    return meaningfulImage;
  }

  return null;
}

/**
 * Parses HTML content to extract metadata (title, description, image)
 * Uses hierarchical fallback approach: Open Graph tags first, then HTML body extraction
 *
 * @param html - The HTML content to parse
 * @param baseUrl - The base URL for resolving relative image URLs
 * @returns ParsedMetadata - Extracted metadata from HTML
 */
export function parseHTML(html: string, baseUrl: string): ParsedMetadata {
  if (!html || !baseUrl) {
    return {
      title: null,
      description: null,
      image: null,
      url: baseUrl || null,
    };
  }

  // Extract Open Graph URL
  const ogUrl = extractMetaTag(html, "og:url");

  // Extract title with fallback
  let title = extractTitle(html);

  // Extract description with fallback
  let description = extractDescription(html);

  // Extract image with fallback
  let image = extractImage(html, baseUrl);

  return {
    title: title || null,
    description: description || null,
    image: image || null,
    url: ogUrl || baseUrl || null,
  };
}

