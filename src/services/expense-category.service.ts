import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuditService } from "./audit.service";
import type { PaginatedResponse, PaginationParams } from "@/types";
import type { ExpenseCategory } from "@prisma/client";

export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  coaAccountId: z.string().uuid().optional().nullable(),
});

export const updateCategorySchema = createCategorySchema.partial();

export class ExpenseCategoryService {
  static async listCategories(
    params: PaginationParams
  ): Promise<PaginatedResponse<ExpenseCategory>> {
    const { page, pageSize, search } = params;

    const where: Record<string, unknown> = { isActive: true };
    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }

    const [items, total] = await Promise.all([
      prisma.expenseCategory.findMany({
        where,
        include: {
          coaAccount: { select: { id: true, code: true, name: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { name: "asc" },
      }),
      prisma.expenseCategory.count({ where }),
    ]);

    return {
      items: items as unknown as ExpenseCategory[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  static async getAllCategories(): Promise<ExpenseCategory[]> {
    return prisma.expenseCategory.findMany({
      where: { isActive: true },
      include: {
        coaAccount: { select: { id: true, code: true, name: true } },
      },
      orderBy: { name: "asc" },
    });
  }

  static async createCategory(
    data: z.infer<typeof createCategorySchema>,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<ExpenseCategory> {
    const parsed = createCategorySchema.parse(data);

    const category = await prisma.expenseCategory.create({
      data: {
        name: parsed.name,
        coaAccountId: parsed.coaAccountId ?? null,
      },
    });

    await AuditService.logCreate({
      userId, userRole, ipAddress,
      entityType: "ExpenseCategory", entityId: category.id, entityLabel: category.name,
      data: { name: category.name },
    });

    return category;
  }

  static async updateCategory(
    id: string,
    data: z.infer<typeof updateCategorySchema>,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<ExpenseCategory> {
    const parsed = updateCategorySchema.parse(data);
    const existing = await prisma.expenseCategory.findUnique({ where: { id } });
    if (!existing) throw new Error("Expense category not found");

    const oldData = { name: existing.name, coaAccountId: existing.coaAccountId };

    const updated = await prisma.expenseCategory.update({
      where: { id },
      data: {
        ...(parsed.name !== undefined && { name: parsed.name }),
        ...(parsed.coaAccountId !== undefined && { coaAccountId: parsed.coaAccountId ?? null }),
      },
    });

    await AuditService.logUpdate({
      userId, userRole, ipAddress,
      entityType: "ExpenseCategory", entityId: id, entityLabel: updated.name,
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
    const category = await prisma.expenseCategory.findUnique({
      where: { id },
      include: { _count: { select: { expenses: true } } },
    });
    if (!category) throw new Error("Expense category not found");
    if (category._count.expenses > 0) {
      throw new Error("Cannot delete category with existing expenses");
    }

    await prisma.expenseCategory.update({
      where: { id },
      data: { isActive: false },
    });

    await AuditService.logDelete({
      userId, userRole, ipAddress,
      entityType: "ExpenseCategory", entityId: id, entityLabel: category.name,
      data: { name: category.name },
    });
  }
}
