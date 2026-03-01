"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, CheckCircle, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface HandoverLineItem {
  id: string;
  confirmed: boolean;
  deliveryOrder: {
    id: string;
    doNumber: string;
    salesOrder: { customer: { name: string } };
  };
}

interface HandoverDetail {
  id: string;
  status: string;
  notes: string | null;
  confirmedAt: string | null;
  trip: { id: string; tripNumber: string; tripDate: string };
  warehouseStaff: { id: string; name: string };
  driver: { id: string; name: string };
  lines: HandoverLineItem[];
}

export default function HandoverDetailPage() {
  const t = useTranslations("handovers");
  const tc = useTranslations("common");
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [handover, setHandover] = useState<HandoverDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchHandover = useCallback(async () => {
    try {
      const res = await fetch(`/api/handovers/${id}`);
      const data = await res.json();
      if (data.success) setHandover(data.data);
    } catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchHandover(); }, [fetchHandover]);

  const confirmLine = async (lineId: string) => {
    try {
      const res = await fetch(`/api/handovers/${id}/lines/${lineId}/confirm`, { method: "POST" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success(t("lineConfirmed"));
      fetchHandover();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  const completeHandover = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/handovers/${id}/confirm`, { method: "POST" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success(t("confirmedSuccess"));
      setConfirmOpen(false);
      fetchHandover();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally { setActionLoading(false); }
  };

  if (loading) return <div className="flex h-64 items-center justify-center text-muted-foreground">{tc("loading")}...</div>;
  if (!handover) return null;

  const allConfirmed = handover.lines.every(l => l.confirmed);
  const confirmedCount = handover.lines.filter(l => l.confirmed).length;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/inventory/handovers")}>
            <ArrowLeft size={16} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Handover — {handover.trip.tripNumber}</h1>
            <p className="text-sm text-muted-foreground">{handover.warehouseStaff.name} → {handover.driver.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={handover.status.toLowerCase()} />
          {handover.status === "PENDING" && allConfirmed && (
            <Button onClick={() => setConfirmOpen(true)}>
              <CheckCircle size={14} className="mr-1" />{t("confirmAll")}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">Progress</p>
          <p className="font-medium">{confirmedCount} / {handover.lines.length} confirmed</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("lines")} ({handover.lines.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("deliveryOrder")}</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {handover.lines.map(line => (
                <TableRow key={line.id}>
                  <TableCell className="font-mono text-sm">{line.deliveryOrder.doNumber}</TableCell>
                  <TableCell>{line.deliveryOrder.salesOrder.customer.name}</TableCell>
                  <TableCell>
                    {line.confirmed ? (
                      <Badge variant="default"><Check size={12} className="mr-1" />Confirmed</Badge>
                    ) : (
                      <Badge variant="secondary">Pending</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {handover.status === "PENDING" && !line.confirmed && (
                      <Button size="sm" variant="outline" onClick={() => confirmLine(line.id)}>
                        <Check size={12} className="mr-1" />{t("confirmLine")}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirmAll")}</DialogTitle>
            <DialogDescription>{t("confirmMessage")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>{tc("cancel")}</Button>
            <Button onClick={completeHandover} disabled={actionLoading}>{actionLoading ? tc("loading") : tc("confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
