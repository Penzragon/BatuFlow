"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";

interface Product {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  brand: string | null;
  capitalCost: number;
  sellPrice: number;
  minStock: number;
  maxStock: number;
  isActive: boolean;
}

/** Formats a number as Indonesian Rupiah without decimals. */
function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

/** Computes gross margin percentage from sell price and capital cost. */
function grossMargin(sellPrice: number, capitalCost: number) {
  if (sellPrice === 0) return "0.0";
  return (((sellPrice - capitalCost) / sellPrice) * 100).toFixed(1);
}

/**
 * Product list page – the main entry point for the Product Master module.
 * Fetches products on mount, renders them in a searchable data table with
 * Rupiah-formatted prices, gross margin, status badges, and action buttons.
 */
export default function ProductsPage() {
  const t = useTranslations("products");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/products?pageSize=100");
      const json = await res.json();
      if (json.success) setProducts(json.data.items);
    } catch {
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/products/${deleteId}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        toast.success("Product deleted");
        setProducts((prev) => prev.filter((p) => p.id !== deleteId));
      } else {
        toast.error(json.error ?? "Failed to delete");
      }
    } catch {
      toast.error("Failed to delete product");
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const columns: ColumnDef<Product, unknown>[] = useMemo(
    () => [
      { accessorKey: "sku", header: t("sku"), size: 120 },
      { accessorKey: "name", header: t("name") },
      { accessorKey: "category", header: t("category"), size: 120 },
      { accessorKey: "brand", header: t("brand"), size: 120 },
      {
        accessorKey: "capitalCost",
        header: t("capitalCost"),
        cell: ({ row }) => formatRupiah(row.original.capitalCost),
      },
      {
        accessorKey: "sellPrice",
        header: t("sellPrice"),
        cell: ({ row }) => formatRupiah(row.original.sellPrice),
      },
      {
        id: "grossMargin",
        header: t("grossMargin"),
        cell: ({ row }) => (
          <span>{grossMargin(row.original.sellPrice, row.original.capitalCost)}%</span>
        ),
      },
      {
        accessorKey: "isActive",
        header: t("active"),
        cell: ({ row }) =>
          row.original.isActive ? (
            <Badge className="bg-green-100 text-green-700 border-0">{t("active")}</Badge>
          ) : (
            <Badge className="bg-gray-100 text-gray-600 border-0">{t("inactive")}</Badge>
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
                router.push(`/inventory/products/${row.original.id}`);
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
    [t, tCommon, router]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        actions={
          <Button onClick={() => router.push("/inventory/products/new")}>
            <Plus className="mr-2 h-4 w-4" />
            {t("addProduct")}
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={products}
        searchKey="name"
        searchPlaceholder={`${tCommon("search")} ${t("name")} / ${t("sku")}...`}
        isLoading={loading}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tCommon("confirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this product? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? tCommon("loading") : tCommon("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
