/**
 * Platform Detector Utility
 *
 * This file provides functions for detecting platforms from URLs.
 * Matches URLs to platforms based on hostname patterns.
 */

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
 * Detects platform from a URL based on hostname patterns
 *
 * @param url - The URL to detect platform for
 * @returns string | null - Detected platform name or null
 */
export function detectPlatform(url: string): string | null {
  const hostname = extractHostname(url);
  if (!hostname) {
    return null;
  }

  // Platform detection patterns (case-insensitive)
  const platformPatterns: Record<string, string[]> = {
    youtube: ["youtube.com", "youtu.be"],
    spotify: ["spotify.com"],
    instagram: ["instagram.com"],
    facebook: ["facebook.com", "fb.com"],
    twitter: ["twitter.com", "x.com"],
    reddit: ["reddit.com"],
    flipkart: ["flipkart.com"],
    blinkit: ["blinkit.com"],
    swiggy: ["swiggy.com"],
    instamart: ["swiggy.com"],
    zepto: ["zepto.com"],
    amazon: ["amazon.com", "amazon.in", "amazon.co.uk"],
    linkedin: ["linkedin.com"],
    netflix: ["netflix.com"],
    dealshare: ["dealshare.in"],
    "google news": ["news.google.com"],
    chrome: ["chrome.google.com"],
    firefox: ["mozilla.org", "firefox.com"],
    safari: ["apple.com"],
  };

  // Check each platform pattern
  for (const [platform, patterns] of Object.entries(platformPatterns)) {
    if (patterns.some((pattern) => hostname.includes(pattern))) {
      // Special handling for Instamart (Swiggy subdomain/path)
      if (platform === "swiggy" && url.includes("/instamart/")) {
        return "instamart";
      }
      return platform;
    }
  }

  return null;
}

/**
 * Checks if a URL belongs to a specific platform
 *
 * @param url - The URL to check
 * @param platform - Platform name to check against
 * @returns boolean - True if URL belongs to the platform
 */
export function isPlatform(url: string, platform: string): boolean {
  const detected = detectPlatform(url);
  return detected === platform;
}

