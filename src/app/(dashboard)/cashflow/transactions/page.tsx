"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useTranslations } from "next-intl";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

        const merged = [...expenses, ...receipts].sort((a, b) => +new Date(b.date) - +new Date(a.date));
        setItems(merged);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (type !== "ALL" && it.type !== type) return false;
      if (!q) return true;
      return [it.number, it.category, it.owner, it.status].join(" ").toLowerCase().includes(q);
    });
  }, [items, search, type]);

  return (
    <div className="space-y-6">
      <PageHeader title={tNav("transactions")} description="Combined list of expense and receipt transactions" />

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Label>Search</Label>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search number/category/user/status..." />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={type} onValueChange={(v: "ALL" | TxType) => setType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="EXPENSE">Expense</SelectItem>
                  <SelectItem value="RECEIPT">Receipt</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="py-8 text-sm text-muted-foreground">Loading transactions...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Number</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">No transactions found</TableCell>
                  </TableRow>
                ) : (
                  filtered.map((it) => (
                    <TableRow key={`${it.type}-${it.id}`}>
                      <TableCell>{format(new Date(it.date), "dd MMM yyyy")}</TableCell>
                      <TableCell>{it.type}</TableCell>
                      <TableCell>
                        <Link href={it.type === "EXPENSE" ? `/expenses/${it.id}` : `/receipts/${it.id}`} className="text-blue-600 underline">
                          {it.number}
                        </Link>
                      </TableCell>
                      <TableCell>{it.category}</TableCell>
                      <TableCell>{it.owner}</TableCell>
                      <TableCell>{it.status}</TableCell>
                      <TableCell className="text-right">{formatCurrency(it.amount)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
