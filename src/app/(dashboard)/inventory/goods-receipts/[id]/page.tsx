"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, CheckCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

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

interface ReceiptLine {
  id: string;
  productId: string;
  expectedQty: number;
  receivedQty: number;
  condition: string;
  notes: string | null;
  newCost: number | null;
  product: { id: string; sku: string; name: string };
}

interface ReceiptDetail {
  id: string;
  receiptNumber: string;
  supplierName: string;
  receiptDate: string;
  status: string;
  notes: string | null;
  warehouse: { id: string; name: string };
  creator: { id: string; name: string };
  verifier: { id: string; name: string } | null;
  confirmer: { id: string; name: string } | null;
  verifiedAt: string | null;
  confirmedAt: string | null;
  lines: ReceiptLine[];
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v);
}

export default function GoodsReceiptDetailPage() {
  const t = useTranslations("goodsReceipts");
  const tc = useTranslations("common");
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [receipt, setReceipt] = useState<ReceiptDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<"verify" | "confirm" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchReceipt = useCallback(async () => {
    try {
      const res = await fetch(`/api/goods-receipts/${id}`);
      const data = await res.json();
      if (data.success) setReceipt(data.data);
    } catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchReceipt(); }, [fetchReceipt]);

  const handleAction = async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/goods-receipts/${id}/${confirmAction}`, { method: "POST" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success(confirmAction === "verify" ? t("verifiedSuccess") : t("confirmedSuccess"));
      setConfirmAction(null);
      fetchReceipt();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally { setActionLoading(false); }
  };

  if (loading) return <div className="flex h-64 items-center justify-center text-muted-foreground">{tc("loading")}...</div>;
  if (!receipt) return null;

  const conditionColor: Record<string, string> = { GOOD: "default", DAMAGED: "destructive", SHORT: "secondary" };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/inventory/goods-receipts")}>
            <ArrowLeft size={16} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{receipt.receiptNumber}</h1>
            <p className="text-sm text-muted-foreground">{receipt.supplierName} — {format(new Date(receipt.receiptDate), "dd MMMM yyyy")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={receipt.status.toLowerCase()} />
          {receipt.status === "DRAFT" && (
            <Button onClick={() => setConfirmAction("verify")}>
              <ShieldCheck size={14} className="mr-1" />{t("verify")}
            </Button>
          )}
          {receipt.status === "VERIFIED" && (
            <Button onClick={() => setConfirmAction("confirm")}>
              <CheckCircle size={14} className="mr-1" />{t("confirmReceipt")}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">{t("warehouse")}</p>
            <p className="font-medium">{receipt.warehouse.name}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">{t("verifiedBy")}</p>
            <p className="font-medium">{receipt.verifier?.name ?? "—"}</p>
            {receipt.verifiedAt && <p className="text-xs text-muted-foreground">{format(new Date(receipt.verifiedAt), "dd/MM/yyyy HH:mm")}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">{t("confirmedBy")}</p>
            <p className="font-medium">{receipt.confirmer?.name ?? "—"}</p>
            {receipt.confirmedAt && <p className="text-xs text-muted-foreground">{format(new Date(receipt.confirmedAt), "dd/MM/yyyy HH:mm")}</p>}
          </CardContent>
        </Card>
      </div>

      {receipt.notes && (
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">{t("notes")}</p><p>{receipt.notes}</p></CardContent></Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">{t("lines")} ({receipt.lines.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("product")}</TableHead>
                <TableHead className="text-right">{t("expectedQty")}</TableHead>
                <TableHead className="text-right">{t("receivedQty")}</TableHead>
                <TableHead>{t("condition")}</TableHead>
                <TableHead className="text-right">{t("newCost")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipt.lines.map(line => (
                <TableRow key={line.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{line.product.name}</p>
                      <p className="text-xs text-muted-foreground">{line.product.sku}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{line.expectedQty}</TableCell>
                  <TableCell className="text-right font-medium">{line.receivedQty}</TableCell>
                  <TableCell>
                    <Badge variant={conditionColor[line.condition] as "default" | "destructive" | "secondary"}>{line.condition}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{line.newCost != null ? formatCurrency(line.newCost) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmAction === "verify" ? t("verify") : t("confirmReceipt")}</DialogTitle>
            <DialogDescription>{confirmAction === "verify" ? t("verifyMessage") : t("confirmMessage")}</DialogDescription>
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
