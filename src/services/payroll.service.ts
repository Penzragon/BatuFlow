import { z } from "zod";
import { prisma } from "@/lib/db";
import { JournalService } from "./journal.service";
import type { PaginatedResponse, PaginationParams } from "@/types";
import type { PayrollRun, PayrollLine } from "@prisma/client";

const BPJS_KESEHATAN_RATE = 0.01; // 1% employee
const BPJS_KETENAGAKERJAAN_RATE = 0.02; // 2% employee
const PTKP_ANNUAL = 54_000_000; // Non-taxable income per year (simplified)
const PPH21_BRACKETS = [
  { limit: 60_000_000, rate: 0.05 },
  { limit: 250_000_000, rate: 0.15 },
  { limit: 500_000_000, rate: 0.25 },
  { limit: Infinity, rate: 0.3 },
] as const;

function workingDaysInMonth(month: number, year: number): number {
  let count = 0;
  const d = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  while (d <= last) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

function calculatePph21Monthly(annualTaxableIncome: number): number {
  if (annualTaxableIncome <= 0) return 0;
  let tax = 0;
  let remaining = annualTaxableIncome;
  let prevLimit = 0;
  for (const { limit, rate } of PPH21_BRACKETS) {
    const bracketSize = Math.min(remaining, limit - prevLimit);
    if (bracketSize <= 0) break;
    tax += bracketSize * rate;
    remaining -= bracketSize;
    prevLimit = limit;
    if (remaining <= 0) break;
  }
  return tax / 12;
}

export const createPayrollRunSchema = z.object({
  periodMonth: z.number().min(1).max(12),
  periodYear: z.number().int().min(2020),
});

interface PayrollListParams extends PaginationParams {
  status?: string;
}

export class PayrollService {
  static async createPayrollRun(
    data: z.infer<typeof createPayrollRunSchema>,
    userId: string
  ): Promise<PayrollRun> {
    const parsed = createPayrollRunSchema.parse(data);
    const { periodMonth, periodYear } = parsed;

    const existing = await prisma.payrollRun.findUnique({
      where: {
        periodMonth_periodYear: { periodMonth, periodYear },
      },
    });
    if (existing) throw new Error("Payroll run for this period already exists");

    const employees = await prisma.employee.findMany({
      where: { deletedAt: null, status: "ACTIVE" },
      orderBy: { name: "asc" },
    });

    const start = new Date(periodYear, periodMonth - 1, 1);
    const end = new Date(periodYear, periodMonth, 0);
    end.setHours(23, 59, 59, 999);
    const workingDays = workingDaysInMonth(periodMonth, periodYear);

    const attendanceByEmployee = await prisma.attendance.findMany({
      where: { date: { gte: start, lte: end } },
    });

    const lines: Array<{
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
    }> = [];

    for (const emp of employees) {
      const basic = emp.basicSalary;
      const allowances = emp.allowances;
      const deductions = emp.deductions;
      const grossMonthly = basic + allowances - deductions;

      const bpjsKesehatan = Math.round(basic * BPJS_KESEHATAN_RATE);
      const bpjsKetenagakerjaan = Math.round(basic * BPJS_KETENAGAKERJAAN_RATE);

      const records = attendanceByEmployee.filter((a) => a.employeeId === emp.id);
      const presentCount = records.filter((r) => r.status === "PRESENT" || r.status === "LATE").length;
      const halfDayCount = records.filter((r) => r.status === "HALF_DAY").length;
      const absentCount = workingDays - presentCount - halfDayCount * 0.5;
      const absentDays = Math.max(0, Math.min(workingDays, absentCount));
      const perDay = workingDays > 0 ? grossMonthly / workingDays : 0;
      const absentDeduction = Math.round(perDay * absentDays);

      const annualGross = grossMonthly * 12;
      const taxableAnnual = Math.max(0, annualGross - PTKP_ANNUAL);
      const pph21 = Math.round(calculatePph21Monthly(taxableAnnual));

      const netPay = Math.round(
        grossMonthly - absentDeduction - bpjsKesehatan - bpjsKetenagakerjaan - pph21
      );

      lines.push({
        employeeId: emp.id,
        basicSalary: basic,
        allowances,
        deductions,
        bpjsKesehatan,
        bpjsKetenagakerjaan,
        pph21,
        absentDeduction,
        netPay: Math.max(0, netPay),
        notes: absentDays > 0 ? `${absentDays} day(s) absent` : null,
      });
    }

    const totalAmount = lines.reduce((sum, l) => sum + l.netPay, 0);

    const run = await prisma.payrollRun.create({
      data: {
        periodMonth,
        periodYear,
        status: "DRAFT",
        totalAmount,
        createdBy: userId,
        lines: {
          create: lines.map((l) => ({
            employeeId: l.employeeId,
            basicSalary: l.basicSalary,
            allowances: l.allowances,
            deductions: l.deductions,
            bpjsKesehatan: l.bpjsKesehatan,
            bpjsKetenagakerjaan: l.bpjsKetenagakerjaan,
            pph21: l.pph21,
            absentDeduction: l.absentDeduction,
            netPay: l.netPay,
            notes: l.notes,
          })),
        },
      },
      include: { lines: true },
    });

    return run;
  }

  static async getPayrollRun(id: string) {
    const run = await prisma.payrollRun.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true } },
        journalEntry: { select: { id: true, entryNumber: true } },
        lines: {
          include: { employee: { select: { id: true, name: true, nik: true, department: true } } },
        },
      },
    });
    if (!run) throw new Error("Payroll run not found");
    return run;
  }

  static async listPayrollRuns(
    params: PayrollListParams
  ): Promise<PaginatedResponse<PayrollRun>> {
    const { page, pageSize, status } = params;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      prisma.payrollRun.findMany({
        where,
        include: { creator: { select: { name: true } } },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
      }),
      prisma.payrollRun.count({ where }),
    ]);

    return {
      items: items as unknown as PayrollRun[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  static async confirmPayrollRun(id: string): Promise<PayrollRun> {
    const run = await prisma.payrollRun.findUnique({ where: { id } });
    if (!run) throw new Error("Payroll run not found");
    if (run.status !== "DRAFT") throw new Error("Only draft payroll can be confirmed");

    return prisma.payrollRun.update({
      where: { id },
      data: { status: "CONFIRMED" },
    });
  }

  static async markAsPaid(
    id: string,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<PayrollRun> {
    const run = await prisma.payrollRun.findUnique({ where: { id } });
    if (!run) throw new Error("Payroll run not found");
    if (run.status !== "CONFIRMED") throw new Error("Only confirmed payroll can be marked as paid");
    if (run.journalEntryId) throw new Error("Payroll already paid and posted");

    const periodLabel = `${run.periodYear}-${String(run.periodMonth).padStart(2, "0")}`;
    const journalEntry = await JournalService.autoPostFromPayroll(
      id,
      periodLabel,
      run.totalAmount,
      userId,
      userRole,
      ipAddress
    );

    const updated = await prisma.payrollRun.update({
      where: { id },
      data: {
        status: "PAID",
        journalEntryId: journalEntry?.id ?? null,
        processedAt: new Date(),
      },
    });

    return updated;
  }

  static async generatePayslip(payrollRunId: string, lineId: string): Promise<{
    run: PayrollRun & { periodMonth: number; periodYear: number };
    line: PayrollLine & { employee: { name: string; nik: string | null; department: string | null; bankAccount: string | null; bankName: string | null } };
  }> {
    const run = await prisma.payrollRun.findUnique({
      where: { id: payrollRunId },
    });
    if (!run) throw new Error("Payroll run not found");

    const line = await prisma.payrollLine.findFirst({
      where: { id: lineId, payrollRunId },
      include: {
        employee: {
          select: { name: true, nik: true, department: true, bankAccount: true, bankName: true },
        },
      },
    });
    if (!line) throw new Error("Payslip line not found");

    return {
      run: run as PayrollRun & { periodMonth: number; periodYear: number },
      line: line as PayrollLine & {
        employee: { name: string; nik: string | null; department: string | null; bankAccount: string | null; bankName: string | null };
      },
    };
  }
}
