"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PayrollRun {
  id: string;
  periodMonth: number;
  periodYear: number;
  status: string;
  totalAmount: number;
  createdAt: string;
  creator?: { name: string };
}

const formatIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

const MONTHS = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: format(new Date(2000, i, 1), "MMMM") }));

export default function PayrollPage() {
  const t = useTranslations("payroll");
  const tc = useTranslations("common");

  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [periodMonth, setPeriodMonth] = useState(new Date().getMonth() + 1);
  const [periodYear, setPeriodYear] = useState(new Date().getFullYear());
  const router = useRouter();

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/payroll?page=1&pageSize=100");
      const json = await res.json();
      if (json.success) setRuns(json.data?.items ?? []);
    } catch {
      toast.error("Failed to load payroll");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodMonth, periodYear }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Payroll run created");
        setCreateOpen(false);
        router.push(`/hr/payroll/${json.data.id}`);
      } else {
        toast.error(json.error ?? "Failed to create");
      }
    } catch {
      toast.error("Failed to create");
    } finally {
      setCreating(false);
    }
  };

  const columns: ColumnDef<PayrollRun, unknown>[] = [
    {
      accessorKey: "period",
      header: t("period"),
      cell: ({ row }) => `${row.original.periodYear}-${String(row.original.periodMonth).padStart(2, "0")}`,
    },
    { accessorKey: "status", header: t("status"), cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    {
      accessorKey: "totalAmount",
      header: t("totalAmount"),
      cell: ({ row }) => formatIDR(row.original.totalAmount),
    },
    {
      id: "actions",
      header: tc("actions"),
      cell: ({ row }) => (
        <Button variant="outline" size="sm" onClick={() => router.push(`/hr/payroll/${row.original.id}`)}>
          View
        </Button>
      ),
    },
  ];

  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("createRun")}
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={runs}
        searchKey="period"
        searchPlaceholder={t("searchPlaceholder")}
        isLoading={loading}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("createRun")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>{t("periodYear")}</Label>
              <Select value={String(periodYear)} onValueChange={(v) => setPeriodYear(parseInt(v, 10))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("periodMonth")}</Label>
              <Select value={String(periodMonth)} onValueChange={(v) => setPeriodMonth(parseInt(v, 10))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (
                    <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{tc("cancel")}</Button>
            <Button onClick={handleCreate} disabled={creating}>{creating ? tc("loading") : tc("create")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
