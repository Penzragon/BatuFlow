import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AuditService } from "./audit.service";
import { MODULES, ACTIONS } from "@/lib/permissions";

/** Shape of a single permission row returned to the client. */
export interface PermissionRow {
  id: string | null;
  role: UserRole;
  module: string;
  action: string;
  allowed: boolean;
}

/** Grouped permissions for a role: module → action → allowed. */
export interface RolePermissions {
  role: UserRole;
  permissions: Record<string, Record<string, boolean>>;
}

const ALL_MODULES = Object.values(MODULES);
const ALL_ACTIONS = Object.values(ACTIONS);

/**
 * Service layer for role permission management.
 * Reads and writes the RolePermission table to provide configurable
 * RBAC beyond the hard-coded default matrix. Admin role always keeps
 * full access and cannot be modified.
 */
export class RoleService {
  /**
   * Returns all permissions for a single role. Merges stored DB
   * permissions with the full module/action matrix so every cell
   * is represented, defaulting to false when no DB row exists.
   */
  static async getPermissions(role: UserRole): Promise<RolePermissions> {
    const stored = await prisma.rolePermission.findMany({ where: { role } });

    const map = new Map<string, boolean>();
    for (const row of stored) {
      map.set(`${row.module}:${row.action}`, row.allowed);
    }

    const permissions: Record<string, Record<string, boolean>> = {};
    for (const mod of ALL_MODULES) {
      permissions[mod] = {};
      for (const act of ALL_ACTIONS) {
        const key = `${mod}:${act}`;
        if (role === "ADMIN") {
          permissions[mod][act] = true;
        } else {
          permissions[mod][act] = map.get(key) ?? false;
        }
      }
    }

    return { role, permissions };
  }

  /**
   * Returns permissions for every role in the system.
   * Used by the role management UI to render the full permission matrix.
   */
  static async getAllPermissions(): Promise<RolePermissions[]> {
    const roles = Object.values(UserRole);
    return Promise.all(roles.map((r) => RoleService.getPermissions(r)));
  }

  /**
   * Updates a single permission cell for a non-admin role.
   * Creates the DB row if it doesn't exist (upsert). Logs the
   * change in the audit trail.
   */
  static async updatePermission(
    role: UserRole,
    module: string,
    action: string,
    allowed: boolean,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<PermissionRow> {
    if (role === "ADMIN") {
      const err = new Error("Admin permissions cannot be modified");
      (err as Error & { status: number }).status = 400;
      throw err;
    }

    if (!ALL_MODULES.includes(module as (typeof ALL_MODULES)[number])) {
      const err = new Error(`Invalid module: ${module}`);
      (err as Error & { status: number }).status = 400;
      throw err;
    }

    if (!ALL_ACTIONS.includes(action as (typeof ALL_ACTIONS)[number])) {
      const err = new Error(`Invalid action: ${action}`);
      (err as Error & { status: number }).status = 400;
      throw err;
    }

    const existing = await prisma.rolePermission.findUnique({
      where: { role_module_action: { role, module, action } },
    });

    const oldAllowed = existing?.allowed ?? false;

    const result = await prisma.rolePermission.upsert({
      where: { role_module_action: { role, module, action } },
      create: { role, module, action, allowed },
      update: { allowed },
    });

    await AuditService.logUpdate({
      userId,
      userRole,
      ipAddress,
      entityType: "RolePermission",
      entityId: result.id,
      entityLabel: `${role} - ${module}:${action}`,
      oldData: { allowed: oldAllowed },
      newData: { allowed },
    });

    return {
      id: result.id,
      role: result.role,
      module: result.module,
      action: result.action,
      allowed: result.allowed,
    };
  }
}
