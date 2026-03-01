import { UserRole } from "@prisma/client";

/**
 * Module identifiers used in the permission system.
 * Each module maps to a sidebar section in the UI.
 */
export const MODULES = {
  SALES: "sales",
  INVENTORY: "inventory",
  FINANCE: "finance",
  HR: "hr",
  EXPENSES: "expenses",
  DELIVERY: "delivery",
  WAREHOUSE: "warehouse",
  SETTINGS: "settings",
  AUDIT: "audit",
  IMPORT: "import",
} as const;

export type Module = (typeof MODULES)[keyof typeof MODULES];

/**
 * Actions that can be performed within each module.
 */
export const ACTIONS = {
  VIEW: "view",
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
  APPROVE: "approve",
  EXPORT: "export",
} as const;

export type Action = (typeof ACTIONS)[keyof typeof ACTIONS];

/**
 * Default permission matrix defining which roles can perform
 * which actions in each module. Admin always has full access.
 */
export const DEFAULT_PERMISSIONS: Record<
  UserRole,
  Record<string, string[]>
> = {
  ADMIN: {
    [MODULES.SALES]: Object.values(ACTIONS),
    [MODULES.INVENTORY]: Object.values(ACTIONS),
    [MODULES.FINANCE]: Object.values(ACTIONS),
    [MODULES.HR]: Object.values(ACTIONS),
    [MODULES.EXPENSES]: Object.values(ACTIONS),
    [MODULES.DELIVERY]: Object.values(ACTIONS),
    [MODULES.WAREHOUSE]: Object.values(ACTIONS),
    [MODULES.SETTINGS]: Object.values(ACTIONS),
    [MODULES.AUDIT]: ["view", "export"],
    [MODULES.IMPORT]: ["view", "create"],
  },
  MANAGER: {
    [MODULES.SALES]: Object.values(ACTIONS),
    [MODULES.INVENTORY]: ["view", "create", "update", "export"],
    [MODULES.FINANCE]: ["view", "export"],
    [MODULES.HR]: ["view", "approve"],
    [MODULES.EXPENSES]: ["view", "approve", "export"],
    [MODULES.DELIVERY]: Object.values(ACTIONS),
    [MODULES.WAREHOUSE]: ["view", "export"],
    [MODULES.SETTINGS]: ["view"],
    [MODULES.AUDIT]: ["view", "export"],
    [MODULES.IMPORT]: [],
  },
  STAFF: {
    [MODULES.SALES]: ["view", "create", "update"],
    [MODULES.INVENTORY]: ["view"],
    [MODULES.FINANCE]: [],
    [MODULES.HR]: ["view"],
    [MODULES.EXPENSES]: ["view", "create", "update"],
    [MODULES.DELIVERY]: ["view"],
    [MODULES.WAREHOUSE]: [],
    [MODULES.SETTINGS]: [],
    [MODULES.AUDIT]: [],
    [MODULES.IMPORT]: [],
  },
  DRIVER: {
    [MODULES.SALES]: [],
    [MODULES.INVENTORY]: [],
    [MODULES.FINANCE]: [],
    [MODULES.HR]: ["view"],
    [MODULES.EXPENSES]: [],
    [MODULES.DELIVERY]: ["view", "update"],
    [MODULES.WAREHOUSE]: [],
    [MODULES.SETTINGS]: [],
    [MODULES.AUDIT]: [],
    [MODULES.IMPORT]: [],
  },
  WAREHOUSE_STAFF: {
    [MODULES.SALES]: [],
    [MODULES.INVENTORY]: ["view"],
    [MODULES.FINANCE]: [],
    [MODULES.HR]: ["view"],
    [MODULES.EXPENSES]: [],
    [MODULES.DELIVERY]: ["view"],
    [MODULES.WAREHOUSE]: ["view", "create", "update"],
    [MODULES.SETTINGS]: [],
    [MODULES.AUDIT]: [],
    [MODULES.IMPORT]: [],
  },
};

/**
 * Checks whether a given role has permission to perform an action
 * on a specific module using the default permission matrix.
 */
export function hasPermission(
  role: UserRole,
  module: string,
  action: string
): boolean {
  const rolePerms = DEFAULT_PERMISSIONS[role];
  if (!rolePerms) return false;
  const modulePerms = rolePerms[module];
  if (!modulePerms) return false;
  return modulePerms.includes(action);
}
