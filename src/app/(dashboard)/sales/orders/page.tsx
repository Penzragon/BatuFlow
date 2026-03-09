"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Eye } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SOItem {
  id: string;
  soNumber: string;
  status: string;
  grandTotal: number;
  createdAt: string;
  customer: { id: string; name: string };
  creator: { id: string; name: string };
  _count: { lines: number; deliveryOrders: number };
}

export default function SalesOrdersPage() {
  const t = useTranslations("salesOrders");
  const router = useRouter();

  const [orders, setOrders] = useState<SOItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<"createdAt" | "grandTotal" | "soNumber">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/sales-orders?pageSize=500");
      const json = await res.json();
      if (json.success) setOrders(json.data.items);
    } catch {
      toast.error("Failed to load sales orders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...orders]
      .filter((o) => {
        if (status !== "ALL" && o.status !== status) return false;
        if (dateFrom && new Date(o.createdAt) < new Date(dateFrom)) return false;
        if (dateTo && new Date(o.createdAt) > new Date(`${dateTo}T23:59:59`)) return false;
        if (!q) return true;
        return [o.soNumber, o.customer?.name, o.creator?.name].join(" ").toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const dir = sortOrder === "asc" ? 1 : -1;
        if (sortBy === "createdAt") return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
        if (sortBy === "grandTotal") return (a.grandTotal - b.grandTotal) * dir;
        return a.soNumber.localeCompare(b.soNumber) * dir;
      });
  }, [orders, search, status, dateFrom, dateTo, sortBy, sortOrder]);

  const columns: ColumnDef<SOItem>[] = useMemo(
    () => [
      {
        accessorKey: "soNumber",
        header: t("soNumber"),
        cell: ({ row }) => (
          <button className="font-medium text-blue-600 hover:underline" onClick={() => router.push(`/sales/orders/${row.original.id}`)}>
            {row.original.soNumber}
          </button>
        ),
      },
      { id: "customer", header: t("customer"), cell: ({ row }) => row.original.customer?.name ?? "-" },
      { accessorKey: "status", header: t("status"), cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      { accessorKey: "grandTotal", header: t("grandTotal"), cell: ({ row }) => formatCurrency(row.original.grandTotal) },
      { id: "createdBy", header: "Created By", cell: ({ row }) => row.original.creator?.name ?? "-" },
      { accessorKey: "createdAt", header: "Date", cell: ({ row }) => format(new Date(row.original.createdAt), "dd MMM yyyy") },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button variant="ghost" size="icon" onClick={() => router.push(`/sales/orders/${row.original.id}`)}>
            <Eye className="h-4 w-4" />
          </Button>
        ),
      },
    ],
    [t, router]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        actions={<Button onClick={() => router.push("/sales/orders/new")}><Plus className="mr-2 h-4 w-4" />{t("createOrder")}</Button>}
      />

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={loading}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                {["DRAFT","CONFIRMED","WAITING_APPROVAL","PARTIALLY_DELIVERED","FULLY_DELIVERED","CLOSED","CANCELLED"].map((s)=><SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={dateFrom} onChange={(e)=>setDateFrom(e.target.value)} className="w-[160px]" />
            <Input type="date" value={dateTo} onChange={(e)=>setDateTo(e.target.value)} className="w-[160px]" />
            <Select value={`${sortBy}:${sortOrder}`} onValueChange={(v)=>{const [sb,so]=v.split(":");setSortBy(sb as any);setSortOrder(so as any);}}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt:desc">Date ↓</SelectItem>
                <SelectItem value="createdAt:asc">Date ↑</SelectItem>
                <SelectItem value="grandTotal:desc">Amount ↓</SelectItem>
                <SelectItem value="grandTotal:asc">Amount ↑</SelectItem>
                <SelectItem value="soNumber:asc">SO # A-Z</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => { setStatus("ALL"); setDateFrom(""); setDateTo(""); setSortBy("createdAt"); setSortOrder("desc"); }}>Reset</Button>
          </div>
        }
      />
    </div>
  );
}
