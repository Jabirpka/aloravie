import { createApp } from "./app.js";
import { env } from "./env.js";
import { logger } from "./logger.js";
import { prisma } from "./prisma.js";
import { expireStalePendingOrders } from "./modules/checkout/checkout.service.js";

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`Aloravie backend listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

// Release stock held by abandoned (unpaid) checkouts — on boot and every 15 min —
// so inventory never gets locked by carts that were never paid.
function releaseStaleReservations() {
  void expireStalePendingOrders()
    .then((n) => { if (n) logger.info({ released: n }, "released stale pending reservations"); })
    .catch((err) => logger.error({ err }, "stale reservation release failed"));
}
releaseStaleReservations();
setInterval(releaseStaleReservations, 15 * 60 * 1000).unref();

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
