"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useTranslations } from "next-intl";
import { ColumnDef } from "@tanstack/react-table";
import { Search, Funnel, CalendarDays } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type TxType = "EXPENSE" | "RECEIPT";

type CombinedTx = {
  id: string;
  type: TxType;
  number: string;
  date: string;
  category: string;
  amount: number;
  status: string;
  owner: string;
};

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val);

export default function CashflowTransactionsPage() {
  const tNav = useTranslations("nav");
  const [items, setItems] = useState<CombinedTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"ALL" | TxType>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [expRes, recRes] = await Promise.all([
          fetch("/api/expenses?page=1&pageSize=500"),
          fetch("/api/receipts?page=1&pageSize=500"),
        ]);
        const [expJson, recJson] = await Promise.all([expRes.json(), recRes.json()]);

        const expenses: CombinedTx[] = (expJson?.data?.items ?? []).map((e: any) => ({
          id: e.id,
          type: "EXPENSE",
          number: e.expenseNumber,
          date: e.expenseDate,
          category: e.category?.name ?? "-",
          amount: e.amount ?? 0,
          status: e.status ?? "-",
          owner: e.submitter?.name ?? "-",
        }));

        const receipts: CombinedTx[] = (recJson?.data?.items ?? []).map((r: any) => ({
          id: r.id,
          type: "RECEIPT",
          number: r.receiptNumber,
          date: r.receiptDate,
          category: r.category?.name ?? "-",
          amount: r.amount ?? 0,
          status: r.status ?? "-",
          owner: r.submitter?.name ?? "-",
        }));

        setItems([...expenses, ...receipts]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (type !== "ALL" && it.type !== type) return false;
      if (dateFrom && new Date(it.date) < new Date(dateFrom)) return false;
      if (dateTo && new Date(it.date) > new Date(`${dateTo}T23:59:59`)) return false;
      if (!q) return true;
      return [it.number, it.category, it.owner, it.status].join(" ").toLowerCase().includes(q);
    });
  }, [items, search, type, dateFrom, dateTo]);

  const columns: ColumnDef<CombinedTx>[] = [
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => format(new Date(row.original.date), "dd MMM yyyy"),
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => (
        <Badge className={row.original.type === "EXPENSE" ? "bg-red-100 text-red-700 hover:bg-red-100" : "bg-green-100 text-green-700 hover:bg-green-100"} variant="secondary">
          {row.original.type}
        </Badge>
      ),
    },
    {
      accessorKey: "number",
      header: "Number",
      cell: ({ row }) => (
        <Link href={row.original.type === "EXPENSE" ? `/expenses/${row.original.id}` : `/receipts/${row.original.id}`} className="text-blue-600 underline">
          {row.original.number}
        </Link>
      ),
    },
    { accessorKey: "category", header: "Category" },
    { accessorKey: "owner", header: "Owner" },
    { accessorKey: "status", header: "Status" },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }) => (
        <div className={`text-right font-medium ${row.original.type === "EXPENSE" ? "text-red-600" : "text-green-600"}`}>
          {formatCurrency(row.original.amount)}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={tNav("transactions")} description="Combined list of expense and receipt transactions" />

      <Card>
        <CardContent className="pt-6 grid gap-3 md:grid-cols-10 items-end">
          <div className="md:col-span-4">
            <Label className="mb-1 flex items-center gap-1"><Search className="h-3.5 w-3.5" />Search</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search number/category/user/status..." />
          </div>
          <div className="md:col-span-2">
            <Label className="mb-1 flex items-center gap-1"><Funnel className="h-3.5 w-3.5" />Type</Label>
            <Select value={type} onValueChange={(v: "ALL" | TxType) => setType(v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="EXPENSE">Expense</SelectItem>
                <SelectItem value="RECEIPT">Receipt</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2"><Label className="mb-1 flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />From</Label><Input type="date" value={dateFrom} onChange={(e)=>setDateFrom(e.target.value)} /></div>
          <div className="md:col-span-2"><Label className="mb-1 flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />To</Label><Input type="date" value={dateTo} onChange={(e)=>setDateTo(e.target.value)} /></div>
        </CardContent>
      </Card>

      <DataTable columns={columns} data={filtered} isLoading={loading} pageSize={20} />
    </div>
  );
}
