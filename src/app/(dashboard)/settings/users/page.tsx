"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

const ROLES = ["ADMIN", "MANAGER", "STAFF", "DRIVER", "WAREHOUSE_STAFF"] as const;

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-red-100 text-red-700 border-0",
  MANAGER: "bg-blue-100 text-blue-700 border-0",
  STAFF: "bg-green-100 text-green-700 border-0",
  DRIVER: "bg-orange-100 text-orange-700 border-0",
  WAREHOUSE_STAFF: "bg-purple-100 text-purple-700 border-0",
};

const INITIAL_FORM = {
  name: "",
  email: "",
  password: "",
  role: "STAFF" as string,
  isActive: true,
};

/**
 * User Management page for ADMIN users.
 * Supports listing, creating, editing, and deactivating user accounts
 * via dialog modals with full form validation and toast feedback.
 */
export default function UsersPage() {
  const t = useTranslations("users");
  const tCommon = useTranslations("common");

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users?pageSize=100");
      const json = await res.json();
      if (json.success) setUsers(json.data.items);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const openCreate = () => {
    setEditingUser(null);
    setForm(INITIAL_FORM);
    setDialogOpen(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setForm({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
      isActive: user.isActive,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.email) {
      toast.error("Name and email are required");
      return;
    }
    if (!editingUser && !form.password) {
      toast.error("Password is required for new users");
      return;
    }
    if (form.password && form.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setSaving(true);
    try {
      const isEdit = !!editingUser;
      const url = isEdit ? `/api/users/${editingUser.id}` : "/api/users";
      const method = isEdit ? "PUT" : "POST";

      const payload: Record<string, unknown> = {
        name: form.name,
        email: form.email,
        role: form.role,
        isActive: form.isActive,
      };
      if (form.password) payload.password = form.password;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (json.success) {
        toast.success(isEdit ? "User updated" : "User created");
        setDialogOpen(false);
        fetchUsers();
      } else {
        toast.error(json.error ?? "Failed to save");
      }
    } catch {
      toast.error("Failed to save user");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/users/${deleteId}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        toast.success("User deactivated");
        setUsers((prev) => prev.filter((u) => u.id !== deleteId));
      } else {
        toast.error(json.error ?? "Failed to deactivate");
      }
    } catch {
      toast.error("Failed to deactivate user");
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const columns: ColumnDef<User, unknown>[] = useMemo(
    () => [
      { accessorKey: "name", header: t("name") },
      { accessorKey: "email", header: t("email") },
      {
        accessorKey: "role",
        header: t("role"),
        cell: ({ row }) => (
          <Badge className={ROLE_COLORS[row.original.role] ?? ""}>
            {row.original.role.replace("_", " ")}
          </Badge>
        ),
      },
      {
        accessorKey: "isActive",
        header: t("status"),
        cell: ({ row }) =>
          row.original.isActive ? (
            <Badge className="bg-green-100 text-green-700 border-0">
              {t("active")}
            </Badge>
          ) : (
            <Badge className="bg-gray-100 text-gray-600 border-0">
              {t("inactive")}
            </Badge>
          ),
      },
      {
        id: "actions",
        header: tCommon("actions"),
        size: 100,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                openEdit(row.original);
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteId(row.original.id);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, tCommon]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            {t("addUser")}
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={users}
        searchKey="name"
        searchPlaceholder={`${tCommon("search")} ${t("name")} / ${t("email")}...`}
        isLoading={loading}
      />

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? t("editUser") : t("addUser")}
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? "Update the user details below."
                : "Fill in the details to create a new user."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="name">{t("name")}</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="John Doe"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="john@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                {t("password")}
                {editingUser && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    (leave blank to keep current)
                  </span>
                )}
              </Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, password: e.target.value }))
                }
                placeholder={editingUser ? "••••••" : "Min 6 characters"}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">{t("role")}</Label>
              <Select
                value={form.role}
                onValueChange={(val) =>
                  setForm((prev) => ({ ...prev, role: val }))
                }
              >
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="active" className="cursor-pointer">
                {t("active")}
              </Label>
              <Switch
                id="active"
                checked={form.isActive}
                onCheckedChange={(val) =>
                  setForm((prev) => ({ ...prev, isActive: val }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? tCommon("loading") : tCommon("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tCommon("confirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate this user? They will no longer
              be able to log in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              {tCommon("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? tCommon("loading") : tCommon("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
