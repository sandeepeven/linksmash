/**
 * Metadata Routes
 *
 * This file defines the HTTP routes for metadata endpoints.
 * Registers routes with Fastify application.
 */

import { FastifyInstance } from "fastify";
import { getMetadata } from "../controllers/metadata.controller";

/**
 * Registers metadata routes with Fastify instance
 *
 * @param fastify - Fastify instance
 * @returns Promise<void>
 */
export async function metadataRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/metadata
   * Fetches metadata for a given URL
   *
   * Query parameters:
   * - url: string (required) - The URL to fetch metadata for
   *
   * Response:
   * - 200: MetadataResponse - Success response with metadata
   * - 400: Error - Invalid URL or missing parameter
   * - 500: Error - Internal server error
   * - 502: Error - Bad gateway (failed to fetch URL)
   * - 504: Error - Request timeout
   */
  fastify.get("/api/metadata", getMetadata);
}

