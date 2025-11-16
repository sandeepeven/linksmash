/**
 * Hostname-based Tag Detection Service
 *
 * This file provides functions for detecting tags based on hostname (p0 priority).
 * Falls back to category-based detection if hostname detection fails.
 */

import { detectLinkTag } from "./tagDetection";

/**
 * Popular hostnames that should be used as tags directly
 * These are apps/services that have Android/iOS apps
 */
const POPULAR_HOSTNAMES: Record<string, string> = {
  // E-commerce
  blinkit: "blinkit",
  "blinkit.com": "blinkit",
  swiggy: "swiggy",
  "swiggy.com": "swiggy",
  instamart: "instamart",
  "instamart.com": "instamart",
  zepto: "zepto",
  "zepto.com": "zepto",
  dealshare: "dealshare",
  "dealshare.com": "dealshare",
  flipkart: "flipkart",
  "flipkart.com": "flipkart",
  amazon: "amazon",
  "amazon.com": "amazon",
  "amazon.in": "amazon",
  "amazon.co.uk": "amazon",
  myntra: "myntra",
  "myntra.com": "myntra",
  ajio: "ajio",
  "ajio.com": "ajio",
  nykaa: "nykaa",
  "nykaa.com": "nykaa",

  // Video & Entertainment
  youtube: "youtube",
  "youtube.com": "youtube",
  "youtu.be": "youtube",
  netflix: "netflix",
  "netflix.com": "netflix",
  spotify: "spotify",
  "spotify.com": "spotify",
  crunchyroll: "crunchyroll",
  "crunchyroll.com": "crunchyroll",
  instagram: "instagram",
  "instagram.com": "instagram",

  // Social & Professional
  linkedin: "linkedin",
  "linkedin.com": "linkedin",
  facebook: "facebook",
  "facebook.com": "facebook",
  twitter: "twitter",
  "twitter.com": "twitter",
  "x.com": "twitter",
  reddit: "reddit",
  "reddit.com": "reddit",

  // News
  "timesofindia.com": "timesofindia",
  "indiatoday.com": "indiatoday",
  "ndtv.com": "ndtv",
  "bbc.com": "bbc",
  "cnn.com": "cnn",
  "reuters.com": "reuters",
  "nytimes.com": "nytimes",
  "theguardian.com": "theguardian",

  // Tech
  github: "github",
  "github.com": "github",
  stackoverflow: "stackoverflow",
  "stackoverflow.com": "stackoverflow",
  medium: "medium",
  "medium.com": "medium",
  "dev.to": "devto",

  // Google Products
  "google.com": "google",
  "google.co.in": "google",
  "news.google.com": "googlenews",
  "chrome.google.com": "chrome",
  "play.google.com": "playstore",
};

/**
 * Extracts hostname from a URL
 *
 * @param url - The URL to extract hostname from
 * @returns string | null - The hostname or null if extraction fails
 */
function extractHostname(url: string): string | null {
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
 * Detects tag based on hostname (p0 priority)
 * Falls back to category-based detection if hostname not found
 *
 * @param url - The URL to analyze
 * @param metadata - Optional metadata (title, description) for fallback detection
 * @returns string | null - The detected tag
 */
export function detectHostnameTag(
  url: string,
  metadata?: { title?: string | null; description?: string | null }
): string | null {
  if (!url || typeof url !== "string") {
    return null;
  }

  const hostname = extractHostname(url);
  if (!hostname) {
    // Fallback to category-based detection
    return detectLinkTag(url, metadata);
  }

  // Check for exact hostname match
  if (POPULAR_HOSTNAMES[hostname]) {
    return POPULAR_HOSTNAMES[hostname];
  }

  // Check for partial matches (e.g., "blinkit" in "app.blinkit.com")
  for (const [key, tag] of Object.entries(POPULAR_HOSTNAMES)) {
    if (hostname.includes(key) || key.includes(hostname)) {
      return tag;
    }
  }

  // Extract base domain (e.g., "blinkit" from "app.blinkit.com")
  const parts = hostname.split(".");
  if (parts.length >= 2) {
    const baseDomain = parts[parts.length - 2]; // Second to last part
    if (POPULAR_HOSTNAMES[baseDomain]) {
      return POPULAR_HOSTNAMES[baseDomain];
    }
  }

  // Fallback to category-based detection
  return detectLinkTag(url, metadata);
}

