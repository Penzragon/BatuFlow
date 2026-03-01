import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuditService } from "./audit.service";
import type { PaginatedResponse, PaginationParams } from "@/types";
import type { Account } from "@prisma/client";

export const createAccountSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  type: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "COGS", "EXPENSE"]),
  parentId: z.string().uuid().optional().nullable(),
});

export const updateAccountSchema = createAccountSchema.partial();

interface AccountTreeNode {
  id: string;
  code: string;
  name: string;
  type: string;
  parentId: string | null;
  isActive: boolean;
  children: AccountTreeNode[];
}

export class AccountService {
  static async listAccounts(
    params: PaginationParams & { type?: string }
  ): Promise<PaginatedResponse<Account>> {
    const { page, pageSize, search, type } = params;

    const where: Record<string, unknown> = { deletedAt: null };
    if (type) where.type = type;
    if (search) {
      where.OR = [
        { code: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.account.findMany({
        where,
        include: {
          parent: { select: { id: true, code: true, name: true } },
          _count: { select: { children: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { code: "asc" },
      }),
      prisma.account.count({ where }),
    ]);

    return {
      items: items as unknown as Account[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  static async getAccount(id: string) {
    const account = await prisma.account.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, code: true, name: true } },
        children: { select: { id: true, code: true, name: true, type: true, isActive: true } },
        expenseCategories: { select: { id: true, name: true } },
      },
    });
    if (!account) throw new Error("Account not found");
    return account;
  }

  static async createAccount(
    data: z.infer<typeof createAccountSchema>,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<Account> {
    const parsed = createAccountSchema.parse(data);

    const existing = await prisma.account.findFirst({
      where: { code: parsed.code, deletedAt: null },
    });
    if (existing) throw new Error("Account code already exists");

    if (parsed.parentId) {
      const parent = await prisma.account.findUnique({ where: { id: parsed.parentId } });
      if (!parent) throw new Error("Parent account not found");
    }

    const account = await prisma.account.create({
      data: {
        code: parsed.code,
        name: parsed.name,
        type: parsed.type,
        parentId: parsed.parentId ?? null,
      },
    });

    await AuditService.logCreate({
      userId, userRole, ipAddress,
      entityType: "Account", entityId: account.id, entityLabel: `${account.code} - ${account.name}`,
      data: { code: account.code, name: account.name, type: account.type },
    });

    return account;
  }

  static async updateAccount(
    id: string,
    data: z.infer<typeof updateAccountSchema>,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<Account> {
    const parsed = updateAccountSchema.parse(data);
    const existing = await prisma.account.findUnique({ where: { id } });
    if (!existing) throw new Error("Account not found");

    if (parsed.code && parsed.code !== existing.code) {
      const dup = await prisma.account.findFirst({
        where: { code: parsed.code, deletedAt: null, id: { not: id } },
      });
      if (dup) throw new Error("Account code already exists");
    }

    const oldData = { code: existing.code, name: existing.name, type: existing.type, parentId: existing.parentId };

    const updated = await prisma.account.update({
      where: { id },
      data: {
        ...(parsed.code !== undefined && { code: parsed.code }),
        ...(parsed.name !== undefined && { name: parsed.name }),
        ...(parsed.type !== undefined && { type: parsed.type }),
        ...(parsed.parentId !== undefined && { parentId: parsed.parentId ?? null }),
      },
    });

    await AuditService.logUpdate({
      userId, userRole, ipAddress,
      entityType: "Account", entityId: id, entityLabel: `${updated.code} - ${updated.name}`,
      oldData,
      newData: { code: updated.code, name: updated.name, type: updated.type, parentId: updated.parentId },
    });

    return updated;
  }

  static async deleteAccount(
    id: string,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<void> {
    const account = await prisma.account.findUnique({
      where: { id },
      include: { _count: { select: { children: true, journalLines: true } } },
    });
    if (!account) throw new Error("Account not found");
    if (account._count.children > 0) throw new Error("Cannot delete account with child accounts");
    if (account._count.journalLines > 0) throw new Error("Cannot delete account with journal entries");

    await prisma.account.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await AuditService.logDelete({
      userId, userRole, ipAddress,
      entityType: "Account", entityId: id, entityLabel: `${account.code} - ${account.name}`,
      data: { code: account.code, name: account.name },
    });
  }

  static async getAccountTree(): Promise<AccountTreeNode[]> {
    const accounts = await prisma.account.findMany({
      where: { deletedAt: null },
      orderBy: { code: "asc" },
    });

    const map = new Map<string, AccountTreeNode>();
    const roots: AccountTreeNode[] = [];

    for (const a of accounts) {
      map.set(a.id, { id: a.id, code: a.code, name: a.name, type: a.type, parentId: a.parentId, isActive: a.isActive, children: [] });
    }

    for (const node of map.values()) {
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  static async findByCode(code: string): Promise<Account | null> {
    return prisma.account.findFirst({
      where: { code, deletedAt: null },
    });
  }
}
