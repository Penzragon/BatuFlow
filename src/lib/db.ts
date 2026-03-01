import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Creates a Prisma client with the PostgreSQL driver adapter.
 * Prisma 7 requires an explicit adapter for database connections.
 */
function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL!;
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
  } as any);
}

/**
 * Singleton Prisma client instance, lazily initialized.
 * Reuses the same connection across hot-reloads in development
 * to prevent exhausting the database connection pool.
 * The Proxy ensures the client is only created when first accessed
 * (not at module import time), preventing build-time errors.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = createPrismaClient();
    }
    return (globalForPrisma.prisma as any)[prop];
  },
});
