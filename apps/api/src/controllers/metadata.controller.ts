/**
 * Metadata Controller
 *
 * This file handles HTTP request/response logic for metadata endpoints.
 * Validates requests and formats responses.
 */

import { FastifyRequest, FastifyReply } from "fastify";
import { fetchMetadata } from "../services/metadata.service";
import { MetadataResponse } from "../types/metadata.types";
import { z } from "zod";

/**
 * Query parameter schema for metadata endpoint
 */
const MetadataQuerySchema = z.object({
  url: z.string().url("Invalid URL format"),
});

/**
 * Handles GET /api/metadata request
 *
 * @param request - Fastify request object
 * @param reply - Fastify reply object
 * @returns Promise<void>
 */
export async function getMetadata(
  request: FastifyRequest<{
    Querystring: { url: string };
  }>,
  reply: FastifyReply
): Promise<void> {
  try {
    // Validate query parameters
    const validationResult = MetadataQuerySchema.safeParse({
      url: request.query.url,
    });

    if (!validationResult.success) {
      reply.code(400).send({
        error: "Invalid request",
        message: validationResult.error.errors[0].message,
      });
      return;
    }

    const { url } = validationResult.data;

    // Fetch metadata
    const metadata: MetadataResponse = await fetchMetadata(url);

    // Return success response
    reply.code(200).send(metadata);
  } catch (error: any) {
    // Handle errors
    console.error("Error fetching metadata:", error);

    if (error instanceof Error) {
      // Check for specific error types
      if (error.message.includes("Invalid URL")) {
        reply.code(400).send({
          error: "Invalid URL",
          message: error.message,
        });
        return;
      }

      if (error.message.includes("timeout") || error.message.includes("timed out")) {
        reply.code(504).send({
          error: "Request timeout",
          message: "The request to fetch metadata timed out",
        });
        return;
      }

      if (error.message.includes("HTTP request failed")) {
        reply.code(502).send({
          error: "Bad gateway",
          message: "Failed to fetch the requested URL",
        });
        return;
      }
    }

    // Generic error response
    reply.code(500).send({
      error: "Internal server error",
      message: "An error occurred while fetching metadata",
    });
  }
}

