"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil, Trash2, Warehouse } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
interface WarehouseRow {
  id: string;
  name: string;
  address: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  _count: { locations: number };
}

export default function WarehousesPage() {
  const t = useTranslations("warehouse");
  const tc = useTranslations("common");
  const router = useRouter();

  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchWarehouses = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/warehouses");
      const json = await res.json();
      if (json.success) setWarehouses(json.data);
    } catch {
      toast.error("Failed to load warehouses");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWarehouses();
  }, [fetchWarehouses]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/warehouses/${deleteId}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        toast.success(t("deleteSuccess"));
        fetchWarehouses();
      } else {
        toast.error(json.error);
      }
    } catch {
      toast.error("Failed to delete warehouse");
    } finally {
      setDeleteId(null);
    }
  };

  const columns: ColumnDef<WarehouseRow>[] = [
    {
      accessorKey: "name",
      header: t("name"),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Warehouse className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{row.original.name}</span>
        </div>
      ),
    },
    {
      accessorKey: "address",
      header: t("address"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.address || "—"}
        </span>
      ),
    },
    {
      id: "locations",
      header: t("locations"),
      cell: ({ row }) => (
        <span>{row.original._count.locations}</span>
      ),
    },
    {
      id: "default",
      header: t("defaultWarehouse"),
      cell: ({ row }) =>
        row.original.isDefault ? (
          <Badge variant="default">{t("defaultWarehouse")}</Badge>
        ) : null,
    },
    {
      id: "status",
      header: t("status"),
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "secondary" : "outline"}>
          {row.original.isActive ? t("active") : t("inactive")}
        </Badge>
      ),
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
            onClick={() =>
              router.push(`/inventory/warehouses/${row.original.id}`)
            }
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => setDeleteId(row.original.id)}
            disabled={row.original.isDefault}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("warehouses")}
        description={t("warehousesDescription")}
        actions={
          <Button onClick={() => router.push("/inventory/warehouses/new")}>
            <Plus className="mr-2 h-4 w-4" />
            {t("addWarehouse")}
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={warehouses}
        searchKey="name"
        searchPlaceholder={`${tc("search")} ${t("warehouses").toLowerCase()}...`}
        isLoading={isLoading}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirmDeleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              {tc("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
