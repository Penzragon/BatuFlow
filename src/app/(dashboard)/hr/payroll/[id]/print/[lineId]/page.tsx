import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { PayrollService } from "@/services/payroll.service";
import { PrintLayout } from "@/components/print/print-layout";

interface PageProps {
  params: Promise<{ id: string; lineId: string }>;
}

const formatIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

export default async function PayslipPrintPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) notFound();

  const { id, lineId } = await params;

  let result: Awaited<ReturnType<typeof PayrollService.generatePayslip>>;
  try {
    result = await PayrollService.generatePayslip(id, lineId);
  } catch {
    notFound();
  }

  const { run, line } = result;
  const periodLabel = `${run.periodYear}-${String(run.periodMonth).padStart(2, "0")}`;

  return (
    <PrintLayout
      companyName="BatuFlow"
      title={`Payslip — ${line.employee.name} (${periodLabel})`}
      footer="Confidential. For employee record."
    >
      <div className="space-y-4 max-w-md">
        <div className="text-sm">
          <p className="font-semibold text-lg">{line.employee.name}</p>
          <p className="text-gray-600">NIK: {line.employee.nik ?? "—"} | Dept: {line.employee.department ?? "—"}</p>
          <p className="text-gray-600">Period: {periodLabel}</p>
        </div>

        <table className="w-full border border-gray-200 text-sm">
          <tbody>
            <tr className="border-b border-gray-100"><td className="py-2 text-gray-600">Basic Salary</td><td className="py-2 text-right font-medium">{formatIDR(line.basicSalary)}</td></tr>
            <tr className="border-b border-gray-100"><td className="py-2 text-gray-600">Allowances</td><td className="py-2 text-right font-medium">{formatIDR(line.allowances)}</td></tr>
            <tr className="border-b border-gray-100"><td className="py-2 text-gray-600">Deductions</td><td className="py-2 text-right font-medium">{formatIDR(line.deductions)}</td></tr>
            <tr className="border-b border-gray-100"><td className="py-2 text-gray-600">BPJS Kesehatan</td><td className="py-2 text-right font-medium">{formatIDR(line.bpjsKesehatan)}</td></tr>
            <tr className="border-b border-gray-100"><td className="py-2 text-gray-600">BPJS Ketenagakerjaan</td><td className="py-2 text-right font-medium">{formatIDR(line.bpjsKetenagakerjaan)}</td></tr>
            <tr className="border-b border-gray-100"><td className="py-2 text-gray-600">PPh 21</td><td className="py-2 text-right font-medium">{formatIDR(line.pph21)}</td></tr>
            <tr className="border-b border-gray-100"><td className="py-2 text-gray-600">Absent Deduction</td><td className="py-2 text-right font-medium">{formatIDR(line.absentDeduction)}</td></tr>
          </tbody>
        </table>

        <div className="pt-2 border-t border-gray-200">
          <p className="text-lg font-semibold">Net Pay: {formatIDR(line.netPay)}</p>
          {line.employee.bankName && line.employee.bankAccount && (
            <p className="text-sm text-gray-600 mt-1">Bank: {line.employee.bankName} — {line.employee.bankAccount}</p>
          )}
        </div>
      </div>
    </PrintLayout>
  );
}
