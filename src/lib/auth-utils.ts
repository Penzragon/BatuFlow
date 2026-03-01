import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import type { UserRole } from "@prisma/client";

/**
 * Gets the current session user. Throws if not authenticated.
 */
export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  return session.user;
}

/**
 * Checks if the current user has one of the required roles.
 * Throws if not authenticated or role mismatch.
 */
export async function requireRole(roles: UserRole[]) {
  const user = await getCurrentUser();
  if (!roles.includes(user.role)) {
    throw new Error("Forbidden");
  }
  return user;
}

/**
 * Checks RBAC permission for the current user on the given module and action.
 * Throws if not authenticated or permission denied.
 */
export async function requirePermission(module: string, action: string) {
  const user = await getCurrentUser();
  const allowed = hasPermission(user.role, module, action);
  if (!allowed) {
    throw new Error("Forbidden");
  }
  return user;
}

/**
 * Extracts the client IP from request headers.
 * Checks x-forwarded-for (for proxies) and x-real-ip.
 */
export function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? null;
  }
  return request.headers.get("x-real-ip");
}
