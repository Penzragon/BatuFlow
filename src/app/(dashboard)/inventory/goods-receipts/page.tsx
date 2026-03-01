"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ColumnDef } from "@tanstack/react-table";

interface GoodsReceipt {
  id: string;
  receiptNumber: string;
  supplierName: string;
  receiptDate: string;
  status: string;
  warehouse: { id: string; name: string };
  creator: { id: string; name: string };
  _count: { lines: number };
  createdAt: string;
}

interface Warehouse {
  id: string;
  name: string;
}

interface Product {
  id: string;
  sku: string;
  name: string;
}

interface LineForm {
  productId: string;
  expectedQty: string;
  receivedQty: string;
  condition: "GOOD" | "DAMAGED" | "SHORT";
  newCost: string;
  notes: string;
}

export default function GoodsReceiptsPage() {
  const t = useTranslations("goodsReceipts");
  const tc = useTranslations("common");
  const router = useRouter();

  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [supplierName, setSupplierName] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [receiptDate, setReceiptDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineForm[]>([{ productId: "", expectedQty: "0", receivedQty: "0", condition: "GOOD", newCost: "", notes: "" }]);

  const fetchReceipts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/goods-receipts?pageSize=200");
      const data = await res.json();
      if (data.success) setReceipts(data.data.items);
    } catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  }, []);

  const fetchMasterData = useCallback(async () => {
    const [wRes, pRes] = await Promise.all([
      fetch("/api/warehouses?pageSize=100"),
      fetch("/api/products?pageSize=500"),
    ]);
    const [wData, pData] = await Promise.all([wRes.json(), pRes.json()]);
    // Warehouses API returns { data: array }; products API returns { data: { items } }
    if (wData.success && wData.data) {
      setWarehouses(Array.isArray(wData.data) ? wData.data : wData.data.items ?? []);
    }
    if (pData.success && pData.data) {
      setProducts(Array.isArray(pData.data) ? pData.data : pData.data.items ?? []);
    }
  }, []);

  useEffect(() => { fetchReceipts(); fetchMasterData(); }, [fetchReceipts, fetchMasterData]);

  const addLine = () => setLines([...lines, { productId: "", expectedQty: "0", receivedQty: "0", condition: "GOOD", newCost: "", notes: "" }]);
  const removeLine = (idx: number) => setLines(lines.filter((_, i) => i !== idx));
  const updateLine = (idx: number, field: keyof LineForm, value: string) => {
    const newLines = [...lines];
    newLines[idx] = { ...newLines[idx], [field]: value };
    setLines(newLines);
  };

  const handleSubmit = async () => {
    if (!supplierName.trim() || !warehouseId) return toast.error("Supplier name and warehouse are required");
    if (lines.some(l => !l.productId)) return toast.error("All lines must have a product selected");
    setSubmitting(true);
    try {
      const payload = {
        supplierName,
        warehouseId,
        receiptDate,
        notes: notes || undefined,
        lines: lines.map(l => ({
          productId: l.productId,
          expectedQty: parseFloat(l.expectedQty) || 0,
          receivedQty: parseFloat(l.receivedQty) || 0,
          condition: l.condition,
          newCost: l.newCost ? parseFloat(l.newCost) : undefined,
          notes: l.notes || undefined,
        })),
      };
      const res = await fetch("/api/goods-receipts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success(t("created"));
      setFormOpen(false);
      fetchReceipts();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally { setSubmitting(false); }
  };

  const columns: ColumnDef<GoodsReceipt>[] = [
    {
      accessorKey: "receiptNumber",
      header: t("receiptNumber"),
      cell: ({ row }) => (
        <button className="font-mono text-sm font-medium text-primary underline" onClick={() => router.push(`/inventory/goods-receipts/${row.original.id}`)}>
          {row.original.receiptNumber}
        </button>
      ),
    },
    { accessorKey: "supplierName", header: t("supplierName") },
    { accessorKey: "warehouse.name", header: t("warehouse"), cell: ({ row }) => row.original.warehouse.name },
    { accessorKey: "receiptDate", header: t("receiptDate"), cell: ({ row }) => format(new Date(row.original.receiptDate), "dd/MM/yyyy") },
    { accessorKey: "status", header: t("status"), cell: ({ row }) => <StatusBadge status={row.original.status.toLowerCase()} /> },
    { accessorKey: "_count.lines", header: "Items", cell: ({ row }) => row.original._count.lines },
  ];

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} actions={
        <Button onClick={() => { setSupplierName(""); setWarehouseId(""); setNotes(""); setLines([{ productId: "", expectedQty: "0", receivedQty: "0", condition: "GOOD", newCost: "", notes: "" }]); setFormOpen(true); }}>
          <Plus size={16} className="mr-1" />{t("createReceipt")}
        </Button>
      } />
      <div className="p-6">
        <DataTable columns={columns} data={receipts} isLoading={loading} searchKey="receiptNumber" />
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("createReceipt")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("supplierName")}</Label>
                <Input value={supplierName} onChange={e => setSupplierName(e.target.value)} />
              </div>
              <div>
                <Label>{t("warehouse")}</Label>
                <Select value={warehouseId} onValueChange={setWarehouseId}>
                  <SelectTrigger><SelectValue placeholder={t("warehouse")} /></SelectTrigger>
                  <SelectContent>
                    {(warehouses ?? []).map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("receiptDate")}</Label>
                <Input type="date" value={receiptDate} onChange={e => setReceiptDate(e.target.value)} />
              </div>
              <div>
                <Label>{t("notes")}</Label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>

            <div>
              <Label className="mb-2 block">{t("lines")}</Label>
              {lines.map((line, idx) => (
                <div key={idx} className="mb-3 rounded border p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">{t("product")}</Label>
                      <Select value={line.productId} onValueChange={v => updateLine(idx, "productId", v)}>
                        <SelectTrigger><SelectValue placeholder={t("product")} /></SelectTrigger>
                        <SelectContent>
                          {(products ?? []).map(p => <SelectItem key={p.id} value={p.id}>{p.sku} - {p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">{t("condition")}</Label>
                      <Select value={line.condition} onValueChange={v => updateLine(idx, "condition", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GOOD">{t("good")}</SelectItem>
                          <SelectItem value="DAMAGED">{t("damaged")}</SelectItem>
                          <SelectItem value="SHORT">{t("short")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">{t("expectedQty")}</Label>
                      <Input type="number" value={line.expectedQty} onChange={e => updateLine(idx, "expectedQty", e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">{t("receivedQty")}</Label>
                      <Input type="number" value={line.receivedQty} onChange={e => updateLine(idx, "receivedQty", e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">{t("newCost")}</Label>
                      <Input type="number" value={line.newCost} onChange={e => updateLine(idx, "newCost", e.target.value)} placeholder="Optional" />
                    </div>
                  </div>
                  {lines.length > 1 && (
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeLine(idx)}>Remove</Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addLine}>+ Add Line</Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>{tc("cancel")}</Button>
            <Button onClick={handleSubmit} disabled={submitting}>{submitting ? tc("loading") : tc("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
