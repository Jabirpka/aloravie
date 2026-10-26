import { createApp } from "./app.js";
import { env } from "./env.js";
import { logger } from "./logger.js";
import { prisma } from "./prisma.js";

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`Aloravie backend listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
  // Force-exit if close hangs.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
