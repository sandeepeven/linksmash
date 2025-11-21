/**
 * Platform Configuration Service
 *
 * This file contains configuration for various platforms including
 * whether to use link preview API and default image URLs.
 */

/**
 * Platform configuration interface
 */
export interface PlatformConfig {
  linkPreview: boolean;
  defaultImageUrl: string | null;
}

/**
 * Platform configurations for popular apps and services
 */
export const PLATFORM_CONFIG: Record<string, PlatformConfig> = {
  flipkart: {
    linkPreview: false,
    defaultImageUrl: null, // Can be set to Flipkart icon URL if needed
  },
  amazon: {
    linkPreview: true,
    defaultImageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/d/de/Amazon_icon.png",
  },
  linkedin: {
    linkPreview: true,
    defaultImageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/LinkedIn_logo_initials.png/960px-LinkedIn_logo_initials.png",
  },
  blinkit: {
    linkPreview: false,
    defaultImageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Blinkit-yellow-app-icon.svg/2048px-Blinkit-yellow-app-icon.svg.png",
  },
  instamart: {
    linkPreview: false,
    defaultImageUrl:
      "https://play-lh.googleusercontent.com/gS8vyX1kwPBjo15FvdQwK_U6NpATu0N5GpWJfXGxhhQKPiUCMtutCNn1hUGQvJAzIBQ",
  },
  zepto: {
    linkPreview: true,
    defaultImageUrl:
      "https://pnghdpro.com/wp-content/themes/pnghdpro/download/social-media-and-brands/zepto-logo-app-icon-hd.png",
  },
  dealshare: {
    linkPreview: true,
    defaultImageUrl:
      "https://media.instahyre.com/images/profile/base/employer/11159/87ab5ffd16/0_-_2019-05-24T173221.538.webp",
  },
  swiggy: {
    linkPreview: true,
    defaultImageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/1/13/Swiggy_logo.png",
  },
  youtube: {
    linkPreview: true,
    defaultImageUrl: "https://cdn-icons-png.flaticon.com/512/1384/1384060.png",
  },
  "google news": {
    linkPreview: true,
    defaultImageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/Google_News_icon.svg/1251px-Google_News_icon.svg.png",
  },
  netflix: {
    linkPreview: false,
    defaultImageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Netflix_icon.svg/1024px-Netflix_icon.svg.png",
  },
  instagram: {
    linkPreview: true,
    defaultImageUrl:
      "https://1000logos.net/wp-content/uploads/2017/02/Instagram-Logo.png",
  },
  spotify: {
    linkPreview: true,
    defaultImageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Spotify_icon.svg/1982px-Spotify_icon.svg.png",
  },
  crunchyroll: {
    linkPreview: false,
    defaultImageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Crunchyroll_Logo.svg/1842px-Crunchyroll_Logo.svg.png",
  },
  reddit: {
    linkPreview: true,
    defaultImageUrl:
      "https://toppng.com/uploads/preview/reddit-icon-reddit-logo-transparent-115628752708pqmsy4kgm.png",
  },
  // Google products and browsers
  chrome: {
    linkPreview: true,
    defaultImageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Google_Chrome_icon_%28February_2022%29.svg/2048px-Google_Chrome_icon_%28February_2022%29.svg.png",
  },
  firefox: {
    linkPreview: true,
    defaultImageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Firefox_logo%2C_2019.svg/2048px-Firefox_logo%2C_2019.svg.png",
  },
  safari: {
    linkPreview: true,
    defaultImageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Safari_browser_logo.svg/2057px-Safari_browser_logo.svg.png",
  },
  // Default for web articles and other websites
  default: {
    linkPreview: true,
    defaultImageUrl:
      "https://www.freeiconspng.com/thumbs/no-image-icon/no-image-icon-23.jpg",
  },
};

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
 * Gets platform configuration for a given URL
 *
 * @param url - The URL to get platform config for
 * @returns PlatformConfig - The platform configuration (defaults to 'default' config)
 */
export function getPlatformConfig(url: string): PlatformConfig {
  const hostname = extractHostname(url);
  if (!hostname) {
    return PLATFORM_CONFIG.default;
  }

  // Check for exact hostname matches first
  for (const [platform, config] of Object.entries(PLATFORM_CONFIG)) {
    if (platform === "default") continue;
    if (hostname.includes(platform)) {
      return config;
    }
  }

  // Check for common patterns
  if (hostname.includes("google") && hostname.includes("news")) {
    return PLATFORM_CONFIG["google news"];
  }

  // Default to web article handling
  return PLATFORM_CONFIG.default;
}

/**
 * Checks if a platform requires link preview API
 *
 * @param url - The URL to check
 * @returns boolean - True if link preview should be used
 */
export function shouldUseLinkPreview(url: string): boolean {
  const config = getPlatformConfig(url);
  return config.linkPreview;
}

/**
 * Gets default image URL for a platform
 *
 * @param url - The URL to get default image for
 * @returns string | null - The default image URL or null
 */
export function getDefaultImageUrl(url: string): string | null {
  const config = getPlatformConfig(url);
  return config.defaultImageUrl;
}
