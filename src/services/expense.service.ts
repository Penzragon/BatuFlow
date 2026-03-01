import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuditService } from "./audit.service";
import { JournalService } from "./journal.service";
import { createNotification } from "./notification.service";
import type { PaginatedResponse, PaginationParams } from "@/types";
import type { Expense } from "@prisma/client";

export const createExpenseSchema = z.object({
  categoryId: z.string().uuid(),
  amount: z.number().min(0.01),
  description: z.string().optional().nullable(),
  expenseDate: z.string(),
  paymentMethod: z.enum(["CASH", "TRANSFER", "GIRO", "CHECK", "OTHER"]).default("CASH"),
  referenceNo: z.string().optional().nullable(),
});

export const updateExpenseSchema = createExpenseSchema.partial();

interface ExpenseListParams extends PaginationParams {
  status?: string;
  categoryId?: string;
  dateFrom?: string;
  dateTo?: string;
  submittedBy?: string;
}

export class ExpenseService {
  static async generateExpenseNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `EXP-${year}-`;
    const last = await prisma.expense.findFirst({
      where: { expenseNumber: { startsWith: prefix } },
      orderBy: { expenseNumber: "desc" },
      select: { expenseNumber: true },
    });
    const seq = last ? parseInt(last.expenseNumber.slice(prefix.length), 10) + 1 : 1;
    return `${prefix}${String(seq).padStart(5, "0")}`;
  }

  static async createExpense(
    data: z.infer<typeof createExpenseSchema>,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<Expense> {
    const parsed = createExpenseSchema.parse(data);

    const category = await prisma.expenseCategory.findUnique({ where: { id: parsed.categoryId } });
    if (!category) throw new Error("Expense category not found");

    const expenseNumber = await ExpenseService.generateExpenseNumber();

    const expense = await prisma.expense.create({
      data: {
        expenseNumber,
        categoryId: parsed.categoryId,
        amount: parsed.amount,
        description: parsed.description ?? null,
        expenseDate: new Date(parsed.expenseDate),
        paymentMethod: parsed.paymentMethod,
        referenceNo: parsed.referenceNo != null && parsed.referenceNo !== "" ? parsed.referenceNo : null,
        status: "DRAFT",
        submittedBy: userId,
      },
    });

    await AuditService.logCreate({
      userId, userRole, ipAddress,
      entityType: "Expense", entityId: expense.id, entityLabel: expenseNumber,
      data: { expenseNumber, category: category.name, amount: parsed.amount, status: "DRAFT" },
    });

    return expense;
  }

  static async updateExpense(
    id: string,
    data: z.infer<typeof updateExpenseSchema>,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<Expense> {
    const parsed = updateExpenseSchema.parse(data);
    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing) throw new Error("Expense not found");
    if (existing.status !== "DRAFT") throw new Error("Only draft expenses can be updated");

    const oldData = {
      categoryId: existing.categoryId,
      amount: existing.amount,
      description: existing.description,
      expenseDate: existing.expenseDate.toISOString(),
      paymentMethod: existing.paymentMethod,
      referenceNo: existing.referenceNo,
    };

    const updated = await prisma.expense.update({
      where: { id },
      data: {
        ...(parsed.categoryId !== undefined && { categoryId: parsed.categoryId }),
        ...(parsed.amount !== undefined && { amount: parsed.amount }),
        ...(parsed.description !== undefined && { description: parsed.description ?? null }),
        ...(parsed.expenseDate !== undefined && { expenseDate: new Date(parsed.expenseDate) }),
        ...(parsed.paymentMethod !== undefined && { paymentMethod: parsed.paymentMethod }),
        ...(parsed.referenceNo !== undefined && { referenceNo: parsed.referenceNo ?? null }),
      },
    });

    await AuditService.logUpdate({
      userId, userRole, ipAddress,
      entityType: "Expense", entityId: id, entityLabel: existing.expenseNumber,
      oldData,
      newData: {
        categoryId: updated.categoryId,
        amount: updated.amount,
        description: updated.description,
        expenseDate: updated.expenseDate.toISOString(),
        paymentMethod: updated.paymentMethod,
        referenceNo: updated.referenceNo,
      },
    });

    return updated;
  }

  static async submitExpense(
    id: string,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<Expense> {
    const expense = await prisma.expense.findUnique({ where: { id } });
    if (!expense) throw new Error("Expense not found");
    if (expense.status !== "DRAFT") throw new Error("Only draft expenses can be submitted");

    const updated = await prisma.expense.update({
      where: { id },
      data: { status: "SUBMITTED" },
    });

    const managers = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "MANAGER"] }, isActive: true, deletedAt: null },
      select: { id: true },
    });
    for (const mgr of managers) {
      await createNotification({
        userId: mgr.id,
        title: "Expense Pending Approval",
        message: `Expense ${expense.expenseNumber} (Rp ${expense.amount.toLocaleString()}) submitted for approval.`,
        entityType: "Expense",
        entityId: expense.id,
      });
    }

    await AuditService.logUpdate({
      userId, userRole, ipAddress,
      entityType: "Expense", entityId: id, entityLabel: expense.expenseNumber,
      oldData: { status: "DRAFT" },
      newData: { status: "SUBMITTED" },
    });

    return updated;
  }

  static async approveExpense(
    id: string,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<Expense> {
    const expense = await prisma.expense.findUnique({
      where: { id },
      include: { category: { include: { coaAccount: true } } },
    });
    if (!expense) throw new Error("Expense not found");
    if (expense.status !== "SUBMITTED") throw new Error("Only submitted expenses can be approved");

    const journalEntry = await JournalService.autoPostFromExpense(
      expense.id,
      expense.expenseNumber,
      expense.amount,
      expense.category.coaAccountId,
      expense.paymentMethod,
      userId,
      userRole,
      ipAddress
    );

    const updated = await prisma.expense.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedBy: userId,
        approvedAt: new Date(),
        journalEntryId: journalEntry?.id ?? null,
      },
    });

    await createNotification({
      userId: expense.submittedBy,
      title: "Expense Approved",
      message: `Your expense ${expense.expenseNumber} has been approved.`,
      entityType: "Expense",
      entityId: expense.id,
    });

    await AuditService.logUpdate({
      userId, userRole, ipAddress,
      entityType: "Expense", entityId: id, entityLabel: expense.expenseNumber,
      oldData: { status: "SUBMITTED" },
      newData: { status: "APPROVED", approvedBy: userId },
    });

    return updated;
  }

  static async rejectExpense(
    id: string,
    reason: string,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<Expense> {
    const expense = await prisma.expense.findUnique({ where: { id } });
    if (!expense) throw new Error("Expense not found");
    if (expense.status !== "SUBMITTED") throw new Error("Only submitted expenses can be rejected");

    const updated = await prisma.expense.update({
      where: { id },
      data: { status: "REJECTED", rejectionReason: reason, approvedBy: userId, approvedAt: new Date() },
    });

    await createNotification({
      userId: expense.submittedBy,
      title: "Expense Rejected",
      message: `Your expense ${expense.expenseNumber} was rejected: ${reason}`,
      entityType: "Expense",
      entityId: expense.id,
    });

    await AuditService.logUpdate({
      userId, userRole, ipAddress,
      entityType: "Expense", entityId: id, entityLabel: expense.expenseNumber,
      oldData: { status: "SUBMITTED" },
      newData: { status: "REJECTED", rejectionReason: reason },
    });

    return updated;
  }

  static async getExpense(id: string) {
    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        category: { include: { coaAccount: { select: { id: true, code: true, name: true } } } },
        submitter: { select: { id: true, name: true, email: true } },
        approver: { select: { id: true, name: true } },
        journalEntry: { select: { id: true, entryNumber: true } },
      },
    });
    if (!expense) throw new Error("Expense not found");
    return expense;
  }

  static async listExpenses(
    params: ExpenseListParams
  ): Promise<PaginatedResponse<Expense>> {
    const { page, pageSize, search, status, categoryId, dateFrom, dateTo, submittedBy } = params;

    const where: Record<string, unknown> = { deletedAt: null };
    if (status) where.status = status;
    if (categoryId) where.categoryId = categoryId;
    if (submittedBy) where.submittedBy = submittedBy;
    if (dateFrom || dateTo) {
      where.expenseDate = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo + "T23:59:59Z") } : {}),
      };
    }
    if (search) {
      where.OR = [
        { expenseNumber: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          submitter: { select: { id: true, name: true } },
          approver: { select: { id: true, name: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.expense.count({ where }),
    ]);

    return {
      items: items as unknown as Expense[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  static async getExpenseReport(params: {
    dateFrom?: string;
    dateTo?: string;
    categoryId?: string;
    submittedBy?: string;
  }) {
    const where: Record<string, unknown> = { deletedAt: null, status: "APPROVED" };
    if (params.categoryId) where.categoryId = params.categoryId;
    if (params.submittedBy) where.submittedBy = params.submittedBy;
    if (params.dateFrom || params.dateTo) {
      where.expenseDate = {
        ...(params.dateFrom ? { gte: new Date(params.dateFrom) } : {}),
        ...(params.dateTo ? { lte: new Date(params.dateTo + "T23:59:59Z") } : {}),
      };
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        submitter: { select: { id: true, name: true } },
      },
      orderBy: { expenseDate: "desc" },
    });

    const byCategory: Record<string, { name: string; total: number; count: number }> = {};
    const byUser: Record<string, { name: string; total: number; count: number }> = {};
    let grandTotal = 0;

    for (const exp of expenses) {
      grandTotal += exp.amount;

      const catKey = exp.categoryId;
      if (!byCategory[catKey]) {
        byCategory[catKey] = { name: (exp as unknown as { category: { name: string } }).category.name, total: 0, count: 0 };
      }
      byCategory[catKey].total += exp.amount;
      byCategory[catKey].count++;

      const userKey = exp.submittedBy;
      if (!byUser[userKey]) {
        byUser[userKey] = { name: (exp as unknown as { submitter: { name: string } }).submitter.name, total: 0, count: 0 };
      }
      byUser[userKey].total += exp.amount;
      byUser[userKey].count++;
    }

    return {
      expenses,
      summary: {
        grandTotal,
        count: expenses.length,
        byCategory: Object.values(byCategory).sort((a, b) => b.total - a.total),
        byUser: Object.values(byUser).sort((a, b) => b.total - a.total),
      },
    };
  }
}
