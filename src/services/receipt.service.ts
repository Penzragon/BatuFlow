import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuditService } from "./audit.service";
import { JournalService } from "./journal.service";
import { createNotification } from "./notification.service";
import type { PaginatedResponse, PaginationParams } from "@/types";
import type { Receipt } from "@prisma/client";

export const createReceiptSchema = z.object({
  categoryId: z.string().uuid(),
  amount: z.number().min(0.01),
  description: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  receiptDate: z.string(),
  paymentMethod: z.enum(["CASH", "TRANSFER", "GIRO", "CHECK", "OTHER"]).default("CASH"),
  referenceNo: z.string().optional().nullable(),
});

export const updateReceiptSchema = createReceiptSchema.partial();

interface ReceiptListParams extends PaginationParams {
  status?: string;
  categoryId?: string;
  dateFrom?: string;
  dateTo?: string;
  submittedBy?: string;
}

export class ReceiptService {
  static async generateReceiptNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `RCPT-${year}-`;
    const last = await prisma.receipt.findFirst({
      where: { receiptNumber: { startsWith: prefix } },
      orderBy: { receiptNumber: "desc" },
      select: { receiptNumber: true },
    });
    const seq = last ? parseInt(last.receiptNumber.slice(prefix.length), 10) + 1 : 1;
    return `${prefix}${String(seq).padStart(5, "0")}`;
  }

  static async createReceipt(
    data: z.infer<typeof createReceiptSchema>,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<Receipt> {
    const parsed = createReceiptSchema.parse(data);

    const category = await prisma.expenseCategory.findUnique({ where: { id: parsed.categoryId } });
    if (!category) throw new Error("Receipt category not found");

    const receiptNumber = await ReceiptService.generateReceiptNumber();

    const receipt = await prisma.receipt.create({
      data: {
        receiptNumber,
        categoryId: parsed.categoryId,
        amount: parsed.amount,
        description: parsed.description ?? null,
        source: parsed.source ?? null,
        receiptDate: new Date(parsed.receiptDate),
        paymentMethod: parsed.paymentMethod,
        referenceNo: parsed.referenceNo != null && parsed.referenceNo !== "" ? parsed.referenceNo : null,
        status: "DRAFT",
        submittedBy: userId,
      },
    });

    await AuditService.logCreate({
      userId, userRole, ipAddress,
      entityType: "Receipt", entityId: receipt.id, entityLabel: receiptNumber,
      data: { receiptNumber, category: category.name, amount: parsed.amount, status: "DRAFT" },
    });

    return receipt;
  }

  static async updateReceipt(
    id: string,
    data: z.infer<typeof updateReceiptSchema>,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<Receipt> {
    const parsed = updateReceiptSchema.parse(data);
    const existing = await prisma.receipt.findUnique({ where: { id } });
    if (!existing) throw new Error("Receipt not found");
    if (existing.status !== "DRAFT") throw new Error("Only draft receipts can be updated");

    const updated = await prisma.receipt.update({
      where: { id },
      data: {
        ...(parsed.categoryId !== undefined && { categoryId: parsed.categoryId }),
        ...(parsed.amount !== undefined && { amount: parsed.amount }),
        ...(parsed.description !== undefined && { description: parsed.description ?? null }),
        ...(parsed.source !== undefined && { source: parsed.source ?? null }),
        ...(parsed.receiptDate !== undefined && { receiptDate: new Date(parsed.receiptDate) }),
        ...(parsed.paymentMethod !== undefined && { paymentMethod: parsed.paymentMethod }),
        ...(parsed.referenceNo !== undefined && { referenceNo: parsed.referenceNo ?? null }),
      },
    });

    await AuditService.logUpdate({
      userId, userRole, ipAddress,
      entityType: "Receipt", entityId: id, entityLabel: existing.receiptNumber,
      oldData: existing,
      newData: updated,
    });

    return updated;
  }

  static async submitReceipt(id: string, userId: string, userRole: string, ipAddress?: string): Promise<Receipt> {
    const receipt = await prisma.receipt.findUnique({ where: { id } });
    if (!receipt) throw new Error("Receipt not found");
    if (receipt.status !== "DRAFT") throw new Error("Only draft receipts can be submitted");

    const updated = await prisma.receipt.update({ where: { id }, data: { status: "SUBMITTED" } });

    const managers = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "MANAGER"] }, isActive: true, deletedAt: null },
      select: { id: true },
    });
    for (const mgr of managers) {
      await createNotification({
        userId: mgr.id,
        title: "Receipt Pending Approval",
        message: `Receipt ${receipt.receiptNumber} (Rp ${receipt.amount.toLocaleString()}) submitted for approval.`,
        entityType: "Receipt",
        entityId: receipt.id,
      });
    }

    await AuditService.logUpdate({
      userId, userRole, ipAddress,
      entityType: "Receipt", entityId: id, entityLabel: receipt.receiptNumber,
      oldData: { status: "DRAFT" },
      newData: { status: "SUBMITTED" },
    });

    return updated;
  }

  static async approveReceipt(id: string, userId: string, userRole: string, ipAddress?: string): Promise<Receipt> {
    const receipt = await prisma.receipt.findUnique({
      where: { id },
      include: { category: { include: { coaAccount: true } } },
    });
    if (!receipt) throw new Error("Receipt not found");
    if (receipt.status !== "SUBMITTED") throw new Error("Only submitted receipts can be approved");

    const journalEntry = await JournalService.autoPostFromReceipt(
      receipt.id,
      receipt.receiptNumber,
      receipt.amount,
      receipt.category.coaAccountId,
      receipt.paymentMethod,
      userId,
      userRole,
      ipAddress
    );

    const updated = await prisma.receipt.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedBy: userId,
        approvedAt: new Date(),
        journalEntryId: journalEntry?.id ?? null,
      },
    });

    await createNotification({
      userId: receipt.submittedBy,
      title: "Receipt Approved",
      message: `Your receipt ${receipt.receiptNumber} has been approved.`,
      entityType: "Receipt",
      entityId: receipt.id,
    });

    return updated;
  }

  static async rejectReceipt(id: string, reason: string, userId: string, userRole: string, ipAddress?: string): Promise<Receipt> {
    const receipt = await prisma.receipt.findUnique({ where: { id } });
    if (!receipt) throw new Error("Receipt not found");
    if (receipt.status !== "SUBMITTED") throw new Error("Only submitted receipts can be rejected");

    const updated = await prisma.receipt.update({
      where: { id },
      data: { status: "REJECTED", rejectionReason: reason, approvedBy: userId, approvedAt: new Date() },
    });

    await createNotification({
      userId: receipt.submittedBy,
      title: "Receipt Rejected",
      message: `Your receipt ${receipt.receiptNumber} was rejected: ${reason}`,
      entityType: "Receipt",
      entityId: receipt.id,
    });

    await AuditService.logUpdate({
      userId, userRole, ipAddress,
      entityType: "Receipt", entityId: id, entityLabel: receipt.receiptNumber,
      oldData: { status: "SUBMITTED" },
      newData: { status: "REJECTED", rejectionReason: reason },
    });

    return updated;
  }

  static async getReceipt(id: string) {
    const receipt = await prisma.receipt.findUnique({
      where: { id },
      include: {
        category: { include: { coaAccount: { select: { id: true, code: true, name: true } } } },
        submitter: { select: { id: true, name: true, email: true } },
        approver: { select: { id: true, name: true } },
        journalEntry: { select: { id: true, entryNumber: true } },
      },
    });
    if (!receipt) throw new Error("Receipt not found");
    return receipt;
  }

  static async listReceipts(params: ReceiptListParams): Promise<PaginatedResponse<Receipt>> {
    const { page, pageSize, search, status, categoryId, dateFrom, dateTo, submittedBy } = params;

    const where: Record<string, unknown> = { deletedAt: null };
    if (status) where.status = status;
    if (categoryId) where.categoryId = categoryId;
    if (submittedBy) where.submittedBy = submittedBy;
    if (dateFrom || dateTo) {
      where.receiptDate = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo + "T23:59:59Z") } : {}),
      };
    }
    if (search) {
      where.OR = [
        { receiptNumber: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { source: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.receipt.findMany({
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
      prisma.receipt.count({ where }),
    ]);

    return {
      items: items as unknown as Receipt[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
