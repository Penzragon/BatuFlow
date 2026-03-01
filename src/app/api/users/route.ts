import {
  apiHandler,
  successResponse,
  parsePaginationParams,
} from "@/lib/api-utils";
import { requireRole, getClientIp } from "@/lib/auth-utils";
import { UserService, createUserSchema } from "@/services/user.service";
import { prisma } from "@/lib/db";

/**
 * GET /api/users
 * Returns a paginated list of users with optional search.
 * Supports ?role=DRIVER to filter by role.
 * Restricted to ADMIN and MANAGER roles.
 */
export const GET = apiHandler(async (req: Request) => {
  await requireRole(["ADMIN", "MANAGER"]);

  const { searchParams } = new URL(req.url);
  const roleFilter = searchParams.get("role");

  // If filtering by role (e.g., for driver selection), return simple list
  if (roleFilter) {
    const users = await prisma.user.findMany({
      where: { role: roleFilter as "DRIVER", isActive: true, deletedAt: null },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    });
    return successResponse({ items: users, total: users.length });
  }

  const pagination = parsePaginationParams(searchParams);
  const result = await UserService.listUsers(pagination);
  return successResponse(result);
});

/**
 * POST /api/users
 * Creates a new user account. Restricted to ADMIN role only.
 * Request body is validated against createUserSchema.
 */
export const POST = apiHandler(async (req: Request) => {
  const user = await requireRole(["ADMIN"]);
  const ip = getClientIp(req);
  const body = await req.json();
  const data = createUserSchema.parse(body);
  const created = await UserService.createUser(
    data,
    user.id,
    user.role,
    ip ?? undefined
  );
  return successResponse(created, 201);
});
