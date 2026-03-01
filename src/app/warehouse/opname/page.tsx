"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { format } from "date-fns";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface OpnameItem {
  id: string;
  opnameNumber: string;
  status: string;
  warehouse: { name: string };
  _count: { lines: number };
  createdAt: string;
}

interface OpnameLine {
  id: string;
  systemQty: number;
  countedQty: number | null;
  variance: number | null;
  product: { sku: string; name: string };
}

interface OpnameDetail {
  id: string;
  opnameNumber: string;
  status: string;
  warehouse: { name: string };
  lines: OpnameLine[];
}

export default function WarehouseOpnamePage() {
  const t = useTranslations("stockOpname");
  const [items, setItems] = useState<OpnameItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<OpnameDetail | null>(null);
  const [editingLine, setEditingLine] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");

  const fetchOpnames = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stock-opname?pageSize=50");
      const data = await res.json();
      if (data.success) setItems(data.data.items.filter((i: OpnameItem) => i.status !== "CONFIRMED"));
    } catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchOpnames(); }, [fetchOpnames]);

  const openDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/stock-opname/${id}`);
      const data = await res.json();
      if (data.success) setDetail(data.data);
    } catch { toast.error("Failed to load"); }
  };

  const handleUpdateLine = async (lineId: string) => {
    if (!detail) return;
    try {
      const res = await fetch(`/api/stock-opname/${detail.id}/lines/${lineId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countedQty: parseFloat(editQty) || 0 }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setEditingLine(null);
      openDetail(detail.id);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Error"); }
  };

  const handleStartCounting = async (id: string) => {
    try {
      const res = await fetch(`/api/stock-opname/${id}/start`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success(t("countingStarted"));
      openDetail(id);
      fetchOpnames();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Error"); }
  };

  const handleConfirm = async (id: string) => {
    try {
      const res = await fetch(`/api/stock-opname/${id}/confirm`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success(t("confirmedSuccess"));
      setDetail(null);
      fetchOpnames();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Error"); }
  };

  if (loading) return <div className="flex h-64 items-center justify-center text-muted-foreground">Loading...</div>;

  if (detail) {
    const countedCount = detail.lines.filter(l => l.countedQty !== null).length;
    return (
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setDetail(null)}>← Back</Button>
          <p className="font-mono font-bold">{detail.opnameNumber}</p>
          <StatusBadge status={detail.status.toLowerCase().replace(/_/g, "_")} />
        </div>
        <p className="text-xs text-muted-foreground">{countedCount}/{detail.lines.length} counted</p>

        <div className="flex gap-2">
          {detail.status === "DRAFT" && (
            <Button size="sm" className="flex-1" onClick={() => handleStartCounting(detail.id)}>
              {t("startCounting")}
            </Button>
          )}
          {detail.status === "IN_PROGRESS" && countedCount === detail.lines.length && (
            <Button size="sm" className="flex-1" onClick={() => handleConfirm(detail.id)}>
              {t("confirmOpname")}
            </Button>
          )}
        </div>

        {detail.lines.map(line => (
          <Card key={line.id}>
            <CardContent className="pt-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-sm">{line.product.name}</p>
                  <p className="text-xs text-muted-foreground">{line.product.sku}</p>
                </div>
                {line.variance != null && line.variance !== 0 && (
                  <Badge variant={line.variance > 0 ? "default" : "destructive"}>
                    {line.variance > 0 ? "+" : ""}{line.variance}
                  </Badge>
                )}
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs">
                <span className="text-muted-foreground">System: {line.systemQty}</span>
                <span className="font-medium">Counted: {line.countedQty ?? "—"}</span>
              </div>
              {["DRAFT", "IN_PROGRESS"].includes(detail.status) && (
                <div className="mt-2">
                  {editingLine === line.id ? (
                    <div className="flex items-center gap-2">
                      <Input type="number" className="h-8 w-24" value={editQty} onChange={e => setEditQty(e.target.value)} />
                      <Button size="sm" onClick={() => handleUpdateLine(line.id)}>OK</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingLine(null)}>✕</Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => { setEditingLine(line.id); setEditQty(line.countedQty != null ? String(line.countedQty) : ""); }}>
                      Count
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-lg font-bold">{t("title")}</h1>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">{t("noOpnames")}</p>
      ) : (
        items.map(item => (
          <Card key={item.id} className="cursor-pointer hover:bg-muted/30" onClick={() => openDetail(item.id)}>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-sm font-bold">{item.opnameNumber}</p>
                  <p className="text-xs text-muted-foreground">{item.warehouse.name}</p>
                </div>
                <StatusBadge status={item.status.toLowerCase().replace(/_/g, "_")} />
              </div>
              <Badge variant="outline" className="mt-2 text-xs">{item._count.lines} items</Badge>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
