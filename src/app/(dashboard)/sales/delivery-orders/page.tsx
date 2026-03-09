"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ColumnDef } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

interface DOItem { id: string; doNumber: string; status: string; createdAt: string; salesOrder: { id: string; soNumber: string; customer: { id: string; name: string } }; creator: { id: string; name: string }; _count: { lines: number }; }
interface SOLine { id: string; productId: string; productName: string; productSku: string; qty: number; uom: string; }

export default function DeliveryOrdersPage() {
  const t = useTranslations("deliveryOrders");
  const tc = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();
  const createFromSO = searchParams.get("createFrom");

  const [orders, setOrders] = useState<DOItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [sort, setSort] = useState("createdAt:desc");

  const [createOpen, setCreateOpen] = useState(false);
  const [soLines, setSOLines] = useState<(SOLine & { qtyToDeliver: number; remaining: number })[]>([]);
  const [createNotes, setCreateNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [soNumber, setSONumber] = useState("");

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/delivery-orders?pageSize=500");
      const json = await res.json();
      if (json.success) setOrders(json.data.items);
    } catch {
      toast.error("Failed to load delivery orders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => { if (createFromSO) openCreateFromSO(createFromSO); }, [createFromSO]);

  const openCreateFromSO = async (soId: string) => {
    try {
      const res = await fetch(`/api/sales-orders/${soId}`);
      const json = await res.json();
      if (!json.success) return toast.error(json.error);
      const so = json.data; setSONumber(so.soNumber);
      const deliveredQtyMap = new Map<string, number>();
      if (so.deliveryOrders) {
        for (const dOrder of so.deliveryOrders) {
          if (dOrder.status === "CONFIRMED" || dOrder.status === "DRAFT") {
            const doRes = await fetch(`/api/delivery-orders/${dOrder.id}`);
            const doJson = await doRes.json();
            if (doJson.success) for (const line of doJson.data.lines) deliveredQtyMap.set(line.productId, (deliveredQtyMap.get(line.productId) ?? 0) + line.qtyDelivered);
          }
        }
      }
      const linesWithRemaining = so.lines.map((line: SOLine) => {
        const delivered = deliveredQtyMap.get(line.productId) ?? 0;
        const remaining = line.qty - delivered;
        return { ...line, remaining, qtyToDeliver: remaining > 0 ? remaining : 0 };
      }).filter((l: { remaining: number }) => l.remaining > 0);
      if (linesWithRemaining.length === 0) return toast.error("All items have already been delivered");
      setSOLines(linesWithRemaining); setCreateOpen(true);
    } catch { toast.error("Failed to load sales order"); }
  };

  const handleCreateDO = async () => {
    if (!createFromSO || soLines.length === 0) return;
    setSubmitting(true);
    try {
      const payload = { salesOrderId: createFromSO, notes: createNotes || undefined, lines: soLines.filter((l) => l.qtyToDeliver > 0).map((l) => ({ productId: l.productId, qtyDelivered: l.qtyToDeliver })) };
      const res = await fetch("/api/delivery-orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (json.success) { toast.success(t("created")); setCreateOpen(false); router.push(`/sales/delivery-orders/${json.data.id}`); }
      else toast.error(json.error || "Failed to create delivery order");
    } catch { toast.error("Failed to create delivery order"); } finally { setSubmitting(false); }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const [sb, so] = sort.split(":") as ["createdAt"|"doNumber", "asc"|"desc"];
    const dir = so === "asc" ? 1 : -1;
    return [...orders]
      .filter((o) => {
        if (status !== "ALL" && o.status !== status) return false;
        if (!q) return true;
        return [o.doNumber, o.salesOrder?.soNumber, o.salesOrder?.customer?.name, o.creator?.name].join(" ").toLowerCase().includes(q);
      })
      .sort((a,b)=> sb === "createdAt" ? (new Date(a.createdAt).getTime()-new Date(b.createdAt).getTime())*dir : a.doNumber.localeCompare(b.doNumber)*dir);
  }, [orders, search, status, sort]);

  const columns: ColumnDef<DOItem>[] = useMemo(() => [
    { accessorKey: "doNumber", header: t("doNumber"), cell: ({ row }) => <button className="font-medium text-blue-600 hover:underline" onClick={() => router.push(`/sales/delivery-orders/${row.original.id}`)}>{row.original.doNumber}</button> },
    { id: "soNumber", header: t("salesOrder"), cell: ({ row }) => <button className="text-blue-600 hover:underline text-sm" onClick={() => router.push(`/sales/orders/${row.original.salesOrder.id}`)}>{row.original.salesOrder.soNumber}</button> },
    { id: "customer", header: "Customer", cell: ({ row }) => row.original.salesOrder?.customer?.name ?? "-" },
    { accessorKey: "status", header: t("status"), cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { accessorKey: "createdAt", header: "Date", cell: ({ row }) => format(new Date(row.original.createdAt), "dd MMM yyyy") },
    { id: "actions", header: "", cell: ({ row }) => <Button variant="ghost" size="icon" onClick={() => router.push(`/sales/delivery-orders/${row.original.id}`)}><Eye className="h-4 w-4" /></Button> },
  ], [t, router]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} />

      <Card><CardContent className="pt-6 grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2"><Label>Search</Label><Input value={search} onChange={(e)=>setSearch(e.target.value)} /></div>
        <div><Label>Status</Label><Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="ALL">All</SelectItem><SelectItem value="DRAFT">DRAFT</SelectItem><SelectItem value="CONFIRMED">CONFIRMED</SelectItem></SelectContent></Select></div>
        <div><Label>Sort</Label><Select value={sort} onValueChange={setSort}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="createdAt:desc">Date ↓</SelectItem><SelectItem value="createdAt:asc">Date ↑</SelectItem><SelectItem value="doNumber:asc">DO # A-Z</SelectItem></SelectContent></Select></div>
      </CardContent></Card>

      <DataTable columns={columns} data={filtered} isLoading={loading} />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{t("createDO")}</DialogTitle><DialogDescription>Creating from {soNumber}</DialogDescription></DialogHeader><div className="space-y-4">{soLines.map((line, idx) => (<div key={line.productId} className="flex items-center gap-3 text-sm"><div className="flex-1"><span className="font-medium">{line.productName}</span><span className="text-muted-foreground ml-1">({line.productSku})</span><div className="text-xs text-muted-foreground">{t("remainingQty")}: {line.remaining} {line.uom}</div></div><div className="w-24"><Input type="number" min={0} max={line.remaining} value={line.qtyToDeliver} onChange={(e) => { const val = Math.min(parseFloat(e.target.value) || 0, line.remaining); setSOLines((prev) => { const updated = [...prev]; updated[idx] = { ...updated[idx], qtyToDeliver: val }; return updated; }); }} /></div></div>))}<div><Label>{t("notes")}</Label><Textarea value={createNotes} onChange={(e) => setCreateNotes(e.target.value)} rows={2} /></div></div><DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>{tc("cancel")}</Button><Button onClick={handleCreateDO} disabled={submitting}>{submitting ? tc("loading") : t("createDO")}</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
