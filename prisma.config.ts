import "dotenv/config";
import { defineConfig, env } from "prisma/config";

/**
 * Prisma 7 configuration. The database URL is read from DATABASE_URL
 * so that migrate, db push, and generate use the same connection.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
