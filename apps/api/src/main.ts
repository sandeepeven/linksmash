/**
 * Main Entry Point
 *
 * This file is the entry point for the Fastify backend server.
 * Starts the server on the configured port.
 */

import { createApp } from "./app";

/**
 * Starts the Fastify server
 */
async function start() {
  try {
    const app = await createApp();

    const port = parseInt(process.env.PORT || "3001", 10);
    const host = process.env.HOST || "0.0.0.0";

    await app.listen({ port, host });

    console.log(`Server listening on http://${host}:${port}`);
    console.log(`Health check: http://${host}:${port}/health`);
    console.log(`Metadata endpoint: http://${host}:${port}/api/metadata`);
  } catch (error) {
    console.error("Error starting server:", error);
    process.exit(1);
  }
}

// Start the server
start();

