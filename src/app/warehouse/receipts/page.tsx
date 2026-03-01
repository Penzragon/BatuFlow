"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface ReceiptCard {
  id: string;
  receiptNumber: string;
  supplierName: string;
  receiptDate: string;
  status: string;
  warehouse: { name: string };
  _count: { lines: number };
}

interface Warehouse { id: string; name: string; }
interface Product { id: string; sku: string; name: string; }

interface LineForm {
  productId: string;
  expectedQty: string;
  receivedQty: string;
}

export default function WarehouseReceiptsPage() {
  const t = useTranslations("goodsReceipts");
  const tc = useTranslations("common");
  const router = useRouter();

  const [items, setItems] = useState<ReceiptCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [supplierName, setSupplierName] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [lines, setLines] = useState<LineForm[]>([{ productId: "", expectedQty: "0", receivedQty: "0" }]);

  const fetchReceipts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/goods-receipts?pageSize=50");
      const data = await res.json();
      if (data.success) setItems(data.data.items);
    } catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  }, []);

  const fetchMasterData = useCallback(async () => {
    const [wRes, pRes] = await Promise.all([
      fetch("/api/warehouses?pageSize=100"),
      fetch("/api/products?pageSize=500"),
    ]);
    const [wData, pData] = await Promise.all([wRes.json(), pRes.json()]);
    if (wData.success && wData.data) {
      setWarehouses(Array.isArray(wData.data) ? wData.data : wData.data.items ?? []);
    }
    if (pData.success && pData.data) {
      setProducts(Array.isArray(pData.data) ? pData.data : pData.data.items ?? []);
    }
  }, []);

  useEffect(() => { fetchReceipts(); fetchMasterData(); }, [fetchReceipts, fetchMasterData]);

  const addLine = () => setLines([...lines, { productId: "", expectedQty: "0", receivedQty: "0" }]);
  const updateLine = (idx: number, field: keyof LineForm, value: string) => {
    const newLines = [...lines];
    newLines[idx] = { ...newLines[idx], [field]: value };
    setLines(newLines);
  };

  const handleSubmit = async () => {
    if (!supplierName.trim() || !warehouseId) return toast.error("Supplier and warehouse required");
    setSubmitting(true);
    try {
      const payload = {
        supplierName,
        warehouseId,
        receiptDate: format(new Date(), "yyyy-MM-dd"),
        lines: lines.map(l => ({
          productId: l.productId,
          expectedQty: parseFloat(l.expectedQty) || 0,
          receivedQty: parseFloat(l.receivedQty) || 0,
        })),
      };
      const res = await fetch("/api/goods-receipts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success(t("created"));
      setFormOpen(false);
      fetchReceipts();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Error"); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="flex h-64 items-center justify-center text-muted-foreground">Loading...</div>;

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">{t("title")}</h1>
        <Button size="sm" onClick={() => { setSupplierName(""); setWarehouseId(""); setLines([{ productId: "", expectedQty: "0", receivedQty: "0" }]); setFormOpen(true); }}>
          <Plus size={14} className="mr-1" />New
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">{t("noReceipts")}</p>
      ) : (
        items.map(r => (
          <Card key={r.id} className="cursor-pointer hover:bg-muted/30" onClick={() => router.push(`/warehouse/receipts/${r.id}`)}>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-sm font-bold">{r.receiptNumber}</p>
                  <p className="text-xs text-muted-foreground">{r.supplierName}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(r.receiptDate), "dd/MM/yyyy")}</p>
                </div>
                <StatusBadge status={r.status.toLowerCase()} />
              </div>
              <Badge variant="outline" className="mt-2 text-xs">{r._count.lines} items</Badge>
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("createReceipt")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("supplierName")}</Label>
              <Input value={supplierName} onChange={e => setSupplierName(e.target.value)} />
            </div>
            <div>
              <Label>{t("warehouse")}</Label>
              <Select value={warehouseId} onValueChange={setWarehouseId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(warehouses ?? []).map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {lines.map((line, idx) => (
              <div key={idx} className="rounded border p-2 space-y-2">
                <Select value={line.productId} onValueChange={v => updateLine(idx, "productId", v)}>
                  <SelectTrigger><SelectValue placeholder="Product" /></SelectTrigger>
                  <SelectContent>
                    {(products ?? []).map(p => <SelectItem key={p.id} value={p.id}>{p.sku} - {p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Expected</Label>
                    <Input type="number" value={line.expectedQty} onChange={e => updateLine(idx, "expectedQty", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Received</Label>
                    <Input type="number" value={line.receivedQty} onChange={e => updateLine(idx, "receivedQty", e.target.value)} />
                  </div>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addLine}>+ Add Line</Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>{tc("cancel")}</Button>
            <Button onClick={handleSubmit} disabled={submitting}>{submitting ? tc("loading") : tc("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
