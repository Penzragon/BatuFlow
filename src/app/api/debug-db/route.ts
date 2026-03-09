import { Prisma } from "@prisma/client";
import { apiHandler, successResponse } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";

function maskHost(url?: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.host;
  } catch {
    return "invalid-url";
  }
}

export const GET = apiHandler(async () => {
  const user = await getCurrentUser();
  if (!["ADMIN", "MANAGER"].includes(user.role)) {
    throw new Error("Forbidden");
  }

  const rows = await prisma.$queryRaw<Array<{ db: string; receipts_table: string | null }>>(
    Prisma.sql`select current_database() as db, to_regclass('public.receipts')::text as receipts_table`
  );

  return successResponse({
    env: process.env.VERCEL_ENV ?? "unknown",
    dbHost: maskHost(process.env.DATABASE_URL),
    dbHostUnpooled: maskHost(process.env.DATABASE_URL_UNPOOLED),
    currentDatabase: rows[0]?.db ?? null,
    receiptsTable: rows[0]?.receipts_table ?? null,
  });
});
