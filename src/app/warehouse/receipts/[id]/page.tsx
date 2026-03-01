"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, ShieldCheck, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";

interface ReceiptLine {
  id: string;
  expectedQty: number;
  receivedQty: number;
  condition: string;
  newCost: number | null;
  product: { sku: string; name: string };
}

interface Receipt {
  id: string;
  receiptNumber: string;
  supplierName: string;
  receiptDate: string;
  status: string;
  warehouse: { name: string };
  lines: ReceiptLine[];
}

export default function WarehouseReceiptDetailPage() {
  const t = useTranslations("goodsReceipts");
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
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

  const handleAction = async (action: "verify" | "confirm") => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/goods-receipts/${id}/${action}`, { method: "POST" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success(action === "verify" ? t("verifiedSuccess") : t("confirmedSuccess"));
      fetchReceipt();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Error"); }
    finally { setActionLoading(false); }
  };

  if (loading) return <div className="flex h-64 items-center justify-center text-muted-foreground">Loading...</div>;
  if (!receipt) return null;

  const conditionColor: Record<string, "default" | "destructive" | "secondary"> = { GOOD: "default", DAMAGED: "destructive", SHORT: "secondary" };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => router.push("/warehouse/receipts")}>
          <ArrowLeft size={16} />
        </Button>
        <div className="flex-1">
          <p className="font-mono font-bold">{receipt.receiptNumber}</p>
          <p className="text-xs text-muted-foreground">{receipt.supplierName} — {format(new Date(receipt.receiptDate), "dd/MM/yyyy")}</p>
        </div>
        <StatusBadge status={receipt.status.toLowerCase()} />
      </div>

      <div className="flex gap-2">
        {receipt.status === "DRAFT" && (
          <Button size="sm" className="flex-1" onClick={() => handleAction("verify")} disabled={actionLoading}>
            <ShieldCheck size={14} className="mr-1" />{t("verify")}
          </Button>
        )}
        {receipt.status === "VERIFIED" && (
          <Button size="sm" className="flex-1" onClick={() => handleAction("confirm")} disabled={actionLoading}>
            <CheckCircle size={14} className="mr-1" />{t("confirmReceipt")}
          </Button>
        )}
      </div>

      {receipt.lines.map(line => (
        <Card key={line.id}>
          <CardContent className="pt-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-sm">{line.product.name}</p>
                <p className="text-xs text-muted-foreground">{line.product.sku}</p>
              </div>
              <Badge variant={conditionColor[line.condition]}>{line.condition}</Badge>
            </div>
            <div className="mt-2 flex items-center gap-3 text-xs">
              <span className="text-muted-foreground">Exp: {line.expectedQty}</span>
              <span className="font-medium">Recv: {line.receivedQty}</span>
              {line.newCost != null && <span className="text-muted-foreground">New Cost: {line.newCost}</span>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
