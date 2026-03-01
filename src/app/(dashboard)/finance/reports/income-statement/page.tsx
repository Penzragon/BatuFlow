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

interface AccountLine {
  accountCode: string;
  accountName: string;
  amount: number;
}

interface IncomeStatementData {
  revenue: { accounts: AccountLine[]; total: number };
  cogs: { accounts: AccountLine[]; total: number };
  grossProfit: number;
  expenses: { accounts: AccountLine[]; total: number };
  netIncome: number;
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(val);

/**
 * Renders a report section (Revenue, COGS, Expenses) with
 * individual account lines and a subtotal row.
 */
function ReportSection({
  title,
  accounts,
  total,
  totalLabel,
}: {
  title: string;
  accounts: AccountLine[];
  total: number;
  totalLabel: string;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="space-y-1 pl-4">
        {accounts.map((acc) => (
          <div key={acc.accountCode} className="flex justify-between text-sm">
            <span>
              <span className="font-mono text-muted-foreground mr-2">
                {acc.accountCode}
              </span>
              {acc.accountName}
            </span>
            <span>{formatCurrency(acc.amount)}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-between border-t pt-2 font-medium">
        <span>{totalLabel}</span>
        <span>{formatCurrency(total)}</span>
      </div>
    </div>
  );
}

export default function IncomeStatementPage() {
  const t = useTranslations("reports");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [data, setData] = useState<IncomeStatementData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    if (!dateFrom || !dateTo) {
      toast.error(t("selectDateRange"));
      return;
    }
    try {
      setLoading(true);
      const params = new URLSearchParams({ dateFrom, dateTo });
      const res = await fetch(`/api/reports/income-statement?${params}`);
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
        title={t("incomeStatement")}
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
          <CardContent className="space-y-6 pt-6">
            <ReportSection
              title={t("revenue")}
              accounts={data.revenue?.accounts ?? []}
              total={data.revenue?.total ?? 0}
              totalLabel={t("totalRevenue")}
            />

            <ReportSection
              title={t("cogs")}
              accounts={data.cogs?.accounts ?? []}
              total={data.cogs?.total ?? 0}
              totalLabel={t("totalCogs")}
            />

            <div className="flex justify-between border-y py-3 text-lg font-bold">
              <span>{t("grossProfit")}</span>
              <span>{formatCurrency(data.grossProfit ?? 0)}</span>
            </div>

            <ReportSection
              title={t("operatingExpenses")}
              accounts={data.expenses?.accounts ?? []}
              total={data.expenses?.total ?? 0}
              totalLabel={t("totalExpenses")}
            />

            <div className="flex justify-between border-t-2 border-double pt-3 text-xl font-bold">
              <span>{t("netIncome")}</span>
              <span
                className={(data.netIncome ?? 0) >= 0 ? "text-green-600" : "text-red-600"}
              >
                {formatCurrency(data.netIncome ?? 0)}
              </span>
            </div>
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
