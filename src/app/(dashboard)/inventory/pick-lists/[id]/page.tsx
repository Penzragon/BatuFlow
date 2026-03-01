"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowLeft, Play, PackageCheck, Hand, Printer } from "lucide-react";
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

interface PickLine {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  qtyRequired: number;
  qtyPicked: number;
  isShortPicked: boolean;
  notes: string | null;
}

interface PickListDetail {
  id: string;
  pickListNumber: string;
  status: string;
  deliveryOrder: {
    id: string;
    doNumber: string;
    salesOrder: { id: string; soNumber: string; customer: { id: string; name: string } };
  };
  creator: { id: string; name: string };
  assignee: { id: string; name: string } | null;
  lines: PickLine[];
}

export default function PickListDetailPage() {
  const t = useTranslations("pickLists");
  const tc = useTranslations("common");
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [pl, setPl] = useState<PickListDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<"start" | "pack" | "ready" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [editingLine, setEditingLine] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");

  const fetchPL = useCallback(async () => {
    try {
      const res = await fetch(`/api/pick-lists/${id}`);
      const data = await res.json();
      if (data.success) setPl(data.data);
    } catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchPL(); }, [fetchPL]);

  const handleAction = async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      const urlMap: Record<string, string> = {
        start: `/api/pick-lists/${id}/start-picking`,
        pack: `/api/pick-lists/${id}/complete-packing`,
        ready: `/api/pick-lists/${id}/ready-for-handover`,
      };
      const res = await fetch(urlMap[confirmAction], { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      const msgs: Record<string, string> = { start: t("pickingStarted"), pack: t("packingCompleted"), ready: t("readyForHandoverSuccess") };
      toast.success(msgs[confirmAction]);
      setConfirmAction(null);
      fetchPL();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally { setActionLoading(false); }
  };

  const handleUpdateLine = async (lineId: string) => {
    try {
      const res = await fetch(`/api/pick-lists/${id}/lines/${lineId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qtyPicked: parseFloat(editQty) || 0 }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success("Line updated");
      setEditingLine(null);
      fetchPL();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center text-muted-foreground">{tc("loading")}...</div>;
  if (!pl) return null;

  const actionLabels: Record<string, { title: string; desc: string }> = {
    start: { title: t("startPicking"), desc: t("startMessage") },
    pack: { title: t("completePacking"), desc: t("packMessage") },
    ready: { title: t("markReady"), desc: t("readyMessage") },
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/inventory/pick-lists")}>
            <ArrowLeft size={16} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{pl.pickListNumber}</h1>
            <p className="text-sm text-muted-foreground">DO: {pl.deliveryOrder.doNumber} — {pl.deliveryOrder.salesOrder.customer.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" asChild>
            <Link href={`/inventory/pick-lists/${pl.id}/print`} target="_blank" rel="noopener noreferrer" title="Print">
              <Printer size={16} />
            </Link>
          </Button>
          <StatusBadge status={pl.status.toLowerCase().replace(/_/g, "_")} />
          {pl.status === "CREATED" && (
            <Button onClick={() => setConfirmAction("start")}><Play size={14} className="mr-1" />{t("startPicking")}</Button>
          )}
          {pl.status === "PICKING" && (
            <Button onClick={() => setConfirmAction("pack")}><PackageCheck size={14} className="mr-1" />{t("completePacking")}</Button>
          )}
          {pl.status === "PACKED" && (
            <Button onClick={() => setConfirmAction("ready")}><Hand size={14} className="mr-1" />{t("markReady")}</Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">{t("assignedTo")}</p>
            <p className="font-medium">{pl.assignee?.name ?? "Unassigned"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">SO</p>
            <p className="font-medium">{pl.deliveryOrder.salesOrder.soNumber}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("lines")} ({pl.lines.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("product")}</TableHead>
                <TableHead className="text-right">{t("qtyRequired")}</TableHead>
                <TableHead className="text-right">{t("qtyPicked")}</TableHead>
                <TableHead>{t("shortPicked")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pl.lines.map(line => (
                <TableRow key={line.id}>
                  <TableCell>
                    <p className="font-medium">{line.productName}</p>
                    <p className="text-xs text-muted-foreground">{line.productSku}</p>
                  </TableCell>
                  <TableCell className="text-right">{line.qtyRequired}</TableCell>
                  <TableCell className="text-right">
                    {editingLine === line.id ? (
                      <div className="flex items-center gap-1 justify-end">
                        <Input type="number" className="w-20 h-8 text-right" value={editQty} onChange={e => setEditQty(e.target.value)} />
                        <Button size="sm" variant="outline" onClick={() => handleUpdateLine(line.id)}>OK</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingLine(null)}>✕</Button>
                      </div>
                    ) : (
                      <span className="font-medium">{line.qtyPicked}</span>
                    )}
                  </TableCell>
                  <TableCell>{line.isShortPicked && <Badge variant="destructive">Short</Badge>}</TableCell>
                  <TableCell>
                    {["CREATED", "PICKING"].includes(pl.status) && editingLine !== line.id && (
                      <Button size="sm" variant="ghost" onClick={() => { setEditingLine(line.id); setEditQty(String(line.qtyPicked)); }}>
                        {tc("edit")}
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
            <DialogTitle>{confirmAction ? actionLabels[confirmAction].title : ""}</DialogTitle>
            <DialogDescription>{confirmAction ? actionLabels[confirmAction].desc : ""}</DialogDescription>
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
