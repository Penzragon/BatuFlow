"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

interface VisitFrequencyRow {
  customerId: string;
  customerName: string;
  visitCount: number;
  lastVisitAt: string | null;
  daysSinceLastVisit: number | null;
  avgDaysBetweenVisits: number | null;
}

interface SummaryRow {
  salespersonId: string;
  salespersonName: string;
  visitCount: number;
  periodStart: string;
  periodEnd: string;
}

export default function VisitAnalyticsPage() {
  const t = useTranslations("analytics");
  const [frequency, setFrequency] = useState<VisitFrequencyRow[]>([]);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(format(new Date(new Date().setDate(1)), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));

  const fetchFrequency = useCallback(async () => {
    try {
      const res = await fetch("/api/visit-analytics?type=frequency");
      const json = await res.json();
      if (json.success) setFrequency(json.data ?? []);
    } catch {
      setFrequency([]);
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`/api/visit-analytics?type=summary&dateFrom=${dateFrom}&dateTo=${dateTo}`);
      const json = await res.json();
      if (json.success) setSummary(json.data ?? []);
    } catch {
      setSummary([]);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchFrequency(), fetchSummary()]).finally(() => setLoading(false));
  }, [fetchFrequency, fetchSummary]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("visitFrequency")}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Visit count and last visit per customer. Sorted by visit count.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : frequency.length === 0 ? (
            <p className="text-muted-foreground">No visit data yet.</p>
          ) : (
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left font-medium">{t("customer")}</th>
                    <th className="p-3 text-right font-medium">{t("visitCount")}</th>
                    <th className="p-3 text-left font-medium">{t("lastVisit")}</th>
                    <th className="p-3 text-right font-medium">{t("daysSinceLastVisit")}</th>
                    <th className="p-3 text-right font-medium">{t("avgDaysBetween")}</th>
                  </tr>
                </thead>
                <tbody>
                  {frequency.map((row) => (
                    <tr key={row.customerId} className="border-b">
                      <td className="p-3 font-medium">{row.customerName}</td>
                      <td className="p-3 text-right">{row.visitCount}</td>
                      <td className="p-3">
                        {row.lastVisitAt
                          ? format(new Date(row.lastVisitAt), "dd MMM yyyy")
                          : "-"}
                      </td>
                      <td className="p-3 text-right">{row.daysSinceLastVisit ?? "-"}</td>
                      <td className="p-3 text-right">{row.avgDaysBetweenVisits ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle>{t("salespersonSummary")}</CardTitle>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[140px]"
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[140px]"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : summary.length === 0 ? (
            <p className="text-muted-foreground">No visits in this period.</p>
          ) : (
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left font-medium">Salesperson</th>
                    <th className="p-3 text-right font-medium">Visits</th>
                    <th className="p-3 text-left font-medium">{t("period")}</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((row) => (
                    <tr key={row.salespersonId} className="border-b">
                      <td className="p-3 font-medium">{row.salespersonName}</td>
                      <td className="p-3 text-right">{row.visitCount}</td>
                      <td className="p-3">
                        {format(new Date(row.periodStart), "dd MMM yyyy")} – {format(new Date(row.periodEnd), "dd MMM yyyy")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
