"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Account {
  id: string;
  code: string;
  name: string;
}

interface GLLine {
  id: string;
  debit: number;
  credit: number;
  description: string;
  journalEntry: {
    entryNumber: string;
    entryDate: string;
    description: string;
    referenceType: string;
  };
}

interface GLDetailData {
  account: { code: string; name: string; type: string };
  lines: GLLine[];
  totalDebit: number;
  totalCredit: number;
  balance: number;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(val);

export default function GLDetailPage() {
  const t = useTranslations("reports");

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<GLDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [accountsLoading, setAccountsLoading] = useState(true);

  useEffect(() => {
    async function loadAccounts() {
      try {
        const res = await fetch("/api/accounts?pageSize=200");
        const json = await res.json();
        if (json.success) {
          setAccounts(json.data.items ?? json.data);
        }
      } catch {
        toast.error(t("fetchError"));
      } finally {
        setAccountsLoading(false);
      }
    }
    loadAccounts();
  }, [t]);

  const fetchReport = useCallback(
    async (targetPage = 1) => {
      if (!accountId) {
        toast.error(t("selectAccount"));
        return;
      }
      if (!dateFrom || !dateTo) {
        toast.error(t("selectDateRange"));
        return;
      }
      try {
        setLoading(true);
        const params = new URLSearchParams({
          accountId,
          dateFrom,
          dateTo,
          page: String(targetPage),
          pageSize: "50",
        });
        const res = await fetch(`/api/reports/gl-detail?${params}`);
        const json = await res.json();
        if (json.success) {
          setData(json.data);
          setPage(targetPage);
        } else {
          toast.error(json.error || t("fetchError"));
        }
      } catch {
        toast.error(t("fetchError"));
      } finally {
        setLoading(false);
      }
    },
    [accountId, dateFrom, dateTo, t],
  );

  /**
   * Computes a running balance for each line, accumulating debit minus credit.
   */
  const computeRunningBalance = (lines: GLLine[]) => {
    let running = 0;
    return lines.map((line) => {
      running += line.debit - line.credit;
      return running;
    });
  };

  const runningBalances = data ? computeRunningBalance(data.lines ?? []) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("glDetail")}
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
              <label className="text-sm font-medium">{t("account")}</label>
              <Select
                value={accountId}
                onValueChange={setAccountId}
                disabled={accountsLoading}
              >
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder={t("selectAccount")} />
                </SelectTrigger>
                <SelectContent>
                  {(accounts ?? []).map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.code} - {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
            <Button onClick={() => fetchReport(1)} disabled={loading}>
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
          <CardContent className="space-y-4 pt-6">
            <div className="text-sm text-muted-foreground">
              {t("account")}: <span className="font-medium text-foreground">{data.account.code} - {data.account.name}</span>
              {" "}({data.account.type})
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("entryNumber")}</TableHead>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("description")}</TableHead>
                  <TableHead>{t("reference")}</TableHead>
                  <TableHead className="text-right">{t("debit")}</TableHead>
                  <TableHead className="text-right">{t("credit")}</TableHead>
                  <TableHead className="text-right">{t("balance")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.lines ?? []).map((line, idx) => (
                  <TableRow key={line.id}>
                    <TableCell className="font-mono">
                      {line.journalEntry.entryNumber}
                    </TableCell>
                    <TableCell>
                      {format(new Date(line.journalEntry.entryDate), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      {line.description || line.journalEntry.description}
                    </TableCell>
                    <TableCell>{line.journalEntry.referenceType}</TableCell>
                    <TableCell className="text-right">
                      {line.debit > 0 ? formatCurrency(line.debit) : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {line.credit > 0 ? formatCurrency(line.credit) : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(runningBalances[idx])}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4} className="font-semibold">
                    {t("total")}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(data.totalDebit)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(data.totalCredit)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(data.balance)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>

            {data.totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-sm text-muted-foreground">
                  {t("page")} {data.page} / {data.totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => fetchReport(page - 1)}
                  >
                    {t("previous")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= data.totalPages}
                    onClick={() => fetchReport(page + 1)}
                  >
                    {t("next")}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          {t("selectFiltersPrompt")}
        </div>
      )}
    </div>
  );
}
