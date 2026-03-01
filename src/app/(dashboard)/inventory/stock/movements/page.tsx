"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { ColumnDef } from "@tanstack/react-table";

interface Movement {
  id: string;
  movementType: string;
  qty: number;
  referenceType: string | null;
  referenceId: string | null;
  notes: string | null;
  createdAt: string;
  product: { id: string; sku: string; name: string };
  warehouse: { id: string; name: string };
}

const typeStatusMap: Record<string, string> = {
  STOCK_IN: "active",
  STOCK_OUT: "failed",
  ADJUSTMENT: "maintenance",
  OPNAME: "in_use",
};

export default function StockMovementsPage() {
  const t = useTranslations("stock");
  const [items, setItems] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMovements = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stock/movements?pageSize=500");
      const data = await res.json();
      if (data.success) setItems(data.data.items);
    } catch {
      toast.error("Failed to load movements");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMovements(); }, [fetchMovements]);

  const columns: ColumnDef<Movement>[] = [
    {
      accessorKey: "createdAt",
      header: t("date"),
      cell: ({ row }) => format(new Date(row.original.createdAt), "dd/MM/yyyy HH:mm"),
    },
    { accessorKey: "product.sku", header: t("sku"), cell: ({ row }) => <span className="font-mono text-xs">{row.original.product.sku}</span> },
    { accessorKey: "product.name", header: t("product"), cell: ({ row }) => row.original.product.name },
    {
      accessorKey: "movementType",
      header: t("movementType"),
      cell: ({ row }) => <StatusBadge status={typeStatusMap[row.original.movementType] ?? "draft"} />,
    },
    {
      accessorKey: "qty",
      header: t("qty"),
      cell: ({ row }) => (
        <span className={row.original.qty > 0 ? "font-medium text-green-600" : "font-medium text-red-600"}>
          {row.original.qty > 0 ? "+" : ""}{row.original.qty}
        </span>
      ),
    },
    { accessorKey: "warehouse.name", header: t("warehouse"), cell: ({ row }) => row.original.warehouse.name },
    { accessorKey: "notes", header: t("reference"), cell: ({ row }) => row.original.notes ?? "—" },
  ];

  return (
    <>
      <PageHeader
        title={t("movements")}
        description={t("movementsDescription")}
        actions={
          <Button variant="outline" asChild>
            <Link href="/inventory/stock"><ArrowLeft size={14} className="mr-1" />{t("onHand")}</Link>
          </Button>
        }
      />
      <div className="p-6">
        <DataTable columns={columns} data={items} isLoading={loading} searchKey="product.name" />
      </div>
    </>
  );
}
