"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowRightLeft, TrendingUp, Package } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ColumnDef } from "@tanstack/react-table";

interface StockItem {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  baseUom: string;
  minStock: number;
  maxStock: number;
  currentQty: number;
  stockStatus: "normal" | "low" | "out_of_stock" | "overstock";
}

const statusMap: Record<string, string> = {
  normal: "active",
  low: "maintenance",
  out_of_stock: "failed",
  overstock: "in_use",
};

export default function StockOnHandPage() {
  const t = useTranslations("stock");
  const tc = useTranslations("common");
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lowOnly, setLowOnly] = useState(false);

  const fetchStock = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ pageSize: "500" });
      if (lowOnly) params.set("lowStockOnly", "true");
      const res = await fetch(`/api/stock/on-hand?${params}`);
      const data = await res.json();
      if (data.success) setItems(data.data.items);
    } catch {
      toast.error("Failed to load stock");
    } finally {
      setLoading(false);
    }
  }, [lowOnly]);

  useEffect(() => { fetchStock(); }, [fetchStock]);

  const statusLabel: Record<string, string> = {
    normal: t("normal"),
    low: t("low"),
    out_of_stock: t("outOfStock"),
    overstock: t("overstock"),
  };

  const columns: ColumnDef<StockItem>[] = [
    { accessorKey: "sku", header: t("sku"), cell: ({ row }) => <span className="font-mono text-xs">{row.original.sku}</span> },
    { accessorKey: "name", header: t("product"), cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { accessorKey: "category", header: t("category"), cell: ({ row }) => row.original.category ?? "—" },
    {
      accessorKey: "currentQty",
      header: t("currentQty"),
      cell: ({ row }) => (
        <span className={row.original.stockStatus === "low" || row.original.stockStatus === "out_of_stock" ? "font-bold text-destructive" : "font-medium"}>
          {row.original.currentQty} {row.original.baseUom}
        </span>
      ),
    },
    { accessorKey: "minStock", header: t("minStock") },
    { accessorKey: "maxStock", header: t("maxStock"), cell: ({ row }) => row.original.maxStock || "—" },
    {
      accessorKey: "stockStatus",
      header: t("stockStatus"),
      cell: ({ row }) => <StatusBadge status={statusMap[row.original.stockStatus] ?? row.original.stockStatus} />,
    },
  ];

  return (
    <>
      <PageHeader
        title={t("onHand")}
        description={t("onHandDescription")}
        actions={
          <div className="flex items-center gap-3">
            <Button variant="outline" asChild>
              <Link href="/inventory/stock/movements"><ArrowRightLeft size={14} className="mr-1" />{t("movements")}</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/inventory/stock/valuation"><TrendingUp size={14} className="mr-1" />{t("valuation")}</Link>
            </Button>
          </div>
        }
      />
      <div className="p-6">
        <div className="mb-4 flex items-center gap-3">
          <Switch id="low-only" checked={lowOnly} onCheckedChange={setLowOnly} />
          <Label htmlFor="low-only">{t("lowStockOnly")}</Label>
        </div>
        <DataTable columns={columns} data={items} isLoading={loading} searchKey="name" />
      </div>
    </>
  );
}
