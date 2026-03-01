"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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

interface ExpenseCategory {
  id: string;
  name: string;
  isActive: boolean;
  coaAccount?: { id: string; code: string; name: string };
}

interface Account {
  id: string;
  code: string;
  name: string;
}

/**
 * Expense categories management page with full CRUD operations.
 * Allows mapping each category to a Chart of Accounts entry
 * for automatic journal entry generation on expense approval.
 */
export default function ExpenseCategoriesPage() {
  const t = useTranslations("expenseCategories");
  const tc = useTranslations("common");

  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseCategory | null>(null);
  const [formData, setFormData] = useState({ name: "", coaAccountId: "" });
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ExpenseCategory | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/expense-categories?page=1&pageSize=100");
      const json = await res.json();
      if (json.success) {
        setCategories(json.data.items);
      }
    } catch {
      toast.error("Failed to load categories");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/accounts?pageSize=200");
      const json = await res.json();
      if (json.success) {
        setAccounts(json.data.items);
      }
    } catch {
      toast.error("Failed to load accounts");
    }
  }, []);

  useEffect(() => {
    fetchCategories();
    fetchAccounts();
  }, [fetchCategories, fetchAccounts]);

  function openCreateDialog() {
    setEditing(null);
    setFormData({ name: "", coaAccountId: "" });
    setFormOpen(true);
  }

  function openEditDialog(category: ExpenseCategory) {
    setEditing(category);
    setFormData({
      name: category.name,
      coaAccountId: category.coaAccount?.id ?? "",
    });
    setFormOpen(true);
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      toast.error("Category name is required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        coaAccountId: formData.coaAccountId || null,
      };

      const url = editing
        ? `/api/expense-categories/${editing.id}`
        : "/api/expense-categories";
      const method = editing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(editing ? t("updateSuccess") : t("createSuccess"));
        setFormOpen(false);
        fetchCategories();
      } else {
        toast.error(json.error || "Failed to save category");
      }
    } catch {
      toast.error("Failed to save category");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/expense-categories/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        toast.success(t("deleteSuccess"));
        setDeleteTarget(null);
        fetchCategories();
      } else {
        toast.error(json.error || "Failed to delete category");
      }
    } catch {
      toast.error("Failed to delete category");
    } finally {
      setDeleting(false);
    }
  }

  const columns: ColumnDef<ExpenseCategory>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: t("name"),
        cell: ({ row }) => (
          <span className="font-medium">{row.getValue("name")}</span>
        ),
      },
      {
        accessorKey: "coaAccount",
        header: t("coaAccount"),
        cell: ({ row }) => {
          const account = row.original.coaAccount;
          if (!account) {
            return (
              <span className="text-muted-foreground italic">
                {t("noCoaMapping")}
              </span>
            );
          }
          return (
            <span className="font-mono text-sm">
              {account.code} — {account.name}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: tc("actions"),
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => openEditDialog(row.original)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => setDeleteTarget(row.original)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [t, tc]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            {t("addCategory")}
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={categories}
        searchKey="name"
        searchPlaceholder={`${tc("search")} ${t("title").toLowerCase()}...`}
        isLoading={loading}
      />

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? t("editCategory") : t("addCategory")}
            </DialogTitle>
            <DialogDescription>
              {editing ? t("editDescription") : t("addDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="category-name">{t("name")} *</Label>
              <Input
                id="category-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder={t("namePlaceholder")}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="category-coa">{t("coaAccount")}</Label>
              <Select
                value={formData.coaAccountId}
                onValueChange={(val) =>
                  setFormData((prev) => ({
                    ...prev,
                    coaAccountId: val === "none" ? "" : val,
                  }))
                }
              >
                <SelectTrigger id="category-coa">
                  <SelectValue placeholder={t("selectAccount")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("noCoaMapping")}</SelectItem>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.code} — {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFormOpen(false)}
              disabled={saving}
            >
              {tc("cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving
                ? tc("loading")
                : editing
                  ? t("update")
                  : t("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteConfirmMessage", {
                name: deleteTarget?.name ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? tc("loading") : tc("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
