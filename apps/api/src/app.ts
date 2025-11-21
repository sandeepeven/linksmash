/**
 * Fastify Application Setup
 *
 * This file configures the Fastify application instance.
 * Sets up CORS, error handling, and registers routes.
 */

import Fastify from "fastify";
import cors from "@fastify/cors";
import { metadataRoutes } from "./routes/metadata";
import { initializeCache, closeCache } from "./services/cache.service";

/**
 * Creates and configures a Fastify application instance
 *
 * @returns Promise<FastifyInstance> - Configured Fastify instance
 */
export async function createApp(): Promise<Fastify.FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || "info",
    },
  });

  // Register CORS plugin
  await app.register(cors, {
    origin: true, // Allow all origins in development
    credentials: true,
  });

  // Register routes
  await app.register(metadataRoutes);

  // Health check endpoint
  app.get("/health", async (request, reply) => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  // Global error handler
  app.setErrorHandler((error, request, reply) => {
    app.log.error(error);
    reply.status(500).send({
      error: "Internal server error",
      message: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  });

  // Initialize Redis cache
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  await initializeCache(redisUrl);

  // Graceful shutdown handler
  const shutdown = async () => {
    app.log.info("Shutting down server...");
    await closeCache();
    await app.close();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  return app;
}

