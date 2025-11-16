/**
 * Tag Detection Service
 *
 * This file provides functions for automatically detecting tags for links
 * based on domain names, URL patterns, and metadata keywords.
 */

/**
 * Interface for metadata used in tag detection
 */
interface Metadata {
  title?: string | null;
  description?: string | null;
}

/**
 * Detects an appropriate tag for a link based on domain, URL patterns, and metadata
 *
 * @param url - The URL to analyze
 * @param metadata - Optional metadata (title, description) to help with detection
 * @returns string | null - The detected tag or null if no match
 */
export function detectLinkTag(url: string, metadata?: Metadata): string | null {
  if (!url || typeof url !== "string") {
    return null;
  }

  const lowerUrl = url.toLowerCase();
  const title = metadata?.title?.toLowerCase() || "";
  const description = metadata?.description?.toLowerCase() || "";
  const combinedText = `${title} ${description}`.toLowerCase();

  // E-commerce / Shopping detection
  const shoppingDomains = [
    "amazon.com",
    "amazon.in",
    "amazon.co.uk",
    "flipkart.com",
    "shopify.com",
    "etsy.com",
    "ebay.com",
    "alibaba.com",
    "aliexpress.com",
    "walmart.com",
    "target.com",
    "bestbuy.com",
    "macy.com",
    "nike.com",
    "adidas.com",
    "zara.com",
    "h&m",
    "hm.com",
    "myntra.com",
    "ajio.com",
    "nykaa.com",
    "purplle.com",
  ];

  const shoppingUrlPatterns = [
    "/product/",
    "/products/",
    "/shop/",
    "/buy/",
    "/cart/",
    "/checkout/",
    "/store/",
    "/purchase/",
    "/item/",
    "/dp/",
    "/gp/product/",
  ];

  const shoppingKeywords = [
    "buy",
    "purchase",
    "price",
    "cart",
    "shopping",
    "sale",
    "discount",
    "off",
    "deal",
    "shop",
    "store",
    "add to cart",
    "checkout",
    "product",
    "shipping",
    "delivery",
  ];

  // News detection
  const newsDomains = [
    "bbc.com",
    "cnn.com",
    "reuters.com",
    "nytimes.com",
    "theguardian.com",
    "washingtonpost.com",
    "wsj.com",
    "economist.com",
    "timesofindia.com",
    "indiatoday.com",
    "ndtv.com",
    "news.com",
  ];

  const newsUrlPatterns = ["/news/", "/article/", "/story/", "/breaking/"];

  const newsKeywords = [
    "news",
    "breaking",
    "article",
    "report",
    "journalism",
    "headlines",
    "latest",
    "update",
  ];

  // Social media detection
  const socialDomains = [
    "facebook.com",
    "twitter.com",
    "x.com",
    "instagram.com",
    "linkedin.com",
    "pinterest.com",
    "reddit.com",
    "tiktok.com",
    "youtube.com",
    "snapchat.com",
  ];

  // Video detection
  const videoDomains = [
    "youtube.com",
    "youtu.be",
    "vimeo.com",
    "dailymotion.com",
    "twitch.tv",
    "netflix.com",
    "hulu.com",
    "disney.com",
    "primevideo.com",
  ];

  const videoUrlPatterns = ["/watch", "/video/", "/v/", "/embed/"];

  const videoKeywords = ["video", "watch", "stream", "movie", "episode"];

  // Tech detection
  const techDomains = [
    "github.com",
    "stackoverflow.com",
    "medium.com",
    "dev.to",
    "techcrunch.com",
    "theverge.com",
    "wired.com",
    "arstechnica.com",
  ];

  const techKeywords = [
    "technology",
    "tech",
    "software",
    "programming",
    "code",
    "developer",
    "app",
    "api",
    "framework",
  ];

  // Check domain-based detection first
  for (const domain of shoppingDomains) {
    if (lowerUrl.includes(domain)) {
      return "shopping";
    }
  }

  for (const domain of newsDomains) {
    if (lowerUrl.includes(domain)) {
      return "news";
    }
  }

  for (const domain of socialDomains) {
    if (lowerUrl.includes(domain)) {
      return "social";
    }
  }

  for (const domain of videoDomains) {
    if (lowerUrl.includes(domain)) {
      return "video";
    }
  }

  for (const domain of techDomains) {
    if (lowerUrl.includes(domain)) {
      return "tech";
    }
  }

  // Check URL pattern-based detection
  for (const pattern of shoppingUrlPatterns) {
    if (lowerUrl.includes(pattern)) {
      return "shopping";
    }
  }

  for (const pattern of newsUrlPatterns) {
    if (lowerUrl.includes(pattern)) {
      return "news";
    }
  }

  for (const pattern of videoUrlPatterns) {
    if (lowerUrl.includes(pattern)) {
      return "video";
    }
  }

  // Check metadata keyword-based detection
  for (const keyword of shoppingKeywords) {
    if (combinedText.includes(keyword)) {
      return "shopping";
    }
  }

  for (const keyword of newsKeywords) {
    if (combinedText.includes(keyword)) {
      return "news";
    }
  }

  for (const keyword of videoKeywords) {
    if (combinedText.includes(keyword)) {
      return "video";
    }
  }

  for (const keyword of techKeywords) {
    if (combinedText.includes(keyword)) {
      return "tech";
    }
  }

  // No match found
  return null;
}
