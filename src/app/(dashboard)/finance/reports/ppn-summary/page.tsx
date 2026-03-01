"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PPNDetail {
  type: "output" | "input";
  referenceType: string;
  referenceId: string;
  amount: number;
  date: string;
}

interface PPNSummaryData {
  outputPpn: number;
  inputPpn: number;
  netPpn: number;
  details: PPNDetail[];
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(val);

export default function PPNSummaryPage() {
  const t = useTranslations("reports");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [data, setData] = useState<PPNSummaryData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    if (!dateFrom || !dateTo) {
      toast.error(t("selectDateRange"));
      return;
    }
    try {
      setLoading(true);
      const params = new URLSearchParams({ dateFrom, dateTo });
      const res = await fetch(`/api/reports/ppn-summary?${params}`);
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
        title={t("ppnSummary")}
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
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t("outputPpn")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {formatCurrency(data.outputPpn ?? 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t("inputPpn")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {formatCurrency(data.inputPpn ?? 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t("netPpn")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p
                  className={`text-2xl font-bold ${
                    (data.netPpn ?? 0) >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {formatCurrency(data.netPpn ?? 0)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t("ppnDetails")}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("type")}</TableHead>
                    <TableHead>{t("reference")}</TableHead>
                    <TableHead className="text-right">{t("amount")}</TableHead>
                    <TableHead>{t("date")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data.details ?? []).map((detail, idx) => (
                    <TableRow key={`${detail.referenceId}-${idx}`}>
                      <TableCell>
                        <Badge
                          variant={
                            detail.type === "output" ? "default" : "secondary"
                          }
                        >
                          {detail.type === "output"
                            ? t("output")
                            : t("input")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {detail.referenceType} #{detail.referenceId}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(detail.amount)}
                      </TableCell>
                      <TableCell>
                        {format(new Date(detail.date), "dd MMM yyyy")}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(data.details ?? []).length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-muted-foreground py-8"
                      >
                        {t("noData")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          {t("selectDateRangePrompt")}
        </div>
      )}
    </div>
  );
}
