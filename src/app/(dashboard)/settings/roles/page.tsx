"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";

interface RolePermissions {
  role: string;
  permissions: Record<string, Record<string, boolean>>;
}

const ROLES = [
  "ADMIN",
  "MANAGER",
  "STAFF",
  "DRIVER",
  "WAREHOUSE_STAFF",
] as const;

const ACTIONS = [
  "view",
  "create",
  "update",
  "delete",
  "approve",
  "export",
] as const;

const MODULE_LABELS: Record<string, string> = {
  sales: "Sales",
  inventory: "Inventory",
  finance: "Finance",
  hr: "HR",
  expenses: "Expenses",
  delivery: "Delivery",
  warehouse: "Warehouse",
  settings: "Settings",
  audit: "Audit",
  import: "Import",
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-red-100 text-red-700 border-0",
  MANAGER: "bg-blue-100 text-blue-700 border-0",
  STAFF: "bg-green-100 text-green-700 border-0",
  DRIVER: "bg-orange-100 text-orange-700 border-0",
  WAREHOUSE_STAFF: "bg-purple-100 text-purple-700 border-0",
};

/**
 * Role Management page for ADMIN users.
 * Displays a permission matrix per role with toggleable switches.
 * Admin role permissions are locked (always full access).
 */
export default function RolesPage() {
  const t = useTranslations("settings");

  const [allPermissions, setAllPermissions] = useState<RolePermissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("ADMIN");
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchPermissions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/roles");
      const json = await res.json();
      if (json.success) setAllPermissions(json.data);
    } catch {
      toast.error("Failed to load permissions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const handleToggle = async (
    role: string,
    module: string,
    action: string,
    allowed: boolean
  ) => {
    const key = `${role}:${module}:${action}`;
    setUpdating(key);

    setAllPermissions((prev) =>
      prev.map((rp) => {
        if (rp.role !== role) return rp;
        return {
          ...rp,
          permissions: {
            ...rp.permissions,
            [module]: { ...rp.permissions[module], [action]: allowed },
          },
        };
      })
    );

    try {
      const res = await fetch(`/api/roles/${role}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module, action, allowed }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error ?? "Failed to update permission");
        setAllPermissions((prev) =>
          prev.map((rp) => {
            if (rp.role !== role) return rp;
            return {
              ...rp,
              permissions: {
                ...rp.permissions,
                [module]: { ...rp.permissions[module], [action]: !allowed },
              },
            };
          })
        );
      }
    } catch {
      toast.error("Failed to update permission");
      setAllPermissions((prev) =>
        prev.map((rp) => {
          if (rp.role !== role) return rp;
          return {
            ...rp,
            permissions: {
              ...rp.permissions,
              [module]: { ...rp.permissions[module], [action]: !allowed },
            },
          };
        })
      );
    } finally {
      setUpdating(null);
    }
  };

  const currentRole = allPermissions.find((rp) => rp.role === activeTab);
  const isAdmin = activeTab === "ADMIN";
  const modules = Object.keys(MODULE_LABELS);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("roleManagement")}
        description="Configure which actions each role can perform in each module."
      />

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            {ROLES.map((r) => (
              <TabsTrigger key={r} value={r} className="gap-2">
                {r.replace("_", " ")}
              </TabsTrigger>
            ))}
          </TabsList>

          {ROLES.map((role) => (
            <TabsContent key={role} value={role}>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-lg">
                      <Badge className={ROLE_COLORS[role]}>
                        {role.replace("_", " ")}
                      </Badge>
                    </CardTitle>
                  </div>
                  <CardDescription>
                    {isAdmin
                      ? "Admin has full access to all modules. These permissions cannot be changed."
                      : "Toggle permissions for each module and action."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="py-3 pr-4 text-left font-medium text-muted-foreground">
                            Module
                          </th>
                          {ACTIONS.map((action) => (
                            <th
                              key={action}
                              className="px-3 py-3 text-center font-medium capitalize text-muted-foreground"
                            >
                              {action}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {modules.map((mod) => (
                          <tr
                            key={mod}
                            className="border-b last:border-0 hover:bg-muted/30"
                          >
                            <td className="py-3 pr-4 font-medium">
                              {MODULE_LABELS[mod]}
                            </td>
                            {ACTIONS.map((action) => {
                              const allowed =
                                currentRole?.permissions[mod]?.[action] ??
                                false;
                              const key = `${role}:${mod}:${action}`;
                              return (
                                <td key={action} className="px-3 py-3 text-center">
                                  <Switch
                                    checked={allowed}
                                    onCheckedChange={(val) =>
                                      handleToggle(role, mod, action, val)
                                    }
                                    disabled={isAdmin || updating === key}
                                    className="mx-auto"
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
