import { prisma } from "@/lib/db";

interface CashflowReportParams {
  dateFrom?: string;
  dateTo?: string;
  expenseCategoryId?: string;
  receiptCategoryId?: string;
  submittedBy?: string;
}

export class CashflowService {
  static async getCashflowReport(params: CashflowReportParams) {
    const expenseWhere: Record<string, unknown> = { deletedAt: null, status: "APPROVED" };
    const receiptWhere: Record<string, unknown> = { deletedAt: null, status: "APPROVED" };

    if (params.expenseCategoryId) expenseWhere.categoryId = params.expenseCategoryId;
    if (params.receiptCategoryId) receiptWhere.categoryId = params.receiptCategoryId;
    if (params.submittedBy) {
      expenseWhere.submittedBy = params.submittedBy;
      receiptWhere.submittedBy = params.submittedBy;
    }
    if (params.dateFrom || params.dateTo) {
      expenseWhere.expenseDate = {
        ...(params.dateFrom ? { gte: new Date(params.dateFrom) } : {}),
        ...(params.dateTo ? { lte: new Date(params.dateTo + "T23:59:59Z") } : {}),
      };
      receiptWhere.receiptDate = {
        ...(params.dateFrom ? { gte: new Date(params.dateFrom) } : {}),
        ...(params.dateTo ? { lte: new Date(params.dateTo + "T23:59:59Z") } : {}),
      };
    }

    const [expenses, receipts] = await Promise.all([
      prisma.expense.findMany({
        where: expenseWhere,
        include: {
          category: { select: { id: true, name: true } },
          submitter: { select: { id: true, name: true } },
        },
        orderBy: { expenseDate: "desc" },
      }),
      prisma.receipt.findMany({
        where: receiptWhere,
        include: {
          category: { select: { id: true, name: true } },
          submitter: { select: { id: true, name: true } },
        },
        orderBy: { receiptDate: "desc" },
      }),
    ]);

    const byCategory: Record<string, { name: string; type: "EXPENSE" | "RECEIPT"; total: number; count: number }> = {};
    const byUser: Record<string, { name: string; totalExpense: number; totalReceipt: number; netCashflow: number; count: number }> = {};

    let totalExpense = 0;
    for (const exp of expenses) {
      totalExpense += exp.amount;
      const catKey = `EXPENSE:${exp.categoryId}`;
      if (!byCategory[catKey]) {
        byCategory[catKey] = { name: exp.category.name, type: "EXPENSE", total: 0, count: 0 };
      }
      byCategory[catKey].total += exp.amount;
      byCategory[catKey].count += 1;

      if (!byUser[exp.submittedBy]) {
        byUser[exp.submittedBy] = { name: exp.submitter.name, totalExpense: 0, totalReceipt: 0, netCashflow: 0, count: 0 };
      }
      byUser[exp.submittedBy].totalExpense += exp.amount;
      byUser[exp.submittedBy].count += 1;
    }

    let totalReceipt = 0;
    for (const rec of receipts) {
      totalReceipt += rec.amount;
      const catKey = `RECEIPT:${rec.categoryId}`;
      if (!byCategory[catKey]) {
        byCategory[catKey] = { name: rec.category.name, type: "RECEIPT", total: 0, count: 0 };
      }
      byCategory[catKey].total += rec.amount;
      byCategory[catKey].count += 1;

      if (!byUser[rec.submittedBy]) {
        byUser[rec.submittedBy] = { name: rec.submitter.name, totalExpense: 0, totalReceipt: 0, netCashflow: 0, count: 0 };
      }
      byUser[rec.submittedBy].totalReceipt += rec.amount;
      byUser[rec.submittedBy].count += 1;
    }

    for (const key of Object.keys(byUser)) {
      byUser[key].netCashflow = byUser[key].totalReceipt - byUser[key].totalExpense;
    }

    return {
      expenses,
      receipts,
      summary: {
        totalExpense,
        totalReceipt,
        netCashflow: totalReceipt - totalExpense,
        byCategory: Object.values(byCategory).sort((a, b) => b.total - a.total),
        byUser: Object.values(byUser).sort((a, b) => Math.abs(b.netCashflow) - Math.abs(a.netCashflow)),
      },
    };
  }
}
