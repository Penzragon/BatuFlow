import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuditService } from "./audit.service";
import type { SalesTarget } from "@prisma/client";

export const upsertTargetSchema = z.object({
  salespersonId: z.string().uuid(),
  periodMonth: z.number().min(1).max(12),
  periodYear: z.number().min(2020).max(2100),
  targetAmount: z.number().min(0),
});

export const listTargetsSchema = z.object({
  salespersonId: z.string().uuid().optional(),
  periodYear: z.coerce.number().optional(),
});

export class SalesTargetService {
  static async listTargets(params: { salespersonId?: string; periodYear?: number }) {
    const where: { salespersonId?: string; periodYear?: number } = {};
    if (params.salespersonId) where.salespersonId = params.salespersonId;
    if (params.periodYear) where.periodYear = params.periodYear;

    const items = await prisma.salesTarget.findMany({
      where,
      include: {
        salesperson: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
    });
    return items;
  }

  static async getTarget(salespersonId: string, periodMonth: number, periodYear: number) {
    const target = await prisma.salesTarget.findUnique({
      where: {
        salespersonId_periodMonth_periodYear: { salespersonId, periodMonth, periodYear },
      },
      include: {
        salesperson: { select: { id: true, name: true } },
      },
    });
    return target;
  }

  static async upsertTarget(
    data: z.infer<typeof upsertTargetSchema>,
    userId: string,
    userRole: string,
    ipAddress?: string
  ): Promise<SalesTarget> {
    const parsed = upsertTargetSchema.parse(data);

    const existing = await prisma.salesTarget.findUnique({
      where: {
        salespersonId_periodMonth_periodYear: {
          salespersonId: parsed.salespersonId,
          periodMonth: parsed.periodMonth,
          periodYear: parsed.periodYear,
        },
      },
    });

    const target = await prisma.salesTarget.upsert({
      where: {
        salespersonId_periodMonth_periodYear: {
          salespersonId: parsed.salespersonId,
          periodMonth: parsed.periodMonth,
          periodYear: parsed.periodYear,
        },
      },
      create: {
        salespersonId: parsed.salespersonId,
        periodMonth: parsed.periodMonth,
        periodYear: parsed.periodYear,
        targetAmount: parsed.targetAmount,
      },
      update: { targetAmount: parsed.targetAmount },
    });

    if (existing) {
      await AuditService.logUpdate({
        userId,
        userRole,
        ipAddress,
        entityType: "SalesTarget",
        entityId: target.id,
        entityLabel: `${target.periodYear}-${String(target.periodMonth).padStart(2, "0")}`,
        oldData: { targetAmount: existing.targetAmount },
        newData: { targetAmount: target.targetAmount },
      });
    } else {
      await AuditService.logCreate({
        userId,
        userRole,
        ipAddress,
        entityType: "SalesTarget",
        entityId: target.id,
        entityLabel: `${target.periodYear}-${String(target.periodMonth).padStart(2, "0")}`,
        data: { salespersonId: target.salespersonId, targetAmount: target.targetAmount },
      });
    }

    return target;
  }

  /**
   * Get achievement summary: for each salesperson/target, actual sales (paid invoices from their SOs) vs target.
   */
  static async getAchievementSummary(periodYear?: number, periodMonth?: number) {
    const year = periodYear ?? new Date().getFullYear();
    const month = periodMonth ?? new Date().getMonth() + 1;

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    const targets = await prisma.salesTarget.findMany({
      where: { periodYear: year, periodMonth: month },
      include: {
        salesperson: { select: { id: true, name: true } },
      },
    });

    const salespersonIds = targets.map((t) => t.salespersonId);
    const invoices = await prisma.arInvoice.findMany({
      where: {
        status: "PAID",
        issuedAt: { gte: start, lte: end },
        deletedAt: null,
        deliveryOrder: {
          salesOrder: { createdBy: { in: salespersonIds } },
        },
      },
      select: {
        grandTotal: true,
        deliveryOrder: { select: { salesOrder: { select: { createdBy: true } } } },
      },
    });

    const actualByUser: Record<string, number> = {};
    for (const inv of invoices) {
      const createdBy = inv.deliveryOrder?.salesOrder?.createdBy;
      if (createdBy) {
        actualByUser[createdBy] = (actualByUser[createdBy] ?? 0) + inv.grandTotal;
      }
    }

    return targets.map((t) => ({
      targetId: t.id,
      salespersonId: t.salespersonId,
      salespersonName: t.salesperson.name,
      periodMonth: t.periodMonth,
      periodYear: t.periodYear,
      targetAmount: t.targetAmount,
      actualAmount: actualByUser[t.salespersonId] ?? 0,
      achievementPercent:
        t.targetAmount > 0
          ? Math.round(((actualByUser[t.salespersonId] ?? 0) / t.targetAmount) * 100)
          : 0,
    }));
  }
}
