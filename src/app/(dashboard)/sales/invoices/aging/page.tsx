"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AgingBucket {
  label: string;
  count: number;
  amount: number;
}

export default function AgingReportPage() {
  const t = useTranslations("invoices");
  const router = useRouter();

  const [buckets, setBuckets] = useState<AgingBucket[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAging = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/invoices/aging");
      const json = await res.json();
      if (json.success) setBuckets(json.data);
    } catch {
      toast.error("Failed to load aging report");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAging();
  }, [fetchAging]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val);

  const labelMap: Record<string, string> = {
    current: t("current"),
    "1-30": t("days30"),
    "31-60": t("days60"),
    "61-90": t("days90"),
    "91-120": t("days120"),
    "120+": t("days120plus"),
  };

  const colorMap: Record<string, string> = {
    current: "bg-green-500",
    "1-30": "bg-yellow-500",
    "31-60": "bg-orange-500",
    "61-90": "bg-red-400",
    "91-120": "bg-red-500",
    "120+": "bg-red-700",
  };

  const totalOutstanding = buckets.reduce((sum, b) => sum + b.amount, 0);
  const maxAmount = Math.max(...buckets.map((b) => b.amount), 1);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("agingReport")}
        actions={
          <Button variant="outline" onClick={() => router.push("/sales/invoices")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Invoices
          </Button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t("totalOutstanding")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{formatCurrency(totalOutstanding)}</p>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {buckets.map((bucket) => (
              <Card key={bucket.label}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">{labelMap[bucket.label] || bucket.label}</span>
                    <span className="text-sm text-muted-foreground">{bucket.count} invoices</span>
                  </div>
                  <p className="text-2xl font-bold">{formatCurrency(bucket.amount)}</p>
                  <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${colorMap[bucket.label] || "bg-gray-500"}`}
                      style={{ width: `${Math.max((bucket.amount / maxAmount) * 100, 2)}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
