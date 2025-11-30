/**
 * Main Entry Point
 *
 * This file is the entry point for the Fastify backend server.
 * Starts the server on the configured port.
 */

// Load environment variables from .env file
import "dotenv/config";

import { createApp } from "./app";

// Add uncaught error handlers to prevent silent failures
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
  process.exit(1);
});

/**
 * Starts the Fastify server
 */
async function start() {
  try {
    const app = await createApp();

    const port = parseInt(process.env.PORT || "8080", 10);

    // Explicitly bind to 0.0.0.0 to ensure it's accessible from outside the container
    // This is critical for AWS App Runner health checks
    await app.listen({
      port,
      host: "0.0.0.0",
    });

    console.log(`Server listening on port ${port}`);
  } catch (error) {
    console.error("Failed to start server:", error);
    if (error instanceof Error) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Start the server
start();
