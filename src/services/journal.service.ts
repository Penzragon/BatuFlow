import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuditService } from "./audit.service";
import type { PaginatedResponse, PaginationParams } from "@/types";
import type { JournalEntry } from "@prisma/client";

const journalLineSchema = z.object({
  accountId: z.string().uuid(),
  debit: z.number().min(0).default(0),
  credit: z.number().min(0).default(0),
  description: z.string().optional(),
});

export const createJournalEntrySchema = z.object({
  entryDate: z.string(),
  description: z.string().min(1),
  referenceType: z.string().optional(),
  referenceId: z.string().optional(),
  lines: z.array(journalLineSchema).min(2),
});

interface JournalListParams extends PaginationParams {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  referenceType?: string;
}

interface GLDetailParams {
  accountId: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  pageSize: number;
}

export class JournalService {
  static async generateEntryNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `JE-${year}-`;
    const last = await prisma.journalEntry.findFirst({
      where: { entryNumber: { startsWith: prefix } },
      orderBy: { entryNumber: "desc" },
      select: { entryNumber: true },
    });
    const seq = last ? parseInt(last.entryNumber.slice(prefix.length), 10) + 1 : 1;
    return `${prefix}${String(seq).padStart(5, "0")}`;
  }

  static async createJournalEntry(
    data: z.infer<typeof createJournalEntrySchema>,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<JournalEntry> {
    const parsed = createJournalEntrySchema.parse(data);

    const totalDebit = parsed.lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = parsed.lines.reduce((sum, l) => sum + l.credit, 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(`Journal entry must balance. Debit: ${totalDebit}, Credit: ${totalCredit}`);
    }

    for (const line of parsed.lines) {
      if (line.debit === 0 && line.credit === 0) {
        throw new Error("Each line must have either a debit or credit amount");
      }
      if (line.debit > 0 && line.credit > 0) {
        throw new Error("A line cannot have both debit and credit");
      }
    }

    const entryNumber = await JournalService.generateEntryNumber();

    const entry = await prisma.journalEntry.create({
      data: {
        entryNumber,
        entryDate: new Date(parsed.entryDate),
        description: parsed.description,
        referenceType: parsed.referenceType ?? null,
        referenceId: parsed.referenceId ?? null,
        status: "DRAFT",
        totalDebit,
        totalCredit,
        createdBy: userId,
        lines: {
          create: parsed.lines.map((l) => ({
            accountId: l.accountId,
            debit: l.debit,
            credit: l.credit,
            description: l.description ?? null,
          })),
        },
      },
      include: { lines: true },
    });

    await AuditService.logCreate({
      userId, userRole, ipAddress,
      entityType: "JournalEntry", entityId: entry.id, entityLabel: entryNumber,
      data: { entryNumber, description: parsed.description, totalDebit, totalCredit },
    });

    return entry;
  }

  static async postJournalEntry(
    id: string,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<JournalEntry> {
    const entry = await prisma.journalEntry.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!entry) throw new Error("Journal entry not found");
    if (entry.status === "POSTED") throw new Error("Journal entry is already posted");

    const period = await prisma.fiscalPeriod.findFirst({
      where: {
        year: entry.entryDate.getFullYear(),
        month: entry.entryDate.getMonth() + 1,
        status: "CLOSED",
      },
    });
    if (period) throw new Error("Cannot post to a closed fiscal period");

    const updated = await prisma.journalEntry.update({
      where: { id },
      data: { status: "POSTED", postedBy: userId, postedAt: new Date() },
      include: { lines: true },
    });

    await AuditService.logUpdate({
      userId, userRole, ipAddress,
      entityType: "JournalEntry", entityId: id, entityLabel: entry.entryNumber,
      oldData: { status: "DRAFT" },
      newData: { status: "POSTED" },
    });

    return updated;
  }

  /**
   * Creates and immediately posts a journal entry from a business event.
   * Used by auto-posting integrations (invoice, payment, expense, goods receipt).
   */
  static async autoPost(params: {
    entryDate: Date;
    description: string;
    referenceType: string;
    referenceId: string;
    lines: { accountId: string; debit: number; credit: number; description?: string }[];
    userId: string;
    userRole: string;
    ipAddress?: string;
  }): Promise<JournalEntry> {
    const { entryDate, description, referenceType, referenceId, lines, userId, userRole, ipAddress } = params;

    const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(`Auto-post journal must balance. Debit: ${totalDebit}, Credit: ${totalCredit}`);
    }

    const entryNumber = await JournalService.generateEntryNumber();

    const entry = await prisma.journalEntry.create({
      data: {
        entryNumber,
        entryDate,
        description,
        referenceType,
        referenceId,
        status: "POSTED",
        totalDebit,
        totalCredit,
        createdBy: userId,
        postedBy: userId,
        postedAt: new Date(),
        lines: {
          create: lines.map((l) => ({
            accountId: l.accountId,
            debit: l.debit,
            credit: l.credit,
            description: l.description ?? null,
          })),
        },
      },
      include: { lines: true },
    });

    await AuditService.logCreate({
      userId, userRole, ipAddress,
      entityType: "JournalEntry", entityId: entry.id, entityLabel: entryNumber,
      data: { entryNumber, description, referenceType, referenceId, totalDebit, totalCredit, autoPosted: true },
    });

    return entry;
  }

  static async autoPostFromInvoice(
    invoiceId: string,
    invoiceNumber: string,
    grandTotal: number,
    ppnAmount: number,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<JournalEntry | null> {
    const arAccount = await prisma.account.findFirst({ where: { code: "1200", deletedAt: null } });
    const revenueAccount = await prisma.account.findFirst({ where: { code: "4100", deletedAt: null } });
    const ppnOutputAccount = await prisma.account.findFirst({ where: { code: "2300", deletedAt: null } });

    if (!arAccount || !revenueAccount) return null;

    const lines: { accountId: string; debit: number; credit: number; description?: string }[] = [
      { accountId: arAccount.id, debit: grandTotal, credit: 0, description: "Accounts Receivable" },
      { accountId: revenueAccount.id, debit: 0, credit: grandTotal - ppnAmount, description: "Sales Revenue" },
    ];

    if (ppnAmount > 0 && ppnOutputAccount) {
      lines.push({ accountId: ppnOutputAccount.id, debit: 0, credit: ppnAmount, description: "PPN Output" });
    }

    return JournalService.autoPost({
      entryDate: new Date(),
      description: `AR Invoice issued: ${invoiceNumber}`,
      referenceType: "ArInvoice",
      referenceId: invoiceId,
      lines,
      userId, userRole, ipAddress,
    });
  }

  static async autoPostFromPayment(
    paymentId: string,
    invoiceNumber: string,
    amount: number,
    paymentMethod: string,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<JournalEntry | null> {
    const cashAccount = await prisma.account.findFirst({ where: { code: "1100", deletedAt: null } });
    const arAccount = await prisma.account.findFirst({ where: { code: "1200", deletedAt: null } });

    if (!cashAccount || !arAccount) return null;

    return JournalService.autoPost({
      entryDate: new Date(),
      description: `Payment received for ${invoiceNumber} (${paymentMethod})`,
      referenceType: "Payment",
      referenceId: paymentId,
      lines: [
        { accountId: cashAccount.id, debit: amount, credit: 0, description: "Cash/Bank" },
        { accountId: arAccount.id, debit: 0, credit: amount, description: "Accounts Receivable" },
      ],
      userId, userRole, ipAddress,
    });
  }

  static async autoPostFromExpense(
    expenseId: string,
    expenseNumber: string,
    amount: number,
    coaAccountId: string | null,
    paymentMethod: string,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<JournalEntry | null> {
    const cashAccount = await prisma.account.findFirst({ where: { code: "1100", deletedAt: null } });
    const defaultExpenseAccount = await prisma.account.findFirst({ where: { code: "5100", deletedAt: null } });

    const expenseAccountId = coaAccountId || defaultExpenseAccount?.id;
    if (!cashAccount || !expenseAccountId) return null;

    return JournalService.autoPost({
      entryDate: new Date(),
      description: `Expense approved: ${expenseNumber} (${paymentMethod})`,
      referenceType: "Expense",
      referenceId: expenseId,
      lines: [
        { accountId: expenseAccountId, debit: amount, credit: 0, description: "Expense" },
        { accountId: cashAccount.id, debit: 0, credit: amount, description: "Cash/Bank" },
      ],
      userId, userRole, ipAddress,
    });
  }

  static async autoPostFromGoodsReceipt(
    receiptId: string,
    receiptNumber: string,
    totalValue: number,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<JournalEntry | null> {
    const inventoryAccount = await prisma.account.findFirst({ where: { code: "1300", deletedAt: null } });
    const apAccount = await prisma.account.findFirst({ where: { code: "2100", deletedAt: null } });

    if (!inventoryAccount || !apAccount || totalValue <= 0) return null;

    return JournalService.autoPost({
      entryDate: new Date(),
      description: `Goods Receipt confirmed: ${receiptNumber}`,
      referenceType: "GoodsReceipt",
      referenceId: receiptId,
      lines: [
        { accountId: inventoryAccount.id, debit: totalValue, credit: 0, description: "Inventory" },
        { accountId: apAccount.id, debit: 0, credit: totalValue, description: "Accounts Payable" },
      ],
      userId, userRole, ipAddress,
    });
  }

  static async autoPostFromPayroll(
    payrollRunId: string,
    periodLabel: string,
    totalAmount: number,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<JournalEntry | null> {
    const salaryExpenseAccount = await prisma.account.findFirst({ where: { code: "6100", deletedAt: null } });
    const cashAccount = await prisma.account.findFirst({ where: { code: "1100", deletedAt: null } });

    if (!salaryExpenseAccount || !cashAccount || totalAmount <= 0) return null;

    return JournalService.autoPost({
      entryDate: new Date(),
      description: `Payroll: ${periodLabel}`,
      referenceType: "PayrollRun",
      referenceId: payrollRunId,
      lines: [
        { accountId: salaryExpenseAccount.id, debit: totalAmount, credit: 0, description: "Salary expense" },
        { accountId: cashAccount.id, debit: 0, credit: totalAmount, description: "Cash/Bank" },
      ],
      userId, userRole, ipAddress,
    });
  }

  static async getJournalEntry(id: string) {
    const entry = await prisma.journalEntry.findUnique({
      where: { id },
      include: {
        lines: {
          include: { account: { select: { id: true, code: true, name: true, type: true } } },
          orderBy: { debit: "desc" },
        },
        creator: { select: { id: true, name: true } },
        poster: { select: { id: true, name: true } },
      },
    });
    if (!entry) throw new Error("Journal entry not found");
    return entry;
  }

  static async listJournalEntries(
    params: JournalListParams
  ): Promise<PaginatedResponse<JournalEntry>> {
    const { page, pageSize, search, status, dateFrom, dateTo, referenceType } = params;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (referenceType) where.referenceType = referenceType;
    if (dateFrom || dateTo) {
      where.entryDate = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo + "T23:59:59Z") } : {}),
      };
    }
    if (search) {
      where.OR = [
        { entryNumber: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.journalEntry.findMany({
        where,
        include: {
          creator: { select: { id: true, name: true } },
          _count: { select: { lines: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { entryDate: "desc" },
      }),
      prisma.journalEntry.count({ where }),
    ]);

    return {
      items: items as unknown as JournalEntry[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  static async getGLDetail(params: GLDetailParams) {
    const { accountId, dateFrom, dateTo, page, pageSize } = params;

    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) throw new Error("Account not found");

    const where: Record<string, unknown> = {
      accountId,
      journalEntry: { status: "POSTED" },
    };

    if (dateFrom || dateTo) {
      where.journalEntry = {
        ...where.journalEntry as object,
        entryDate: {
          ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
          ...(dateTo ? { lte: new Date(dateTo + "T23:59:59Z") } : {}),
        },
      };
    }

    const [lines, total] = await Promise.all([
      prisma.journalLine.findMany({
        where,
        include: {
          journalEntry: {
            select: { id: true, entryNumber: true, entryDate: true, description: true, referenceType: true, referenceId: true },
          },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { journalEntry: { entryDate: "desc" } },
      }),
      prisma.journalLine.count({ where }),
    ]);

    const totals = await prisma.journalLine.aggregate({
      where,
      _sum: { debit: true, credit: true },
    });

    return {
      account: { id: account.id, code: account.code, name: account.name, type: account.type },
      lines,
      totalDebit: totals._sum.debit ?? 0,
      totalCredit: totals._sum.credit ?? 0,
      balance: (totals._sum.debit ?? 0) - (totals._sum.credit ?? 0),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
