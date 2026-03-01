"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
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
import { Card, CardContent } from "@/components/ui/card";

interface AccountNode {
  id: string;
  code: string;
  name: string;
  type: string;
  parentId: string | null;
  isActive: boolean;
  children: AccountNode[];
}

interface AccountFlat {
  id: string;
  code: string;
  name: string;
  type: string;
  parentId: string | null;
  isActive: boolean;
}

const ACCOUNT_TYPES = [
  { value: "ASSET", label: "Asset" },
  { value: "LIABILITY", label: "Liability" },
  { value: "EQUITY", label: "Equity" },
  { value: "REVENUE", label: "Revenue" },
  { value: "COGS", label: "COGS" },
  { value: "EXPENSE", label: "Expense" },
] as const;

const TYPE_LABELS: Record<string, string> = {
  ASSET: "Asset",
  LIABILITY: "Liability",
  EQUITY: "Equity",
  REVENUE: "Revenue",
  COGS: "COGS",
  EXPENSE: "Expense",
};

/**
 * Recursive tree node component that renders an account with
 * expand/collapse toggling and indented children via ml-6.
 */
function AccountTreeNode({
  node,
  onEdit,
  onDelete,
}: {
  node: AccountNode;
  onEdit: (account: AccountNode) => void;
  onDelete: (account: AccountNode) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 group">
        <button
          type="button"
          className="flex h-5 w-5 shrink-0 items-center justify-center"
          onClick={() => hasChildren && setExpanded(!expanded)}
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {hasChildren && (
            <ChevronRight
              className={`h-4 w-4 text-muted-foreground transition-transform ${
                expanded ? "rotate-90" : ""
              }`}
            />
          )}
        </button>

        <span className="font-mono text-sm text-muted-foreground">
          {node.code}
        </span>
        <span className="text-sm font-medium">{node.name}</span>
        <StatusBadge status={TYPE_LABELS[node.type] ?? node.type} />

        <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onEdit(node)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(node)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {hasChildren && expanded && (
        <div className="ml-6">
          {node.children.map((child) => (
            <AccountTreeNode
              key={child.id}
              node={child}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Chart of Accounts page — displays a hierarchical tree of accounts
 * with CRUD operations via dialog forms.
 */
export default function ChartOfAccountsPage() {
  const t = useTranslations("accounts");

  const [tree, setTree] = useState<AccountNode[]>([]);
  const [flatAccounts, setFlatAccounts] = useState<AccountFlat[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AccountNode | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    type: "ASSET",
    parentId: "",
  });
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<AccountNode | null>(null);
  const [deleting, setDeleting] = useState(false);

  /** Loads the account tree for display and a flat list for the parent selector. */
  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const [treeRes, flatRes] = await Promise.all([
        fetch("/api/accounts/tree"),
        fetch("/api/accounts?pageSize=200"),
      ]);

      const treeJson = await treeRes.json();
      const flatJson = await flatRes.json();

      if (treeJson.success) {
        setTree(Array.isArray(treeJson.data) ? treeJson.data : []);
      } else {
        toast.error(treeJson.error ?? t("fetchError"));
      }

      if (flatJson.success) {
        const flat = flatJson.data?.items ?? flatJson.data;
        setFlatAccounts(Array.isArray(flat) ? flat : []);
      }
    } catch {
      toast.error(t("fetchError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  function openCreateDialog() {
    setEditing(null);
    setFormData({ code: "", name: "", type: "ASSET", parentId: "" });
    setFormOpen(true);
  }

  function openEditDialog(account: AccountNode) {
    setEditing(account);
    setFormData({
      code: account.code,
      name: account.name,
      type: account.type,
      parentId: account.parentId ?? "",
    });
    setFormOpen(true);
  }

  async function handleSave() {
    if (!formData.code.trim() || !formData.name.trim()) {
      toast.error(t("validationError"));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        code: formData.code.trim(),
        name: formData.name.trim(),
        type: formData.type,
        parentId: formData.parentId || null,
      };

      const url = editing
        ? `/api/accounts/${editing.id}`
        : "/api/accounts";
      const method = editing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(editing ? t("updateSuccess") : t("createSuccess"));
        setFormOpen(false);
        fetchAccounts();
      } else {
        toast.error(data.error ?? t("saveError"));
      }
    } catch {
      toast.error(t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/accounts/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (data.success) {
        toast.success(t("deleteSuccess"));
        setDeleteTarget(null);
        fetchAccounts();
      } else {
        toast.error(data.error ?? t("deleteError"));
      }
    } catch {
      toast.error(t("deleteError"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            {t("addAccount")}
          </Button>
        }
      />

      {loading ? (
        <Card>
          <CardContent className="py-10">
            <div className="flex items-center justify-center text-sm text-muted-foreground">
              {t("loading")}
            </div>
          </CardContent>
        </Card>
      ) : tree.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16">
            <p className="text-sm text-muted-foreground">{t("emptyState")}</p>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              {t("addAccount")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-4">
            {(tree ?? []).map((node) => (
              <AccountTreeNode
                key={node.id}
                node={node}
                onEdit={openEditDialog}
                onDelete={setDeleteTarget}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? t("editAccount") : t("addAccount")}
            </DialogTitle>
            <DialogDescription>
              {editing ? t("editDescription") : t("addDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="account-code">{t("code")}</Label>
              <Input
                id="account-code"
                value={formData.code}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, code: e.target.value }))
                }
                placeholder="1000"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="account-name">{t("name")}</Label>
              <Input
                id="account-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder={t("namePlaceholder")}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="account-type">{t("type")}</Label>
              <Select
                value={formData.type}
                onValueChange={(val) =>
                  setFormData((prev) => ({ ...prev, type: val }))
                }
              >
                <SelectTrigger id="account-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((at) => (
                    <SelectItem key={at.value} value={at.value}>
                      {at.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="account-parent">{t("parentAccount")}</Label>
              <Select
                value={formData.parentId}
                onValueChange={(val) =>
                  setFormData((prev) => ({
                    ...prev,
                    parentId: val === "none" ? "" : val,
                  }))
                }
              >
                <SelectTrigger id="account-parent">
                  <SelectValue placeholder={t("noParent")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("noParent")}</SelectItem>
                  {(flatAccounts ?? [])
                    .filter((a) => !editing || a.id !== editing.id)
                    .map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.code} — {a.name}
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
              {t("cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t("saving") : editing ? t("update") : t("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteConfirmTitle")}</DialogTitle>
            <DialogDescription>
              {t("deleteConfirmMessage", {
                name: deleteTarget?.name ?? "",
                code: deleteTarget?.code ?? "",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? t("deleting") : t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
