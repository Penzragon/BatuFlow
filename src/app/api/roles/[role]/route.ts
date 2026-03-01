import { UserRole } from "@prisma/client";
import { apiHandler, successResponse, errorResponse } from "@/lib/api-utils";
import { requireRole, getClientIp } from "@/lib/auth-utils";
import { RoleService } from "@/services/role.service";

const VALID_ROLES = Object.values(UserRole);

/**
 * GET /api/roles/:role
 * Returns permissions for a single role. Restricted to ADMIN.
 */
export const GET = apiHandler(async (_req: Request, context: unknown) => {
  await requireRole(["ADMIN"]);
  const { role } = (context as { params: Promise<{ role: string }> }).params
    ? await (context as { params: Promise<{ role: string }> }).params
    : (context as { params: { role: string } }).params;

  if (!VALID_ROLES.includes(role as UserRole)) {
    return errorResponse("Invalid role", 400);
  }

  const result = await RoleService.getPermissions(role as UserRole);
  return successResponse(result);
});

/**
 * PUT /api/roles/:role
 * Updates a single permission for the specified role.
 * Body: { module: string, action: string, allowed: boolean }
 * Restricted to ADMIN role.
 */
export const PUT = apiHandler(async (req: Request, context: unknown) => {
  const admin = await requireRole(["ADMIN"]);
  const ip = getClientIp(req);
  const { role } = (context as { params: Promise<{ role: string }> }).params
    ? await (context as { params: Promise<{ role: string }> }).params
    : (context as { params: { role: string } }).params;

  if (!VALID_ROLES.includes(role as UserRole)) {
    return errorResponse("Invalid role", 400);
  }

  const body = await req.json();
  const { module, action, allowed } = body;

  if (!module || !action || typeof allowed !== "boolean") {
    return errorResponse("module, action, and allowed are required", 400);
  }

  const result = await RoleService.updatePermission(
    role as UserRole,
    module,
    action,
    allowed,
    admin.id,
    admin.role,
    ip ?? undefined
  );

  return successResponse(result);
});
