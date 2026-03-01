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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ColumnDef } from "@tanstack/react-table";

interface OpnameItem {
  id: string;
  opnameNumber: string;
  status: string;
  warehouse: { id: string; name: string };
  creator: { id: string; name: string };
  counter: { id: string; name: string } | null;
  _count: { lines: number };
  createdAt: string;
}

interface Warehouse { id: string; name: string; }
interface Product { id: string; sku: string; name: string; }

export default function StockOpnamePage() {
  const t = useTranslations("stockOpname");
  const tc = useTranslations("common");
  const router = useRouter();

  const [items, setItems] = useState<OpnameItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  const fetchOpnames = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stock-opname?pageSize=200");
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

  useEffect(() => { fetchOpnames(); fetchMasterData(); }, [fetchOpnames, fetchMasterData]);

  const toggleProduct = (productId: string) => {
    setSelectedProductIds(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  };

  const selectAll = () => {
    if (selectedProductIds.length === (products ?? []).length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds((products ?? []).map(p => p.id));
    }
  };

  const handleSubmit = async () => {
    if (!warehouseId) return toast.error("Warehouse is required");
    if (selectedProductIds.length === 0) return toast.error("Select at least one product");
    setSubmitting(true);
    try {
      const payload = { warehouseId, notes: notes || undefined, productIds: selectedProductIds };
      const res = await fetch("/api/stock-opname", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success(t("created"));
      setFormOpen(false);
      fetchOpnames();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally { setSubmitting(false); }
  };

  const columns: ColumnDef<OpnameItem>[] = [
    {
      accessorKey: "opnameNumber",
      header: t("opnameNumber"),
      cell: ({ row }) => (
        <button className="font-mono text-sm font-medium text-primary underline" onClick={() => router.push(`/inventory/stock-opname/${row.original.id}`)}>
          {row.original.opnameNumber}
        </button>
      ),
    },
    { accessorKey: "warehouse.name", header: t("warehouse"), cell: ({ row }) => row.original.warehouse.name },
    { accessorKey: "status", header: t("status"), cell: ({ row }) => <StatusBadge status={row.original.status.toLowerCase().replace(/_/g, "_")} /> },
    { accessorKey: "counter", header: t("countedBy"), cell: ({ row }) => row.original.counter?.name ?? "—" },
    { accessorKey: "_count.lines", header: "Items", cell: ({ row }) => row.original._count.lines },
    { accessorKey: "createdAt", header: "Date", cell: ({ row }) => format(new Date(row.original.createdAt), "dd/MM/yyyy") },
  ];

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} actions={
        <Button onClick={() => { setWarehouseId(""); setNotes(""); setSelectedProductIds([]); setFormOpen(true); }}>
          <Plus size={16} className="mr-1" />{t("createOpname")}
        </Button>
      } />
      <div className="p-6">
        <DataTable columns={columns} data={items} isLoading={loading} searchKey="opnameNumber" />
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("createOpname")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("warehouse")}</Label>
              <Select value={warehouseId} onValueChange={setWarehouseId}>
                <SelectTrigger><SelectValue placeholder={t("warehouse")} /></SelectTrigger>
                <SelectContent>
                  {(warehouses ?? []).map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("notes")}</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>{t("selectProducts")} ({selectedProductIds.length})</Label>
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  {selectedProductIds.length === (products ?? []).length ? "Deselect All" : t("allProducts")}
                </Button>
              </div>
              <div className="max-h-60 overflow-y-auto rounded border p-2 space-y-1">
                {(products ?? []).map(p => (
                  <label key={p.id} className="flex items-center gap-2 p-1 hover:bg-muted/50 rounded cursor-pointer">
                    <Checkbox
                      checked={selectedProductIds.includes(p.id)}
                      onCheckedChange={() => toggleProduct(p.id)}
                    />
                    <span className="text-sm">{p.sku} — {p.name}</span>
                  </label>
                ))}
              </div>
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
