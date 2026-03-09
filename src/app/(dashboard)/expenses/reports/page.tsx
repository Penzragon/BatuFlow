"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CashflowReportData {
  summary: {
    totalExpense: number;
    totalReceipt: number;
    netCashflow: number;
    byCategory: Array<{ name: string; type: "EXPENSE" | "RECEIPT"; total: number; count: number }>;
    byUser: Array<{ name: string; totalExpense: number; totalReceipt: number; netCashflow: number; count: number }>;
  };
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(val);

export default function CashflowReportsPage() {
  const t = useTranslations("reports");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [data, setData] = useState<CashflowReportData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setData(null);
  }, [dateFrom, dateTo]);

  const fetchReport = useCallback(async () => {
    if (!dateFrom || !dateTo) {
      toast.error(t("selectDateRange"));
      return;
    }

    try {
      setLoading(true);
      const params = new URLSearchParams({ dateFrom, dateTo });
      const res = await fetch(`/api/cashflow/report?${params}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        toast.error(json.error || t("fetchError"));
      }
    } catch {
      toast.error(t("fetchError"));
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, t]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("cashflowReport")} description={t("cashflowReportDescription")} />

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateFrom">{t("dateFrom")}</Label>
              <Input id="dateFrom" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateTo">{t("dateTo")}</Label>
              <Input id="dateTo" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <Button onClick={fetchReport} disabled={loading}>
              <Search className="mr-2 h-4 w-4" />
              {t("generate")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : data ? (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            {format(new Date(dateFrom), "dd MMM yyyy")} – {format(new Date(dateTo), "dd MMM yyyy")}
          </p>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">{t("totalExpense")}</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{formatCurrency(data.summary.totalExpense)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">{t("totalReceipt")}</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{formatCurrency(data.summary.totalReceipt)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">{t("netCashflow")}</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{formatCurrency(data.summary.netCashflow)}</p></CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>{t("byCategory")}</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("categoryName")}</TableHead>
                    <TableHead>{t("type")}</TableHead>
                    <TableHead className="text-right">{t("count")}</TableHead>
                    <TableHead className="text-right">{t("total")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.summary.byCategory.map((row, idx) => (
                    <TableRow key={`${row.type}-${row.name}-${idx}`}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{row.type === "EXPENSE" ? t("expense") : t("receipt")}</TableCell>
                      <TableCell className="text-right">{row.count}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{t("byUser")}</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("userName")}</TableHead>
                    <TableHead className="text-right">{t("totalExpense")}</TableHead>
                    <TableHead className="text-right">{t("totalReceipt")}</TableHead>
                    <TableHead className="text-right">{t("netCashflow")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.summary.byUser.map((row, idx) => (
                    <TableRow key={`${row.name}-${idx}`}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.totalExpense)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.totalReceipt)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.netCashflow)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">{t("selectDateRangePrompt")}</div>
      )}
    </div>
  );
}
