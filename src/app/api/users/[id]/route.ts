import { apiHandler, successResponse } from "@/lib/api-utils";
import { requireRole, getClientIp } from "@/lib/auth-utils";
import { UserService, updateUserSchema } from "@/services/user.service";

/**
 * GET /api/users/:id
 * Returns a single user by ID. Restricted to ADMIN role.
 */
export const GET = apiHandler(async (_req: Request, context: unknown) => {
  await requireRole(["ADMIN"]);
  const { id } = (context as { params: Promise<{ id: string }> }).params
    ? await (context as { params: Promise<{ id: string }> }).params
    : (context as { params: { id: string } }).params;
  const user = await UserService.getUser(id);
  return successResponse(user);
});

/**
 * PUT /api/users/:id
 * Updates a user's name, email, role, active status, or password.
 * Restricted to ADMIN role. Request body validated against updateUserSchema.
 */
export const PUT = apiHandler(async (req: Request, context: unknown) => {
  const admin = await requireRole(["ADMIN"]);
  const ip = getClientIp(req);
  const { id } = (context as { params: Promise<{ id: string }> }).params
    ? await (context as { params: Promise<{ id: string }> }).params
    : (context as { params: { id: string } }).params;
  const body = await req.json();
  const data = updateUserSchema.parse(body);
  const user = await UserService.updateUser(
    id,
    data,
    admin.id,
    admin.role,
    ip ?? undefined
  );
  return successResponse(user);
});

/**
 * DELETE /api/users/:id
 * Soft-deletes (deactivates) a user. Restricted to ADMIN role.
 */
export const DELETE = apiHandler(async (req: Request, context: unknown) => {
  const admin = await requireRole(["ADMIN"]);
  const ip = getClientIp(req);
  const { id } = (context as { params: Promise<{ id: string }> }).params
    ? await (context as { params: Promise<{ id: string }> }).params
    : (context as { params: { id: string } }).params;
  await UserService.deactivateUser(id, admin.id, admin.role, ip ?? undefined);
  return successResponse({ deleted: true });
});
