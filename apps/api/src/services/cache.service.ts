/**
 * Cache Service
 *
 * This file provides Redis caching functionality for metadata.
 * Caches metadata by URL to reduce redundant scraping requests.
 */

import Redis from "ioredis";
import { ParsedMetadata } from "../utils/og-parser";

/**
 * Cache TTL in seconds (24 hours)
 */
const CACHE_TTL = 24 * 60 * 60; // 24 hours

/**
 * Redis client instance
 */
let redisClient: Redis | null = null;

/**
 * Initializes the Redis client connection
 *
 * @param redisUrl - Optional Redis connection URL (defaults to redis://localhost:6379)
 * @returns Promise<void>
 */
export async function initializeCache(
  redisUrl: string = "redis://localhost:6379"
): Promise<void> {
  // Skip Redis if URL is localhost and we're in production (likely no Redis available)
  if (redisUrl.includes("localhost") && process.env.NODE_ENV === "production") {
    console.log("Skipping Redis cache (localhost not available in production)");
    redisClient = null;
    return;
  }

  try {
    redisClient = new Redis(redisUrl, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
      connectTimeout: 2000, // 2 second timeout
      commandTimeout: 2000,
    });

    // Use Promise.race to add a timeout to the connection
    const connectPromise = redisClient.connect();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Redis connection timeout")), 3000)
    );

    await Promise.race([connectPromise, timeoutPromise]);
    console.log("Redis cache connected successfully");
  } catch (error) {
    console.error("Failed to connect to Redis:", error);
    // Continue without cache if Redis is unavailable
    redisClient = null;
  }
}

/**
 * Closes the Redis connection
 *
 * @returns Promise<void>
 */
export async function closeCache(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log("Redis cache connection closed");
  }
}

/**
 * Generates a cache key for a URL
 *
 * @param url - The URL to generate a key for
 * @returns string - The cache key
 */
function getCacheKey(url: string): string {
  return `metadata:${Buffer.from(url).toString("base64url")}`;
}

/**
 * Retrieves cached metadata for a URL
 *
 * @param url - The URL to get cached metadata for
 * @returns Promise<ParsedMetadata | null> - Cached metadata or null if not found
 */
export async function getCachedMetadata(
  url: string
): Promise<ParsedMetadata | null> {
  if (!redisClient) {
    return null;
  }

  try {
    const key = getCacheKey(url);
    const cached = await redisClient.get(key);

    if (cached) {
      return JSON.parse(cached) as ParsedMetadata;
    }

    return null;
  } catch (error) {
    console.error("Error retrieving from cache:", error);
    return null;
  }
}

/**
 * Stores metadata in the cache
 *
 * @param url - The URL to cache metadata for
 * @param metadata - The metadata to cache
 * @returns Promise<void>
 */
export async function setCachedMetadata(
  url: string,
  metadata: ParsedMetadata
): Promise<void> {
  if (!redisClient) {
    return;
  }

  try {
    const key = getCacheKey(url);
    await redisClient.setex(key, CACHE_TTL, JSON.stringify(metadata));
  } catch (error) {
    console.error("Error storing in cache:", error);
    // Don't throw - cache failures shouldn't break the service
  }
}

/**
 * Checks if Redis is available
 *
 * @returns boolean - True if Redis is connected, false otherwise
 */
export function isCacheAvailable(): boolean {
  return redisClient !== null && redisClient.status === "ready";
}
