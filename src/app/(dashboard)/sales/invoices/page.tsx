"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ColumnDef } from "@tanstack/react-table";
import { Eye, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface InvoiceItem {
  id: string;
  invoiceNumber: string;
  status: string;
  grandTotal: number;
  amountPaid: number;
  dueDate: string;
  createdAt: string;
  customer: { id: string; name: string };
  deliveryOrder: { id: string; doNumber: string; salesOrder: { id: string; soNumber: string } };
}

export default function InvoicesPage() {
  const t = useTranslations("invoices");
  const router = useRouter();

  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [sort, setSort] = useState("createdAt:desc");

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/invoices?pageSize=500");
      const json = await res.json();
      if (json.success) setInvoices(json.data.items);
    } catch {
      toast.error("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const [sb, so] = sort.split(":") as ["createdAt"|"dueDate"|"grandTotal", "asc"|"desc"];
    const dir = so === "asc" ? 1 : -1;

    return [...invoices]
      .filter((i) => {
        if (status !== "ALL" && i.status !== status) return false;
        if (!q) return true;
        return [i.invoiceNumber, i.customer?.name, i.deliveryOrder?.salesOrder?.soNumber].join(" ").toLowerCase().includes(q);
      })
      .sort((a,b) => {
        if (sb === "grandTotal") return (a.grandTotal - b.grandTotal) * dir;
        if (sb === "dueDate") return (new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()) * dir;
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
      });
  }, [invoices, search, status, sort]);

  const columns: ColumnDef<InvoiceItem>[] = useMemo(
    () => [
      {
        accessorKey: "invoiceNumber",
        header: t("invoiceNumber"),
        cell: ({ row }) => (
          <button className="font-medium text-blue-600 hover:underline" onClick={() => router.push(`/sales/invoices/${row.original.id}`)}>
            {row.original.invoiceNumber}
          </button>
        ),
      },
      { id: "customer", header: t("customer"), cell: ({ row }) => row.original.customer?.name ?? "-" },
      { id: "soNumber", header: "SO", cell: ({ row }) => row.original.deliveryOrder?.salesOrder?.soNumber ?? "-" },
      { accessorKey: "status", header: t("status"), cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      { accessorKey: "grandTotal", header: t("grandTotal"), cell: ({ row }) => formatCurrency(row.original.grandTotal) },
      {
        id: "balance",
        header: t("balance"),
        cell: ({ row }) => {
          const balance = row.original.grandTotal - row.original.amountPaid;
          return <span className={balance > 0 ? "text-red-600 font-medium" : "text-green-600"}>{formatCurrency(balance)}</span>;
        },
      },
      {
        accessorKey: "dueDate",
        header: t("dueDate"),
        cell: ({ row }) => {
          const due = new Date(row.original.dueDate);
          const isOverdue = due < new Date() && !["PAID", "DRAFT"].includes(row.original.status);
          return <span className={isOverdue ? "text-red-600 font-medium" : ""}>{format(due, "dd MMM yyyy")}</span>;
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => <Button variant="ghost" size="icon" onClick={() => router.push(`/sales/invoices/${row.original.id}`)}><Eye className="h-4 w-4" /></Button>,
      },
    ],
    [t, router]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        actions={
          <Button variant="outline" onClick={() => router.push("/sales/invoices/aging")}>
            <BarChart3 className="mr-2 h-4 w-4" />
            {t("agingReport")}
          </Button>
        }
      />

      <Card><CardContent className="pt-6 grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2"><Label>Search</Label><Input value={search} onChange={(e)=>setSearch(e.target.value)} /></div>
        <div><Label>Status</Label><Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="ALL">All</SelectItem>{["DRAFT","ISSUED","PARTIALLY_PAID","PAID","OVERDUE"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Sort</Label><Select value={sort} onValueChange={setSort}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="createdAt:desc">Created ↓</SelectItem><SelectItem value="createdAt:asc">Created ↑</SelectItem><SelectItem value="dueDate:asc">Due ↑</SelectItem><SelectItem value="dueDate:desc">Due ↓</SelectItem><SelectItem value="grandTotal:desc">Amount ↓</SelectItem><SelectItem value="grandTotal:asc">Amount ↑</SelectItem></SelectContent></Select></div>
      </CardContent></Card>

      <DataTable columns={columns} data={filtered} isLoading={loading} />
    </div>
  );
}
