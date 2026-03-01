"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ColumnDef } from "@tanstack/react-table";

interface ValuationItem {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  capitalCost: number;
  currentQty: number;
  totalValue: number;
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v);
}

export default function StockValuationPage() {
  const t = useTranslations("stock");
  const [items, setItems] = useState<ValuationItem[]>([]);
  const [totalValuation, setTotalValuation] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchValuation = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stock/valuation");
      const data = await res.json();
      if (data.success) {
        setItems(data.data.items);
        setTotalValuation(data.data.totalValuation);
      }
    } catch {
      toast.error("Failed to load valuation");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchValuation(); }, [fetchValuation]);

  const columns: ColumnDef<ValuationItem>[] = [
    { accessorKey: "sku", header: t("sku"), cell: ({ row }) => <span className="font-mono text-xs">{row.original.sku}</span> },
    { accessorKey: "name", header: t("product"), cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { accessorKey: "category", header: t("category"), cell: ({ row }) => row.original.category ?? "—" },
    { accessorKey: "currentQty", header: t("currentQty"), cell: ({ row }) => row.original.currentQty },
    { accessorKey: "capitalCost", header: t("capitalCost"), cell: ({ row }) => formatCurrency(row.original.capitalCost) },
    { accessorKey: "totalValue", header: t("totalValue"), cell: ({ row }) => <span className="font-medium">{formatCurrency(row.original.totalValue)}</span> },
  ];

  return (
    <>
      <PageHeader
        title={t("valuation")}
        description={t("valuationDescription")}
        actions={
          <Button variant="outline" asChild>
            <Link href="/inventory/stock"><ArrowLeft size={14} className="mr-1" />{t("onHand")}</Link>
          </Button>
        }
      />
      <div className="p-6">
        <Card className="mb-6">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">{t("totalValuation")}</p>
            <p className="text-2xl font-bold">{formatCurrency(totalValuation)}</p>
          </CardContent>
        </Card>
        <DataTable columns={columns} data={items} isLoading={loading} searchKey="name" />
      </div>
    </>
  );
}
