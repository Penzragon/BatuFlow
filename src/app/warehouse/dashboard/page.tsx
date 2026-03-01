"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { ClipboardList, Hand, PackageOpen, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";

interface DashboardData {
  pendingPickLists: number;
  pendingHandovers: number;
  todaysReceipts: number;
  lowStockProducts: { id: string; sku: string; name: string; currentQty: number; minStock: number; deficit: number }[];
}

export default function WarehouseDashboard() {
  const t = useTranslations("warehousePortal");
  const [data, setData] = useState<DashboardData | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/warehouse/dashboard");
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch { toast.error("Failed to load dashboard"); }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  if (!data) return <div className="flex h-64 items-center justify-center text-muted-foreground">Loading...</div>;

  const kpis = [
    { label: t("pendingPickLists"), value: data.pendingPickLists, icon: ClipboardList, color: "text-blue-500" },
    { label: t("pendingHandovers"), value: data.pendingHandovers, icon: Hand, color: "text-amber-500" },
    { label: t("todaysReceipts"), value: data.todaysReceipts, icon: PackageOpen, color: "text-green-500" },
    { label: t("lowStock"), value: data.lowStockProducts.length, icon: AlertTriangle, color: "text-red-500" },
  ];

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-lg font-bold">{t("dashboard")}</h1>

      <div className="grid grid-cols-2 gap-3">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label}>
              <CardContent className="pt-4 text-center">
                <Icon size={24} className={`mx-auto mb-1 ${kpi.color}`} />
                <p className="text-2xl font-bold">{kpi.value}</p>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {data.lowStockProducts.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <h2 className="text-sm font-semibold mb-2">{t("lowStock")}</h2>
            <div className="space-y-2">
              {data.lowStockProducts.map(p => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-destructive">{p.currentQty}</p>
                    <p className="text-xs text-muted-foreground">min: {p.minStock}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
