"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, CheckCircle, Download } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { format } from "date-fns";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";

interface CommissionLine {
  id: string;
  invoiceAmount: number;
  profitAmount: number;
  commissionAmount: number;
  invoice: {
    id: string;
    invoiceNumber: string;
    grandTotal: number;
    issuedAt: string | null;
    customer: { name: string };
  };
}

interface CommissionDetail {
  id: string;
  periodStart: string;
  periodEnd: string;
  totalSales: number;
  totalProfit: number;
  commissionAmount: number;
  status: string;
  confirmedAt: string | null;
  salesperson: { id: string; name: string; email: string };
  rule: { type: string; rate: number | null };
  lines: CommissionLine[];
}

export default function CommissionDetailPage() {
  const t = useTranslations("commissions");
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [commission, setCommission] = useState<CommissionDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCommission = useCallback(async () => {
    try {
      const res = await fetch(`/api/commissions/${id}`);
      const json = await res.json();
      if (json.success) setCommission(json.data);
      else toast.error(json.error ?? "Commission not found");
    } catch {
      toast.error("Failed to load commission");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCommission();
  }, [fetchCommission]);

  const handleConfirm = async () => {
    try {
      const res = await fetch(`/api/commissions/${id}/confirm`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        toast.success(t("confirmed"));
        fetchCommission();
      } else {
        toast.error(json.error ?? "Failed to confirm");
      }
    } catch {
      toast.error("Failed to confirm");
    }
  };

  const handleExport = () => {
    window.open(`/api/commissions/export?ids=${id}`, "_blank");
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val);

  if (loading || !commission) {
    return (
      <div className="space-y-6">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/sales/commissions"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <PageHeader
          title={`${t("title")} — ${format(new Date(commission.periodStart), "MMM yyyy")}`}
          description={commission.salesperson.name}
          actions={
            <>
              {commission.status === "DRAFT" && (
                <Button onClick={handleConfirm}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {t("confirm")}
                </Button>
              )}
              <Button variant="outline" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                {t("exportExcel")}
              </Button>
            </>
          }
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Summary</CardTitle>
            <StatusBadge status={commission.status.toLowerCase()} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground">{t("totalSales")}</p>
              <p className="text-xl font-semibold">{formatCurrency(commission.totalSales)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("totalProfit")}</p>
              <p className="text-xl font-semibold">{formatCurrency(commission.totalProfit)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("commissionAmount")}</p>
              <p className="text-xl font-semibold text-primary">{formatCurrency(commission.commissionAmount)}</p>
            </div>
            {commission.confirmedAt && (
              <div>
                <p className="text-sm text-muted-foreground">Confirmed at</p>
                <p className="text-sm">{format(new Date(commission.confirmedAt), "dd MMM yyyy HH:mm")}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoice breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left font-medium">{t("invoiceNumber")}</th>
                  <th className="p-3 text-left font-medium">Customer</th>
                  <th className="p-3 text-left font-medium">Issued</th>
                  <th className="p-3 text-right font-medium">{t("invoiceAmount")}</th>
                  <th className="p-3 text-right font-medium">{t("profitAmount")}</th>
                  <th className="p-3 text-right font-medium">{t("lineCommission")}</th>
                </tr>
              </thead>
              <tbody>
                {(commission.lines ?? []).map((line) => (
                  <tr key={line.id} className="border-b">
                    <td className="p-3">{line.invoice?.invoiceNumber ?? "-"}</td>
                    <td className="p-3">{line.invoice?.customer?.name ?? "-"}</td>
                    <td className="p-3">
                      {line.invoice?.issuedAt
                        ? format(new Date(line.invoice.issuedAt), "dd MMM yyyy")
                        : "-"}
                    </td>
                    <td className="p-3 text-right">{formatCurrency(line.invoiceAmount)}</td>
                    <td className="p-3 text-right">{formatCurrency(line.profitAmount)}</td>
                    <td className="p-3 text-right font-medium">{formatCurrency(line.commissionAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
