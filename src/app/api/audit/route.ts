import { getCurrentUser } from "@/lib/auth-utils";
import { apiHandler, successResponse, parsePaginationParams } from "@/lib/api-utils";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/**
 * GET /api/audit
 * Returns paginated audit logs with field-level changes and user info.
 * Admins/Managers see all logs; other roles see only their own.
 *
 * Query params: entityType, entityId, userId, module, action,
 *               dateFrom, dateTo, page, pageSize
 */
export const GET = apiHandler(async (req: Request) => {
  const user = await getCurrentUser();
  const { searchParams } = new URL(req.url);
  const { page, pageSize } = parsePaginationParams(searchParams);

  const entityType = searchParams.get("entityType") ?? undefined;
  const entityId = searchParams.get("entityId") ?? undefined;
  const filterUserId = searchParams.get("userId") ?? undefined;
  const action = searchParams.get("action") ?? undefined;
  const dateFrom = searchParams.get("dateFrom") ?? undefined;
  const dateTo = searchParams.get("dateTo") ?? undefined;
  const search = searchParams.get("search") ?? undefined;

  const isPrivileged = user.role === "ADMIN" || user.role === "MANAGER";

  const where: Prisma.AuditLogWhereInput = {
    ...(entityType && { entityType }),
    ...(entityId && { entityId }),
    ...(action && { action: action as Prisma.AuditLogWhereInput["action"] }),
    ...(search && { entityLabel: { contains: search, mode: "insensitive" as const } }),
    ...(dateFrom || dateTo
      ? {
          timestamp: {
            ...(dateFrom && { gte: new Date(dateFrom) }),
            ...(dateTo && { lte: new Date(dateTo) }),
          },
        }
      : {}),
    userId: isPrivileged
      ? filterUserId ?? undefined
      : user.id,
  };

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        changes: true,
      },
      orderBy: { timestamp: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return successResponse({
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
});
