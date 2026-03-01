"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, Search } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  accountType: string;
  debit: number;
  credit: number;
  balance: number;
}

interface TrialBalanceData {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(val);

export default function TrialBalancePage() {
  const t = useTranslations("reports");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [data, setData] = useState<TrialBalanceData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    if (!dateFrom || !dateTo) {
      toast.error(t("selectDateRange"));
      return;
    }
    try {
      setLoading(true);
      const params = new URLSearchParams({ dateFrom, dateTo });
      const res = await fetch(`/api/reports/trial-balance?${params}`);
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
      <PageHeader
        title={t("trialBalance")}
        actions={
          <Button variant="outline" asChild>
            <Link href="/finance/reports">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("backToReports")}
            </Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">{t("dateFrom")}</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t("dateTo")}</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
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
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("accountCode")}</TableHead>
                  <TableHead>{t("accountName")}</TableHead>
                  <TableHead>{t("type")}</TableHead>
                  <TableHead className="text-right">{t("debit")}</TableHead>
                  <TableHead className="text-right">{t("credit")}</TableHead>
                  <TableHead className="text-right">{t("balance")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.rows ?? []).map((row) => (
                  <TableRow key={row.accountCode}>
                    <TableCell className="font-mono">{row.accountCode}</TableCell>
                    <TableCell>{row.accountName}</TableCell>
                    <TableCell>{row.accountType}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.debit)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.credit)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.balance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} className="font-semibold">
                    {t("total")}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(data.totalDebit)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(data.totalCredit)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          {t("selectDateRangePrompt")}
        </div>
      )}
    </div>
  );
}
