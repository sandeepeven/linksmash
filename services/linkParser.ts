/**
 * Link Parser Service
 *
 * This file provides functions for parsing links and text+link combinations
 * to extract title, description, and other metadata.
 */

/**
 * Parsed link data interface
 */
export interface ParsedLinkData {
  url: string;
  title: string | null;
  description: string | null;
  hostname: string | null;
}

/**
 * Extracts a URL from text that might contain both description and URL
 *
 * @param text - The text that might contain a URL
 * @returns string | null - The extracted URL or null if no URL found
 */
export function extractUrlFromText(text: string): string | null {
  if (!text || text.trim() === "") {
    return null;
  }

  // Try to find URLs in the text using regex
  // Matches http:// or https:// URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = text.match(urlRegex);

  if (matches && matches.length > 0) {
    // Return the first URL found
    // Clean up the URL by removing trailing punctuation that might not be part of the URL
    let url = matches[0];
    // Remove trailing punctuation (period, comma, etc.) that might not be part of URL
    url = url.replace(/[.,;:!?]+$/, "");
    return url;
  }

  // If no URL found but text starts with http:// or https://, treat entire text as URL
  const trimmedText = text.trim();
  if (
    trimmedText.startsWith("http://") ||
    trimmedText.startsWith("https://")
  ) {
    return trimmedText;
  }

  return null;
}

/**
 * Extracts hostname from a URL
 *
 * @param url - The URL to extract hostname from
 * @returns string | null - The hostname or null if extraction fails
 */
export function extractHostname(url: string): string | null {
  try {
    const urlObj = new URL(url);
    let hostname = urlObj.hostname.toLowerCase();
    // Remove 'www.' prefix if present
    if (hostname.startsWith("www.")) {
      hostname = hostname.substring(4);
    }
    return hostname;
  } catch {
    return null;
  }
}

/**
 * Extracts title from text using various patterns
 *
 * @param text - The text to extract title from
 * @param url - The URL (optional, for context)
 * @returns string | null - The extracted title
 */
function extractTitleFromText(text: string, url?: string): string | null {
  if (!text || text.trim() === "") {
    return null;
  }

  // Remove URL from text if present
  let cleanText = text;
  if (url) {
    cleanText = cleanText.replace(url, "").trim();
  }

  // Pattern 1: "Check out this product on [platform]-[Title]"
  // Example: "Check out this product on blinkit-Archies Shagun Envelope (Yellow)"
  const pattern1 = /(?:check out|take a look at|see|view).*?on\s+\w+[-–]\s*([^(\n]+)/i;
  const match1 = cleanText.match(pattern1);
  if (match1 && match1[1]) {
    return match1[1].trim();
  }

  // Pattern 2: Extract text before "on [Platform]" or "from [Platform]"
  // Example: "Take a look at this Frontech - 50.8 cm (20 inch) HD LED Backlit VA Panel Monitor (MON-0074) on Flipkart"
  const pattern2 = /(.+?)\s+on\s+\w+/i;
  const match2 = cleanText.match(pattern2);
  if (match2 && match2[1]) {
    const candidate = match2[1].trim();
    // Extract product name (usually after dash or colon)
    const productMatch = candidate.match(/[-–:]\s*(.+?)(?:\s*\(|$)/);
    if (productMatch && productMatch[1]) {
      return productMatch[1].trim();
    }
    return candidate;
  }

  // Pattern 3: Extract text between quotes or parentheses
  const quotedMatch = cleanText.match(/["']([^"']+)["']/);
  if (quotedMatch && quotedMatch[1]) {
    return quotedMatch[1].trim();
  }

  // Pattern 4: Extract first sentence or phrase (up to 100 chars)
  const firstSentence = cleanText.split(/[.!?]/)[0].trim();
  if (firstSentence && firstSentence.length > 0 && firstSentence.length < 100) {
    return firstSentence;
  }

  return null;
}

/**
 * Parses a link or text+link combination to extract metadata
 *
 * @param input - The input text or URL
 * @returns ParsedLinkData - Parsed link data with title, description, and hostname
 */
export function parseLink(input: string): ParsedLinkData {
  const url = extractUrlFromText(input);
  const hostname = url ? extractHostname(url) : null;

  // Type 1: Direct URL (no additional text)
  if (input.trim() === url) {
    return {
      url: url || input,
      title: hostname || null,
      description: null,
      hostname,
    };
  }

  // Type 2: Text with description followed by a link
  if (url && input.includes(url)) {
    // Extract description (everything except the URL)
    const description = input.replace(url, "").trim();
    const title = extractTitleFromText(description, url);

    return {
      url,
      title: title || hostname || null,
      description: description || null,
      hostname,
    };
  }

  // Type 3: Others (no clear URL or pattern)
  return {
    url: url || input,
    title: null,
    description: input.trim() || null,
    hostname,
  };
}

/**
 * Parses BlinkIt-style share text
 * Example: "Check out this product on blinkit-Archies Shagun Envelope (Yellow) https://blinkit.com/prn/x/prid/529979"
 *
 * @param text - The share text
 * @param url - The URL
 * @returns ParsedLinkData - Parsed data
 */
export function parseBlinkItStyle(text: string, url: string): ParsedLinkData {
  const hostname = extractHostname(url);
  const description = text.replace(url, "").trim();

  // Extract title from pattern: "blinkit-[Title]"
  const titleMatch = description.match(/blinkit[-–]\s*(.+?)(?:\s*https?|$)/i);
  const title = titleMatch ? titleMatch[1].trim() : null;

  return {
    url,
    title: title || hostname || "blinkit",
    description: description || null,
    hostname: hostname || "blinkit",
  };
}

/**
 * Parses Flipkart-style share text
 * Example: "Take a look at this Frontech - 50.8 cm (20 inch) HD LED Backlit VA Panel Monitor (MON-0074) on Flipkart https://dl.flipkart.com/s/9pkVYkuuuN"
 *
 * @param text - The share text
 * @param url - The URL
 * @returns ParsedLinkData - Parsed data
 */
export function parseFlipkartStyle(text: string, url: string): ParsedLinkData {
  const hostname = extractHostname(url);
  const description = text.replace(url, "").trim();

  // Extract product name (usually after dash and before parentheses or "on Flipkart")
  const productMatch = description.match(/[-–]\s*(.+?)(?:\s*\(|on\s+flipkart|$)/i);
  let title = productMatch ? productMatch[1].trim() : null;

  // If title extraction failed, try to get the main product name
  if (!title) {
    const parts = description.split(" - ");
    if (parts.length > 1) {
      title = parts[parts.length - 1]
        .replace(/\s*\([^)]+\)/g, "")
        .replace(/\s*on\s+flipkart/i, "")
        .trim();
    }
  }

  return {
    url,
    title: title || hostname || "Flipkart",
    description: description || null,
    hostname: hostname || "flipkart",
  };
}

