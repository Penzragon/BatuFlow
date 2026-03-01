"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Play, PackageCheck, Hand, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface PickLine {
  id: string;
  productName: string;
  productSku: string;
  qtyRequired: number;
  qtyPicked: number;
  isShortPicked: boolean;
}

interface PickListDetail {
  id: string;
  pickListNumber: string;
  status: string;
  deliveryOrder: {
    doNumber: string;
    salesOrder: { soNumber: string; customer: { name: string } };
  };
  lines: PickLine[];
}

export default function WarehousePickListDetailPage() {
  const t = useTranslations("pickLists");
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [pl, setPl] = useState<PickListDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingLine, setEditingLine] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchPL = useCallback(async () => {
    try {
      const res = await fetch(`/api/pick-lists/${id}`);
      const data = await res.json();
      if (data.success) setPl(data.data);
    } catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchPL(); }, [fetchPL]);

  const handleUpdateLine = async (lineId: string) => {
    try {
      const res = await fetch(`/api/pick-lists/${id}/lines/${lineId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qtyPicked: parseFloat(editQty) || 0 }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setEditingLine(null);
      fetchPL();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Error"); }
  };

  const handleStatusAction = async (action: "start" | "pack" | "ready") => {
    setActionLoading(true);
    const urls: Record<string, string> = {
      start: `/api/pick-lists/${id}/start-picking`,
      pack: `/api/pick-lists/${id}/complete-packing`,
      ready: `/api/pick-lists/${id}/ready-for-handover`,
    };
    try {
      const res = await fetch(urls[action], { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      const msgs: Record<string, string> = { start: t("pickingStarted"), pack: t("packingCompleted"), ready: t("readyForHandoverSuccess") };
      toast.success(msgs[action]);
      fetchPL();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Error"); }
    finally { setActionLoading(false); }
  };

  if (loading) return <div className="flex h-64 items-center justify-center text-muted-foreground">Loading...</div>;
  if (!pl) return null;

  const pickedCount = pl.lines.filter(l => l.qtyPicked > 0).length;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => router.push("/warehouse/pick-lists")}>
          <ArrowLeft size={16} />
        </Button>
        <div className="flex-1">
          <p className="font-mono font-bold">{pl.pickListNumber}</p>
          <p className="text-xs text-muted-foreground">{pl.deliveryOrder.salesOrder.customer.name}</p>
        </div>
        <StatusBadge status={pl.status.toLowerCase().replace(/_/g, "_")} />
      </div>

      <div className="flex gap-2">
        {pl.status === "CREATED" && (
          <Button size="sm" className="flex-1" onClick={() => handleStatusAction("start")} disabled={actionLoading}>
            <Play size={14} className="mr-1" />{t("startPicking")}
          </Button>
        )}
        {pl.status === "PICKING" && (
          <Button size="sm" className="flex-1" onClick={() => handleStatusAction("pack")} disabled={actionLoading}>
            <PackageCheck size={14} className="mr-1" />{t("completePacking")}
          </Button>
        )}
        {pl.status === "PACKED" && (
          <Button size="sm" className="flex-1" onClick={() => handleStatusAction("ready")} disabled={actionLoading}>
            <Hand size={14} className="mr-1" />{t("markReady")}
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">{pickedCount}/{pl.lines.length} items picked</p>

      {pl.lines.map(line => (
        <Card key={line.id}>
          <CardContent className="pt-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-sm">{line.productName}</p>
                <p className="text-xs text-muted-foreground">{line.productSku}</p>
              </div>
              {line.isShortPicked && <Badge variant="destructive" className="text-xs">Short</Badge>}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Need: {line.qtyRequired}</span>
              <span className="text-xs">|</span>
              <span className="text-xs font-medium">Picked: {line.qtyPicked}</span>
            </div>
            {["CREATED", "PICKING"].includes(pl.status) && (
              <div className="mt-2">
                {editingLine === line.id ? (
                  <div className="flex items-center gap-2">
                    <Input type="number" className="h-8 w-24" value={editQty} onChange={e => setEditQty(e.target.value)} />
                    <Button size="sm" onClick={() => handleUpdateLine(line.id)}>
                      <Check size={14} />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingLine(null)}>✕</Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => { setEditingLine(line.id); setEditQty(String(line.qtyPicked || line.qtyRequired)); }}>
                    Pick
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
