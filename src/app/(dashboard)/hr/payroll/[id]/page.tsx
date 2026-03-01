"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowLeft, Check, DollarSign, Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";

interface PayrollLine {
  id: string;
  employeeId: string;
  basicSalary: number;
  allowances: number;
  deductions: number;
  bpjsKesehatan: number;
  bpjsKetenagakerjaan: number;
  pph21: number;
  absentDeduction: number;
  netPay: number;
  notes: string | null;
  employee: { id: string; name: string; nik: string | null; department: string | null };
}

interface PayrollRunDetail {
  id: string;
  periodMonth: number;
  periodYear: number;
  status: string;
  totalAmount: number;
  journalEntryId: string | null;
  lines: PayrollLine[];
  creator?: { name: string };
}

const formatIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

export default function PayrollDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations("payroll");
  const tc = useTranslations("common");

  const id = params.id as string;
  const [run, setRun] = useState<PayrollRunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [actioning, setActioning] = useState(false);
  const [downloadingLineId, setDownloadingLineId] = useState<string | null>(null);

  const fetchRun = useCallback(async () => {
    try {
      const res = await fetch(`/api/payroll/${id}`);
      const json = await res.json();
      if (json.success) setRun(json.data);
      else toast.error("Payroll run not found");
    } catch {
      toast.error("Failed to load payroll");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRun();
  }, [fetchRun]);

  const handleConfirm = async () => {
    setActioning(true);
    try {
      const res = await fetch(`/api/payroll/${id}/confirm`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        toast.success(t("confirmSuccess"));
        setConfirmOpen(false);
        fetchRun();
      } else {
        toast.error(json.error ?? "Failed to confirm");
      }
    } catch {
      toast.error("Failed to confirm");
    } finally {
      setActioning(false);
    }
  };

  const handlePay = async () => {
    setActioning(true);
    try {
      const res = await fetch(`/api/payroll/${id}/pay`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        toast.success(t("paySuccess"));
        setPayOpen(false);
        fetchRun();
      } else {
        toast.error(json.error ?? "Failed to mark as paid");
      }
    } catch {
      toast.error("Failed to mark as paid");
    } finally {
      setActioning(false);
    }
  };

  const handleDownloadPayslip = async (lineId: string) => {
    setDownloadingLineId(lineId);
    try {
      const res = await fetch(`/api/payroll/${id}/payslip/${lineId}`);
      const json = await res.json();
      if (!json.success || !json.data) {
        toast.error("Failed to load payslip data");
        return;
      }
      const { run: runData, line } = json.data as {
        run: { periodMonth: number; periodYear: number };
        line: {
          employee: { name: string; nik: string | null; department: string | null; bankAccount: string | null; bankName: string | null };
          basicSalary: number;
          allowances: number;
          deductions: number;
          bpjsKesehatan: number;
          bpjsKetenagakerjaan: number;
          pph21: number;
          absentDeduction: number;
          netPay: number;
        };
      };
      const periodLabel = `${runData.periodYear}-${String(runData.periodMonth).padStart(2, "0")}`;
      const html = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><title>Payslip ${line.employee.name} ${periodLabel}</title></head>
        <body style="font-family: system-ui; max-width: 400px; margin: 2rem auto; padding: 1rem;">
          <h2>Payslip</h2>
          <p><strong>${line.employee.name}</strong></p>
          <p>NIK: ${line.employee.nik ?? "—"} | Dept: ${line.employee.department ?? "—"}</p>
          <p>Period: ${periodLabel}</p>
          <hr/>
          <table style="width:100%; border-collapse: collapse;">
            <tr><td>Basic Salary</td><td style="text-align:right">${formatIDR(line.basicSalary)}</td></tr>
            <tr><td>Allowances</td><td style="text-align:right">${formatIDR(line.allowances)}</td></tr>
            <tr><td>Deductions</td><td style="text-align:right">${formatIDR(line.deductions)}</td></tr>
            <tr><td>BPJS Kesehatan</td><td style="text-align:right">${formatIDR(line.bpjsKesehatan)}</td></tr>
            <tr><td>BPJS Ketenagakerjaan</td><td style="text-align:right">${formatIDR(line.bpjsKetenagakerjaan)}</td></tr>
            <tr><td>PPh 21</td><td style="text-align:right">${formatIDR(line.pph21)}</td></tr>
            <tr><td>Absent Deduction</td><td style="text-align:right">${formatIDR(line.absentDeduction)}</td></tr>
          </table>
          <hr/>
          <p><strong>Net Pay: ${formatIDR(line.netPay)}</strong></p>
          ${line.employee.bankName && line.employee.bankAccount ? `<p>Bank: ${line.employee.bankName} - ${line.employee.bankAccount}</p>` : ""}
        </body>
        </html>
      `;
      const win = window.open("", "_blank");
      if (win) {
        win.document.write(html);
        win.document.close();
        win.print();
      }
    } catch {
      toast.error("Failed to generate payslip");
    } finally {
      setDownloadingLineId(null);
    }
  };

  if (loading || !run) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const periodLabel = `${run.periodYear}-${String(run.periodMonth).padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${t("title")} — ${periodLabel}`}
        description={t("description")}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/hr/payroll")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            {run.status === "DRAFT" && (
              <Button onClick={() => setConfirmOpen(true)}>
                <Check className="mr-2 h-4 w-4" />
                {t("confirm")}
              </Button>
            )}
            {run.status === "CONFIRMED" && !run.journalEntryId && (
              <Button onClick={() => setPayOpen(true)}>
                <DollarSign className="mr-2 h-4 w-4" />
                {t("markAsPaid")}
              </Button>
            )}
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{t("period")}: {periodLabel}</CardTitle>
          <div className="flex gap-4 items-center">
            <StatusBadge status={run.status} />
            <span>{t("totalAmount")}: {formatIDR(run.totalAmount)}</span>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payroll lines</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("employee")}</TableHead>
                <TableHead className="text-right">{t("basicSalary")}</TableHead>
                <TableHead className="text-right">{t("allowances")}</TableHead>
                <TableHead className="text-right">{t("deductions")}</TableHead>
                <TableHead className="text-right">{t("bpjsKesehatan")}</TableHead>
                <TableHead className="text-right">{t("bpjsKetenagakerjaan")}</TableHead>
                <TableHead className="text-right">{t("pph21")}</TableHead>
                <TableHead className="text-right">{t("absentDeduction")}</TableHead>
                <TableHead className="text-right">{t("netPay")}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(run.lines ?? []).map((line) => (
                <TableRow key={line.id}>
                  <TableCell className="font-medium">{line.employee?.name ?? "—"}</TableCell>
                  <TableCell className="text-right">{formatIDR(line.basicSalary)}</TableCell>
                  <TableCell className="text-right">{formatIDR(line.allowances)}</TableCell>
                  <TableCell className="text-right">{formatIDR(line.deductions)}</TableCell>
                  <TableCell className="text-right">{formatIDR(line.bpjsKesehatan)}</TableCell>
                  <TableCell className="text-right">{formatIDR(line.bpjsKetenagakerjaan)}</TableCell>
                  <TableCell className="text-right">{formatIDR(line.pph21)}</TableCell>
                  <TableCell className="text-right">{formatIDR(line.absentDeduction)}</TableCell>
                  <TableCell className="text-right font-medium">{formatIDR(line.netPay)}</TableCell>
                  <TableCell className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/hr/payroll/${id}/print/${line.id}`} target="_blank" rel="noopener noreferrer" title={t("payslip")}>
                        <Printer className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!!downloadingLineId}
                      onClick={() => handleDownloadPayslip(line.id)}
                    >
                      {downloadingLineId === line.id ? tc("loading") : <Download className="h-4 w-4" />}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirm")}</AlertDialogTitle>
            <AlertDialogDescription>{t("confirmMessage")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actioning}>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={actioning}>{actioning ? tc("loading") : tc("confirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={payOpen} onOpenChange={setPayOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("markAsPaid")}</AlertDialogTitle>
            <AlertDialogDescription>{t("payMessage")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actioning}>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handlePay} disabled={actioning}>{actioning ? tc("loading") : t("markAsPaid")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
