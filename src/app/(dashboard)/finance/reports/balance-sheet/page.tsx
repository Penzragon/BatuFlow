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

interface BalanceSheetData {
  assets: { accounts: AccountLine[]; total: number };
  liabilities: { accounts: AccountLine[]; total: number };
  equity: { accounts: AccountLine[]; total: number };
  totalAssets: number;
  totalLiabilitiesAndEquity: number;
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(val);

/**
 * Renders a balance-sheet section (Assets, Liabilities, Equity)
 * with individual account lines and a subtotal.
 */
function BalanceSection({
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

export default function BalanceSheetPage() {
  const t = useTranslations("reports");

  const [dateTo, setDateTo] = useState("");
  const [data, setData] = useState<BalanceSheetData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    if (!dateTo) {
      toast.error(t("selectDate"));
      return;
    }
    try {
      setLoading(true);
      const params = new URLSearchParams({ dateTo });
      const res = await fetch(`/api/reports/balance-sheet?${params}`);
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
  }, [dateTo, t]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("balanceSheet")}
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
              <label className="text-sm font-medium">{t("asOfDate")}</label>
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
            <BalanceSection
              title={t("assets")}
              accounts={data.assets?.accounts ?? []}
              total={data.assets?.total ?? 0}
              totalLabel={t("totalAssets")}
            />

            <BalanceSection
              title={t("liabilities")}
              accounts={data.liabilities?.accounts ?? []}
              total={data.liabilities?.total ?? 0}
              totalLabel={t("totalLiabilities")}
            />

            <BalanceSection
              title={t("equity")}
              accounts={data.equity?.accounts ?? []}
              total={data.equity?.total ?? 0}
              totalLabel={t("totalEquity")}
            />

            <div className="space-y-2 border-t-2 border-double pt-4">
              <div className="flex justify-between text-lg font-bold">
                <span>{t("totalAssets")}</span>
                <span>{formatCurrency(data.totalAssets ?? 0)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>{t("totalLiabilitiesAndEquity")}</span>
                <span>{formatCurrency(data.totalLiabilitiesAndEquity ?? 0)}</span>
              </div>
              {(data.totalAssets ?? 0) !== (data.totalLiabilitiesAndEquity ?? 0) && (
                <p className="text-sm text-destructive font-medium">
                  {t("balanceSheetImbalance")}
                </p>
              )}
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
