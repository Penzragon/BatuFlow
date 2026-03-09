import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuditService } from "./audit.service";
import type { PaginatedResponse, PaginationParams } from "@/types";
import type { ReceiptCategory } from "@prisma/client";

export const createReceiptCategorySchema = z.object({
  name: z.string().min(1).max(100),
  coaAccountId: z.string().uuid().optional().nullable(),
});

export const updateReceiptCategorySchema = createReceiptCategorySchema.partial();

export class ReceiptCategoryService {
  static async listCategories(
    params: PaginationParams
  ): Promise<PaginatedResponse<ReceiptCategory>> {
    const { page, pageSize, search } = params;

    const where: Record<string, unknown> = { isActive: true };
    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }

    const [items, total] = await Promise.all([
      prisma.receiptCategory.findMany({
        where,
        include: {
          coaAccount: { select: { id: true, code: true, name: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { name: "asc" },
      }),
      prisma.receiptCategory.count({ where }),
    ]);

    return {
      items: items as unknown as ReceiptCategory[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  static async getAllCategories(): Promise<ReceiptCategory[]> {
    return prisma.receiptCategory.findMany({
      where: { isActive: true },
      include: {
        coaAccount: { select: { id: true, code: true, name: true } },
      },
      orderBy: { name: "asc" },
    });
  }

  static async createCategory(
    data: z.infer<typeof createReceiptCategorySchema>,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<ReceiptCategory> {
    const parsed = createReceiptCategorySchema.parse(data);

    const category = await prisma.receiptCategory.create({
      data: {
        name: parsed.name,
        coaAccountId: parsed.coaAccountId ?? null,
      },
    });

    await AuditService.logCreate({
      userId,
      userRole,
      ipAddress,
      entityType: "ReceiptCategory",
      entityId: category.id,
      entityLabel: category.name,
      data: { name: category.name },
    });

    return category;
  }

  static async updateCategory(
    id: string,
    data: z.infer<typeof updateReceiptCategorySchema>,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<ReceiptCategory> {
    const parsed = updateReceiptCategorySchema.parse(data);
    const existing = await prisma.receiptCategory.findUnique({ where: { id } });
    if (!existing) throw new Error("Receipt category not found");

    const oldData = { name: existing.name, coaAccountId: existing.coaAccountId };

    const updated = await prisma.receiptCategory.update({
      where: { id },
      data: {
        ...(parsed.name !== undefined && { name: parsed.name }),
        ...(parsed.coaAccountId !== undefined && {
          coaAccountId: parsed.coaAccountId ?? null,
        }),
      },
    });

    await AuditService.logUpdate({
      userId,
      userRole,
      ipAddress,
      entityType: "ReceiptCategory",
      entityId: id,
      entityLabel: updated.name,
      oldData,
      newData: { name: updated.name, coaAccountId: updated.coaAccountId },
    });

    return updated;
  }

  static async deleteCategory(
    id: string,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<void> {
    const category = await prisma.receiptCategory.findUnique({
      where: { id },
      include: { _count: { select: { receipts: true } } },
    });
    if (!category) throw new Error("Receipt category not found");
    if (category._count.receipts > 0) {
      throw new Error("Cannot delete category with existing receipts");
    }

    await prisma.receiptCategory.update({
      where: { id },
      data: { isActive: false },
    });

    await AuditService.logDelete({
      userId,
      userRole,
      ipAddress,
      entityType: "ReceiptCategory",
      entityId: id,
      entityLabel: category.name,
      data: { name: category.name },
    });
  }
}
