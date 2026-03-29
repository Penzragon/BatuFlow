import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Resolves the PostgreSQL connection string for Prisma.
 * Prefer Neon/Vercel **unpooled** URLs so queries hit the primary and avoid
 * transaction-pooler quirks; otherwise append `pgbouncer=true` for `-pooler`
 * hosts so Prisma disables incompatible prepared statements.
 */
function resolveDatabaseUrl(): string {
  const direct =
    process.env.DATABASE_URL_UNPOOLED ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.DATABASE_URL;
  if (!direct) {
    throw new Error("DATABASE_URL is not set");
  }
  if (direct.includes("-pooler.") && !direct.includes("pgbouncer=")) {
    return `${direct}${direct.includes("?") ? "&" : "?"}pgbouncer=true`;
  }
  return direct;
}

/**
 * Creates a Prisma client with the PostgreSQL driver adapter.
 * Prisma 7 requires an explicit adapter for database connections.
 */
function createPrismaClient(): PrismaClient {
  const connectionString = resolveDatabaseUrl();
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
