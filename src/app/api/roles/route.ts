import { apiHandler, successResponse } from "@/lib/api-utils";
import { requireRole } from "@/lib/auth-utils";
import { RoleService } from "@/services/role.service";

/**
 * GET /api/roles
 * Returns the full permission matrix for all roles.
 * Restricted to ADMIN role only.
 */
export const GET = apiHandler(async () => {
  await requireRole(["ADMIN"]);
  const result = await RoleService.getAllPermissions();
  return successResponse(result);
});
