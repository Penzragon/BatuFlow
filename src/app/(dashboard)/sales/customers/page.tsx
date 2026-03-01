"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
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

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  region: string | null;
  tier: string | null;
  paymentTermsDays: number;
  isActive: boolean;
}

/**
 * Customer list page with search, filtering, and CRUD actions.
 * Displays all customers in a paginated data table.
 */
export default function CustomersPage() {
  const t = useTranslations("customers");
  const tc = useTranslations("common");
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/customers?pageSize=100");
      const json = await res.json();
      if (json.success) {
        setCustomers(json.data.items);
      }
    } catch {
      toast.error("Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/customers/${deleteId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Customer deleted");
        fetchCustomers();
      } else {
        toast.error(json.error || "Failed to delete");
      }
    } catch {
      toast.error("Failed to delete customer");
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const columns: ColumnDef<Customer>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: t("name"),
        cell: ({ row }) => (
          <button
            className="font-medium text-left hover:underline text-blue-600"
            onClick={() =>
              router.push(`/sales/customers/${row.original.id}`)
            }
          >
            {row.getValue("name")}
          </button>
        ),
      },
      {
        accessorKey: "phone",
        header: t("phone"),
        cell: ({ row }) => row.getValue("phone") || "—",
      },
      {
        accessorKey: "email",
        header: t("email"),
        cell: ({ row }) => row.getValue("email") || "—",
      },
      {
        accessorKey: "region",
        header: t("region"),
        cell: ({ row }) => row.getValue("region") || "—",
      },
      {
        accessorKey: "tier",
        header: t("tier"),
        cell: ({ row }) => row.getValue("tier") || "—",
      },
      {
        accessorKey: "paymentTermsDays",
        header: t("paymentTerms"),
        cell: ({ row }) => `${row.getValue("paymentTermsDays")} days`,
      },
      {
        accessorKey: "isActive",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge
            status={row.getValue("isActive") ? "active" : "inactive"}
          />
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
                router.push(`/sales/customers/${row.original.id}`)
              }
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => setDeleteId(row.original.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [t, tc, router]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        actions={
          <Button onClick={() => router.push("/sales/customers/new")}>
            <Plus className="mr-2 h-4 w-4" />
            {t("addCustomer")}
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={customers}
        searchKey="name"
        searchPlaceholder={`${tc("search")} ${t("title").toLowerCase()}...`}
        isLoading={loading}
      />

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tc("confirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this customer? This action cannot
              be undone.
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
