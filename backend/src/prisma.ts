import { PrismaClient } from "@prisma/client";
import { env } from "./env.js";

// Reuse a single client across hot reloads in development.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.isProd ? ["warn", "error"] : ["query", "warn", "error"],
  });

if (!env.isProd) globalForPrisma.prisma = prisma;
