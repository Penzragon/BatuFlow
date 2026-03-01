"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Play, CheckCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface OpnameLine {
  id: string;
  productId: string;
  systemQty: number;
  countedQty: number | null;
  variance: number | null;
  notes: string | null;
  product: { id: string; sku: string; name: string };
}

interface OpnameDetail {
  id: string;
  opnameNumber: string;
  status: string;
  notes: string | null;
  warehouse: { id: string; name: string };
  creator: { id: string; name: string };
  counter: { id: string; name: string } | null;
  confirmer: { id: string; name: string } | null;
  confirmedAt: string | null;
  lines: OpnameLine[];
}

export default function StockOpnameDetailPage() {
  const t = useTranslations("stockOpname");
  const tc = useTranslations("common");
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [opname, setOpname] = useState<OpnameDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<"start" | "confirm" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [editingLine, setEditingLine] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");

  const fetchOpname = useCallback(async () => {
    try {
      const res = await fetch(`/api/stock-opname/${id}`);
      const data = await res.json();
      if (data.success) setOpname(data.data);
    } catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchOpname(); }, [fetchOpname]);

  const handleAction = async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      const url = confirmAction === "start" ? `/api/stock-opname/${id}/start` : `/api/stock-opname/${id}/confirm`;
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success(confirmAction === "start" ? t("countingStarted") : t("confirmedSuccess"));
      setConfirmAction(null);
      fetchOpname();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally { setActionLoading(false); }
  };

  const handleUpdateLine = async (lineId: string) => {
    try {
      const res = await fetch(`/api/stock-opname/${id}/lines/${lineId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countedQty: parseFloat(editQty) || 0 }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success("Count updated");
      setEditingLine(null);
      fetchOpname();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center text-muted-foreground">{tc("loading")}...</div>;
  if (!opname) return null;

  const countedCount = opname.lines.filter(l => l.countedQty !== null).length;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/inventory/stock-opname")}>
            <ArrowLeft size={16} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{opname.opnameNumber}</h1>
            <p className="text-sm text-muted-foreground">{opname.warehouse.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={opname.status.toLowerCase().replace(/_/g, "_")} />
          {opname.status === "DRAFT" && (
            <Button onClick={() => setConfirmAction("start")}><Play size={14} className="mr-1" />{t("startCounting")}</Button>
          )}
          {opname.status === "IN_PROGRESS" && (
            <Button onClick={() => setConfirmAction("confirm")}><CheckCircle size={14} className="mr-1" />{t("confirmOpname")}</Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">Progress</p>
          <p className="font-medium">{countedCount} / {opname.lines.length} counted</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">{t("countedBy")}</p>
          <p className="font-medium">{opname.counter?.name ?? "—"}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">{t("confirmedBy")}</p>
          <p className="font-medium">{opname.confirmer?.name ?? "—"}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("lines")} ({opname.lines.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("product")}</TableHead>
                <TableHead className="text-right">{t("systemQty")}</TableHead>
                <TableHead className="text-right">{t("countedQty")}</TableHead>
                <TableHead className="text-right">{t("variance")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {opname.lines.map(line => (
                <TableRow key={line.id}>
                  <TableCell>
                    <p className="font-medium">{line.product.name}</p>
                    <p className="text-xs text-muted-foreground">{line.product.sku}</p>
                  </TableCell>
                  <TableCell className="text-right">{line.systemQty}</TableCell>
                  <TableCell className="text-right">
                    {editingLine === line.id ? (
                      <div className="flex items-center gap-1 justify-end">
                        <Input type="number" className="w-20 h-8 text-right" value={editQty} onChange={e => setEditQty(e.target.value)} />
                        <Button size="sm" variant="outline" onClick={() => handleUpdateLine(line.id)}>OK</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingLine(null)}>✕</Button>
                      </div>
                    ) : (
                      <span className="font-medium">{line.countedQty ?? "—"}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {line.variance != null ? (
                      <span className={line.variance === 0 ? "" : line.variance > 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                        {line.variance > 0 ? "+" : ""}{line.variance}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    {["DRAFT", "IN_PROGRESS"].includes(opname.status) && editingLine !== line.id && (
                      <Button size="sm" variant="ghost" onClick={() => { setEditingLine(line.id); setEditQty(line.countedQty != null ? String(line.countedQty) : ""); }}>
                        Count
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmAction === "start" ? t("startCounting") : t("confirmOpname")}</DialogTitle>
            <DialogDescription>{confirmAction === "start" ? t("startMessage") : t("confirmMessage")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>{tc("cancel")}</Button>
            <Button onClick={handleAction} disabled={actionLoading}>{actionLoading ? tc("loading") : tc("confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
